/* ═══════════════════════════════════════════════
   RiskMapper Nepal — simulation.js

   CASCADE — HOW IT WORKS
   ──────────────────────
   All 32 cascade scenarios are PRE-COMPUTED in
   generate_data.py and stored in risk_data.json.
   No BFS runs in the browser — instant lookup.

   When you click a ward:
   1. Load scenario[wardId] from RISK_DATA
   2. Sort wards by probability (highest first)
   3. Animate them appearing 100ms apart:
      - Polygon color flashes red (via highlightWardPolygon)
      - Circle overlay drawn (size/opacity ∝ probability)
      - Lines drawn from source to direct neighbors
   4. Panel shows top 8 affected wards + probabilities

   Probability formula (computed in Python):
     P(neighbor) = P(current) × (neighbor_score/10) × 0.6
   Source ward always = 1.0 (100%).
   Stops below 0.05 (5%).

   DIJKSTRA EVAC — HOW IT WORKS
   ─────────────────────────────
   Graph = 32 ward nodes. Edge weight = neighbor risk score.
   Higher risk score = more dangerous to pass through.
   So Dijkstra finds path that avoids high-risk wards.
   Drawn as dashed polyline through ward centroids.
═══════════════════════════════════════════════ */

let cascadeMode = false;
let evacuMode = false;

// ── CASCADE SIMULATION ──
function simulateCascade(sourceWardId) {
  clearCascade();
  cascadeMode = true;

  const wardId = sourceWardId || (activeWard ? activeWard : RISK_DATA.wards[0].ward);
  const sourceWard = wardMap[wardId];

  // Load precomputed scenario — O(1) lookup
  const scenario = RISK_DATA.cascade_scenarios[String(wardId)];
  if (!scenario) { console.warn('No scenario for ward', wardId); return; }

  // Show panel
  document.getElementById('cascade-info').classList.add('visible');
  const sourceEl = document.getElementById('ci-source');
  if (sourceEl) sourceEl.textContent = `SOURCE: ${sourceWard.name.toUpperCase()} (${sourceWard.score}/10)`;

  // Sort by probability
  const entries = Object.entries(scenario).sort((a, b) => b[1] - a[1]);

  // Staggered animation — 100ms per ward
  entries.forEach(([wardStr, prob], idx) => {
    const wId = parseInt(wardStr);
    const w = wardMap[wId];
    if (!w) return;

    setTimeout(() => {
      const r = 6 + prob * 18;
      const alpha = 0.15 + prob * 0.7;
      const color = wId === wardId ? '#e02020' : '#e02020';

      // Flash polygon color
      if (wId === wardId) {
        highlightWardPolygon(wId, '#e02020', 0.85);
      } else if (prob > 0.05) {
        highlightWardPolygon(wId, '#e02020', Math.min(alpha * 0.7, 0.7));
      }

      // Overlay circle marker
      const cm = L.circleMarker([w.lat, w.lng], {
        radius: wId === wardId ? 16 : r,
        fillColor: color,
        color: color,
        weight: wId === wardId ? 2 : 1,
        opacity: wId === wardId ? 1 : alpha,
        fillOpacity: wId === wardId ? 0.9 : alpha * 0.4,
      }).addTo(map);

      const pct = Math.round(prob * 100);
      cm.bindTooltip(
        `<span style="font-family:Space Mono;font-size:10px">${w.name}<br>${wId === wardId ? 'EPICENTRE — 100%' : `Cascade risk: <b>${pct}%</b>`}</span>`,
        { direction: 'top' }
      );
      cascadeMarkers.push(cm);

      // Pulsing ring for high-probability wards
      if (prob > 0.4 || wId === wardId) {
        const ring = L.circleMarker([w.lat, w.lng], {
          radius: (wId === wardId ? 16 : r) + 9,
          fillColor: 'transparent',
          color: '#e02020',
          weight: 1.5,
          opacity: 0.2,
          fillOpacity: 0,
        }).addTo(map);
        cascadeMarkers.push(ring);
      }

      // Draw adjacency lines: source → direct neighbors only
      const directNeighbors = RISK_DATA.adjacency[String(wardId)] || [];
      if (directNeighbors.includes(wId) && prob > 0.25) {
        const line = L.polyline(
          [[sourceWard.lat, sourceWard.lng], [w.lat, w.lng]],
          { color: '#e02020', weight: 1.5, opacity: 0.25, dashArray: '4,5' }
        ).addTo(map);
        cascadeMarkers.push(line);
      }
    }, idx * 100);
  });

  // Build info panel — top 8 excluding source
  const rowsEl = document.getElementById('cascade-rows');
  rowsEl.innerHTML = entries
    .filter(([wStr]) => parseInt(wStr) !== wardId)
    .slice(0, 8)
    .map(([wardStr, prob]) => {
      const w = wardMap[parseInt(wardStr)];
      const pct = Math.round(prob * 100);
      const color = pct > 80 ? '#e02020' : pct > 40 ? '#f47a1f' : '#f0b429';
      return `<div class="ci-row">
        <span class="ci-ward-name">${w ? w.name : 'Ward '+wardStr}</span>
        <span class="ci-prob" style="color:${color}">${pct}%</span>
      </div>`;
    }).join('');

  document.getElementById('cascade-btn').classList.add('active-sim');
  document.getElementById('cascade-btn').textContent = '✕ CLEAR CASCADE';
}

