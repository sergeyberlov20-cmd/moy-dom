window.mdMap = function (id, lat, lon, zoom, opts) {
  opts = opts || {};
  if (!window.maplibregl || !document.getElementById(id)) return;

  var map = new maplibregl.Map({
    container: id,
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [lon, lat],
    zoom: zoom,
    scrollZoom: false
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

  map.on('load', function () {
    // подписи на русском, если русского названия нет — обычное
    map.getStyle().layers.forEach(function (l) {
      if (l.type === 'symbol' && l.layout && l.layout['text-field'] &&
          JSON.stringify(l.layout['text-field']).indexOf('name') !== -1) {
        map.setLayoutProperty(l.id, 'text-field', ['coalesce', ['get', 'name:ru'], ['get', 'name']]);
      }
    });

    // круг района (радиус в метрах), без точной метки
    if (opts.circle) {
      var pts = [], r = opts.circle;
      var dLat = r / 111320, dLon = r / (111320 * Math.cos(lat * Math.PI / 180));
      for (var i = 0; i <= 64; i++) {
        var a = i / 64 * 2 * Math.PI;
        pts.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)]);
      }
      map.addSource('area', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [pts] } } });
      map.addLayer({ id: 'area-fill', type: 'fill', source: 'area', paint: { 'fill-color': '#1c2e5a', 'fill-opacity': 0.12 } });
      map.addLayer({ id: 'area-line', type: 'line', source: 'area', paint: { 'line-color': '#1c2e5a', 'line-width': 2 } });
    }
  });

  if (opts.marker) {
    new maplibregl.Marker({ color: '#1c2e5a' })
      .setLngLat([lon, lat])
      .setPopup(new maplibregl.Popup().setHTML(opts.marker))
      .addTo(map);
  }
  return map;
};
