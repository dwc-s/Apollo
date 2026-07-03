/* Shareable session card.
 *
 * Draws a branded summary of the just-finished session on a <canvas> from the
 * numbers already on the end-session page (window.APOLLO_CARD), then offers it
 * via the Web Share API where supported, or a PNG download otherwise. Entirely
 * client-side — no server round-trip, nothing stored.
 */
(function () {
    'use strict';

    function ready(fn) {
        if (document.readyState !== 'loading') fn();
        else document.addEventListener('DOMContentLoaded', fn);
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    ready(function () {
        const data = window.APOLLO_CARD;
        const btn = document.getElementById('share-card-btn');
        const status = document.getElementById('share-card-status');
        if (!data || !btn) return;

        function drawCard(logo) {
            const S = 1080;
            const c = document.createElement('canvas');
            c.width = S; c.height = S;
            const ctx = c.getContext('2d');
            const g = ctx.createLinearGradient(0, 0, 0, S);
            g.addColorStop(0, '#dfe8f5'); g.addColorStop(1, '#b9cbe6');
            ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
            ctx.fillStyle = '#f6f9fd'; roundRect(ctx, 70, 70, S - 140, S - 140, 40); ctx.fill();

            ctx.textAlign = 'center';
            if (logo) {
                const lw = 250, lh = logo.height * (lw / logo.width);
                ctx.drawImage(logo, (S - lw) / 2, 120, lw, lh);
            }
            ctx.fillStyle = '#1a3a5c';
            ctx.font = '700 58px Quantico, sans-serif';
            ctx.fillText((data.endNoun || 'Session') + ' complete', S / 2, 470);
            if (data.date) {
                ctx.font = '400 34px Quantico, sans-serif';
                ctx.fillStyle = '#5a6a82';
                ctx.fillText(String(data.date), S / 2, 520);
            }

            const cells = [
                [String(data.arrows != null ? data.arrows : '—'), 'arrows'],
                [(data.hitPct != null ? data.hitPct + '%' : '—'), 'on target'],
                [String(data.length || '—'), 'on the line'],
            ];
            const colW = (S - 200) / 3;
            cells.forEach(function (s, i) {
                const x = 100 + colW * i + colW / 2;
                ctx.fillStyle = '#1a3a5c';
                ctx.font = '700 72px Quantico, sans-serif';
                ctx.fillText(s[0], x, 700);
                ctx.fillStyle = '#5a6a82';
                ctx.font = '400 30px Quantico, sans-serif';
                ctx.fillText(s[1], x, 748);
            });

            if (data.hit != null) {
                ctx.fillStyle = '#33507d';
                ctx.font = '400 34px Quantico, sans-serif';
                ctx.fillText(data.hit + ' hit · ' + data.missed + ' missed', S / 2, 838);
            }
            ctx.fillStyle = '#1a3a5c';
            ctx.font = '700 42px Quantico, sans-serif';
            ctx.fillText(data.username || 'Archer', S / 2, 935);
            ctx.fillStyle = '#7a879c';
            ctx.font = '400 30px Quantico, sans-serif';
            ctx.fillText('apolloshoots.org', S / 2, 985);
            return c;
        }

        function download(blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'apollo-session.png';
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
            status.textContent = 'Downloaded ✓';
        }

        btn.addEventListener('click', function () {
            // The results page auto-redirects after a few seconds; cancel it so
            // the share sheet / download isn't yanked away mid-action.
            if (window.APOLLO_END_REDIRECT) clearTimeout(window.APOLLO_END_REDIRECT);
            status.textContent = 'Building card…';
            const logo = new Image();
            logo.onload = function () { finish(logo); };
            logo.onerror = function () { finish(null); };
            logo.src = '/static/logo.png';

            function finish(logoImg) {
                const canvas = drawCard(logoImg);
                canvas.toBlob(function (blob) {
                    if (!blob) { status.textContent = 'Could not build the card.'; return; }
                    const file = new File([blob], 'apollo-session.png', { type: 'image/png' });
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        navigator.share({ files: [file], title: 'Apollo session' })
                            .then(function () { status.textContent = 'Shared ✓'; })
                            .catch(function () { download(blob); });
                    } else {
                        download(blob);
                    }
                }, 'image/png');
            }
        });
    });
})();
