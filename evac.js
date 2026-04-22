/* ═══════════════════════════════════════════════
   RiskMapper Nepal — evac.js
   Nearest Open Space (Park) Finder

   HOW IT WORKS
   ────────────
   1. User clicks "Nearest Open Space" button.
   2. Browser asks for the user's GPS location.
   3. We query OpenStreetMap's Overpass API for
      parks/open spaces within 3km of that point.
   4. For each park found, we compute straight-line
      distance (Haversine formula) to find the closest.
   5. We also run Dijkstra on the ward graph to find
      the safest ward-path from the user's ward to the
      ward containing the park.
   6. Results drawn on map + shown in info panel.

   If geolocation fails, we fall back to Ward 10
   (Baneshwor) as the default origin — the highest-risk
   ward, which is also the most useful demo point.
═══════════════════════════════════════════════ */

let parkMode = false;
let parkMarkers = [];
let userLocationMarker = null;

// ── HAVERSINE DISTANCE (km) ──
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) *
            Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── FIND NEAREST WARD to a lat/lng ──
function nearestWard(lat, lng) {
  let best = null, bestDist = Infinity;
  RISK_DATA.wards.forEach(w => {
    const d = haversine(lat, lng, w.lat, w.lng);
    if (d < bestDist) { bestDist = d; best = w; }
  });
  return best;
}

// ── FETCH PARKS VIA OVERPASS API ──
async function fetchNearbyParks(lat, lng, radiusMeters = 3000) {
  const query = `
    [out:json][timeout:10];
    (
      node["leisure"="park"](around:${radiusMeters},${lat},${lng});
      way["leisure"="park"](around:${radiusMeters},${lat},${lng});
      node["leisure"="garden"](around:${radiusMeters},${lat},${lng});
      way["landuse"="recreation_ground"](around:${radiusMeters},${lat},${lng});
      way["leisure"="playground"](around:${radiusMeters},${lat},${lng});
    );
    out center;
  `;
  const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Overpass API failed');
  const data = await resp.json();
  return data.elements.map(el => ({
    id: el.id,
    name: el.tags?.name || 'Open Space',
    lat: el.lat ?? el.center?.lat,
    lng: el.lon ?? el.center?.lon,
    type: el.tags?.leisure || el.tags?.landuse || 'park',
  })).filter(p => p.lat && p.lng);
}