function clearCascade() {
  cascadeMarkers.forEach(m => m.remove());
  cascadeMarkers = [];
  cascadeMode = false;
  resetPolygonStyles();
  document.getElementById('cascade-info').classList.remove('visible');
  document.getElementById('cascade-btn').classList.remove('active-sim');
  document.getElementById('cascade-btn').textContent = '⚡ Simulate Cascade';
}

// ── DIJKSTRA EVACUATION ──
function dijkstraEvac(startWardId) {
  const adj = RISK_DATA.adjacency;
  const dist = {}, prev = {}, visited = new Set();
  RISK_DATA.wards.forEach(w => dist[w.ward] = Infinity);
  dist[startWardId] = 0;
  const queue = [{ wardId: startWardId, cost: 0 }];

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const { wardId } = queue.shift();
    if (visited.has(wardId)) continue;
    visited.add(wardId);
    (adj[String(wardId)] || []).forEach(nId => {
      const n = wardMap[nId];
      if (!n) return;
      const newCost = dist[wardId] + n.score; // edge weight = neighbor risk score
      if (newCost < dist[nId]) {
        dist[nId] = newCost;
        prev[nId] = wardId;
        queue.push({ wardId: nId, cost: newCost });
      }
    });
  }
  return { dist, prev };
}

function getPath(prev, targetId) {
  const path = [];
  let cur = targetId;
  while (cur !== undefined) { path.unshift(cur); cur = prev[cur]; }
  return path;
}

function showEvacRoutes() {
  clearEvac();
  evacuMode = true;
  const safeWards = RISK_DATA.wards.filter(w => w.level === 'low' || w.score < 5.5);
  const srcWards = RISK_DATA.wards.filter(w => w.level === 'critical').slice(0, 3);
  const colors = ['#00b87a', '#3b82f6', '#a855f7'];

  srcWards.forEach((src, idx) => {
    const { dist, prev } = dijkstraEvac(src.ward);
    let bestDest = null, bestCost = Infinity;
    safeWards.forEach(sw => { if (dist[sw.ward] < bestCost) { bestCost = dist[sw.ward]; bestDest = sw; } });
    if (!bestDest) return;

    const path = getPath(prev, bestDest.ward);
    const color = colors[idx];
    const latlngs = path.map(wId => { const w = wardMap[wId]; return [w.lat, w.lng]; });

    const line = L.polyline(latlngs, { color, weight: 3, opacity: 0.85, dashArray: '8, 6' }).addTo(map);
    line.bindTooltip(`<span style="font-family:Space Mono;font-size:10px;color:${color}">ROUTE ${String.fromCharCode(65+idx)}: ${src.name} → ${bestDest.name}<br><span style="color:#9ba3af">${path.length-1} ward hops · Dijkstra safest path</span></span>`, { sticky: true });
    evacuLines.push(line);

    const s = L.circleMarker([src.lat, src.lng], { radius:10, fillColor:'#e02020', color:'#fff', weight:2, fillOpacity:0.9 }).addTo(map);
    s.bindTooltip(`<span style="font-family:Space Mono;font-size:10px">DANGER ZONE<br>${src.name}</span>`);
    evacuLines.push(s);

    const d = L.circleMarker([bestDest.lat, bestDest.lng], { radius:10, fillColor:color, color:'#fff', weight:2, fillOpacity:0.9 }).addTo(map);
    d.bindTooltip(`<span style="font-family:Space Mono;font-size:10px">SAFE ZONE<br>${bestDest.name}</span>`);
    evacuLines.push(d);
  });

  document.getElementById('evac-btn').textContent = '✕ CLEAR ROUTES';
  document.getElementById('evac-btn').style.borderColor = 'var(--accent)';
  document.getElementById('evac-btn').style.color = 'var(--accent)';
}

function clearEvac() {
  evacuLines.forEach(l => l.remove());
  evacuLines = [];
  evacuMode = false;
  document.getElementById('evac-btn').textContent = '⟶ Show Evacuation Routes';
  document.getElementById('evac-btn').style.borderColor = '';
  document.getElementById('evac-btn').style.color = '';
}
