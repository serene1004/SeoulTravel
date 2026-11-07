import { useEffect, useRef, useState } from 'react';

import { House } from 'lucide-react';
import {
  Map,
  NavigationControl,
  Popup,
  setWorkerUrl,
  type GeoJSONSource,
  type Map as MapLibreMap,
  type MapLayerMouseEvent,
} from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

import {
  loadLocalizedPlaceContents,
  type LocalizedPlaceContentMap,
} from '../data/publicAttractions';
import { getSpotCategoryLabel, type Locale, type Spot, type SpotCategory } from '../data/spots';
import { t } from '../i18n/messages';
import 'maplibre-gl/dist/maplibre-gl.css';

setWorkerUrl(maplibreWorkerUrl);

const mapStyleUrl = 'https://tiles.openfreemap.org/styles/bright';
const seoulCenter: [number, number] = [126.9785, 37.5665];

type ExploreMapProps = {
  spots: Spot[];
  locale: Locale;
  categoryColors: Record<SpotCategory, string>;
  centerLabel: string;
  mapErrorLabel: string;
  retryLabel: string;
  selectedSpotId: string | null;
  onSelectSpot: (id: string) => void;
  onSelectCluster: (places: ClusterPlace[]) => void;
};

export type ClusterPlace = { id: string; kind: 'spot'; coordinates: [number, number] };

function toMapPlaceFeatureCollection(spots: Spot[], categoryColors: Record<SpotCategory, string>) {
  return {
    type: 'FeatureCollection' as const,
    features: [
      ...spots.map((spot) => ({
        type: 'Feature' as const,
        properties: {
          id: spot.id,
          kind: 'spot',
          category: spot.category,
          color: categoryColors[spot.category],
          nameKo: spot.name.ko,
          nameEn: spot.name.en,
          nameJa: spot.name.ja,
        },
        geometry: { type: 'Point' as const, coordinates: spot.coordinates },
      })),
    ],
  };
}

function applyMapLabelLanguage(map: MapLibreMap, locale: Locale) {
  const fields =
    locale === 'ko' ? ['name:ko', 'name_ko', 'name'] : locale === 'ja' ? ['name:ja'] : ['name:en'];
  const textField = ['coalesce', ...fields.map((field) => ['get', field])];

  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== 'symbol') continue;
    const currentTextField = JSON.stringify(layer.layout?.['text-field'] ?? '');
    if (currentTextField.includes('name')) {
      map.setLayoutProperty(layer.id, 'text-field', textField as never);
    }
  }
}

function applyMapControlLanguage(map: MapLibreMap, locale: Locale) {
  map.getCanvasContainer().setAttribute('lang', locale);
  const controlLabels = [
    ['.maplibregl-ctrl-zoom-in', 'zoomIn'],
    ['.maplibregl-ctrl-zoom-out', 'zoomOut'],
    ['.maplibregl-ctrl-compass', 'resetNorth'],
  ] as const;
  controlLabels.forEach(([selector, key]) => {
    const control = map.getContainer().querySelector<HTMLButtonElement>(selector);
    if (!control) return;
    const label = t(locale, key);
    control.setAttribute('aria-label', label);
    control.title = label;
  });
}

