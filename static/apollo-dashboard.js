/* Apollo home dashboard — a Gridstack-backed widget grid on the splash page.
 *
 * View mode (default): the grid is static; graph tiles lazy-load their SVG
 * from /dashboard/graph/<key> so the home page stays fast. Edit mode: drag +
 * resize are enabled, tiles get a remove (×) button, and an "Add widget"
 * palette drops in any registered widget. Save serializes the layout and POSTs
 * it to /dashboard/save (persisted per-user in form_prefs). */
(function () {
  const gridEl = document.getElementById('dashboard-grid');
  if (!gridEl || typeof GridStack === 'undefined') return;

  const grid = GridStack.init({
    column: 12,
    cellHeight: 66,
    margin: 8,
    staticGrid: true,   // view mode — no drag/resize until "Edit dashboard"
    float: false,
    // Drag by the tile body, but never let the remove button start a drag.
    draggable: { handle: '.grid-stack-item-content', cancel: '.dash-remove' },
  }, gridEl);

  // ── responsive: collapse to a single column on narrow screens ──
  function applyResponsive() {
    const cols = window.innerWidth < 768 ? 1 : 12;
    if (grid.getColumn() !== cols) grid.column(cols);
  }
  let rzTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(rzTimer);
    rzTimer = setTimeout(applyResponsive, 200);
  });
  applyResponsive();

  const csrf = (document.querySelector('meta[name="csrf-token"]') || {}).content || '';

  // ── lazy-load graph tiles ──
  function loadGraph(graphEl) {
    if (!graphEl || graphEl.dataset.loaded) return Promise.resolve();
    graphEl.dataset.loaded = '1';
    const key = graphEl.dataset.graphKey;
    const body = graphEl.querySelector('.dash-graph-body');
    return fetch('/dashboard/graph/' + encodeURIComponent(key), {
      credentials: 'same-origin', headers: { 'Accept': 'text/html' },
    }).then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); })
      .then(function (html) {
        if (!body) return;
        body.innerHTML = html;
        // Mount any client-rendered tile content (e.g. the animated handicap).
        if (window.ApolloHandicapAnim) window.ApolloHandicapAnim.initAll(body);
      })
      .catch(function () {
        if (body) body.innerHTML =
          '<p class="dash-graph-empty">Could not load this graph.</p>';
      });
  }

  function pumpGraphs() {
    const pending = Array.prototype.slice.call(
      gridEl.querySelectorAll('.dash-graph:not([data-loaded])'));
    const MAX = 2;
    let i = 0, inFlight = 0;
    (function next() {
      while (inFlight < MAX && i < pending.length) {
        inFlight++;
        loadGraph(pending[i++]).finally(function () { inFlight--; next(); });
      }
    })();
  }
  pumpGraphs();

  // ── edit mode ──
  const toggleBtn = document.getElementById('dash-edit-toggle');
  const editActions = document.getElementById('dash-edit-actions');
  const statusEl = document.getElementById('dash-status');
  let editing = false;

  function setEditing(on) {
    editing = on;
    grid.setStatic(!on);
    gridEl.classList.toggle('dash-editing', on);
    if (editActions) editActions.hidden = !on;
    if (toggleBtn) toggleBtn.hidden = on;
    if (!on) hidePalette();
    if (statusEl) statusEl.textContent = '';
  }
  if (toggleBtn) toggleBtn.addEventListener('click', function () { setEditing(true); });
  const doneBtn = document.getElementById('dash-done');
  if (doneBtn) doneBtn.addEventListener('click', function () { setEditing(false); });

  // remove (event-delegated; only meaningful while editing)
  gridEl.addEventListener('click', function (e) {
    const btn = e.target.closest ? e.target.closest('.dash-remove') : null;
    if (!btn || !editing) return;
    const item = btn.closest('.grid-stack-item');
    if (item) grid.removeWidget(item);
  });

  // ── add-widget palette ──
  const palette = document.getElementById('dash-palette');
  const addBtn = document.getElementById('dash-add');
  const paletteClose = document.getElementById('dash-palette-close');
  function showPalette() { if (palette) { palette.hidden = false; refreshPalette(); } }
  function hidePalette() { if (palette) palette.hidden = true; }
  if (addBtn) addBtn.addEventListener('click', showPalette);
  if (paletteClose) paletteClose.addEventListener('click', hidePalette);

  function placedIds() {
    const s = new Set();
    grid.save(false).forEach(function (n) { if (n.id) s.add(n.id); });
    return s;
  }
  // Grey out widgets already on the grid so you can't add a second copy.
  function refreshPalette() {
    if (!palette) return;
    const placed = placedIds();
    palette.querySelectorAll('.dash-palette-item').forEach(function (b) {
      b.disabled = placed.has(b.dataset.wid);
    });
  }

  function tileInner(wid, kind, report, label) {
    const remove = '<button type="button" class="dash-remove" title="Remove widget" ' +
      'aria-label="Remove widget">×</button>';
    let body;
    if (kind === 'graph') {
      body = '<div class="dash-graph" data-graph-key="' + report + '">' +
             '<div class="dash-graph-title">' + label + '</div>' +
             '<div class="dash-graph-body"><span class="dash-graph-loading">Loading…</span>' +
             '</div></div>';
    } else {
      const tpl = document.querySelector(
        '#dash-widget-templates [data-tpl-id="' + wid + '"]');
      body = tpl ? tpl.innerHTML : '';
    }
    return '<div class="dash-tile dash-tile-' + kind + '">' + remove + body + '</div>';
  }

  function addWidget(wid, kind, report, label, w, h) {
    const item = document.createElement('div');
    item.className = 'grid-stack-item';
    item.setAttribute('gs-id', wid);
    item.setAttribute('gs-w', w);
    item.setAttribute('gs-h', h);
    item.innerHTML = '<div class="grid-stack-item-content">' +
      tileInner(wid, kind, report, label) + '</div>';
    gridEl.appendChild(item);
    grid.makeWidget(item);
    if (kind === 'graph') loadGraph(item.querySelector('.dash-graph'));
  }

  if (palette) {
    palette.querySelectorAll('.dash-palette-item').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.disabled) return;
        const label = b.querySelector('.dash-palette-label');
        addWidget(b.dataset.wid, b.dataset.kind, b.dataset.report,
                  label ? label.textContent : b.dataset.wid,
                  parseInt(b.dataset.w, 10) || 3, parseInt(b.dataset.h, 10) || 2);
        refreshPalette();
      });
    });
  }

  // ── save ──
  const saveBtn = document.getElementById('dash-save');
  if (saveBtn) saveBtn.addEventListener('click', function () {
    const layout = grid.save(false).map(function (n) {
      return { id: n.id, x: n.x, y: n.y, w: n.w, h: n.h };
    }).filter(function (n) { return n.id; });
    if (statusEl) statusEl.textContent = 'Saving…';
    fetch('/dashboard/save', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
      body: JSON.stringify({ layout: layout }),
    }).then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function () {
        if (statusEl) statusEl.textContent = 'Saved ✓';
        setTimeout(function () { setEditing(false); }, 700);
      })
      .catch(function () {
        if (statusEl) statusEl.textContent = 'Save failed — please try again.';
      });
  });
})();
