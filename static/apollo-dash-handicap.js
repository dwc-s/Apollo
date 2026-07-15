/* Animated handicap dashboard tile: draws the handicap-vs-time line on with a
 * stroke-dashoffset sweep, a moving head dot, dashed AGB class-threshold lines,
 * and a gold "ping" flash the first time the line crosses (achieves) each class.
 * Mounted per tile by apollo-dashboard.js loadGraph (window.ApolloHandicapAnim
 * .initAll(body)); data comes from /dashboard/graph/handicap_animated.
 */
(function () {
    'use strict';
    var NS = 'http://www.w3.org/2000/svg';
    function el(tag, attrs) {
        var e = document.createElementNS(NS, tag);
        for (var k in attrs) e.setAttribute(k, attrs[k]);
        return e;
    }

    function render(host, data) {
        var pts = (data.points || []).filter(function (p) {
            return p && typeof p.hc === 'number';
        });
        if (pts.length < 2) {
            host.innerHTML = '<p class="dash-graph-empty">Need at least two ' +
                'completed rounds to chart your handicap.</p>';
            return;
        }
        var W = 520, H = 280, ml = 10, mr = 66, mt = 16, mb = 24;
        var pw = W - ml - mr, ph = H - mt - mb;
        var hcs = pts.map(function (p) { return p.hc; });
        var yMin = Math.min.apply(null, hcs), yMax = Math.max.apply(null, hcs);
        var thr = (data.thresholds || []).filter(function (t) {
            return typeof t.hc === 'number' && t.hc >= yMin - 6 && t.hc <= yMax + 6;
        });
        thr.forEach(function (t) { yMin = Math.min(yMin, t.hc); yMax = Math.max(yMax, t.hc); });
        var span = (yMax - yMin) || 1;
        yMin -= span * 0.08; yMax += span * 0.08;

        function X(i) { return ml + (pts.length === 1 ? pw / 2 : pw * i / (pts.length - 1)); }
        // y inverted: lower handicap (better) sits higher on the chart.
        function Y(hc) { return mt + ph * (hc - yMin) / (yMax - yMin); }

        var svg = el('svg', {
            viewBox: '0 0 ' + W + ' ' + H, 'class': 'dash-hc-svg',
            preserveAspectRatio: 'xMidYMid meet', width: '100%', height: '100%'
        });
        thr.forEach(function (t) {
            var y = Y(t.hc);
            svg.appendChild(el('line', {
                x1: ml, y1: y, x2: ml + pw, y2: y,
                stroke: t.record ? '#c9a227' : '#95abcf', 'stroke-width': 1,
                'stroke-dasharray': '4 4', opacity: 0.7
            }));
            var lab = el('text', {
                x: ml + pw + 5, y: y + 3, fill: '#5a6b8a',
                'font-family': 'Quantico, sans-serif', 'font-size': 9
            });
            lab.textContent = t.code;
            svg.appendChild(lab);
        });
        var d = pts.map(function (p, i) {
            return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.hc).toFixed(1);
        }).join(' ');
        var path = el('path', {
            d: d, fill: 'none', stroke: '#21A4C8', 'stroke-width': 2.4,
            'stroke-linejoin': 'round', 'stroke-linecap': 'round'
        });
        svg.appendChild(path);
        var pingLayer = el('g', {});
        svg.appendChild(pingLayer);
        var head = el('circle', { r: 4, fill: '#FFC30E', stroke: '#1a3a5c', 'stroke-width': 1, cx: X(0), cy: Y(pts[0].hc) });
        svg.appendChild(head);
        host.innerHTML = '';
        host.appendChild(svg);

        var L = 0;
        try { L = path.getTotalLength(); } catch (e) { L = 0; }
        if (!L) return;   // not laid out (hidden tile) — line already drawn statically
        path.style.strokeDasharray = L;
        path.style.strokeDashoffset = L;

        // Cumulative path length to each vertex, for scheduling pings.
        var segLen = [0];
        for (var i = 1; i < pts.length; i++) {
            segLen[i] = segLen[i - 1] +
                Math.hypot(X(i) - X(i - 1), Y(pts[i].hc) - Y(pts[i - 1].hc));
        }
        // First vertex where the handicap reaches each nearby class.
        var crossings = [];
        thr.forEach(function (t) {
            for (var j = 0; j < pts.length; j++) {
                if (pts[j].hc <= t.hc) { crossings.push({ i: j, t: t }); break; }
            }
        });
        var fired = crossings.map(function () { return false; });

        function ping(x, y) {
            var c = el('circle', { cx: x, cy: y, r: 3, fill: 'none', stroke: '#FFC30E', 'stroke-width': 2 });
            pingLayer.appendChild(c);
            var s = null;
            (function grow(ts) {
                if (s === null) s = ts;
                var k = (ts - s) / 650;
                if (k >= 1) { c.remove(); return; }
                c.setAttribute('r', (3 + k * 16).toFixed(1));
                c.setAttribute('opacity', (1 - k).toFixed(2));
                requestAnimationFrame(grow);
            })();
        }

        var DUR = 2200, t0 = null;
        (function frame(ts) {
            if (t0 === null) t0 = ts;
            var k = Math.min(1, (ts - t0) / DUR);
            var drawn = L * k;
            path.style.strokeDashoffset = String(L - drawn);
            try {
                var pt = path.getPointAtLength(drawn);
                head.setAttribute('cx', pt.x); head.setAttribute('cy', pt.y);
            } catch (e) { /* ignore */ }
            crossings.forEach(function (cr, idx) {
                if (!fired[idx] && drawn >= segLen[cr.i]) {
                    fired[idx] = true;
                    ping(X(cr.i), Y(pts[cr.i].hc));
                }
            });
            if (k < 1) requestAnimationFrame(frame);
        })(performance.now());
    }

    function initAll(root) {
        (root || document).querySelectorAll('.dash-handicap-anim').forEach(function (host) {
            if (host.dataset.hcInit === '1') return;
            var data;
            try { data = JSON.parse(host.dataset.handicap); }
            catch (e) { return; }
            if (!data) return;
            host.dataset.hcInit = '1';
            render(host, data);
        });
    }

    window.ApolloHandicapAnim = { initAll, render };
    if (document.readyState !== 'loading') { initAll(); }
    else { document.addEventListener('DOMContentLoaded', function () { initAll(); }); }
})();
