/* Animated shot player — plays a sequence of frames onto a target face:
 *   kind 'evolution' — one frame per session: the whole group is shown, and the
 *        centroid (teal cross) + R95 ring (purple) glide/breathe between
 *        sessions, with a centroid trail. Coords are NORMALIZED (edge = 1.0),
 *        drawn on a generic ring face at mm_per_edge = 2.0.
 *   kind 'session'   — one frame per arrow within a single session: arrows land
 *        one at a time (cumulative), the running score ticks up, and the group
 *        tightens then loosens. Coords are real millimetres on the real face.
 *
 * Host: <div class="anim-host" data-anim='{...}'></div>. Reuses the face/marker
 * primitives exported by apollo-replay.js so the face is drawn identically.
 * Call window.ApolloAnim.initAll(root) after the hosts exist (analyze.html does
 * this per streamed-in report card, mirroring ApolloReplay.initAll).
 */
(function () {
    'use strict';

    function h(tag, cls, parent) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (parent) parent.appendChild(e);
        return e;
    }

    function buildPlayer(host, data) {
        var R = window.ApolloReplay;
        if (!R) return;
        var frames = data.frames || [];
        if (!frames.length) return;

        var VIEW = R.VIEW;
        var mmEdge = parseFloat(data.mm_per_edge) || 2.0;
        var scale = mmEdge > 0 ? VIEW / mmEdge : 0;
        var append = data.kind === 'session';   // cumulative vs replace

        host.textContent = '';
        var wrap = h('div', 'anim-wrap', host);
        var stage = h('div', 'anim-stage', wrap);
        var side = h('div', 'anim-side', wrap);

        // ── Face SVG (drawn once) + overlay layers ─────────────────────────
        var svg = R.svgEl('svg', {
            viewBox: '0 0 ' + VIEW + ' ' + VIEW,
            preserveAspectRatio: 'xMidYMid meet', 'class': 'anim-svg'
        });
        R.drawFace(svg, data.face_render || null, data.target_image_url || '', scale);
        var markerLayer = R.svgEl('g', {});
        svg.appendChild(markerLayer);
        var trailEl = R.svgEl('polyline', {
            fill: 'none', stroke: '#21A4C8', 'stroke-width': 1.4,
            'stroke-opacity': '0.4', 'stroke-linejoin': 'round'
        });
        svg.appendChild(trailEl);
        var ring = R.svgEl('circle', {
            cx: VIEW / 2, cy: VIEW / 2, r: 0, fill: 'none',
            stroke: '#8E43FE', 'stroke-width': 2, 'stroke-dasharray': '5 5'
        });
        ring.style.transition = 'cx .5s ease, cy .5s ease, r .5s ease';
        svg.appendChild(ring);
        var cent = R.svgEl('g', {});
        cent.appendChild(R.svgEl('line', { x1: -7, y1: 0, x2: 7, y2: 0, stroke: '#21A4C8', 'stroke-width': 2.4 }));
        cent.appendChild(R.svgEl('line', { x1: 0, y1: -7, x2: 0, y2: 7, stroke: '#21A4C8', 'stroke-width': 2.4 }));
        cent.setAttribute('transform', 'translate(' + (VIEW / 2) + ',' + (VIEW / 2) + ')');
        cent.style.transition = 'transform .5s ease';
        svg.appendChild(cent);
        stage.appendChild(svg);

        // ── Side HUD ───────────────────────────────────────────────────────
        var label = h('div', 'anim-label', side);
        var hud = h('div', 'anim-hud', side);

        // ── Controls ────────────────────────────────────────────────────────
        var ctl = h('div', 'anim-ctl', wrap);
        var btn = h('button', 'anim-btn', ctl);
        btn.type = 'button'; btn.textContent = '▶';
        var slider = h('input', 'anim-slider', ctl);
        slider.type = 'range'; slider.min = '0';
        slider.max = String(frames.length - 1); slider.value = '0';
        slider.setAttribute('aria-label', 'Scrub frames');

        var trail = [];
        var drawn = 0;      // markers currently in the layer (append mode)
        var lastI = -1;

        function marker(m, isNew) {
            if (m.miss) return;
            var p = R.cartToView(m.x, m.y, scale);
            var mk = R.svgEl('circle', {
                cx: p.cx.toFixed(1), cy: p.cy.toFixed(1), r: 3.4,
                fill: '#ffffff', stroke: '#1a3a5c', 'stroke-width': 1
            });
            mk.setAttribute('class', isNew ? 'anim-mark anim-pop' : 'anim-mark');
            markerLayer.appendChild(mk);
        }

        function render(i) {
            var f = frames[i];
            var ms = f.markers || [];
            if (append && i > lastI) {
                // Forward: append only the newly-landed arrows, pop the latest.
                for (var k = drawn; k < ms.length; k++) marker(ms[k], k === ms.length - 1);
                drawn = ms.length;
            } else {
                // Replace (evolution) or backward scrub: rebuild from scratch.
                markerLayer.textContent = '';
                for (var j = 0; j < ms.length; j++) marker(ms[j], !append);
                drawn = ms.length;
            }
            if (f.centroid) {
                var c = R.cartToView(f.centroid[0], f.centroid[1], scale);
                cent.setAttribute('transform', 'translate(' + c.cx.toFixed(1) + ',' + c.cy.toFixed(1) + ')');
                ring.setAttribute('cx', c.cx.toFixed(1));
                ring.setAttribute('cy', c.cy.toFixed(1));
                if (f.r95 != null) ring.setAttribute('r', Math.max(3, f.r95 * scale).toFixed(1));
                trail.push([c.cx, c.cy]);
                if (trail.length > 18) trail.shift();
                trailEl.setAttribute('points', trail.map(function (p) {
                    return p[0].toFixed(1) + ',' + p[1].toFixed(1);
                }).join(' '));
            }
            hud.innerHTML = (f.hud || []).map(function (kv) {
                return '<div class="anim-row"><span>' + kv[0] + '</span><b>' + kv[1] + '</b></div>';
            }).join('');
            label.textContent = f.label || ('Frame ' + (i + 1));
            slider.value = String(i);
            lastI = i;
        }

        var idx = 0, timer = null;
        var interval = append ? 260 : 1100;

        function goto(i, viaScrub) {
            var n = frames.length;
            var wrapAround = i >= n;
            idx = ((i % n) + n) % n;
            if (wrapAround || viaScrub) { trail = []; }  // reset trail on loop / jump
            render(idx);
        }
        function play() {
            if (timer) return;
            btn.textContent = '❚❚';
            timer = setInterval(function () { goto(idx + 1, false); }, interval);
        }
        function pause() { clearInterval(timer); timer = null; btn.textContent = '▶'; }

        btn.addEventListener('click', function () { timer ? pause() : play(); });
        slider.addEventListener('input', function () {
            pause();
            goto(parseInt(slider.value, 10), true);
        });

        goto(0, true);
        play();
    }

    function initAll(root) {
        if (!window.ApolloReplay) return;
        (root || document).querySelectorAll('[data-anim]').forEach(function (host) {
            if (host.dataset.animInit === '1') return;
            var data;
            try { data = JSON.parse(host.dataset.anim); }
            catch (e) { console.warn('Apollo: bad anim JSON', e); return; }
            if (!data || !data.frames || !data.frames.length) return;
            host.dataset.animInit = '1';
            buildPlayer(host, data);
        });
    }

    window.ApolloAnim = { initAll, buildPlayer };

    if (document.readyState !== 'loading') { initAll(); }
    else { document.addEventListener('DOMContentLoaded', function () { initAll(); }); }
})();