export function ExploreMap({
  spots,
  locale,
  categoryColors,
  centerLabel,
  mapErrorLabel,
  retryLabel,
  selectedSpotId,
  onSelectSpot,
  onSelectCluster,
}: ExploreMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const localeRef = useRef(locale);
  const onSelectSpotRef = useRef(onSelectSpot);
  const onSelectClusterRef = useRef(onSelectCluster);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [mapAttempt, setMapAttempt] = useState(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [localizedContents, setLocalizedContents] = useState<LocalizedPlaceContentMap>({});

  useEffect(() => {
    let mounted = true;
    void loadLocalizedPlaceContents()
      .then((content) => {
        if (mounted) setLocalizedContents(content);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    localeRef.current = locale;
    onSelectSpotRef.current = onSelectSpot;
    onSelectClusterRef.current = onSelectCluster;
  }, [locale, onSelectCluster, onSelectSpot]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return undefined;

    setMapError(false);
    const map = new Map({
      container: mapContainerRef.current,
      style: mapStyleUrl,
      center: seoulCenter,
      zoom: 11.35,
    });
    map.addControl(new NavigationControl({ showCompass: true }), 'top-right');
    map.on('error', () => setMapError(true));
    map.on('load', () => {
      applyMapLabelLanguage(map, localeRef.current);
      applyMapControlLanguage(map, localeRef.current);
      map.addSource('map-places', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: 22,
        clusterRadius: 36,
      });
      map.addLayer({
        id: 'place-clusters',
        type: 'circle',
        source: 'map-places',
        filter: ['has', 'point_count'],
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['get', 'point_count'],
            2,
            18,
            10,
            23,
            50,
            29,
          ],
          'circle-color': '#1f5c50',
          'circle-stroke-color': '#fffaf0',
          'circle-stroke-width': 3,
          'circle-opacity': 0.94,
        },
      });
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'map-places',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 12,
        },
        paint: { 'text-color': '#fffaf0' },
      });
      map.addLayer({
        id: 'place-points',
        type: 'circle',
        source: 'map-places',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 7,
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#fffaf0',
          'circle-stroke-width': 3,
        },
      });
      map.on('mouseenter', 'place-clusters', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mousemove', 'place-clusters', async (event: MapLayerMouseEvent) => {
        const cluster = event.features?.[0];
        const clusterId = Number(cluster?.properties?.cluster_id);
        const pointCount = Number(cluster?.properties?.point_count);
        const coordinates =
          cluster?.geometry.type === 'Point' ? cluster.geometry.coordinates : undefined;
        const source = map.getSource('map-places') as GeoJSONSource | undefined;
        if (!source || !Number.isFinite(clusterId) || !coordinates) return;

        setHoveredId(null);
        const places = await source.getClusterLeaves(clusterId, 8, 0);
        const popupContent = document.createElement('article');
        popupContent.className = 'spot-popup cluster-popup';
        const heading = document.createElement('strong');
        heading.textContent = t(localeRef.current, 'placesCount', { count: pointCount });
        popupContent.append(heading);
        const list = document.createElement('ul');
        const currentLocale = localeRef.current;
        places.forEach((place) => {
          const item = document.createElement('li');
          item.textContent = String(
            place.properties?.[`name${currentLocale[0].toUpperCase()}${currentLocale.slice(1)}`] ??
              t(currentLocale, 'mapPlaceFallback'),
          );
          list.append(item);
        });
        popupContent.append(list);
        if (pointCount > places.length) {
          const more = document.createElement('p');
          more.textContent = t(localeRef.current, 'morePlacesClick', {
            count: pointCount - places.length,
          });
          popupContent.append(more);
        }
        const popup =
          popupRef.current ??
          new Popup({
            anchor: 'bottom',
            closeButton: false,
            closeOnClick: false,
            offset: 14,
          }).addTo(map);
        popup.setLngLat(coordinates as [number, number]).setDOMContent(popupContent);
        popupRef.current = popup;
      });
      map.on('mouseleave', 'place-clusters', () => {
        map.getCanvas().style.cursor = '';
        popupRef.current?.remove();
        popupRef.current = null;
      });
      map.on('click', 'place-clusters', async (event: MapLayerMouseEvent) => {
        const cluster = event.features?.[0];
        const clusterId = Number(cluster?.properties?.cluster_id);
        const source = map.getSource('map-places') as GeoJSONSource | undefined;
        const pointCount = Number(cluster?.properties?.point_count);
        if (!source || !Number.isFinite(clusterId) || !Number.isFinite(pointCount)) return;
        const places = await source.getClusterLeaves(clusterId, pointCount, 0);
        onSelectClusterRef.current(
          places.flatMap((place) => {
            const id = place.properties?.id;
            const kind = place.properties?.kind;
            const coordinates =
              place.geometry.type === 'Point' ? place.geometry.coordinates : undefined;
            return typeof id === 'string' && kind === 'spot' && Array.isArray(coordinates)
              ? [{ id, kind, coordinates: coordinates as [number, number] }]
              : [];
          }),
        );
      });
      map.on('mouseenter', 'place-points', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mousemove', 'place-points', (event: MapLayerMouseEvent) => {
        const id = event.features?.[0]?.properties?.id;
        const kind = event.features?.[0]?.properties?.kind;
        if (typeof id !== 'string') return;
        setHoveredId(kind === 'spot' ? id : null);
      });
      map.on('mouseleave', 'place-points', () => {
        map.getCanvas().style.cursor = '';
        setHoveredId(null);
      });
      map.on('click', 'place-points', (event: MapLayerMouseEvent) => {
        const id = event.features?.[0]?.properties?.id;
        const kind = event.features?.[0]?.properties?.kind;
        if (typeof id !== 'string') return;
        if (kind === 'spot') onSelectSpotRef.current(id);
      });
      setIsMapReady(true);
    });

    mapRef.current = map;
    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
      setIsMapReady(false);
    };
  }, [mapAttempt]);

  useEffect(() => {
    const source = mapRef.current?.getSource('map-places') as GeoJSONSource | undefined;
    if (isMapReady) source?.setData(toMapPlaceFeatureCollection(spots, categoryColors));
  }, [categoryColors, isMapReady, spots]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;

    const updateLanguage = () => {
      if (!map.isStyleLoaded() || !map.getStyle()?.layers?.length) {
        map.once('idle', updateLanguage);
        map.triggerRepaint();
        return;
      }
      applyMapLabelLanguage(map, locale);
    };

    applyMapControlLanguage(map, locale);
    updateLanguage();
    return () => {
      map.off('idle', updateLanguage);
    };
  }, [isMapReady, locale]);

  useEffect(() => {
    const spot = selectedSpotId ? spots.find((item) => item.id === selectedSpotId) : undefined;
    const coordinates = spot?.coordinates;
    const map = mapRef.current;
    if (coordinates && map)
      map.flyTo({
        center: coordinates,
        zoom: Math.max(map.getZoom(), 14.6),
        duration: 900,
        essential: true,
      });
  }, [selectedSpotId, spots]);

  useEffect(() => {
    const map = mapRef.current;
    if (!isMapReady || !map) return;
    const spot = hoveredId ? spots.find((item) => item.id === hoveredId) : undefined;
    if (!spot) {
      popupRef.current?.remove();
      popupRef.current = null;
      return;
    }

    const popupContent = document.createElement('article');
    popupContent.className = 'spot-popup spot-hover-popup';
    const localizedContent = localizedContents[spot.id]?.[locale];
    const name = spot.name[locale];
    const metadata =
      localizedContent?.curationReason ||
      localizedContent?.tags ||
      (locale === 'ko' ? spot.address || spot.note.ko : undefined);
    const district = spot.district[locale];
    const coordinates = spot.coordinates;
    const kicker = document.createElement('div');
    kicker.className = 'spot-popup-kicker';
    for (const text of [getSpotCategoryLabel(spot.category, locale), district]) {
      const label = document.createElement('span');
      label.textContent = text;
      kicker.append(label);
    }
    const heading = document.createElement('strong');
    heading.textContent = name;
    popupContent.append(kicker, heading);
    if (metadata) {
      const description = document.createElement('p');
      description.textContent = metadata;
      popupContent.append(description);
    }
    const popup =
      popupRef.current ??
      new Popup({
        anchor: 'bottom',
        closeButton: false,
        closeOnClick: false,
        className: 'spot-popup-container',
        offset: 14,
      }).addTo(map);
    popup.setLngLat(coordinates).setDOMContent(popupContent);
    popupRef.current = popup;
  }, [hoveredId, isMapReady, locale, localizedContents, spots]);

  function centerMap() {
    mapRef.current?.flyTo({ center: seoulCenter, zoom: 11.35, duration: 900, essential: true });
  }

  return (
    <section className="map-area" aria-label={t(locale, 'interactiveMap')}>
      <div className="map-canvas" ref={mapContainerRef} aria-label={t(locale, 'mapOfSeoul')} />
      {mapError && (
        <div className="map-error-notice" role="alert">
          <span>{mapErrorLabel}</span>
          <button type="button" onClick={() => setMapAttempt((attempt) => attempt + 1)}>
            {retryLabel}
          </button>
        </div>
      )}
      <button
        className="locate-button"
        onClick={centerMap}
        aria-label={centerLabel}
        title={centerLabel}
      >
        <House size={19} />
      </button>
    </section>
  );
}
