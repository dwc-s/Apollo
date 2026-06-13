/* Shared shot-display — all arrows drawn at once, no animation, as a
 * resolution-independent inline SVG so the thumbnail stays crisp at any
 * size / pixel density.
 *
 * Each host element carries its own target params (vector face spec and/or
 * raster image URL + physical mm per edge) as data-attrs so multiple
 * displays on one page can coexist:
 *   <div class="shot-replay"
 *        data-shots='[{"x":"-12.4","y":"40.0"}, ...]'
 *        data-record-mode="0"
 *        data-face-render='{"face_bg":"#fff","rings":[...],...}'  (or "null")
 *        data-target-image="/static/targets/nasp_40cm.jpg"
 *        data-target-width-mm="400.0"
 *        data-img-width="1197"></div>
 *
 * When data-face-render carries a vector ring spec the face is drawn as SVG
 * circles (crisp at any scale); otherwise the raster target image is embedded
 * as an <image> fallback. Shot markers and crosshair are always vector.
 *
 * Call window.ApolloReplay.initAll() once the hosts exist in the DOM
 * (templates that source this file with `defer` get this for free via the
 * DOMContentLoaded auto-init below).
 */
(function () {
    'use strict';

    const SVGNS = 'http://www.w3.org/2000/svg';
    const XLINKNS = 'http://www.w3.org/1999/xlink';

    // Fixed SVG user-space edge. The host element is sized in CSS; the SVG
    // scales to fill it, so marker sizes below are proportional regardless of
    // the on-screen size (220 px thumbnails, 280 px analyze blocks, …).
    const VIEW = 220;

    function svgEl(tag, attrs) {
        const el = document.createElementNS(SVGNS, tag);
        if (attrs) {
            for (const k in attrs) el.setAttribute(k, attrs[k]);
        }
        return el;
    }

    // Cheap luminance check on a #rrggbb fill — dark zones get a light mark,
    // light zones a dark mark. Mirrors the live target editor's logic.
    function contrastingMark(hex) {
        if (typeof hex !== 'string') return '#1a3a5c';
        const m = hex.replace('#', '');
        if (m.length !== 6) return '#1a3a5c';
        const r = parseInt(m.slice(0, 2), 16);
        const g = parseInt(m.slice(2, 4), 16);
        const b = parseInt(m.slice(4, 6), 16);
        if ([r, g, b].some(v => isNaN(v))) return '#1a3a5c';
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        return lum > 140 ? '#1a3a5c' : '#ffffff';
    }

    function cartToView(x, y, scale) {
        return { cx: VIEW / 2 + x * scale, cy: VIEW / 2 - y * scale };
    }

    // Draw the target face: vector rings when we have a face spec, else the
    // raster image, else a black disc. Returns nothing — appends to `svg`.
    function drawFace(svg, faceRender, imgUrl, scale) {
        const rings = (faceRender && faceRender.rings) || [];
        if (rings.length && scale > 0) {
            if (faceRender.face_bg) {
                svg.appendChild(svgEl('rect', {
                    x: 0, y: 0, width: VIEW, height: VIEW, fill: faceRender.face_bg
                }));
            }
            const centers = (faceRender.multi_spot &&
                             Array.isArray(faceRender.multi_spot.centers_mm))
                ? faceRender.multi_spot.centers_mm
                : [[0, 0]];
            centers.forEach(c => {
                const { cx, cy } = cartToView(c[0], c[1], scale);
                rings.forEach(ring => {
                    svg.appendChild(svgEl('circle', {
                        cx, cy, r: ring.radius_mm * scale,
                        fill: ring.color,
                        stroke: contrastingMark(ring.color),
                        'stroke-width': 0.5
                    }));
                });
                if (faceRender.center_mark) {
                    drawCenterMark(svg, cx, cy, faceRender, rings, scale);
                }
            });
        } else if (imgUrl) {
            const im = svgEl('image', {
                x: 0, y: 0, width: VIEW, height: VIEW,
                preserveAspectRatio: 'xMidYMid slice'
            });
            im.setAttribute('href', imgUrl);
            im.setAttributeNS(XLINKNS, 'href', imgUrl);
            svg.appendChild(im);
        } else {
            svg.appendChild(svgEl('rect',
                { x: 0, y: 0, width: VIEW, height: VIEW, fill: '#000' }));
        }
        // Subtle dashed crosshair over whatever face we drew.
        const ch = svgEl('g', {
            stroke: 'rgba(0,0,0,0.18)', 'stroke-width': 0.6,
            'stroke-dasharray': '3 4'
        });
        ch.appendChild(svgEl('line', { x1: VIEW / 2, y1: 0, x2: VIEW / 2, y2: VIEW }));
        ch.appendChild(svgEl('line', { x1: 0, y1: VIEW / 2, x2: VIEW, y2: VIEW / 2 }));
        svg.appendChild(ch);
    }

    function drawCenterMark(svg, cx, cy, faceRender, rings, scale) {
        const xMm = parseFloat(faceRender.x_ring_mm) || 0;
        const arm = Math.max(2.0, xMm * 0.55) * scale;
        const stroke = Math.max(1.2, Math.max(1.0, xMm * 0.08) * scale);
        const innerColor = (rings[rings.length - 1] &&
                            rings[rings.length - 1].color) || '#ffffff';
        const markColor = contrastingMark(innerColor);
        const g = svgEl('g', {
            stroke: markColor, 'stroke-width': stroke, 'stroke-linecap': 'round'
        });
        if (faceRender.center_mark === 'cross') {
            g.appendChild(svgEl('line', { x1: cx - arm, y1: cy, x2: cx + arm, y2: cy }));
            g.appendChild(svgEl('line', { x1: cx, y1: cy - arm, x2: cx, y2: cy + arm }));
        } else if (faceRender.center_mark === 'x') {
            const d = arm * 0.7071;
            g.appendChild(svgEl('line', { x1: cx - d, y1: cy - d, x2: cx + d, y2: cy + d }));
            g.appendChild(svgEl('line', { x1: cx - d, y1: cy + d, x2: cx + d, y2: cy - d }));
        }
        svg.appendChild(g);
    }

    function drawSettledMarker(svg, cx, cy, index, showSeq) {
        const arm = 8;
        const g = svgEl('g', {});
        const cross = svgEl('g', {
            stroke: '#fcba03', 'stroke-width': 1.5, 'stroke-linecap': 'round'
        });
        cross.appendChild(svgEl('line', { x1: cx - arm, y1: cy, x2: cx + arm, y2: cy }));
        cross.appendChild(svgEl('line', { x1: cx, y1: cy - arm, x2: cx, y2: cy + arm }));
        g.appendChild(cross);
        const r = showSeq ? 7 : 4;
        g.appendChild(svgEl('circle', {
            cx, cy, r, fill: 'rgba(252,186,3,0.85)',
            stroke: '#fcba03', 'stroke-width': 1
        }));
        if (showSeq) {
            const t = svgEl('text', {
                x: cx, y: cy, fill: '#000',
                'font-family': 'Quantico, sans-serif', 'font-size': 8,
                'font-weight': 'bold', 'text-anchor': 'middle',
                'dominant-baseline': 'central'
            });
            t.textContent = String(index + 1);
            g.appendChild(t);
        }
        svg.appendChild(g);
    }

    function drawMissMarker(svg, index) {
        const offsetX = (index % 5) * 18 - 36;
        const cx = VIEW / 2 + offsetX;
        const cy = VIEW - 14;
        const g = svgEl('g', {});
        const x = svgEl('g', {
            stroke: '#e53935', 'stroke-width': 2, 'stroke-linecap': 'round'
        });
        x.appendChild(svgEl('line', { x1: cx - 6, y1: cy - 6, x2: cx + 6, y2: cy + 6 }));
        x.appendChild(svgEl('line', { x1: cx + 6, y1: cy - 6, x2: cx - 6, y2: cy + 6 }));
        g.appendChild(x);
        const t = svgEl('text', {
            x: cx, y: cy + 9, fill: '#e53935',
            'font-family': 'Quantico, sans-serif', 'font-size': 8,
            'font-weight': 'bold', 'text-anchor': 'middle',
            'dominant-baseline': 'hanging'
        });
        t.textContent = 'M' + (index + 1);
        g.appendChild(t);
        svg.appendChild(g);
    }

    function startReplay(host, shots) {
        const showSeq   = parseInt(host.dataset.recordMode || '0', 10) === 0;
        const mmPerEdge = parseFloat(host.dataset.targetWidthMm) || 0;
        const imgUrl    = host.dataset.targetImage || '';
        let faceRender  = null;
        try { faceRender = JSON.parse(host.dataset.faceRender || 'null'); }
        catch (e) { faceRender = null; }

        const scale = mmPerEdge > 0 ? VIEW / mmPerEdge : 0;

        const svg = svgEl('svg', {
            viewBox: '0 0 ' + VIEW + ' ' + VIEW,
            preserveAspectRatio: 'xMidYMid meet'
        });
        svg.setAttribute('class', 'shot-replay-svg');

        drawFace(svg, faceRender, imgUrl, scale);

        if (scale > 0) {
            shots.forEach((raw, i) => {
                const xVal = parseFloat(raw.x);
                const yVal = parseFloat(raw.y);
                if (raw.x === '' || isNaN(xVal) || isNaN(yVal)) return;
                const isMiss = raw.miss === true
                            || (xVal === 100000 && yVal === 100000);
                if (isMiss) {
                    drawMissMarker(svg, i);
                } else {
                    const { cx, cy } = cartToView(xVal, yVal, scale);
                    drawSettledMarker(svg, cx, cy, i, showSeq);
                }
            });
        }

        host.textContent = '';
        host.appendChild(svg);
    }

    function initAll(root) {
        (root || document).querySelectorAll('.shot-replay').forEach(host => {
            if (host.dataset.replayInitialized === '1') return;
            let shots;
            try   { shots = JSON.parse(host.dataset.shots); }
            catch (e) { console.warn('Apollo: bad shot JSON', e); return; }
            if (!shots || shots.length === 0) return;
            host.dataset.replayInitialized = '1';
            startReplay(host, shots);
        });
    }

    window.ApolloReplay = { initAll, startReplay };

    if (document.readyState !== 'loading') {
        initAll();
    } else {
        document.addEventListener('DOMContentLoaded', () => initAll());
    }
})();
