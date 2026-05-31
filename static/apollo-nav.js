/* Side-nav helpers shared across every page.
 *
 * Injects the "Export data" and "Import data" modals at the end of <body>
 * and wires up the matching side-nav links. Kept in one file so each
 * template only needs to add a single <script> tag.
 */
(function () {
    'use strict';

    function ready(fn) {
        if (document.readyState !== 'loading') fn();
        else document.addEventListener('DOMContentLoaded', fn);
    }

    const EXPORT_MODAL_HTML = `
<div class="modal-backdrop" id="export-modal" role="dialog" aria-modal="true" aria-labelledby="export-modal-title">
    <div class="modal-card">
        <h3 id="export-modal-title">Export your data</h3>
        <p>Download every shot, bow, arrow, target, and session record in one file. Pick a format and click <em>Download</em>.</p>
        <form id="export-modal-form" action="/export_data" method="GET" target="_blank">
            <div class="export-format-options">
                <label class="radio-option">
                    <input type="radio" name="format" value="xlsx" checked>
                    <span>Excel workbook (.xlsx)</span>
                </label>
                <label class="radio-option">
                    <input type="radio" name="format" value="csv">
                    <span>CSV — zip of one file per table (.zip)</span>
                </label>
                <label class="radio-option">
                    <input type="radio" name="format" value="sql">
                    <span>SQL INSERT statements (.sql)</span>
                </label>
            </div>
            <div class="modal-actions">
                <button type="button" class="secondary" id="export-modal-cancel">Cancel</button>
                <button type="submit">Download</button>
            </div>
        </form>
    </div>
</div>`;

    const IMPORT_MODAL_HTML = `
<div class="modal-backdrop" id="import-modal" role="dialog" aria-modal="true" aria-labelledby="import-modal-title">
    <div class="modal-card">
        <h3 id="import-modal-title">Import your data</h3>
        <p>Load a file previously created by <em>Export data</em>. Rows are merged into your current data — nothing already saved is removed. Pick the file's format and choose the file.</p>
        <form id="import-modal-form" enctype="multipart/form-data">
            <div class="export-format-options">
                <label class="radio-option">
                    <input type="radio" name="format" value="xlsx" checked>
                    <span>Excel workbook (.xlsx)</span>
                </label>
                <label class="radio-option">
                    <input type="radio" name="format" value="csv">
                    <span>CSV — zip of one file per table (.zip)</span>
                </label>
                <label class="radio-option">
                    <input type="radio" name="format" value="sql">
                    <span>SQL INSERT statements (.sql)</span>
                </label>
            </div>
            <div style="margin-top:0.75rem;">
                <input type="file" name="file" id="import-modal-file" required>
            </div>
            <div id="import-modal-status" style="margin-top:0.75rem; display:none;"></div>
            <div class="modal-actions">
                <button type="button" class="secondary" id="import-modal-cancel">Cancel</button>
                <button type="submit" id="import-modal-submit">Import</button>
            </div>
        </form>
    </div>
</div>`;

    function csrfToken() {
        // Flask-WTF renders <meta name="csrf-token"> on most templates; if it's
        // missing fall back to scraping any csrf_token hidden input on the page.
        const meta = document.querySelector('meta[name="csrf-token"]');
        if (meta) return meta.getAttribute('content');
        const hidden = document.querySelector('input[name="csrf_token"]');
        return hidden ? hidden.value : '';
    }

    function pickFormatFromName(name) {
        const lower = (name || '').toLowerCase();
        if (lower.endsWith('.xlsx')) return 'xlsx';
        if (lower.endsWith('.zip') || lower.endsWith('.csv')) return 'csv';
        if (lower.endsWith('.sql')) return 'sql';
        return null;
    }

    ready(function () {
        document.body.insertAdjacentHTML('beforeend', EXPORT_MODAL_HTML);
        document.body.insertAdjacentHTML('beforeend', IMPORT_MODAL_HTML);

        // ─── Mobile side-nav drawer ────────────────────────
        // The hamburger and backdrop are styled only inside the
        // (max-width: 768px) breakpoint, so they're invisible on
        // desktop even though they're always in the DOM.
        const sideNav = document.querySelector('.side-nav');
        if (sideNav) {
            const burger = document.createElement('button');
            burger.type = 'button';
            burger.className = 'nav-hamburger';
            burger.setAttribute('aria-label', 'Toggle navigation');
            burger.setAttribute('aria-expanded', 'false');
            burger.textContent = '☰';

            const backdrop = document.createElement('div');
            backdrop.className = 'side-nav-backdrop';

            document.body.appendChild(burger);
            document.body.appendChild(backdrop);

            function openNav() {
                sideNav.classList.add('open');
                backdrop.classList.add('open');
                burger.setAttribute('aria-expanded', 'true');
            }
            function closeNav() {
                sideNav.classList.remove('open');
                backdrop.classList.remove('open');
                burger.setAttribute('aria-expanded', 'false');
            }
            function toggleNav() {
                if (sideNav.classList.contains('open')) closeNav();
                else openNav();
            }

            burger.addEventListener('click', toggleNav);
            backdrop.addEventListener('click', closeNav);
            // Tapping a link inside the drawer should close it so the
            // user lands on the new page with the drawer dismissed.
            sideNav.querySelectorAll('a').forEach(a => {
                a.addEventListener('click', closeNav);
            });
            document.addEventListener('keydown', evt => {
                if (evt.key === 'Escape' && sideNav.classList.contains('open')) {
                    closeNav();
                }
            });
        }

        // ─── Export ────────────────────────────────────────────────
        const exportModal  = document.getElementById('export-modal');
        const exportLink   = document.getElementById('export-link');
        const exportCancel = document.getElementById('export-modal-cancel');
        const exportForm   = document.getElementById('export-modal-form');

        function openExport()  { exportModal.classList.add('open'); }
        function closeExport() { exportModal.classList.remove('open'); }

        if (exportLink) {
            exportLink.addEventListener('click', evt => {
                evt.preventDefault();
                openExport();
            });
        }
        exportCancel.addEventListener('click', closeExport);
        exportModal.addEventListener('click', evt => {
            if (evt.target === exportModal) closeExport();
        });
        // Close the dialog after submit — the download fires in a new tab
        // (target=_blank) so the current page stays put.
        exportForm.addEventListener('submit', () => setTimeout(closeExport, 100));

        // ─── Import ────────────────────────────────────────────────
        const importModal  = document.getElementById('import-modal');
        const importLink   = document.getElementById('import-link');
        const importCancel = document.getElementById('import-modal-cancel');
        const importForm   = document.getElementById('import-modal-form');
        const importFile   = document.getElementById('import-modal-file');
        const importStatus = document.getElementById('import-modal-status');
        const importSubmit = document.getElementById('import-modal-submit');

        function openImport()  { importModal.classList.add('open'); }
        function closeImport() {
            importModal.classList.remove('open');
            importStatus.style.display = 'none';
            importStatus.textContent = '';
            importForm.reset();
            importSubmit.disabled = false;
        }

        if (importLink) {
            importLink.addEventListener('click', evt => {
                evt.preventDefault();
                openImport();
            });
        }
        importCancel.addEventListener('click', closeImport);
        importModal.addEventListener('click', evt => {
            if (evt.target === importModal) closeImport();
        });

        // Auto-pick the format radio when the user picks a file with a
        // recognizable extension. They can still override manually before
        // clicking Import.
        importFile.addEventListener('change', () => {
            const f = importFile.files && importFile.files[0];
            if (!f) return;
            const guessed = pickFormatFromName(f.name);
            if (guessed) {
                const radio = importForm.querySelector(`input[name="format"][value="${guessed}"]`);
                if (radio) radio.checked = true;
            }
        });

        // Shared Escape handler for both modals.
        document.addEventListener('keydown', evt => {
            if (evt.key !== 'Escape') return;
            if (exportModal.classList.contains('open')) closeExport();
            if (importModal.classList.contains('open')) closeImport();
        });

        importForm.addEventListener('submit', async evt => {
            evt.preventDefault();
            importStatus.style.display = 'block';
            importStatus.style.color = '';
            importStatus.textContent = 'Importing…';
            importSubmit.disabled = true;

            const fd = new FormData(importForm);
            try {
                const res = await fetch('/import_data', {
                    method: 'POST',
                    body: fd,
                    headers: { 'X-CSRFToken': csrfToken() },
                    credentials: 'same-origin',
                });
                const data = await res.json().catch(() => ({
                    ok: false, error: 'Unexpected server response.'
                }));
                if (!res.ok || !data.ok) {
                    importStatus.style.color = '#c0392b';
                    importStatus.textContent = 'Import failed: ' +
                        (data.error || res.statusText || 'unknown error');
                    importSubmit.disabled = false;
                    return;
                }
                importStatus.style.color = '#1e7e34';
                const parts = Object.entries(data.counts || {})
                    .filter(([, n]) => n > 0)
                    .map(([t, n]) => `${n} ${t}`)
                    .join(', ');
                importStatus.textContent = data.total
                    ? `Imported ${data.total} rows (${parts}). Reloading…`
                    : 'Import finished, but no rows were found in the file.';
                if (data.total) {
                    setTimeout(() => window.location.reload(), 900);
                } else {
                    importSubmit.disabled = false;
                }
            } catch (err) {
                importStatus.style.color = '#c0392b';
                importStatus.textContent = 'Import failed: ' + err.message;
                importSubmit.disabled = false;
            }
        });
    });
})();
