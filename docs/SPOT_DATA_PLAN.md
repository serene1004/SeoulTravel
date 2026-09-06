# Seoul spot data and map plan

## Goal

Replace inline placeholder markers with a curated, auditable Seoul spot catalog that can feed maps, search, category filters, and detail views from one source.

## Implemented flow

1. `src/data/seoul-spots.json` is the source of truth. Every spot has a stable ID, category, district/neighborhood, localized labels, map coordinates, and a public-data source identifier.
2. `src/data/spots.ts` provides typed access to the JSON catalog, category values, and a safe `getSpotById` lookup.
3. `src/App.tsx` imports the catalog, turns its filtered entries into MapLibre GeoJSON, and refreshes the same source whenever a category or text search changes.
4. Selecting a marker drives the detail panel and dialog; nearby recommendations are derived from the selected spot's coordinates instead of an unrelated static list.
5. `/spots/:spotId` resolves its content from the same catalog and includes a link back to the official tourism listing.

## Curation and maintenance rules

- The catalog does not copy Visit Seoul text, images, ratings, or editorial rankings. Its production refresh path is limited to Seoul Open Data Plaza datasets with an explicit reusable license.
- Every refresh must retain the data-source identifier, license, retrieval time, and required attribution. A seed record without an exact currently active public-data match must not be published.
- Coordinates are appropriate for marker display but should be verified against the place's official map or a licensed geocoding provider before a production release.
- Opening hours, prices, and temporary notices are deliberately not duplicated in the JSON because they change frequently; the detail screen links to the official listing instead.
- When adding a location, retain the `id`, three localized labels, category, district, neighborhood, coordinates, and `sourceUrl`. Update the catalog's `updatedAt` field after verification.
