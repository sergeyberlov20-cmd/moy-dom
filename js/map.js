window.mdMap = function (id, lat, lon, zoom, opts) {
  opts = opts || {};
  var el = document.getElementById(id);
  if (!el || !window.L) return;
  var map = L.map(el, { scrollWheelZoom: false, attributionControl: false }).setView([lat, lon], zoom);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  L.control.attribution({ prefix: false })
    .addAttribution('© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>')
    .addTo(map);
  if (opts.marker) L.marker([lat, lon]).addTo(map).bindPopup(opts.marker);
  if (opts.circle) L.circle([lat, lon], { radius: opts.circle, color: '#1c2e5a', weight: 2, fillOpacity: 0.12 }).addTo(map);
  return map;
};
