// Distance unit conversion — shared by session.html and edit_session.html.
//
// Distance is stored in metres everywhere (like coordinates, which are always
// mm). The archer types in their chosen unit: each page keeps a hidden
// #distance (canonical metres — the value actually submitted / queued offline)
// beside a visible #distance_display. These helpers convert between the two so
// an Imperial entry never reaches the DB as yards.
//
// Exposed on window because each page's inline script calls them. Must be
// loaded (non-defer) BEFORE that inline script, which calls the helpers
// synchronously. Kept in an IIFE so UNITS_KEY / M_PER_YARD don't collide with
// the `const UNITS_KEY` each page already declares.
(function () {
    // Must match the units-toggle storage key the pages use.
    const UNITS_KEY = 'apollo_units';
    const M_PER_YARD = 0.9144;
    function imperial() { return localStorage.getItem(UNITS_KEY) === 'imperial'; }

    function distanceToMetres(shown) {       // visible (user unit) → canonical metres
        const n = parseFloat(shown);
        if (isNaN(n)) return '';
        return imperial() ? String(Math.round(n * M_PER_YARD * 100) / 100)
                          : String(n);
    }
    function distanceToDisplay(metres) {     // canonical metres → visible (user unit)
        const n = parseFloat(metres);
        if (isNaN(n)) return '';
        return imperial() ? String(Math.round(n / M_PER_YARD * 100) / 100)
                          : String(n);
    }
    function syncDistanceDisplay() {         // re-render the visible field from canonical
        const dEl = document.getElementById('distance');
        const vEl = document.getElementById('distance_display');
        if (dEl && vEl) vEl.value = distanceToDisplay(dEl.value);
    }

    window.distanceToMetres = distanceToMetres;
    window.distanceToDisplay = distanceToDisplay;
    window.syncDistanceDisplay = syncDistanceDisplay;
})();
