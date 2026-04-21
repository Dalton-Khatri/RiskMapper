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
  document.getElementById('cascade-btn').addEventListener('click', () => {
    if (cascadeMode) clearCascade();
    else simulateCascade();
  });

  document.getElementById('evac-btn').addEventListener('click', () => {
    if (evacuMode) clearEvac();
    else showEvacRoutes();
  });

  document.getElementById('ward-search').addEventListener('input', e => {
    buildWardList(e.target.value);
  });

  document.getElementById('wd-close').addEventListener('click', () => {
    document.getElementById('ward-detail').classList.add('hidden');
    activeWard = null;
    buildWardList(document.getElementById('ward-search').value);
  });
}
