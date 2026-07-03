/* Practice-reminder push subscription (opt-in).
 *
 * Wires the toggle on the account page to the browser Push API and Apollo's
 * /api/push/* endpoints. Only offered when the browser supports push AND the
 * server has VAPID keys configured (checked via /api/push/config).
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

    // VAPID public keys are base64url; the Push API wants a Uint8Array.
    function urlB64ToUint8Array(base64) {
        const padding = '='.repeat((4 - base64.length % 4) % 4);
        const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
        const raw = atob(b64);
        const arr = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
        return arr;
    }

    ready(async function () {
        const box = document.getElementById('push-reminders');
        if (!box) return;
        const btn = document.getElementById('push-toggle-btn');
        const status = document.getElementById('push-status');
        const set = (m) => { status.textContent = m; };

        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            set('Push notifications aren’t supported by this browser.');
            btn.disabled = true;
            return;
        }

        let cfg;
        try {
            cfg = await (await fetch('/api/push/config', { credentials: 'same-origin' })).json();
        } catch (e) {
            set('Could not reach the server.');
            btn.disabled = true;
            return;
        }
        if (!cfg.enabled || !cfg.public_key) {
            set('Reminders aren’t configured on this server yet.');
            btn.disabled = true;
            return;
        }

        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();

        function render() {
            if (sub) {
                btn.textContent = 'Turn off reminders';
                set('Reminders are on for this device.');
            } else {
                btn.textContent = 'Turn on reminders';
                set('Reminders are off on this device.');
            }
        }
        render();

        btn.addEventListener('click', async function () {
            btn.disabled = true;
            try {
                if (sub) {
                    const endpoint = sub.endpoint;
                    await sub.unsubscribe();
                    await fetch('/api/push/unsubscribe', {
                        method: 'POST', credentials: 'same-origin',
                        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken() },
                        body: JSON.stringify({ endpoint }),
                    });
                    sub = null;
                    render();
                } else {
                    const perm = await Notification.requestPermission();
                    if (perm !== 'granted') {
                        set('Notification permission was denied.');
                        btn.disabled = false;
                        return;
                    }
                    sub = await reg.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlB64ToUint8Array(cfg.public_key),
                    });
                    const json = sub.toJSON();
                    const res = await (await fetch('/api/push/subscribe', {
                        method: 'POST', credentials: 'same-origin',
                        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken() },
                        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
                    })).json();
                    if (!res.ok) set('Could not save the subscription.');
                    render();
                }
            } catch (e) {
                set('Something went wrong: ' + e.message);
            }
            btn.disabled = false;
        });
    });
})();
