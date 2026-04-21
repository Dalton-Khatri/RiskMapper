/* ═══════════════════════════════════════════════
   RiskMapper Nepal — ui.js
   Sidebar, ward list, stats panel rendering
   ═══════════════════════════════════════════════ */

let activeWard = null;

function buildHeaderStats() {
  const s = RISK_DATA.stats;
  const el = document.getElementById('header-stats');
  el.innerHTML = `
    <div class="hstat critical">${s.critical_count} CRITICAL</div>
    <div class="hstat high">${s.high_count} HIGH</div>
    <div class="hstat moderate">${s.moderate_count} MOD</div>
    <div class="hstat low">${s.low_count} LOW</div>
  `;
}

function buildWardList(filter = '') {
  const el = document.getElementById('ward-list');
  const wards = RISK_DATA.wards.filter(w =>
    w.name.toLowerCase().includes(filter.toLowerCase()) ||
    String(w.ward).includes(filter)
  );
  el.innerHTML = wards.map((w, i) => `
    <div class="ward-item ${activeWard === w.ward ? 'active' : ''}" data-ward="${w.ward}">
      <span class="ward-rank">${filter ? '' : i + 1}</span>
      <span class="ward-dot" style="background:${LEVEL_COLORS[w.level]}"></span>
      <div class="ward-info">
        <div class="ward-name">${w.name}</div>
        <div class="ward-num">WARD ${w.ward}</div>
      </div>
      <span class="ward-score-badge" style="color:${LEVEL_COLORS[w.level]}">${w.score}</span>
    </div>
  `).join('');

  el.querySelectorAll('.ward-item').forEach(item => {
    item.addEventListener('click', () => {
      selectWard(parseInt(item.dataset.ward));
    });
  });
}

function buildStatsPanel() {
  const s = RISK_DATA.stats;
  const total = s.total_wards;
  document.getElementById('stats-rows').innerHTML = [
    ['critical', s.critical_count],
    ['high', s.high_count],
    ['moderate', s.moderate_count],
    ['low', s.low_count],
  ].map(([level, count]) => `
    <div class="sp-row">
      <div class="sp-color" style="background:${LEVEL_COLORS[level]}"></div>
      <div class="sp-label">${level.toUpperCase()}</div>
      <div class="sp-count" style="color:${LEVEL_COLORS[level]}">${count}</div>
    </div>
  `).join('');
}

function selectWard(wardId) {
  activeWard = wardId;
  const w = wardMap[wardId];
  buildWardList(document.getElementById('ward-search').value);

  const detail = document.getElementById('ward-detail');
  const color = LEVEL_COLORS[w.level];
  document.getElementById('wd-name').textContent = w.name;
  document.getElementById('wd-sub').textContent = `Ward ${w.ward} · ${w.level.toUpperCase()}`;
  document.getElementById('wd-score').textContent = w.score;
  document.getElementById('wd-score').style.color = color;

  const f = w.factors;
  document.getElementById('wd-body').innerHTML = [
    ['Building Age', f.age_score],
    ['Material Type', f.material_score],
    ['Fault Distance', f.fault_distance_score],
    ['Soil Quality', f.soil_score],
  ].map(([label, val]) => `
    <div class="wd-factor">
      <div class="wd-factor-label">${label}</div>
      <div class="wd-bar-wrap">
        <div class="wd-bar" style="width:${val * 10}%; background:${color};"></div>
      </div>
      <div class="wd-factor-val">${val}</div>
    </div>
  `).join('');

  detail.classList.remove('hidden');
  map.setView([w.lat, w.lng], 14);
}