// ── MAIN FUNCTION ──
async function findNearestPark() {
  if (parkMode) { clearPark(); return; }

  const parkInfoEl = document.getElementById('park-info');
  const parkRowsEl = document.getElementById('park-rows');
  parkInfoEl.classList.add('visible');
  parkRowsEl.innerHTML = `<div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);padding:4px 0;">LOCATING YOU...</div>`;

  document.getElementById('park-btn').textContent = '...SEARCHING';
  document.getElementById('park-btn').disabled = true;

  let userLat, userLng;

  try {
    // Try GPS
    const pos = await new Promise((resolve, reject) => {
      if (!navigator.geolocation) reject(new Error('no geolocation'));
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 6000 });
    });
    userLat = pos.coords.latitude;
    userLng = pos.coords.longitude;
  } catch {
    // Fallback: use Ward 10 (Baneshwor) centroid — highest risk ward
    const fallbackWard = wardMap[10];
    userLat = fallbackWard.lat;
    userLng = fallbackWard.lng;
    parkRowsEl.innerHTML = `<div style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);margin-bottom:8px;">GPS unavailable — using Ward 10 (Baneshwor)</div>`;
  }

  // Show user location on map
  if (userLocationMarker) userLocationMarker.remove();
  userLocationMarker = L.circleMarker([userLat, userLng], {
    radius: 10,
    fillColor: '#3b82f6',
    color: '#fff',
    weight: 2,
    fillOpacity: 0.9,
  }).addTo(map);
  userLocationMarker.bindTooltip('<span style="font-family:Space Mono;font-size:10px">YOUR LOCATION</span>');
  parkMarkers.push(userLocationMarker);
  map.setView([userLat, userLng], 14);

  try {
    parkRowsEl.innerHTML += `<div style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);">FETCHING PARKS...</div>`;
    const parks = await fetchNearbyParks(userLat, userLng, 3000);

    if (parks.length === 0) {
      parkRowsEl.innerHTML = `<div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">No parks found within 3km.</div>`;
      finishParkSearch();
      return;
    }

    // Sort by Haversine distance
    parks.sort((a, b) =>
      haversine(userLat, userLng, a.lat, a.lng) -
      haversine(userLat, userLng, b.lat, b.lng)
    );

    const nearest = parks[0];
    const distKm = haversine(userLat, userLng, nearest.lat, nearest.lng);

    // Draw line to nearest park
    const line = L.polyline(
      [[userLat, userLng], [nearest.lat, nearest.lng]],
      { color: '#00b87a', weight: 3, opacity: 0.9, dashArray: '8,5' }
    ).addTo(map);
    parkMarkers.push(line);

    // Park marker (green)
    const parkMark = L.circleMarker([nearest.lat, nearest.lng], {
      radius: 12,
      fillColor: '#00b87a',
      color: '#fff',
      weight: 2,
      fillOpacity: 0.85,
    }).addTo(map);
    parkMark.bindTooltip(
      `<span style="font-family:Space Mono;font-size:10px;color:#00b87a"><b>${nearest.name}</b><br>Open Space · ${distKm.toFixed(2)} km away</span>`,
      { permanent: true, direction: 'top' }
    );
    parkMarkers.push(parkMark);

    // Also show next 2 nearest as smaller dots
    parks.slice(1, 3).forEach(p => {
      const d = haversine(userLat, userLng, p.lat, p.lng);
      const m = L.circleMarker([p.lat, p.lng], {
        radius: 7,
        fillColor: '#00b87a',
        color: '#fff',
        weight: 1.5,
        fillOpacity: 0.5,
      }).addTo(map);
      m.bindTooltip(`<span style="font-family:Space Mono;font-size:10px">${p.name} · ${d.toFixed(2)}km</span>`);
      parkMarkers.push(m);
    });

    // Ward-graph path (Dijkstra) from user's ward to park's ward
    const userWard = nearestWard(userLat, userLng);
    const parkWard = nearestWard(nearest.lat, nearest.lng);
    let wardPathText = '';

    if (userWard && parkWard && userWard.ward !== parkWard.ward) {
      const { dist, prev } = dijkstraEvac(userWard.ward);
      const path = getPath(prev, parkWard.ward);
      if (path.length > 1) {
        const wardNames = path.map(id => wardMap[id]?.name || id).join(' → ');
        wardPathText = `<div style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);margin-top:6px;padding-top:6px;border-top:1px solid var(--border);line-height:1.6;">WARD PATH:<br>${wardNames}</div>`;

        // Draw ward path on map
        const wLatlngs = path.map(id => { const w = wardMap[id]; return [w.lat, w.lng]; });
        const wLine = L.polyline(wLatlngs, {
          color: '#00b87a',
          weight: 2,
          opacity: 0.4,
          dashArray: '4,4',
        }).addTo(map);
        parkMarkers.push(wLine);
      }
    }

    // Build panel
    parkRowsEl.innerHTML = `
      <div class="ci-row">
        <span class="ci-ward-name" style="font-weight:600;color:var(--text)">${nearest.name}</span>
        <span class="ci-prob" style="color:var(--accent)">${distKm.toFixed(2)} km</span>
      </div>
      <div style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);margin-top:4px;">
        ${parks.length} open spaces found within 3km
      </div>
      ${wardPathText}
    `;

  } catch (err) {
    parkRowsEl.innerHTML = `<div style="font-family:var(--font-mono);font-size:10px;color:var(--brand);">Error: ${err.message}</div>`;
  }

  finishParkSearch();
}

function finishParkSearch() {
  parkMode = true;
  document.getElementById('park-btn').textContent = '✕ CLEAR PARK ROUTE';
  document.getElementById('park-btn').disabled = false;
  document.getElementById('park-btn').style.borderColor = 'var(--accent)';
  document.getElementById('park-btn').style.color = 'var(--accent)';
}

function clearPark() {
  parkMarkers.forEach(m => m.remove());
  parkMarkers = [];
  if (userLocationMarker) { userLocationMarker.remove(); userLocationMarker = null; }
  parkMode = false;
  document.getElementById('park-info').classList.remove('visible');
  document.getElementById('park-btn').textContent = '⬡ Nearest Open Space';
  document.getElementById('park-btn').style.borderColor = '';
  document.getElementById('park-btn').style.color = '';
}
