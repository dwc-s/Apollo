/* apollo-offline.js — offline shot capture + sync for /sesh.
 *
 * When navigator.onLine is false, a tap on the target is saved to an
 * IndexedDB queue instead of POSTed, the quiver state machine is run
 * client-side (mirroring the server in apollo.py:_insert_shot callers),
 * and the marker is drawn via the page's existing drawPastShots(). When
 * the connection returns, the whole queue is POSTed to /api/sync_shots and,
 * on success, cleared.
 *
 * Scope (v1): ordinary practice sessions. Tournament/match sessions
 * (window.APOLLO_IS_TOURNAMENT) never queue — they require a connection.
 *
 * Globals provided by session.html:
 *   window.APOLLO_SESSION_ID, window.APOLLO_IS_TOURNAMENT,
 *   window.APOLLO_CURRENT_QS, window.PAST_SHOTS, drawPastShots().
 */
(function () {
  'use strict';

  if (!('indexedDB' in window)) return;   // no queue without IndexedDB

  const DB_NAME = 'apollo-offline';
  const STORE = 'pending_shots';

  // ── IndexedDB helpers ──────────────────────────────────────────────────
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE, { keyPath: 'key', autoIncrement: true });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function tx(mode, fn) {
    return openDB().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const store = t.objectStore(STORE);
      let out;
      Promise.resolve(fn(store)).then((v) => { out = v; });
      t.oncomplete = () => resolve(out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    }));
  }

  function idbAdd(entry) {
    return tx('readwrite', (s) => s.add(entry));
  }
  function idbAll() {
    // getAll() returns records in key (insertion) order; each carries .key.
    return tx('readonly', (s) => new Promise((res) => {
      const r = s.getAll();
      r.onsuccess = () => res(r.result || []);
    }));
  }
  function idbDelete(keys) {
    return tx('readwrite', (s) => { keys.forEach((k) => s.delete(k)); });
  }

  // ── State + DOM ────────────────────────────────────────────────────────
  const state = { ar: 0, qc: 0, lockedQS: 0 };
  let recordedThisPage = false;
  let needsReloadAfterSync = false;
  let syncing = false;
  let initialQueueLen = 0;

  const $ = (id) => document.getElementById(id);
  const val = (id) => { const e = $(id); return e ? e.value : ''; };

  function csrfToken() {
    const e = document.querySelector('input[name="csrf_token"]');
    return e ? e.value : '';
  }
  function isTournament() { return !!window.APOLLO_IS_TOURNAMENT; }
  function readout() { return $('coord-readout'); }
  function setReadout(html) { const r = readout(); if (r) r.innerHTML = html; }

  function fields() {
    const tEl = document.querySelector('input[name="target_id"]') || $('target_id');
    const tagsEl = document.querySelector('input[name="session_tags"]');
    return {
      x: val('x_coord'), y: val('y_coord'),
      bow: val('bow'), arrow_type: val('arrow_type'),
      quiver_size: val('quiver_size'),
      distance: val('distance'),
      session_notes: val('session_notes'),
      session_tags: tagsEl ? tagsEl.value : '',
      target_id: tEl ? tEl.value : '',
    };
  }

  // Push the local counters back into the form so a later *online* shot,
  // and the visible read-outs, stay consistent without a round-trip.
  function syncDom() {
    const arIn = $('arrows_remaining'); if (arIn) arIn.value = state.ar;
    const qcIn = $('quivers_completed'); if (qcIn) qcIn.value = state.qc;
    const arDisp = $('arrows-remaining-display'); if (arDisp) arDisp.textContent = state.ar;
    const qcDisp = $('quivers-completed-display'); if (qcDisp) qcDisp.textContent = state.qc;
    const qsIn = $('quiver_size');
    if (qsIn) {
      if (state.lockedQS > 0) qsIn.value = state.lockedQS;
      // Locked while a quiver is in progress; unlocked between quivers so
      // the size can be adjusted (mirrors the server's quiver_size lock).
      const midQuiver = state.ar > 0 && state.ar < state.lockedQS;
      qsIn.readOnly = midQuiver;
    }
  }

  function isMissCoords(x, y) {
    return parseFloat(x) === 100000 && parseFloat(y) === 100000;
  }

  // ── Banner ─────────────────────────────────────────────────────────────
  let bannerEl = null;
  function banner() {
    if (bannerEl) return bannerEl;
    bannerEl = document.createElement('div');
    bannerEl.id = 'apollo-offline-banner';
    bannerEl.style.cssText = [
      'position:fixed', 'top:0', 'left:50%', 'transform:translateX(-50%)',
      'z-index:9999', 'padding:6px 16px', 'font:700 0.85rem/1.3 Quantico,sans-serif',
      'border-radius:0 0 10px 10px', 'box-shadow:0 2px 8px rgba(0,0,0,0.25)',
      'display:none', 'max-width:92vw', 'text-align:center', 'letter-spacing:.02em',
    ].join(';');
    document.body.appendChild(bannerEl);
    return bannerEl;
  }
  function setBanner(text, kind) {
    const b = banner();
    b.textContent = text;
    const palette = {
      offline: ['#7a3b00', '#ffe2c2'],
      ok: ['#0d3b16', '#c7efce'],
      warn: ['#5c1a1a', '#f3c7c7'],
    }[kind] || ['#1a3a5c', '#e8f0f8'];
    b.style.color = palette[0];
    b.style.background = palette[1];
    b.style.display = '';
  }
  function hideBanner() { if (bannerEl) bannerEl.style.display = 'none'; }

  function updateBanner() {
    if (!navigator.onLine) {
      idbAll().then((recs) => {
        setBanner(
          recs.length
            ? `Offline — ${recs.length} shot${recs.length === 1 ? '' : 's'} saved on device`
            : 'Offline — shots will be saved on device',
          'offline'
        );
      });
    } else {
      idbAll().then((recs) => { if (!recs.length) hideBanner(); });
    }
  }

  // ── Record a shot offline ────────────────────────────────────────────────
  function recordShot() {
    if (isTournament()) {
      setReadout('<span style="color:#c97a4a;font-weight:700;">Reconnect to continue tournament scoring</span>');
      return;
    }
    const f = fields();
    if (f.x === '' || f.y === '') return;

    const qsInput = parseInt(f.quiver_size, 10) || 0;
    const midQuiver = state.ar > 0 && state.ar < state.lockedQS;
    let effectiveQS;
    if (midQuiver) {
      effectiveQS = state.lockedQS;
    } else {
      effectiveQS = qsInput;
      state.lockedQS = qsInput;
      state.ar = qsInput;
    }
    if (effectiveQS <= 0) {
      setReadout('<span style="color:#c97a4a;font-weight:700;">Enter a quiver size first</span>');
      return;
    }

    const preDecrAR = state.ar;   // stored on the row; recall/redraw rely on it
    const entry = {
      session_id: window.APOLLO_SESSION_ID,
      ts: new Date().toISOString(),
      x_coord: f.x, y_coord: f.y,
      bow: f.bow, arrow_type: f.arrow_type,
      quiver_size: effectiveQS,
      arrows_remaining: preDecrAR,
      distance: f.distance,
      session_notes: f.session_notes,
      session_tags: f.session_tags,
      target_id: f.target_id,
      is_precise: 1, record_mode: 1,
    };

    idbAdd(entry).then(() => {
      // Advance the local quiver counters exactly as the server would.
      state.ar -= 1;
      let completed = false;
      if (state.ar <= 0) { state.qc += 1; state.ar = effectiveQS; completed = true; }
      syncDom();

      // Markers: match get_past_shots() — show the current quiver's hits,
      // and clear the canvas once a quiver closes.
      const miss = isMissCoords(f.x, f.y);
      if (completed) {
        window.PAST_SHOTS = [];
      } else if (!miss) {
        window.PAST_SHOTS = (window.PAST_SHOTS || []).concat([
          { x: parseFloat(f.x), y: parseFloat(f.y) },
        ]);
      }
      if (typeof drawPastShots === 'function') drawPastShots();

      setReadout(miss
        ? '<span style="color:#c97a4a;font-weight:700;">MISS SAVED (offline)</span>'
        : '<span style="color:#2e7d32;font-weight:700;">SHOT SAVED (offline)</span>');
      recordedThisPage = true;
      updateBanner();
    });
  }

  // ── Recall the most recent offline shot ──────────────────────────────────
  // Returns a Promise<boolean>: true if an offline shot was recalled, false
  // if the queue is empty (caller should then say recall isn't possible).
  function recallOffline() {
    return idbAll().then((recs) => {
      if (!recs.length) return false;
      const last = recs[recs.length - 1];
      return idbDelete([last.key]).then(() => {
        const rowAR = parseInt(last.arrows_remaining, 10) || 0;
        const rowQS = parseInt(last.quiver_size, 10) || 0;
        // Reverse the state machine (mirrors recall_arrow in apollo.py).
        if (rowAR === 1 && state.qc > 0) state.qc -= 1;
        state.ar = rowAR;
        if (rowQS > 0) state.lockedQS = rowQS;
        syncDom();
        // Best-effort marker rollback: pop the last drawn dot. (A recall of
        // the shot that *closed* a quiver can't fully restore the cleared
        // dots without server data — counters stay correct regardless.)
        if (!isMissCoords(last.x_coord, last.y_coord) &&
            Array.isArray(window.PAST_SHOTS) && window.PAST_SHOTS.length) {
          window.PAST_SHOTS = window.PAST_SHOTS.slice(0, -1);
        }
        if (typeof drawPastShots === 'function') drawPastShots();
        updateBanner();
        return true;
      });
    });
  }

  // ── Sync the queue to the server ─────────────────────────────────────────
  function syncNow() {
    if (!navigator.onLine || syncing) return Promise.resolve();
    return idbAll().then((recs) => {
      if (!recs.length) { updateBanner(); return; }
      syncing = true;
      const shots = recs.map((r) => {
        const { key, ...rest } = r;   // strip the IndexedDB key
        return rest;
      });
      const body = {
        shots,
        active: {
          session_id: window.APOLLO_SESSION_ID,
          arrows_remaining: state.ar,
          quivers_completed: state.qc,
          current_quiver_size: state.lockedQS || 0,
        },
      };
      return fetch('/api/sync_shots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken() },
        body: JSON.stringify(body),
      }).then((res) => res.json().catch(() => ({})).then((payload) => ({ res, payload })))
        .then(({ res, payload }) => {
          if (res.ok && payload.ok) {
            return idbDelete(recs.map((r) => r.key)).then(() => {
              const n = payload.inserted != null ? payload.inserted : recs.length;
              setBanner(`Synced ${n} shot${n === 1 ? '' : 's'} ✓`, 'ok');
              // If the page was rendered from a stale cookie (reopened with a
              // pending queue) and the server reconciled the active session,
              // reload so the counters/markers match server truth.
              if (needsReloadAfterSync && payload.reconciled) {
                setTimeout(() => window.location.assign('/sesh'), 1200);
              } else {
                setTimeout(updateBanner, 2500);
              }
            });
          }
          if (res.status === 409) {
            setBanner('Some shots couldn’t sync (session not found).', 'warn');
          } else {
            setBanner('Sync failed — will retry.', 'warn');
          }
        })
        .catch(() => { setBanner('Sync failed — will retry.', 'warn'); })
        .finally(() => { syncing = false; });
    });
  }

  // ── Init ───────────────────────────────────────────────────────────────
  function initState() {
    state.ar = parseInt(val('arrows_remaining'), 10) || 0;
    state.qc = parseInt(val('quivers_completed'), 10) || 0;
    state.lockedQS = parseInt(window.APOLLO_CURRENT_QS, 10) || 0;
    return idbAll().then((recs) => {
      initialQueueLen = recs.length;
      if (recs.length) {
        // Reopened with a pending queue: the rendered counters predate the
        // queued offline shots (the cookie was frozen offline). Replay each
        // queued shot's recorded pre-decrement counter to rebuild true state.
        needsReloadAfterSync = true;
        recs.forEach((r) => {
          state.lockedQS = parseInt(r.quiver_size, 10) || state.lockedQS;
          let ar = (parseInt(r.arrows_remaining, 10) || 0) - 1;
          if (ar <= 0) { state.qc += 1; ar = state.lockedQS; }
          state.ar = ar;
        });
        syncDom();
      }
    });
  }

  window.ApolloOffline = {
    isOffline: () => !navigator.onLine,
    recordShot,
    recallOffline,
    syncNow,
  };

  function boot() {
    initState().then(() => {
      updateBanner();
      if (navigator.onLine) syncNow();
    });
    window.addEventListener('online', () => { syncNow(); });
    window.addEventListener('offline', () => { updateBanner(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
