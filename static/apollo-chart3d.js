/* Client-rendered 3D charts (Plotly). Each host is
 *   <div class="chart3d-host" data-chart3d='{"kind":"mountain", ...}'></div>
 * shipped by an /analyze report fn (raw arrays instead of a matplotlib SVG).
 * Kinds: 'mountain' (shot-density KDE surface), 'cone' (angular dispersion vs
 * distance), 'coresample' (x,y,time scatter), 'landscape' (expected-score
 * surface). Call window.ApolloChart3d.initAll(root) per streamed-in card
 * (analyze.html initCard), mirroring ApolloReplay.initAll.
 */
(function () {
    'use strict';

    var INK = '#1a3a5c', TEAL = '#21A4C8', PURPLE = '#8E43FE', GOLD = '#FFC30E';
    var FONT = { color: INK, family: 'Quantico, sans-serif', size: 12 };
    // Warm density ramp for the mountain (kept distinct from the teal/purple
    // analyze palette, matching the flat heatmap it elevates).
    var DENSITY = 'YlOrRd';
    // Teal→purple time ramp for the history core-sample.
    var TIME_SCALE = [[0, '#B9D8E4'], [0.5, TEAL], [1, PURPLE]];

    function config() {
        return {
            responsive: true, displaylogo: false,
            modeBarButtonsToRemove: ['sendDataToCloud', 'toImage', 'resetCameraLastSave3d'],
            scrollZoom: true,
        };
    }

    function layout(title, ax) {
        return {
            title: { text: title, font: { color: INK, family: 'Quantico, sans-serif', size: 15 } },
            paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
            font: FONT, margin: { l: 0, r: 0, t: 34, b: 0 },
            autosize: true, showlegend: !!ax.legend,
            legend: { x: 0, y: 1, font: FONT },
            scene: {
                xaxis: { title: ax.x, color: INK, gridcolor: 'rgba(26,58,92,0.12)', zerolinecolor: 'rgba(26,58,92,0.3)' },
                yaxis: { title: ax.y, color: INK, gridcolor: 'rgba(26,58,92,0.12)', zerolinecolor: 'rgba(26,58,92,0.3)' },
                zaxis: { title: ax.z, color: INK, gridcolor: 'rgba(26,58,92,0.12)', zerolinecolor: 'rgba(26,58,92,0.3)' },
                aspectmode: ax.aspectmode || 'auto',
                camera: { eye: ax.eye || { x: 1.5, y: 1.5, z: 1.1 } },
            },
        };
    }

    function toCm(a) { return (a || []).map(function (v) { return v / 10; }); }

    function mountain(host, d) {
        var trace = {
            type: 'surface', z: d.z, x: toCm(d.x), y: toCm(d.y),
            colorscale: DENSITY, showscale: true,
            colorbar: { title: 'shots', thickness: 12, len: 0.6, tickfont: FONT },
            contours: { z: { show: true, usecolormap: true, project: { z: true } } },
        };
        Plotly.newPlot(host, [trace],
            layout(d.title || 'Shot-density mountain',
                { x: 'left / right (cm)', y: 'up / down (cm)', z: 'density',
                  eye: { x: 1.4, y: -1.5, z: 0.9 } }),
            config());
    }

    function cone(host, d) {
        var traces = [];
        function rings(list, color, name, width) {
            (list || []).forEach(function (rg, i) {
                traces.push({
                    type: 'scatter3d', mode: 'lines',
                    x: toCm(rg.xs), y: toCm(rg.ys),
                    z: rg.xs.map(function () { return rg.d; }),
                    line: { color: color, width: width }, opacity: 0.9,
                    showlegend: i === 0, name: name, hoverinfo: 'skip',
                });
            });
        }
        rings(d.rings, TEAL, 'Your group (R95)', 4);
        if (d.ref && d.ref.length) rings(d.ref, PURPLE, 'Reference archer', 2);
        var lay = layout(d.title || 'Dispersion cone vs distance',
            { x: 'left / right (cm)', y: 'up / down (cm)', z: 'distance (m)',
              legend: true, eye: { x: 1.7, y: 1.7, z: 0.6 } });
        Plotly.newPlot(host, traces, lay, config());
    }

    function coresample(host, d) {
        var pts = d.pts || [];
        var trace = {
            type: 'scatter3d', mode: 'markers',
            x: pts.map(function (p) { return p.x; }),
            y: pts.map(function (p) { return p.y; }),
            z: pts.map(function (p) { return p.t; }),
            marker: {
                size: 3, opacity: 0.75,
                color: pts.map(function (p) { return p.t; }),
                colorscale: TIME_SCALE,
                colorbar: { title: 'days', thickness: 12, len: 0.6, tickfont: FONT },
            },
            hoverinfo: 'skip',
        };
        Plotly.newPlot(host, [trace],
            layout(d.title || 'History core-sample',
                { x: 'left / right (norm)', y: 'up / down (norm)', z: 'days since first shot',
                  eye: { x: 1.6, y: 1.6, z: 0.8 } }),
            config());
    }

    function landscape(host, d) {
        var traces = [{
            type: 'surface', z: d.z, x: d.x, y: d.y,
            colorscale: 'Viridis', opacity: 0.92, showscale: true,
            colorbar: { title: 'pts/arrow', thickness: 12, len: 0.6, tickfont: FONT },
        }];
        if (d.you) {
            traces.push({
                type: 'scatter3d', mode: 'markers+text',
                x: [d.you[0]], y: [d.you[1]], z: [d.you[2]],
                marker: { size: 6, color: GOLD, line: { color: INK, width: 1 } },
                text: ['you'], textposition: 'top center',
                textfont: { color: INK, family: 'Quantico, sans-serif', size: 12 },
                name: 'you', showlegend: false, hoverinfo: 'text',
            });
        }
        Plotly.newPlot(host, traces,
            layout(d.title || 'Score landscape',
                { x: 'distance (m)', y: 'handicap', z: 'expected pts / arrow',
                  eye: { x: 1.7, y: 1.5, z: 0.9 } }),
            config());
    }

    var KINDS = { mountain: mountain, cone: cone, coresample: coresample, landscape: landscape };

    function render(host, data) {
        var fn = KINDS[data.kind];
        if (!fn) { console.warn('Apollo: unknown chart3d kind', data.kind); return; }
        try { fn(host, data); }
        catch (e) { console.error('Apollo chart3d render failed', data.kind, e); }
    }

    function initAll(root) {
        if (typeof Plotly === 'undefined') return;
        (root || document).querySelectorAll('[data-chart3d]').forEach(function (host) {
            if (host.dataset.chart3dInit === '1') return;
            var data;
            try { data = JSON.parse(host.dataset.chart3d); }
            catch (e) { console.warn('Apollo: bad chart3d JSON', e); return; }
            if (!data || !data.kind) return;
            host.dataset.chart3dInit = '1';
            render(host, data);
        });
    }

    window.ApolloChart3d = { initAll, render };

    if (document.readyState !== 'loading') { initAll(); }
    else { document.addEventListener('DOMContentLoaded', function () { initAll(); }); }
})();
