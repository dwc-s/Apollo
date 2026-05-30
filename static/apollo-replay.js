/* Shared shot-replay canvas animation.
 *
 * Each canvas carries its own target params (image URL + physical mm per
 * edge) as data-attrs so multiple replays on one page can coexist:
 *   <canvas class="shot-replay"
 *           data-shots='[{"x":"-12.4","y":"40.0"}, ...]'
 *           data-record-mode="0"
 *           data-target-image="/static/targets/nasp_40cm.jpg"
 *           data-target-width-mm="400.0"
 *           data-img-width="1197">
 *
 * Call window.ApolloReplay.initAll() once the canvases exist in the DOM
 * (templates that source this file from <head> via `defer` get this for
 * free via the DOMContentLoaded auto-init below).
 */
(function () {
    'use strict';

    // Canvas size used to be a global constant; it now comes from each
    // <canvas>'s own width attr so the same JS works for the 360px replays
    // on /previous_sessions and the smaller side-by-side ones on /analyze.
    const SHOT_INTERVAL_MS   = 400;   // 2x speed (800 = 1x)
    const IMPACT_DURATION_MS = 1000;
    const LOOP_PAUSE_MS      = 500;

    // Cache loaded Image objects by URL so multiple canvases pointing at
    // the same target don't refetch the file each time.
    const imgCache = {};
    function getTargetImage(url) {
        if (!imgCache[url]) {
            const img = new Image();
            img.src   = url;
            imgCache[url] = img;
        }
        return imgCache[url];
    }

    function cartToCanvas(x, y, mmPerEdge, size) {
        const scale = size / mmPerEdge;
        return {
            cx: size / 2 + x * scale,
            cy: size / 2 - y * scale
        };
    }

    function drawBase(ctx, targetImg, size) {
        if (targetImg && targetImg.complete && targetImg.naturalWidth > 0) {
            ctx.drawImage(targetImg, 0, 0, size, size);
        } else {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, size, size);
        }
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth   = 0.75;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(size / 2, 0);    ctx.lineTo(size / 2, size);
        ctx.moveTo(0, size / 2);    ctx.lineTo(size, size / 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    function drawSettledMarker(ctx, cx, cy, index, showSeq) {
        ctx.save();
        ctx.strokeStyle = '#fcba03';
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy);
        ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8);
        ctx.stroke();
        const r = showSeq ? 7 : 4;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle   = 'rgba(252,186,3,0.85)';
        ctx.fill();
        ctx.strokeStyle = '#fcba03';
        ctx.lineWidth   = 1;
        ctx.stroke();
        if (showSeq) {
            ctx.font         = 'bold 7px Quantico, sans-serif';
            ctx.fillStyle    = '#000';
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(index + 1), cx, cy);
        }
        ctx.restore();
    }

    function drawMissMarker(ctx, index, size) {
        const offsetX = (index % 5) * 18 - 36;
        const cx      = size / 2 + offsetX;
        const cy      = size - 14;
        ctx.save();
        ctx.strokeStyle = '#e53935';
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 6, cy - 6); ctx.lineTo(cx + 6, cy + 6);
        ctx.moveTo(cx + 6, cy - 6); ctx.lineTo(cx - 6, cy + 6);
        ctx.stroke();
        ctx.font         = 'bold 7px Quantico, sans-serif';
        ctx.fillStyle    = '#e53935';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('M' + (index + 1), cx, cy + 8);
        ctx.restore();
    }

    function animateImpact(ctx, targetImg, cx, cy, isMiss, placedShots, showSeq, size, shotIndex, onDone) {
        const start = performance.now();
        function frame(now) {
            const t    = Math.min((now - start) / IMPACT_DURATION_MS, 1);
            const ease = 1 - Math.pow(1 - t, 3);
            drawBase(ctx, targetImg, size);
            placedShots.forEach(s => {
                if (s.miss) drawMissMarker(ctx, s.index, size);
                else        drawSettledMarker(ctx, s.cx, s.cy, s.index, showSeq);
            });
            if (isMiss) {
                ctx.save();
                ctx.fillStyle = `rgba(229,57,53,${(1 - ease) * 0.45})`;
                ctx.fillRect(0, 0, size, size);
                ctx.restore();
            } else {
                const ringR   = 6 + ease * 20;
                const ringAlp = (1 - ease) * 0.9;
                ctx.save();
                ctx.beginPath();
                ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(252,186,3,${ringAlp})`;
                ctx.lineWidth   = 2.5;
                ctx.stroke();
                ctx.globalAlpha = ease;
                drawSettledMarker(ctx, cx, cy, shotIndex, showSeq);
                ctx.restore();
            }
            if (t < 1) requestAnimationFrame(frame);
            else       onDone();
        }
        requestAnimationFrame(frame);
    }

    function startReplay(canvas, shots) {
        const ctx       = canvas.getContext('2d');
        const size      = canvas.width || 360;
        const placed    = [];
        let   idx       = 0;
        const showSeq   = parseInt(canvas.dataset.recordMode || '0') === 0;
        const mmPerEdge = parseFloat(canvas.dataset.targetWidthMm) || 0;
        const imgUrl    = canvas.dataset.targetImage || '';
        const targetImg = imgUrl ? getTargetImage(imgUrl) : null;

        function redrawAll() {
            drawBase(ctx, targetImg, size);
            placed.forEach(s => {
                if (s.miss) drawMissMarker(ctx, s.index, size);
                else        drawSettledMarker(ctx, s.cx, s.cy, s.index, showSeq);
            });
        }

        function next() {
            if (idx >= shots.length) {
                setTimeout(() => {
                    placed.length = 0;
                    idx = 0;
                    drawBase(ctx, targetImg, size);
                    setTimeout(next, 500);
                }, LOOP_PAUSE_MS);
                return;
            }
            const raw       = shots[idx];
            const xVal      = parseFloat(raw.x);
            const yVal      = parseFloat(raw.y);
            const shotIndex = idx++;

            if (raw.x === '' || isNaN(xVal) || isNaN(yVal)) {
                setTimeout(next, SHOT_INTERVAL_MS / 2);
                return;
            }

            // The server may pre-flag a shot as a miss when it landed
            // outside the outermost scoring zone (line-cutter rule
            // applied). Fall back to the sentinel check when the flag
            // isn't set so older payloads still behave.
            const isMiss     = raw.miss === true
                            || (xVal === 100000 && yVal === 100000);
            const { cx, cy } = isMiss
                ? { cx: size / 2, cy: size / 2 }
                : cartToCanvas(xVal, yVal, mmPerEdge, size);

            animateImpact(ctx, targetImg, cx, cy, isMiss, placed, showSeq, size, shotIndex, () => {
                placed.push({ cx, cy, miss: isMiss, index: shotIndex });
                redrawAll();
                setTimeout(next, SHOT_INTERVAL_MS);
            });
        }

        function kick() {
            drawBase(ctx, targetImg, size);
            setTimeout(next, 600);
        }
        if (!targetImg || (targetImg.complete && targetImg.naturalWidth > 0)) {
            kick();
        } else {
            targetImg.addEventListener('load',  kick, { once: true });
            targetImg.addEventListener('error', kick, { once: true });
        }
    }

    function initAll(root) {
        (root || document).querySelectorAll('.shot-replay').forEach(canvas => {
            if (canvas.dataset.replayInitialized === '1') return;
            let shots;
            try   { shots = JSON.parse(canvas.dataset.shots); }
            catch (e) { console.warn('Apollo: bad shot JSON', e); return; }
            if (!shots || shots.length === 0) return;
            canvas.dataset.replayInitialized = '1';
            startReplay(canvas, shots);
        });
    }

    window.ApolloReplay = { initAll, startReplay };

    if (document.readyState !== 'loading') {
        initAll();
    } else {
        document.addEventListener('DOMContentLoaded', () => initAll());
    }
})();
