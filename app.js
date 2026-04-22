/* ═══════════════════════════════════════════════
   RiskMapper Nepal — app.js
   Application bootstrap and event bindings
   ═══════════════════════════════════════════════ */

let wardMap = {};

window.addEventListener('load', () => {
  // Build ward lookup map
  RISK_DATA.wards.forEach(w => wardMap[w.ward] = w);

  // Render UI components
  buildHeaderStats();
  buildWardList();
  buildStatsPanel();

  // Initialize Leaflet map
  initMap();

  // Bind interactive events
  bindEvents();

  // Hide loading screen
  setTimeout(() => {
    const loader = document.getElementById('loading');
    loader.style.opacity = '0';
    setTimeout(() => loader.style.display = 'none', 400);
  }, 900);
});

function bindEvents() {
  // Cascade button — uses activeWard if one is selected, else top ward
  document.getElementById('cascade-btn').addEventListener('click', () => {
    if (cascadeMode) clearCascade();
    else simulateCascade(activeWard || RISK_DATA.wards[0].ward);
  });

  // Evac routes button
  document.getElementById('evac-btn').addEventListener('click', () => {
    if (evacuMode) clearEvac();
    else showEvacRoutes();
  });

  // Park / nearest open space button
  document.getElementById('park-btn').addEventListener('click', () => {
    if (parkMode) clearPark();
    else findNearestPark();
  });

  // Ward search filter
  document.getElementById('ward-search').addEventListener('input', e => {
    buildWardList(e.target.value);
  });

  // Ward detail close button
  document.getElementById('wd-close').addEventListener('click', () => {
    document.getElementById('ward-detail').classList.add('hidden');
    activeWard = null;
    buildWardList(document.getElementById('ward-search').value);
  });
}
