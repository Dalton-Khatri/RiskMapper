/* ═══════════════════════════════════════════════
   RiskMapper Nepal — simulation.js
   Cascade simulation — works on ANY selected ward.
   Uses precomputed scenarios for top-3 wards,
   dynamically computes BFS cascade for all others.
   ═══════════════════════════════════════════════

   HOW CASCADE WORKS
   ─────────────────
   1. You click a ward — it becomes the "source" node (probability = 1.0).
   2. BFS spreads outward through the adjacency graph.
   3. At each hop the probability decays:
        P(neighbor fails) = P(current) × (neighbor_score / 10) × 0.6
      — The 0.6 is the decay factor per hop (each distance step halves-ish)
      — neighbor_score/10 means a vulnerable neighbor is more likely to fail
   4. We cut off at probability < 0.05 (5%) — too small to matter.
   5. The result is a map: { ward_id → failure_probability }
   6. On the map: circle radius and opacity scale with probability.
      Red circles = high cascade risk, faint = low cascade risk.
═══════════════════════════════════════════════ */

let cascadeMode = false;
let evacuMode = false;

// ── DYNAMIC CASCADE COMPUTATION (BFS) ──
function computeCascade(startWardId) {
  // If precomputed scenario exists, use it directly
  const precomputed = RISK_DATA.cascade_scenarios[String(startWardId)];
  if (precomputed) return precomputed;

  // Otherwise compute dynamically using BFS
  const adj = RISK_DATA.adjacency;
  const results = {};
  const visited = new Set();
  const queue = [{ wardId: startWardId, prob: 1.0 }];

  while (queue.length > 0) {
    const { wardId, prob } = queue.shift();
    if (visited.has(wardId)) continue;
    visited.add(wardId);
    results[wardId] = Math.round(prob * 1000) / 1000;

    if (prob < 0.05) continue; // cut off — negligible probability

    const neighbors = adj[String(wardId)] || [];
    neighbors.forEach(neighborId => {
      if (!visited.has(neighborId)) {
        const neighbor = wardMap[neighborId];
        if (!neighbor) return;
        // decay: current_prob × neighbor_vulnerability × 0.6 per hop
        const cascadeProb = prob * (neighbor.score / 10) * 0.6;
        queue.push({ wardId: neighborId, prob: cascadeProb });
      }
    });
  }
  return results;
}

