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

import { getPublicAttractionRecord } from '../data/publicAttractions';
import { getSpotCategoryLabel, type Locale, type Spot, type SpotCategory } from '../data/spots';
import 'maplibre-gl/dist/maplibre-gl.css';

setWorkerUrl(maplibreWorkerUrl);

const mapStyleUrl = 'https://tiles.openfreemap.org/styles/bright';
const seoulCenter: [number, number] = [126.9785, 37.5665];

type ExploreMapProps = {
  spots: Spot[];
  locale: Locale;
  categoryColors: Record<SpotCategory, string>;
  centerLabel: string;
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

export function ExploreMap({
  spots,
  locale,
  categoryColors,
  centerLabel,
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
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    localeRef.current = locale;
    onSelectSpotRef.current = onSelectSpot;
    onSelectClusterRef.current = onSelectCluster;
  }, [locale, onSelectCluster, onSelectSpot]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return undefined;

    const map = new Map({
      container: mapContainerRef.current,
      style: mapStyleUrl,
      center: seoulCenter,
      zoom: 11.35,
    });
    map.addControl(new NavigationControl({ showCompass: true }), 'top-right');
    map.on('load', () => {
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
        heading.textContent = `${pointCount}개의 장소`;
        popupContent.append(heading);
        const list = document.createElement('ul');
        const currentLocale = localeRef.current;
        places.forEach((place) => {
          const item = document.createElement('li');
          item.textContent = String(
            place.properties?.[`name${currentLocale[0].toUpperCase()}${currentLocale.slice(1)}`] ??
              '서울 장소',
          );
          list.append(item);
        });
        popupContent.append(list);
        if (pointCount > places.length) {
          const more = document.createElement('p');
          more.textContent = `외 ${pointCount - places.length}곳 · 클릭하여 목록 보기`;
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
  }, []);

  useEffect(() => {
    const source = mapRef.current?.getSource('map-places') as GeoJSONSource | undefined;
    if (isMapReady) source?.setData(toMapPlaceFeatureCollection(spots, categoryColors));
  }, [categoryColors, isMapReady, spots]);

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
    const record = spot ? getPublicAttractionRecord(spot.id) : undefined;
    const name = locale === 'ko' ? record?.name || spot.name.ko : spot.name[locale];
    const metadata = record?.address || spot.note[locale];
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
    const description = document.createElement('p');
    description.textContent = metadata;
    popupContent.append(kicker, heading, description);
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
  }, [hoveredId, isMapReady, locale, spots]);

  function centerMap() {
    mapRef.current?.flyTo({ center: seoulCenter, zoom: 11.35, duration: 900, essential: true });
  }

  return (
    <section className="map-area" aria-label="Interactive Seoul map">
      <div className="map-canvas" ref={mapContainerRef} aria-label="Map of Seoul places" />
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
