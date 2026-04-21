/* ═══════════════════════════════════════════════
   RiskMapper Nepal — map.js
   Leaflet map initialization and marker logic
   ═══════════════════════════════════════════════ */

let map, markers = {}, cascadeMarkers = [], evacuLines = [];

function initMap() {
  map = L.map('map', {
    center: [27.715, 85.335],
    zoom: 13,
    zoomControl: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OSM contributors',
    maxZoom: 19,
  }).addTo(map);

  RISK_DATA.wards.forEach(w => {
    const radius = 8 + (w.score / 10) * 14;
    const color = LEVEL_COLORS[w.level];

    const marker = L.circleMarker([w.lat, w.lng], {
      radius,
      fillColor: color,
      color: '#fff',
      weight: 2,
      opacity: 0.9,
      fillOpacity: 0.55,
    }).addTo(map);

    // Pulsing outer ring for critical wards
    if (w.level === 'critical') {
      L.circleMarker([w.lat, w.lng], {
        radius: radius + 7,
        fillColor: 'transparent',
        color: color,
        weight: 1.5,
        opacity: 0.25,
        fillOpacity: 0,
        className: 'pulse-ring',
      }).addTo(map);
    }

    marker.bindPopup(buildPopupHTML(w));

    // Clicking a ward: select it AND immediately run cascade from it
    marker.on('click', () => {
      selectWard(w.ward);
      // Auto-run cascade from this ward
      if (cascadeMode) clearCascade();
      simulateCascade(w.ward);
    });

    markers[w.ward] = marker;
  });
}

function buildPopupHTML(w) {
  const color = LEVEL_COLORS[w.level];
  return `
    <div style="font-family:'Space Mono',monospace; min-width:160px; padding:6px;">
      <div style="font-size:13px;font-weight:700;color:${color};margin-bottom:4px;">${w.name}</div>
      <div style="font-size:9px;color:#9ba3af;margin-bottom:10px;letter-spacing:0.06em;">WARD ${w.ward} · CLICK TO SIMULATE CASCADE</div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:#1a1f2e;margin-bottom:4px;">
        <span>Risk Score</span>
        <span style="font-weight:700;color:${color}">${w.score}/10</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:#1a1f2e;">
        <span>Level</span>
        <span style="font-weight:700;color:${color}">${w.level.toUpperCase()}</span>
      </div>
    </div>
  `;
}