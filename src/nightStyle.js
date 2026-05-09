export const nightStyle = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': '#020934',
      },
    },
    {
      id: 'osm-night',
      type: 'raster',
      source: 'osm',
      paint: {
        'raster-opacity': 0.5,
        'raster-hue-rotate': 215,
        'raster-saturation': -0.55,
        'raster-contrast': 0.78,
        'raster-brightness-min': 0.38,
        'raster-brightness-max': 0.03,
      },
    },
  ],
};
