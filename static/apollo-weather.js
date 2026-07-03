/* Session weather capture.
 *
 * Reuses the geolocation → Open-Meteo pattern from the Bow-hand elevation tool
 * (extended with wind speed / gust / direction) and POSTs the reading to
 * /api/session_conditions, which stores it on the active session so the
 * /analyze "Performance vs conditions" report can bucket shots by wind and
 * temperature. Opt-in: nothing is sent until the archer taps the button.
 */
(function () {
    'use strict';

    function ready(fn) {
        if (document.readyState !== 'loading') fn();
        else document.addEventListener('DOMContentLoaded', fn);
    }

    function csrfToken() {
        const meta = document.querySelector('meta[name="csrf-token"]');
        if (meta) return meta.getAttribute('content');
        const hidden = document.querySelector('input[name="csrf_token"]');
        return hidden ? hidden.value : '';
    }

    ready(function () {
        const wrap = document.getElementById('wx-widget');
        if (!wrap) return;
        const btn = document.getElementById('wx-capture-btn');
        const status = document.getElementById('wx-status');
        if (!btn || !status) return;

        function fmt(c) {
            const bits = [];
            if (c.temp_c != null) bits.push(Math.round(c.temp_c) + '°C');
            if (c.wind_kmh != null) {
                let s = Math.round(c.wind_kmh) + ' km/h';
                if (c.gust_kmh != null) s += ' (gust ' + Math.round(c.gust_kmh) + ')';
                bits.push(s);
            }
            if (c.humidity_pct != null) bits.push(Math.round(c.humidity_pct) + '% RH');
            return bits.join(' · ');
        }

        function showCaptured(c, src) {
            status.textContent = '✓ ' + fmt(c) + (src === 'manual' ? ' (manual)' : '');
            btn.textContent = '↻ Re-capture weather';
        }

        // Reflect any weather already stored for this session.
        fetch('/api/session_conditions', {
            credentials: 'same-origin', headers: { 'Accept': 'application/json' },
        }).then(r => r.ok ? r.json() : null)
          .then(d => { if (d && d.captured) showCaptured(d, d.source); })
          .catch(() => {});

        function save(payload) {
            return fetch('/api/session_conditions', {
                method: 'POST', credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRFToken': csrfToken(),
                },
                body: JSON.stringify(payload),
            }).then(r => r.json());
        }

        btn.addEventListener('click', function () {
            if (!navigator.geolocation) {
                status.textContent = 'Location not available on this device.';
                return;
            }
            status.textContent = 'Locating…';
            navigator.geolocation.getCurrentPosition(function (pos) {
                const lat = pos.coords.latitude.toFixed(3);
                const lon = pos.coords.longitude.toFixed(3);
                status.textContent = 'Fetching weather…';
                fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat +
                      '&longitude=' + lon +
                      '&current=temperature_2m,relative_humidity_2m,surface_pressure,' +
                      'wind_speed_10m,wind_gusts_10m,wind_direction_10m')
                    .then(r => r.ok ? r.json() : Promise.reject(r.status))
                    .then(function (d) {
                        const c = d && d.current;
                        if (!c) return Promise.reject('no data');
                        const payload = {
                            source: 'auto',
                            temp_c: c.temperature_2m,
                            humidity_pct: c.relative_humidity_2m,
                            pressure_hpa: c.surface_pressure,
                            wind_kmh: c.wind_speed_10m,
                            gust_kmh: c.wind_gusts_10m,
                            wind_dir_deg: c.wind_direction_10m,
                        };
                        return save(payload).then(function (res) {
                            if (res && res.ok) showCaptured(payload, 'auto');
                            else status.textContent = 'Save failed: ' +
                                ((res && res.error) || 'error');
                        });
                    })
                    .catch(() => {
                        status.textContent = 'Weather lookup failed — try again.';
                    });
            }, function () {
                status.textContent = 'Location denied — weather not captured.';
            }, { timeout: 10000, maximumAge: 600000 });
        });
    });
})();
