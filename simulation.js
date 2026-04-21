/* ═══════════════════════════════════════════════
   RiskMapper Nepal — simulation.js
   Cascade simulation and evacuation route logic
   ═══════════════════════════════════════════════ */

let cascadeMode = false;
let evacuMode = false;

// ── CASCADE SIMULATION ──
function simulateCascade() {
  clearCascade();
  cascadeMode = true;

  const topWard = RISK_DATA.wards[0];
  const scenario = RISK_DATA.cascade_scenarios[String(topWard.ward)];
  const cascadeInfoEl = document.getElementById('cascade-info');
  const rowsEl = document.getElementById('cascade-rows');

  cascadeInfoEl.classList.add('visible');

  const entries = Object.entries(scenario)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  entries.forEach(([wardStr, prob], idx) => {
    const wardId = parseInt(wardStr);
    const w = wardMap[wardId];
    if (!w) return;

    setTimeout(() => {
      const intensity = prob;
      const r = 5 + intensity * 16;
      const alpha = 0.2 + intensity * 0.6;
      const cm = L.circleMarker([w.lat, w.lng], {
        radius: r,
        fillColor: '#e02020',
        color: '#e02020',
        weight: 1,
        opacity: alpha,
        fillOpacity: alpha * 0.5,
      }).addTo(map);
      cascadeMarkers.push(cm);

      if (prob > 0.4) {
        const ring = L.circleMarker([w.lat, w.lng], {
          radius: r + 8,
          fillColor: 'transparent',
          color: '#e02020',
          weight: 1,
          opacity: 0.2,
          fillOpacity: 0,
        }).addTo(map);
        cascadeMarkers.push(ring);
      }
    }, idx * 120);
  });

  rowsEl.innerHTML = entries.slice(0, 8).map(([wardStr, prob]) => {
    const w = wardMap[parseInt(wardStr)];
    const pct = Math.round(prob * 100);
    const color = pct > 80 ? '#e02020' : pct > 40 ? '#f47a1f' : '#f0b429';
    return `
      <div class="ci-row">
        <span class="ci-ward-name">${w ? w.name : 'W' + wardStr}</span>
        <span class="ci-prob" style="color:${color}">${pct}%</span>
      </div>
    `;
  }).join('');

  document.getElementById('cascade-btn').classList.add('active-sim');
  document.getElementById('cascade-btn').textContent = '✕ CLEAR CASCADE';
}

function clearCascade() {
  cascadeMarkers.forEach(m => m.remove());
  cascadeMarkers = [];
  cascadeMode = false;
  document.getElementById('cascade-info').classList.remove('visible');
  document.getElementById('cascade-btn').classList.remove('active-sim');
  document.getElementById('cascade-btn').textContent = '⚡ SIMULATE CASCADE';
}

// ── EVAC ROUTES ──
function showEvacRoutes() {
  clearEvac();
  evacuMode = true;

  const routes = [
    { from: wardMap[10], to: wardMap[32], color: '#00b87a', label: 'ROUTE A' },
    { from: wardMap[12], to: wardMap[7],  color: '#00b87a', label: 'ROUTE B' },
    { from: wardMap[19], to: wardMap[22], color: '#3b82f6', label: 'ROUTE C' },
  ];

  routes.forEach(r => {
    const line = L.polyline([
      [r.from.lat, r.from.lng],
      [r.to.lat, r.to.lng],
    ], {
      color: r.color,
      weight: 3,
      opacity: 0.85,
      dashArray: '8, 6',
    }).addTo(map);
    line.bindTooltip(`<span style="font-family:Space Mono,monospace;font-size:10px;color:${r.color}">${r.label} — Dijkstra safest path</span>`);
    evacuLines.push(line);

    const arrMark = L.circleMarker([r.to.lat, r.to.lng], {
      radius: 8,
      fillColor: r.color,
      color: '#fff',
      weight: 2,
      fillOpacity: 0.9,
    }).addTo(map);
    evacuLines.push(arrMark);
  });

  document.getElementById('evac-btn').textContent = '✕ CLEAR ROUTES';
  document.getElementById('evac-btn').style.borderColor = 'var(--accent)';
  document.getElementById('evac-btn').style.color = 'var(--accent)';
}

function clearEvac() {
  evacuLines.forEach(l => l.remove());
  evacuLines = [];
  evacuMode = false;
  document.getElementById('evac-btn').textContent = '⟶ SHOW EVAC ROUTES';
  document.getElementById('evac-btn').style.borderColor = '';
  document.getElementById('evac-btn').style.color = '';
}
