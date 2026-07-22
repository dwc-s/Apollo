/* Per-field unit toggles.
 *
 * Any <input data-unit="KIND"> gets a small unit button rendered beside it.
 * Each KIND (length, mass, diameter, drawweight, targetsize) remembers its own
 * chosen unit *independently* in localStorage — so you can keep arrow length in
 * inches while weights read in grains — and clicking any one field's button
 * flips every field of that kind on the page together.
 *
 * The value stored in the DB is always the field's CANONICAL unit (inches for
 * length, grams for mass, mm for diameter/target sizes, lb for draw weight) —
 * unchanged from before this control existed, so existing data and the reports
 * that read it are untouched. The button only changes how the number is shown
 * and entered: on load the canonical value is converted into the chosen unit,
 * and on submit it is converted back, so the server never sees a display unit.
 *
 * Self-contained (no dependency on the older global apollo-units.js, which still
 * drives the session distance field and the display-only pages). Load with a
 * plain <script> tag near </body>.
 */
(function () {
    'use strict';

    // canonical = display × per;  display = canonical ÷ per.
    // `def` is the unit shown until the user picks otherwise (persisted per kind).
    var KINDS = {
        length: {
            def: 'cm',
            units: {
                cm: { label: 'cm', per: 0.3937007874, dp: 1 },
                in: { label: 'in', per: 1, dp: 2 },
            },
        },
        mass: {   // archery convention weighs components in grains → default gr
            def: 'gr',
            units: {
                g:  { label: 'g',  per: 1, dp: 2 },
                gr: { label: 'gr', per: 0.06479891, dp: 1 },
            },
        },
        diameter: {
            def: 'mm',
            units: {
                mm: { label: 'mm', per: 1, dp: 2 },
                in: { label: 'in', per: 25.4, dp: 4 },
            },
        },
        drawweight: {
            def: 'lb',
            units: {
                lb: { label: 'lb', per: 1, dp: 1 },
                kg: { label: 'kg', per: 2.2046226218, dp: 2 },
            },
        },
        targetsize: {
            def: 'mm',
            units: {
                mm: { label: 'mm', per: 1, dp: 1 },
                in: { label: 'in', per: 25.4, dp: 3 },
            },
        },
    };

    var registry = {};   // kind → [ {input, btn} ]

    function storageKey(kind) { return 'apollo_unit_' + kind; }

    function unitFor(kind) {
        var cfg = KINDS[kind];
        var saved = null;
        try { saved = localStorage.getItem(storageKey(kind)); } catch (e) { /* private mode */ }
        return (saved && cfg.units[saved]) ? saved : cfg.def;
    }

    function setUnit(kind, u) {
        try { localStorage.setItem(storageKey(kind), u); } catch (e) { /* ignore */ }
    }

    function otherUnit(kind, u) {
        var keys = Object.keys(KINDS[kind].units);
        return keys[0] === u ? keys[1] : keys[0];
    }

    function round(n, dp) {
        var f = Math.pow(10, dp);
        return Math.round(n * f) / f;
    }

    function toDisplay(canonStr, kind, unit) {
        var n = parseFloat(canonStr);
        if (isNaN(n)) return '';
        var u = KINDS[kind].units[unit];
        return String(round(n / u.per, u.dp));
    }

    function toCanon(dispStr, kind, unit) {
        var n = parseFloat(dispStr);
        if (isNaN(n)) return '';
        var u = KINDS[kind].units[unit];
        // Keep canonical to 6 dp so a round-trip through grains/inches doesn't
        // accumulate error, then trim any trailing zeros.
        return String(round(n * u.per, 6));
    }

    function renderKind(kind) {
        var unit = unitFor(kind);
        (registry[kind] || []).forEach(function (rec) {
            rec.input.value = toDisplay(rec.input.dataset.canon, kind, unit);
            rec.btn.textContent = KINDS[kind].units[unit].label + ' ⇄';
            rec.btn.title = 'Shown in ' + KINDS[kind].units[unit].label +
                ' — click to switch to ' +
                KINDS[kind].units[otherUnit(kind, unit)].label;
        });
    }

    function wire(input) {
        var kind = input.dataset.unit;
        if (!KINDS[kind]) return;
        if (input.dataset.unitInit === '1') return;
        input.dataset.unitInit = '1';

        // The value rendered by the server is canonical; stash it before we
        // overwrite the visible field with the chosen display unit. Sanitize to
        // a number-or-empty so a NULL that Jinja rendered as the literal "None"
        // (or any stray text) can't round-trip back to the server on submit.
        var init = (input.value || '').trim();
        input.dataset.canon = isNaN(parseFloat(init)) ? '' : init;

        // Wrap the input so the button can sit inline beside it.
        var wrap = document.createElement('span');
        wrap.className = 'unit-field';
        input.parentNode.insertBefore(wrap, input);
        wrap.appendChild(input);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'unit-btn';
        wrap.appendChild(btn);

        (registry[kind] = registry[kind] || []).push({ input: input, btn: btn });

        // Typing updates the canonical form for the current unit, so a later
        // toggle (or submit) reflects what the user actually entered.
        input.addEventListener('input', function () {
            input.dataset.canon = toCanon(input.value, kind, unitFor(kind));
        });

        btn.addEventListener('click', function () {
            setUnit(kind, otherUnit(kind, unitFor(kind)));
            renderKind(kind);
        });
    }

    function initAll(root) {
        (root || document).querySelectorAll('input[data-unit]').forEach(wire);
        Object.keys(registry).forEach(renderKind);

        // On submit, hand the server the canonical value for every unit field
        // in the form (browsers submit input.value, so we swap it in place).
        (root || document).querySelectorAll('form').forEach(function (form) {
            if (form.dataset.unitSubmit === '1') return;
            form.dataset.unitSubmit = '1';
            form.addEventListener('submit', function () {
                form.querySelectorAll('input[data-unit]').forEach(function (input) {
                    input.value = input.dataset.canon || '';
                });
            });
        });
    }

    window.ApolloFieldUnits = { initAll: initAll };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { initAll(); });
    } else {
        initAll();
    }
})();
