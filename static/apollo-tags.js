/* Tag-chip input. Replaces a comma-separated text field with a row of
   pill chips. Space and Enter commit the current draft; Backspace on an
   empty draft removes the last chip; tags themselves cannot contain
   spaces, so the canonical separator round-trips cleanly.

   Wire-up: drop a <div data-tag-chips
                       data-tag-name="session_tags"
                       data-tag-value="{{ existing|e }}"
                       data-tag-suggestions='{{ suggestions|tojson }}'
                       data-tag-placeholder="...">. The script replaces its
   contents with the chip UI and a same-named hidden input. The hidden
   input is also refreshed right before form submit so any unfinished
   draft text isn't lost. */
(function () {
    function init(container) {
        const fieldName   = container.dataset.tagName || 'tags';
        const initial     = container.dataset.tagValue || '';
        let allTags = [];
        try { allTags = JSON.parse(container.dataset.tagSuggestions || '[]'); }
        catch (_) { allTags = []; }
        const placeholder = container.dataset.tagPlaceholder || '';

        container.classList.add('tag-chip-input');
        container.innerHTML = '';

        const hidden = document.createElement('input');
        hidden.type  = 'hidden';
        hidden.name  = fieldName;
        container.appendChild(hidden);

        const inner = document.createElement('div');
        inner.className = 'tag-chip-inner';
        container.appendChild(inner);

        const input = document.createElement('input');
        input.type         = 'text';
        input.className    = 'tag-chip-typing';
        input.autocomplete = 'off';
        input.placeholder  = placeholder;
        // Defeat the .form-panel input[type="text"] full-width rule.
        input.style.width  = 'auto';
        inner.appendChild(input);

        const suggList = document.createElement('ul');
        suggList.className = 'tag-suggestions';
        suggList.hidden = true;
        container.appendChild(suggList);

        let tags = initial.split(',').map(s => s.trim()).filter(Boolean);
        let activeIdx = -1;
        let currentMatches = [];

        function syncHidden() {
            hidden.value = tags.join(', ');
        }

        function renderChips() {
            inner.querySelectorAll('.tag-chip').forEach(c => c.remove());
            tags.forEach((t, idx) => {
                const chip = document.createElement('span');
                chip.className = 'tag-chip';
                chip.textContent = t;
                const x = document.createElement('button');
                x.type = 'button';
                x.className = 'tag-chip-x';
                x.setAttribute('aria-label', 'Remove tag ' + t);
                x.textContent = '×';
                x.addEventListener('mousedown', evt => {
                    // mousedown so the input doesn't blur and swallow the click
                    evt.preventDefault();
                    tags.splice(idx, 1);
                    renderChips();
                    syncHidden();
                    input.focus();
                });
                chip.appendChild(x);
                inner.insertBefore(chip, input);
            });
        }

        function commitDraft() {
            const raw = input.value.replace(/\s+/g, '').trim();
            input.value = '';
            if (!raw) { compute(); return false; }
            const lc = raw.toLowerCase();
            if (!tags.some(t => t.toLowerCase() === lc)) {
                tags.push(raw);
                renderChips();
                syncHidden();
            }
            compute();
            return true;
        }

        function renderSuggestions(matches) {
            suggList.innerHTML = '';
            if (!matches.length) { suggList.hidden = true; return; }
            matches.forEach((tag, i) => {
                const li = document.createElement('li');
                li.textContent = tag;
                if (i === activeIdx) li.classList.add('active');
                li.addEventListener('mousedown', evt => {
                    evt.preventDefault();
                    pick(i);
                });
                suggList.appendChild(li);
            });
            suggList.hidden = false;
        }

        function compute() {
            const frag = input.value.trim().toLowerCase();
            const used = new Set(tags.map(t => t.toLowerCase()));
            currentMatches = allTags.filter(tag => {
                const lc = tag.toLowerCase();
                if (used.has(lc)) return false;
                if (!frag) return true;
                return lc.includes(frag);
            }).slice(0, 8);
            activeIdx = currentMatches.length ? 0 : -1;
            renderSuggestions(currentMatches);
        }

        function pick(i) {
            const tag = currentMatches[i];
            if (!tag) return;
            input.value = tag;
            commitDraft();
            input.focus();
        }

        input.addEventListener('input', () => {
            // If a space sneaks in (paste, IME), commit on the space.
            if (/\s/.test(input.value)) {
                const parts = input.value.split(/\s+/);
                const tail  = parts.pop();
                parts.forEach(p => {
                    if (!p) return;
                    input.value = p;
                    commitDraft();
                });
                input.value = tail || '';
            }
            compute();
        });
        input.addEventListener('focus', compute);
        input.addEventListener('blur', () => {
            // Hide suggestions on blur; don't auto-commit the draft (user
            // may be clicking elsewhere without meaning to finalize).
            setTimeout(() => { suggList.hidden = true; }, 120);
        });
        input.addEventListener('keydown', evt => {
            if (evt.key === ' ' || evt.key === 'Spacebar') {
                evt.preventDefault();
                if (input.value.trim()) commitDraft();
                return;
            }
            if (evt.key === 'Enter') {
                if (!suggList.hidden && activeIdx >= 0 && currentMatches.length) {
                    evt.preventDefault();
                    pick(activeIdx);
                } else if (input.value.trim()) {
                    evt.preventDefault();
                    commitDraft();
                }
                // Empty draft: let Enter behave normally (form default).
                return;
            }
            if (evt.key === 'Backspace' && !input.value && tags.length) {
                evt.preventDefault();
                tags.pop();
                renderChips();
                syncHidden();
                compute();
                return;
            }
            if (evt.key === ',') {
                // Comma is the canonical separator on the wire; never let
                // one land inside a chip's text.
                evt.preventDefault();
                if (input.value.trim()) commitDraft();
                return;
            }
            if (!suggList.hidden && currentMatches.length) {
                if (evt.key === 'ArrowDown') {
                    evt.preventDefault();
                    activeIdx = (activeIdx + 1) % currentMatches.length;
                    renderSuggestions(currentMatches);
                } else if (evt.key === 'ArrowUp') {
                    evt.preventDefault();
                    activeIdx = (activeIdx - 1 + currentMatches.length) % currentMatches.length;
                    renderSuggestions(currentMatches);
                } else if (evt.key === 'Escape') {
                    suggList.hidden = true;
                }
            }
        });

        container.addEventListener('mousedown', e => {
            // Click into the empty area of the wrapper focuses the input.
            if (e.target === container || e.target === inner) {
                input.focus();
            }
        });

        // Flush any in-progress draft so it's submitted with the form.
        const form = container.closest('form');
        if (form) {
            form.addEventListener('submit', () => {
                if (input.value.trim()) commitDraft();
            }, true);
        }

        renderChips();
        syncHidden();
    }

    function initAll(root) {
        (root || document).querySelectorAll('[data-tag-chips]').forEach(el => {
            if (el.dataset.tagInited === '1') return;
            el.dataset.tagInited = '1';
            init(el);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => initAll());
    } else {
        initAll();
    }
    // Exposed for late-mounted containers, if ever needed.
    window.ApolloTags = { initAll: initAll };
})();