// ── SIMULATE CASCADE ──
function simulateCascade(sourceWardId) {
  clearCascade();
  cascadeMode = true;

  // Use activeWard if set, otherwise default to highest-risk ward
  const wardId = sourceWardId || (activeWard ? activeWard : RISK_DATA.wards[0].ward);
  const sourceWard = wardMap[wardId];
  const scenario = computeCascade(wardId);

  // Show panel
  const cascadeInfoEl = document.getElementById('cascade-info');
  const rowsEl = document.getElementById('cascade-rows');
  const sourceEl = document.getElementById('ci-source');
  cascadeInfoEl.classList.add('visible');
  sourceEl.textContent = `SOURCE: ${sourceWard.name.toUpperCase()} (${sourceWard.score}/10)`;

  // Sort wards by probability, highest first
  const entries = Object.entries(scenario)
    .sort((a, b) => b[1] - a[1]);

  // Animate markers appearing in staggered waves (120ms apart)
  entries.forEach(([wardStr, prob], idx) => {
    const wId = parseInt(wardStr);
    const w = wardMap[wId];
    if (!w) return;

    setTimeout(() => {
      const r = 6 + prob * 18;           // bigger = higher probability
      const alpha = 0.15 + prob * 0.7;   // more opaque = higher probability

      // Source ward gets a special solid marker
      if (wId === wardId) {
        const src = L.circleMarker([w.lat, w.lng], {
          radius: 16,
          fillColor: '#e02020',
          color: '#e02020',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9,
        }).addTo(map);
        src.bindTooltip(`<b style="font-family:Space Mono">${w.name} — EPICENTRE (100%)</b>`);
        cascadeMarkers.push(src);
        return;
      }

      const cm = L.circleMarker([w.lat, w.lng], {
        radius: r,
        fillColor: '#e02020',
        color: '#e02020',
        weight: 1,
        opacity: alpha,
        fillOpacity: alpha * 0.45,
      }).addTo(map);

      const pct = Math.round(prob * 100);
      cm.bindTooltip(
        `<span style="font-family:Space Mono;font-size:10px">${w.name}<br>Cascade probability: <b>${pct}%</b></span>`,
        { direction: 'top' }
      );
      cascadeMarkers.push(cm);

      // Extra pulsing ring for high-probability wards (>40%)
      if (prob > 0.4) {
        const ring = L.circleMarker([w.lat, w.lng], {
          radius: r + 9,
          fillColor: 'transparent',
          color: '#e02020',
          weight: 1.5,
          opacity: 0.2,
          fillOpacity: 0,
        }).addTo(map);
        cascadeMarkers.push(ring);
      }

      // Draw adjacency lines from source to direct neighbors
      const directNeighbors = RISK_DATA.adjacency[String(wardId)] || [];
      if (directNeighbors.includes(wId) && prob > 0.3) {
        const line = L.polyline(
          [[sourceWard.lat, sourceWard.lng], [w.lat, w.lng]],
          { color: '#e02020', weight: 1.5, opacity: 0.2, dashArray: '4,4' }
        ).addTo(map);
        cascadeMarkers.push(line);
      }
    }, idx * 100);
  });

  // Build info panel rows — top 8 affected wards
  rowsEl.innerHTML = entries
    .filter(([wStr]) => parseInt(wStr) !== wardId) // exclude source itself
    .slice(0, 8)
    .map(([wardStr, prob]) => {
      const w = wardMap[parseInt(wardStr)];
      const pct = Math.round(prob * 100);
      const color = pct > 80 ? '#e02020' : pct > 40 ? '#f47a1f' : '#f0b429';
      return `
        <div class="ci-row">
          <span class="ci-ward-name">${w ? w.name : 'Ward ' + wardStr}</span>
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
  document.getElementById('cascade-btn').textContent = '⚡ Simulate Cascade';
}

// ── EVAC ROUTES ──
// Routes connect top-risk wards → their nearest low-risk ward via adjacency graph.
// This is a simplified Dijkstra — weight = risk score (avoid high-risk wards).

function dijkstraEvac(startWardId) {
  const adj = RISK_DATA.adjacency;
  const dist = {};
  const prev = {};
  const visited = new Set();

  RISK_DATA.wards.forEach(w => { dist[w.ward] = Infinity; });
  dist[startWardId] = 0;

  const queue = [{ wardId: startWardId, cost: 0 }];

  while (queue.length > 0) {
    // Pick lowest cost unvisited
    queue.sort((a, b) => a.cost - b.cost);
    const { wardId } = queue.shift();
    if (visited.has(wardId)) continue;
    visited.add(wardId);

    const neighbors = adj[String(wardId)] || [];
    neighbors.forEach(nId => {
      const n = wardMap[nId];
      if (!n) return;
      // Edge weight = neighbor's risk score (higher score = dangerous = avoid)
      const edgeCost = n.score;
      const newCost = dist[wardId] + edgeCost;
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
  while (cur !== undefined) {
    path.unshift(cur);
    cur = prev[cur];
  }
  return path;
}

function showEvacRoutes() {
  clearEvac();
  evacuMode = true;

  // Find low/moderate wards as safe destinations
  const safeWards = RISK_DATA.wards.filter(w => w.level === 'low' || w.score < 5.5);

  // For top 3 critical wards, compute route to nearest safe ward
  const sourceWards = RISK_DATA.wards.filter(w => w.level === 'critical').slice(0, 3);
  const colors = ['#00b87a', '#3b82f6', '#a855f7'];

  sourceWards.forEach((src, idx) => {
    const { dist, prev } = dijkstraEvac(src.ward);

    // Find closest safe ward by Dijkstra cost
    let bestDest = null, bestCost = Infinity;
    safeWards.forEach(sw => {
      if (dist[sw.ward] < bestCost) {
        bestCost = dist[sw.ward];
        bestDest = sw;
      }
    });

    if (!bestDest) return;

    const path = getPath(prev, bestDest.ward);
    const color = colors[idx];
    const routeLabel = `ROUTE ${String.fromCharCode(65 + idx)}`;

    // Draw polyline through path wards
    const latlngs = path.map(wId => {
      const w = wardMap[wId];
      return [w.lat, w.lng];
    });

    const line = L.polyline(latlngs, {
      color,
      weight: 3,
      opacity: 0.85,
      dashArray: '8, 6',
    }).addTo(map);

    line.bindTooltip(
      `<span style="font-family:Space Mono;font-size:10px;color:${color}">
        ${routeLabel}: ${src.name} → ${bestDest.name}<br>
        <span style="color:#9ba3af">${path.length - 1} ward hops · Dijkstra safest path</span>
      </span>`,
      { sticky: true }
    );
    evacuLines.push(line);

    // Source marker (red X)
    const srcMark = L.circleMarker([src.lat, src.lng], {
      radius: 10,
      fillColor: '#e02020',
      color: '#fff',
      weight: 2,
      fillOpacity: 0.9,
    }).addTo(map);
    srcMark.bindTooltip(`<span style="font-family:Space Mono;font-size:10px">DANGER ZONE<br>${src.name}</span>`);
    evacuLines.push(srcMark);

    // Destination marker (green circle)
    const destMark = L.circleMarker([bestDest.lat, bestDest.lng], {
      radius: 10,
      fillColor: color,
      color: '#fff',
      weight: 2,
      fillOpacity: 0.9,
    }).addTo(map);
    destMark.bindTooltip(`<span style="font-family:Space Mono;font-size:10px">SAFE ZONE<br>${bestDest.name}</span>`);
    evacuLines.push(destMark);
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