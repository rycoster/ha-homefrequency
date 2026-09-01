const BASE = document.querySelector('base')?.getAttribute('href')?.replace(/\/$/, '') || '';

// Touch device: no hover, no Shift+Enter, native pickers need showPicker()
const COARSE_POINTER = window.matchMedia('(pointer: coarse)').matches;

function openDatePicker(input) {
    input.focus();
    // focus() alone doesn't open the native picker on mobile
    if (typeof input.showPicker === 'function') {
        try { input.showPicker(); } catch (e) { /* requires user gesture; focus is the fallback */ }
    }
}

function scrollEditorIntoView(el) {
    // Keep the editor visible above the on-screen keyboard
    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
}

const addTaskForm = document.getElementById('add-task-form');
const taskList = document.getElementById('task-list');
const addTaskToggle = document.getElementById('add-task-toggle');

function resetCardPanels(card) {
    // Collapsing a card returns it to its default presentation
    const history = card.querySelector('.task-history');
    if (history) history.classList.remove('open');
    const notes = card.querySelector('.task-notes');
    if (notes) notes.classList.toggle('open', notes.dataset.defaultOpen === '1');
    // ...and exits editing
    card.classList.remove('card-editing');
    const editBtn = card.querySelector('.btn-edit');
    if (editBtn) editBtn.textContent = 'Edit';
}

function toggleCardExpanded(card) {
    const wasExpanded = card.classList.contains('card-expanded');
    // Collapse all other cards
    document.querySelectorAll('.task-card.card-expanded').forEach(c => {
        c.classList.remove('card-expanded');
        resetCardPanels(c);
    });
    // Toggle this card
    if (!wasExpanded) {
        card.classList.add('card-expanded');
    } else {
        resetCardPanels(card);
    }
}

if (addTaskToggle) {
    addTaskToggle.addEventListener('click', () => {
        const isOpen = addTaskForm.classList.toggle('open');
        addTaskToggle.textContent = isOpen ? '- New Task' : '+ New Task';
        if (isOpen) document.getElementById('task-name').focus();
    });
}

// Schedule type toggle
let scheduleType = 'dynamic';
const toggleBtns = document.querySelectorAll('.toggle-btn');
const intervalFields = document.getElementById('interval-fields');
const fixedFields = document.getElementById('fixed-fields');

toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        toggleBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        scheduleType = btn.dataset.type;
        intervalFields.style.display = scheduleType === 'interval' ? '' : 'none';
        fixedFields.style.display = scheduleType === 'fixed' ? '' : 'none';
    });
});

const SNOOZE_OPTIONS = [
    { days: 1, label: '1 day' },
    { days: 3, label: '3 days' },
    { days: 7, label: '1 week' },
    { days: 14, label: '2 weeks' },
    { days: 30, label: '1 month' },
];

async function snoozeTask(id, days) {
    await fetch(`${BASE}/api/tasks/${id}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days }),
    });
    loadTasks(id);
}

function closeSnoozeMenu() {
    document.querySelectorAll('.snooze-menu').forEach(el => el.remove());
    document.removeEventListener('click', onDocClickCloseSnooze, true);
}

function onDocClickCloseSnooze(e) {
    if (!e.target.closest('.snooze-menu') && !e.target.closest('.btn-snooze')) {
        // Swallow the dismissing tap so it can't also press whatever is under it
        e.preventDefault();
        e.stopPropagation();
        closeSnoozeMenu();
    }
}

function openSnoozeMenu(btn, id) {
    closeSnoozeMenu();
    const menu = document.createElement('div');
    menu.className = 'snooze-menu';
    menu.innerHTML = SNOOZE_OPTIONS.map(o =>
        `<button type="button" data-days="${o.days}">${o.label}</button>`
    ).join('');
    menu.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-days]');
        if (!b) return;
        snoozeTask(id, parseInt(b.dataset.days));
        closeSnoozeMenu();
    });
    btn.parentElement.appendChild(menu);
    // Flip upward when the menu would extend past the bottom of the viewport
    const rect = menu.getBoundingClientRect();
    if (rect.bottom > window.innerHeight - 16) {
        menu.style.bottom = '100%';
        menu.style.marginTop = '0';
        menu.style.marginBottom = '4px';
    }
    setTimeout(() => document.addEventListener('click', onDocClickCloseSnooze, true), 0);
}

async function unsnoozeTask(id) {
    await fetch(`${BASE}/api/tasks/${id}/unsnooze`, { method: 'POST' });
    loadTasks(id);
}

// Fixed unit sub-field switching
const fixedUnitSelect = document.getElementById('fixed-unit');
const fixedDow = document.getElementById('fixed-dow');
const fixedDom = document.getElementById('fixed-dom');
const fixedYearlyInputs = document.getElementById('fixed-yearly-inputs');

fixedUnitSelect.addEventListener('change', () => {
    const unit = fixedUnitSelect.value;
    fixedDow.style.display = unit === 'weekly' ? '' : 'none';
    fixedDom.style.display = unit === 'monthly' ? '' : 'none';
    fixedYearlyInputs.style.display = unit === 'yearly' ? '' : 'none';
});

const toggleNotesBtn = document.getElementById('toggle-notes');
const taskNotes = document.getElementById('task-notes');
toggleNotesBtn.addEventListener('click', () => {
    const showing = taskNotes.style.display !== 'none';
    taskNotes.style.display = showing ? 'none' : '';
    toggleNotesBtn.classList.toggle('active', !showing);
    if (!showing) taskNotes.focus();
});

addTaskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('task-name').value.trim();
    if (!name) return;
    const notes = document.getElementById('task-notes').value.trim() || undefined;

    let body;
    if (scheduleType === 'dynamic') {
        body = { name, schedule_type: 'dynamic', notes };
    } else if (scheduleType === 'interval') {
        const freq = parseInt(document.getElementById('task-freq').value);
        const unit = parseInt(document.getElementById('task-unit').value);
        if (!freq) return;
        body = { name, frequency_days: freq * unit, notes };
    } else {
        const fixedUnit = fixedUnitSelect.value;
        let fixedValue;
        if (fixedUnit === 'weekly') {
            fixedValue = parseInt(fixedDow.value);
        } else if (fixedUnit === 'monthly') {
            fixedValue = parseInt(fixedDom.value);
            if (!fixedValue || fixedValue < 1 || fixedValue > 31) return;
        } else {
            const month = parseInt(document.getElementById('fixed-month').value);
            const day = parseInt(document.getElementById('fixed-year-day').value);
            if (!day || day < 1 || day > 31) return;
            fixedValue = month * 100 + day;
        }
        body = { name, schedule_type: 'fixed', fixed_unit: fixedUnit, fixed_value: fixedValue, notes };
    }

    const resp = await fetch(`${BASE}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const result = await resp.json();

    document.getElementById('task-name').value = '';
    document.getElementById('task-freq').value = '1';
    document.getElementById('task-notes').value = '';
    taskNotes.style.display = 'none';
    toggleNotesBtn.classList.remove('active');
    addTaskForm.classList.remove('open');
    addTaskToggle.textContent = '+ New Task';
    loadTasks(result.id);
});

function getBucket(days) {
    if (days === null || days === undefined) return 'tracking';
    if (days < 0) return 'overdue';
    if (days <= 7) return 'week';
    if (days <= 30) return 'month';
    if (days <= 90) return '3months';
    if (days <= 365) return 'year';
    return 'later';
}

const BUCKET_LABELS = {
    week: '1 week',
    month: '1 month',
    '3months': '3 months',
    year: '1 year',
    later: '1 year+'
};

async function loadTasks(highlightId) {
    let tasks;
    try {
        const res = await fetch(`${BASE}/api/tasks`);
        if (!res.ok) {
            throw new Error(`API returned HTTP ${res.status} ${res.statusText}`);
        }
        tasks = await res.json();
    } catch (err) {
        console.error('[HomeFrequency] loadTasks failed:', err);
        showLoadError(err);
        return;
    }
    clearLoadError();

    // Show the Print QR sheet link only when at least one task has QR enabled
    const qrSheetBtn = document.getElementById('btn-qr-sheet');
    if (qrSheetBtn) {
        qrSheetBtn.style.display = tasks.some(t => t.qr_enabled) ? '' : 'none';
    }

    const prevScroll = taskList.scrollTop;
    taskList.innerHTML = '';

    const logoWrap = document.createElement('div');
    logoWrap.className = 'app-logo-row';
    const logoTextLeft = document.createElement('span');
    logoTextLeft.className = 'app-logo-text';
    logoTextLeft.textContent = 'HOME';
    const logoImg = document.createElement('img');
    logoImg.src = `${BASE}/static/logo-icon.png`;
    logoImg.alt = 'HomeFrequency';
    logoImg.className = 'app-logo-icon';
    const logoTextRight = document.createElement('span');
    logoTextRight.className = 'app-logo-text';
    logoTextRight.textContent = 'FREQUENCY';
    logoWrap.appendChild(logoTextLeft);
    logoWrap.appendChild(logoImg);
    logoWrap.appendChild(logoTextRight);
    taskList.appendChild(logoWrap);

    let prevBucket = null;

    tasks.forEach(task => {
        const bucket = getBucket(task.days_until);
        if (prevBucket !== null && bucket !== prevBucket) {
            const sep = document.createElement('div');
            sep.className = 'timeline-sep';
            sep.innerHTML = `<span>${BUCKET_LABELS[prevBucket] || prevBucket}</span>`;
            taskList.appendChild(sep);
        }
        prevBucket = bucket;

        const card = document.createElement('div');
        card.className = 'task-card';
        card.dataset.search = [task.name || '', task.notes || ''].join(' ').toLowerCase();

        let dueText, dueClass;
        const days = task.days_until;
        const isDynamic = (task.schedule_type || 'interval') === 'dynamic';
        const isSnoozed = task.is_snoozed;

        if (isSnoozed) {
            dueText = 'Snoozed';
            dueClass = 'snoozed';
            card.classList.add('snoozed');
        } else if (days === null || days === undefined) {
            dueText = 'Tracking...';
            dueClass = 'tracking';
            card.classList.add('tracking');
        } else if (days < 0) {
            card.classList.add('overdue');
            dueText = `Overdue by ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''}`;
            dueClass = 'overdue';
        } else if (days === 0) {
            card.classList.add('due-soon');
            dueText = 'Due today';
            dueClass = 'due-soon';
        } else if (days <= 7) {
            dueText = `Due in ${days} day${days !== 1 ? 's' : ''}`;
            dueClass = (task.frequency_days && days / task.frequency_days <= 0.25) ? 'due-approaching' : 'ok';
        } else if (days < 30) {
            const weeks = Math.floor(days / 7);
            dueText = `Due in ${weeks} week${weeks !== 1 ? 's' : ''}`;
            dueClass = (task.frequency_days && days / task.frequency_days <= 0.25) ? 'due-approaching' : 'ok';
        } else {
            const months = Math.floor(days / 30);
            dueText = `Due in ${months} month${months !== 1 ? 's' : ''}`;
            dueClass = (task.frequency_days && days / task.frequency_days <= 0.25) ? 'due-approaching' : 'ok';
        }

        const freqLabel = formatTaskFrequency(task);
        const dynamicTag = isDynamic ? '<span class="tag-dynamic">dynamic</span>' : '';

        if (dueClass === 'due-approaching') card.classList.add('due-approaching');
        if (days > 90) card.classList.add('distant');

        const hasNotes = task.notes && task.notes.trim();
        const hasHistory = task.completions && task.completions.length > 0;
        const notesOpen = hasNotes && (days <= 7 || days < 0);
        const sensorIcon = task.sensor_enabled ? '<span class="sensor-icon" title="HA sensor enabled"><svg viewBox="0 0 24 24" width="14" height="14"><path fill="#03a9f4" d="M12 2L2 12h3v8h6v-6h2v6h6v-8h3L12 2z"/></svg></span>' : '';
        const qrIcon = task.qr_enabled
            ? `<button type="button" class="qr-icon" title="Print QR code for this task" data-task-id="${task.id}" data-qr-token="${task.qr_token || ''}" data-task-name="${escapeAttr(task.name)}" onclick="openQrModal(this); event.stopPropagation();"><svg viewBox="0 0 24 24" width="14" height="14"><path fill="#03a9f4" d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm8 0h2v2h-2v-2zm4 0h2v2h-2v-2zm-4 4h2v2h-2v-2zm2 2h2v2h-2v-2zm2-2h2v2h-2v-2zm2 2h2v2h-2v-2zm-2-4h2v2h-2v-2zm-2 2h2v2h-2v-2z"/></svg></button>`
            : '';
        const indicatorHtml = `<span class="task-notes-indicator${hasNotes ? ' has-notes' : ''}" role="button" aria-label="${hasNotes ? 'View notes' : 'Add notes'}" title="${hasNotes ? 'View notes' : 'Add notes'}">&#128172;</span>`;
        const historyIndicatorHtml = `<span class="task-history-indicator${hasHistory ? ' has-history' : ''}" role="button" aria-label="Completion history" title="Completion history">&#128337;</span>`;

        let historyHtml = '';
        if (hasHistory) {
            const completions = task.completions.slice(0, 10);
            const items = completions.map((c, i) => {
                const d = new Date(c.completed_at);
                const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                let gapHtml = '';
                if (i < completions.length - 1) {
                    const prev = new Date(completions[i + 1].completed_at);
                    const gapDays = Math.round((d - prev) / 86400000);
                    if (gapDays === 0) return '';
                    gapHtml = `<span class="history-gap">${formatGap(gapDays)}</span>`;
                }
                return `<li data-completion-id="${c.id}"><span class="history-date">${dateStr}</span>${gapHtml}<button class="btn-history-delete" aria-label="Delete entry" title="Delete entry">&times;</button></li>`;
            }).join('');
            historyHtml = `<div class="task-history"><span class="history-label">History</span><ul>${items}</ul></div>`;
        } else {
            historyHtml = '<div class="task-history"></div>';
        }

        const notesHtml = `<div class="task-notes${notesOpen ? ' open' : ''}" data-default-open="${notesOpen ? '1' : '0'}">${hasNotes ? linkifyText(escapeHtml(task.notes)) : ''}</div>`;

        const sensorHtml = `<div class="sensor-toggle-row">
            <label class="sensor-toggle-label">
                <input type="checkbox" class="sensor-toggle" ${task.sensor_enabled ? 'checked' : ''}>
                <span>HA Sensor</span>
            </label>
            <label class="sensor-toggle-label qr-toggle-label" title="When on, a scannable QR icon appears on the card — click it to open a printable code. Scanning the printout marks the task complete.&#10;&#10;Requires port 5050 to be enabled in this add-on's Network settings (opt-in for security). The QR dialog auto-detects and walks you through it.">
                <input type="checkbox" class="qr-toggle" ${task.qr_enabled ? 'checked' : ''}>
                <span>QR</span>
            </label>
        </div>`;

        card.innerHTML = `
            <div class="task-info">
                <div class="task-name">${escapeHtml(task.name)}</div>
                <div class="task-meta-row">
                    <span class="task-meta">${freqLabel}</span>${dynamicTag}
                    ${historyIndicatorHtml}
                    ${indicatorHtml}
                    ${sensorIcon}
                    ${qrIcon}
                </div>
                ${notesHtml}
                ${sensorHtml}
                ${historyHtml}
            </div>
            <div class="task-due ${dueClass}" title="Click to set when you last did this" data-id="${task.id}">${dueText}</div>
            <div class="task-actions">
                <button class="btn-edit">Edit</button>
                ${isSnoozed ? `<button class="btn-unsnooze" onclick="unsnoozeTask(${task.id})">Wake</button>` : ''}
                ${!isSnoozed && (days === null || days < 0) ? `<button class="btn-snooze" onclick="openSnoozeMenu(this, ${task.id})" aria-label="Snooze" title="Snooze">Zzz</button>` : ''}
                ${hasHistory ? `<button class="btn-undo" onclick="undoLastCompletion(${task.completions[0].id})" title="Undo last completion">Undo</button>` : ''}
                <button class="btn-done" onclick="completeTask(${task.id})">Reset</button>
                <button class="btn-delete" onclick="deleteTask(${task.id}, this)">Delete</button>
            </div>
        `;

        card.addEventListener('click', (e) => {
            // Don't toggle when clicking buttons or inputs
            if (e.target.closest('button, input, select, textarea, .task-actions')) return;
            // When already expanded, also protect interactive content areas
            if (card.classList.contains('card-expanded') &&
                e.target.closest('.task-notes-indicator, .task-history-indicator, .task-notes, .task-history')) return;
            // While editing, the name/frequency/due fields open inline editors;
            // don't collapse the card out from under them
            if (card.classList.contains('card-editing') &&
                e.target.closest('.task-name, .task-meta, .task-due')) return;
            toggleCardExpanded(card);
        });

        const editBtn = card.querySelector('.btn-edit');
        editBtn.addEventListener('click', () => {
            const editing = card.classList.toggle('card-editing');
            editBtn.textContent = editing ? 'Done' : 'Edit';
        });

        card.querySelector('.task-name').addEventListener('click', (e) => {
            if (!card.classList.contains('card-editing')) return;
            const nameEl = e.currentTarget;
            if (nameEl.querySelector('input')) return;

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'name-edit';
            input.value = task.name;

            const original = nameEl.textContent;
            nameEl.textContent = '';
            nameEl.appendChild(input);
            input.focus();
            input.select();
            scrollEditorIntoView(input);

            async function save() {
                const val = input.value.trim();
                if (val && val !== task.name) {
                    await fetch(`${BASE}/api/tasks/${task.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: val })
                    });
                    loadTasks(task.id);
                } else {
                    nameEl.textContent = original;
                }
            }

            input.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') { ev.preventDefault(); save(); }
                if (ev.key === 'Escape') { nameEl.textContent = original; }
            });

            input.addEventListener('blur', save);
        });

        // Inline frequency editing
        card.querySelector('.task-meta').addEventListener('click', (e) => {
            if (!card.classList.contains('card-editing')) return;
            const metaEl = e.currentTarget;
            if (metaEl.querySelector('input, select')) return;
            metaEl.style.cursor = 'default';

            const original = metaEl.textContent;
            const stype = task.schedule_type || 'interval';

            function cancelEdit() {
                metaEl.textContent = original;
                metaEl.style.cursor = '';
            }

            if (stype === 'dynamic') {
                // Dynamic tasks: show a type-switch dropdown to convert
                metaEl.innerHTML = '';
                const wrap = document.createElement('span');
                wrap.className = 'freq-edit';
                const sel = document.createElement('select');
                [{v:'dynamic',l:'Dynamic'},{v:'interval',l:'Interval'},{v:'fixed',l:'Fixed'}].forEach(o => {
                    const opt = document.createElement('option');
                    opt.value = o.v; opt.textContent = o.l;
                    if (o.v === 'dynamic') opt.selected = true;
                    sel.appendChild(opt);
                });
                wrap.appendChild(sel);
                metaEl.appendChild(wrap);
                sel.focus();

                let saved = false;
                async function saveDynamic() {
                    if (saved) return;
                    saved = true;
                    const val = sel.value;
                    if (val !== 'dynamic') {
                        const body = { schedule_type: val };
                        if (val === 'interval') body.frequency_days = task.frequency_days || 7;
                        await fetch(`${BASE}/api/tasks/${task.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body)
                        });
                        loadTasks(task.id);
                    } else {
                        cancelEdit();
                    }
                }
                sel.addEventListener('change', saveDynamic);
                sel.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Escape') { saved = true; cancelEdit(); }
                });
                sel.addEventListener('blur', saveDynamic);

            } else if (stype === 'interval') {
                // Decompose frequency_days into best-fit unit
                let num, unitVal;
                if (task.frequency_days % 365 === 0 && task.frequency_days >= 365) {
                    num = task.frequency_days / 365; unitVal = 365;
                } else if (task.frequency_days % 30 === 0 && task.frequency_days >= 30) {
                    num = task.frequency_days / 30; unitVal = 30;
                } else if (task.frequency_days % 7 === 0 && task.frequency_days >= 7) {
                    num = task.frequency_days / 7; unitVal = 7;
                } else {
                    num = task.frequency_days; unitVal = 1;
                }

                metaEl.innerHTML = '';
                const wrap = document.createElement('span');
                wrap.className = 'freq-edit';

                const typeSelect = document.createElement('select');
                typeSelect.className = 'type-switch';
                [{v:'interval',l:'Interval'},{v:'dynamic',l:'Dynamic'}].forEach(o => {
                    const opt = document.createElement('option');
                    opt.value = o.v; opt.textContent = o.l;
                    if (o.v === 'interval') opt.selected = true;
                    typeSelect.appendChild(opt);
                });

                const numInput = document.createElement('input');
                numInput.type = 'number';
                numInput.inputMode = 'numeric';
                numInput.min = '1';
                numInput.value = num;

                const unitSelect = document.createElement('select');
                [{v:1,l:'days'},{v:7,l:'weeks'},{v:30,l:'months'},{v:365,l:'years'}].forEach(o => {
                    const opt = document.createElement('option');
                    opt.value = o.v; opt.textContent = o.l;
                    if (o.v === unitVal) opt.selected = true;
                    unitSelect.appendChild(opt);
                });

                wrap.appendChild(typeSelect);
                wrap.appendChild(numInput);
                wrap.appendChild(unitSelect);
                metaEl.appendChild(wrap);
                numInput.focus();
                numInput.select();

                let saved = false;

                typeSelect.addEventListener('change', async () => {
                    if (saved) return;
                    if (typeSelect.value === 'dynamic') {
                        saved = true;
                        await fetch(`${BASE}/api/tasks/${task.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ schedule_type: 'dynamic' })
                        });
                        loadTasks(task.id);
                    }
                });

                async function save() {
                    if (saved) return;
                    saved = true;
                    const n = parseInt(numInput.value);
                    const u = parseInt(unitSelect.value);
                    if (n && n > 0 && n * u !== task.frequency_days) {
                        await fetch(`${BASE}/api/tasks/${task.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ frequency_days: n * u })
                        });
                        loadTasks(task.id);
                    } else {
                        cancelEdit();
                    }
                }

                function onKey(ev) {
                    if (ev.key === 'Enter') { ev.preventDefault(); save(); }
                    if (ev.key === 'Escape') { saved = true; cancelEdit(); }
                }
                numInput.addEventListener('keydown', onKey);
                unitSelect.addEventListener('keydown', onKey);
                typeSelect.addEventListener('keydown', onKey);
                numInput.addEventListener('blur', () => setTimeout(() => {
                    if (!metaEl.contains(document.activeElement)) save();
                }, 0));
                unitSelect.addEventListener('blur', () => setTimeout(() => {
                    if (!metaEl.contains(document.activeElement)) save();
                }, 0));
                typeSelect.addEventListener('blur', () => setTimeout(() => {
                    if (!metaEl.contains(document.activeElement)) save();
                }, 0));

            } else if (task.fixed_unit === 'weekly') {
                metaEl.innerHTML = '';
                const wrap = document.createElement('span');
                wrap.className = 'freq-edit';

                const typeSelect = document.createElement('select');
                typeSelect.className = 'type-switch';
                [{v:'fixed',l:'Fixed'},{v:'dynamic',l:'Dynamic'}].forEach(o => {
                    const opt = document.createElement('option');
                    opt.value = o.v; opt.textContent = o.l;
                    if (o.v === 'fixed') opt.selected = true;
                    typeSelect.appendChild(opt);
                });

                const sel = document.createElement('select');
                DAY_NAMES.forEach((name, i) => {
                    const opt = document.createElement('option');
                    opt.value = i; opt.textContent = name;
                    if (i === task.fixed_value) opt.selected = true;
                    sel.appendChild(opt);
                });
                wrap.appendChild(typeSelect);
                wrap.appendChild(sel);
                metaEl.appendChild(wrap);
                sel.focus();

                let saved = false;

                typeSelect.addEventListener('change', async () => {
                    if (saved) return;
                    if (typeSelect.value === 'dynamic') {
                        saved = true;
                        await fetch(`${BASE}/api/tasks/${task.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ schedule_type: 'dynamic' })
                        });
                        loadTasks(task.id);
                    }
                });

                async function save() {
                    if (saved) return;
                    saved = true;
                    const val = parseInt(sel.value);
                    if (val !== task.fixed_value) {
                        await fetch(`${BASE}/api/tasks/${task.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ fixed_value: val })
                        });
                        loadTasks(task.id);
                    } else {
                        cancelEdit();
                    }
                }
                sel.addEventListener('change', save);
                sel.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Escape') { saved = true; cancelEdit(); }
                });
                typeSelect.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Escape') { saved = true; cancelEdit(); }
                });
                sel.addEventListener('blur', () => setTimeout(() => {
                    if (!metaEl.contains(document.activeElement)) save();
                }, 0));
                typeSelect.addEventListener('blur', () => setTimeout(() => {
                    if (!metaEl.contains(document.activeElement)) save();
                }, 0));

            } else if (task.fixed_unit === 'monthly') {
                metaEl.innerHTML = '';
                const wrap = document.createElement('span');
                wrap.className = 'freq-edit';

                const typeSelect = document.createElement('select');
                typeSelect.className = 'type-switch';
                [{v:'fixed',l:'Fixed'},{v:'dynamic',l:'Dynamic'}].forEach(o => {
                    const opt = document.createElement('option');
                    opt.value = o.v; opt.textContent = o.l;
                    if (o.v === 'fixed') opt.selected = true;
                    typeSelect.appendChild(opt);
                });

                const inp = document.createElement('input');
                inp.type = 'number';
                inp.inputMode = 'numeric';
                inp.min = '1'; inp.max = '31';
                inp.value = task.fixed_value;
                wrap.appendChild(typeSelect);
                wrap.appendChild(inp);
                metaEl.appendChild(wrap);
                inp.focus();
                inp.select();

                let saved = false;

                typeSelect.addEventListener('change', async () => {
                    if (saved) return;
                    if (typeSelect.value === 'dynamic') {
                        saved = true;
                        await fetch(`${BASE}/api/tasks/${task.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ schedule_type: 'dynamic' })
                        });
                        loadTasks(task.id);
                    }
                });

                async function save() {
                    if (saved) return;
                    saved = true;
                    const val = parseInt(inp.value);
                    if (val && val >= 1 && val <= 31 && val !== task.fixed_value) {
                        await fetch(`${BASE}/api/tasks/${task.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ fixed_value: val })
                        });
                        loadTasks(task.id);
                    } else {
                        cancelEdit();
                    }
                }
                inp.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Enter') { ev.preventDefault(); save(); }
                    if (ev.key === 'Escape') { saved = true; cancelEdit(); }
                });
                typeSelect.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Escape') { saved = true; cancelEdit(); }
                });
                inp.addEventListener('blur', () => setTimeout(() => {
                    if (!metaEl.contains(document.activeElement)) save();
                }, 0));
                typeSelect.addEventListener('blur', () => setTimeout(() => {
                    if (!metaEl.contains(document.activeElement)) save();
                }, 0));

            } else if (task.fixed_unit === 'yearly') {
                const curMonth = Math.floor(task.fixed_value / 100);
                const curDay = task.fixed_value % 100;

                metaEl.innerHTML = '';
                const wrap = document.createElement('span');
                wrap.className = 'freq-edit';

                const typeSelect = document.createElement('select');
                typeSelect.className = 'type-switch';
                [{v:'fixed',l:'Fixed'},{v:'dynamic',l:'Dynamic'}].forEach(o => {
                    const opt = document.createElement('option');
                    opt.value = o.v; opt.textContent = o.l;
                    if (o.v === 'fixed') opt.selected = true;
                    typeSelect.appendChild(opt);
                });

                const monthSel = document.createElement('select');
                MONTH_ABBR.forEach((name, i) => {
                    if (i === 0) return;
                    const opt = document.createElement('option');
                    opt.value = i; opt.textContent = name;
                    if (i === curMonth) opt.selected = true;
                    monthSel.appendChild(opt);
                });

                const dayInp = document.createElement('input');
                dayInp.type = 'number';
                dayInp.inputMode = 'numeric';
                dayInp.min = '1'; dayInp.max = '31';
                dayInp.value = curDay;

                wrap.appendChild(typeSelect);
                wrap.appendChild(monthSel);
                wrap.appendChild(dayInp);
                metaEl.appendChild(wrap);
                monthSel.focus();

                let saved = false;

                typeSelect.addEventListener('change', async () => {
                    if (saved) return;
                    if (typeSelect.value === 'dynamic') {
                        saved = true;
                        await fetch(`${BASE}/api/tasks/${task.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ schedule_type: 'dynamic' })
                        });
                        loadTasks(task.id);
                    }
                });

                async function save() {
                    if (saved) return;
                    saved = true;
                    const m = parseInt(monthSel.value);
                    const d = parseInt(dayInp.value);
                    const newVal = m * 100 + d;
                    if (d && d >= 1 && d <= 31 && newVal !== task.fixed_value) {
                        await fetch(`${BASE}/api/tasks/${task.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ fixed_value: newVal })
                        });
                        loadTasks(task.id);
                    } else {
                        cancelEdit();
                    }
                }

                function onKey(ev) {
                    if (ev.key === 'Enter') { ev.preventDefault(); save(); }
                    if (ev.key === 'Escape') { saved = true; cancelEdit(); }
                }
                typeSelect.addEventListener('keydown', onKey);
                monthSel.addEventListener('keydown', onKey);
                dayInp.addEventListener('keydown', onKey);
                typeSelect.addEventListener('blur', () => setTimeout(() => {
                    if (!metaEl.contains(document.activeElement)) save();
                }, 0));
                monthSel.addEventListener('blur', () => setTimeout(() => {
                    if (!metaEl.contains(document.activeElement)) save();
                }, 0));
                dayInp.addEventListener('blur', () => setTimeout(() => {
                    if (!metaEl.contains(document.activeElement)) save();
                }, 0));
            }
        });

        const indicator = card.querySelector('.task-notes-indicator');
        const notesDiv = card.querySelector('.task-notes');

        function openNotesEditor() {
            if (notesDiv.querySelector('textarea')) return;
            notesDiv.classList.add('open');

            const textarea = document.createElement('textarea');
            textarea.className = 'notes-edit';
            textarea.value = task.notes || '';
            textarea.rows = 3;

            const original = notesDiv.textContent;
            notesDiv.textContent = '';
            notesDiv.appendChild(textarea);
            textarea.focus();
            scrollEditorIntoView(textarea);

            async function saveNotes() {
                const val = textarea.value.trim();
                if (val !== (task.notes || '').trim()) {
                    await fetch(`${BASE}/api/tasks/${task.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ notes: val || '' })
                    });
                    loadTasks(task.id);
                } else {
                    notesDiv.textContent = original;
                }
            }

            textarea.addEventListener('keydown', (ev) => {
                // Mobile keyboards have no Shift+Enter; there, Enter inserts a
                // newline and blur (tap outside) saves instead.
                if (ev.key === 'Enter' && !ev.shiftKey && !COARSE_POINTER) { ev.preventDefault(); saveNotes(); }
                if (ev.key === 'Escape') { notesDiv.textContent = original; }
            });

            textarea.addEventListener('blur', saveNotes);
        }

        indicator.addEventListener('click', () => {
            // On a collapsed card the tap just expands the card (card handler)
            if (!card.classList.contains('card-expanded')) return;
            if (notesDiv.classList.contains('open')) {
                notesDiv.classList.remove('open');
            } else if (hasNotes) {
                notesDiv.classList.add('open');
            } else if (card.classList.contains('card-editing')) {
                openNotesEditor();
            }
        });

        notesDiv.addEventListener('click', (e) => {
            if (e.target.closest('a')) return;
            if (!card.classList.contains('card-editing')) return;
            if (!notesDiv.querySelector('textarea')) openNotesEditor();
        });

        const historyIndicator = card.querySelector('.task-history-indicator');
        const historyDiv = card.querySelector('.task-history');

        if (historyIndicator && historyDiv) {
            historyIndicator.addEventListener('click', () => {
                if (!card.classList.contains('card-expanded')) return;
                historyDiv.classList.toggle('open');
            });

            historyDiv.addEventListener('click', async (e) => {
                const deleteBtn = e.target.closest('.btn-history-delete');
                if (deleteBtn) {
                    const li = deleteBtn.closest('li');
                    const completionId = li.dataset.completionId;
                    await fetch(`${BASE}/api/completions/${completionId}`, { method: 'DELETE' });
                    loadTasks(task.id);
                    return;
                }

                const dateSpan = e.target.closest('.history-date');
                if (dateSpan && card.classList.contains('card-editing')) {
                    const li = dateSpan.closest('li');
                    const completionId = li.dataset.completionId;
                    if (dateSpan.querySelector('input')) return;

                    const input = document.createElement('input');
                    input.type = 'date';
                    input.className = 'date-correct';
                    input.max = new Date().toISOString().split('T')[0];
                    // Find the completion to get its current date
                    const completion = task.completions.find(c => String(c.id) === completionId);
                    if (completion) {
                        input.value = completion.completed_at.split('T')[0];
                    }

                    const originalText = dateSpan.textContent;
                    dateSpan.textContent = '';
                    dateSpan.appendChild(input);

                    const setBtn = document.createElement('button');
                    setBtn.className = 'btn-date-confirm';
                    setBtn.textContent = 'Set';
                    dateSpan.appendChild(setBtn);

                    openDatePicker(input);
                    scrollEditorIntoView(input);

                    // Save only on explicit confirm -- mobile pickers fire
                    // 'change' on every wheel movement, mid-selection.
                    let finished = false;

                    async function saveDate() {
                        if (finished) return;
                        if (input.value) {
                            finished = true;
                            await fetch(`${BASE}/api/completions/${completionId}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ completed_at: input.value + 'T12:00:00' })
                            });
                            loadTasks(task.id);
                        }
                    }

                    function cancelEdit() {
                        finished = true;
                        dateSpan.textContent = originalText;
                    }

                    function revertIfLeft() {
                        // Some WebViews blur the input while the native picker
                        // is open; give the tap on Set time to land.
                        setTimeout(() => {
                            if (finished) return;
                            if (!dateSpan.contains(document.activeElement)) {
                                cancelEdit();
                            }
                        }, 200);
                    }

                    setBtn.addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        saveDate();
                    });
                    input.addEventListener('keydown', (ev) => {
                        if (ev.key === 'Escape') cancelEdit();
                        if (ev.key === 'Enter') saveDate();
                    });
                    input.addEventListener('blur', (ev) => {
                        if (ev.relatedTarget === setBtn) return;
                        revertIfLeft();
                    });
                    setBtn.addEventListener('blur', revertIfLeft);
                }
            });
        }

        card.querySelector('.task-due').addEventListener('click', (e) => {
            if (!card.classList.contains('card-editing')) return;
            const dueEl = e.currentTarget;
            if (dueEl.querySelector('input')) return;

            const input = document.createElement('input');
            input.type = 'date';
            input.className = 'date-correct';
            input.max = new Date().toISOString().split('T')[0];
            if (task.last_completed) {
                input.value = task.last_completed.split('T')[0];
            } else {
                input.value = input.max;
            }

            const original = dueEl.textContent;
            dueEl.textContent = '';
            dueEl.appendChild(input);

            const confirmBtn = document.createElement('button');
            confirmBtn.className = 'btn-date-confirm';
            confirmBtn.textContent = 'Set';
            dueEl.appendChild(confirmBtn);

            openDatePicker(input);
            scrollEditorIntoView(input);

            let finished = false;

            async function saveDueDate() {
                if (finished) return;
                if (input.value) {
                    finished = true;
                    await completeTaskAt(task.id, input.value);
                }
            }

            function cancelEdit() {
                finished = true;
                dueEl.textContent = original;
            }

            function revertIfLeft() {
                setTimeout(() => {
                    if (finished) return;
                    if (!dueEl.contains(document.activeElement)) {
                        cancelEdit();
                    }
                }, 200);
            }

            confirmBtn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                saveDueDate();
            });

            input.addEventListener('blur', (ev) => {
                if (ev.relatedTarget === confirmBtn) return;
                revertIfLeft();
            });

            confirmBtn.addEventListener('blur', revertIfLeft);

            input.addEventListener('keydown', (ev) => {
                if (ev.key === 'Escape') cancelEdit();
                if (ev.key === 'Enter') saveDueDate();
            });
        });

        const sensorToggle = card.querySelector('.sensor-toggle');
        if (sensorToggle) {
            sensorToggle.addEventListener('change', async () => {
                await fetch(`${BASE}/api/tasks/${task.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sensor_enabled: sensorToggle.checked })
                });
            });
        }

        const qrToggle = card.querySelector('.qr-toggle');
        if (qrToggle) {
            qrToggle.addEventListener('change', async () => {
                const enabled = qrToggle.checked;
                await fetch(`${BASE}/api/tasks/${task.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ qr_enabled: enabled })
                });
                // Update the meta-row icon in place so the card stays expanded/editing
                task.qr_enabled = enabled;
                const metaRow = card.querySelector('.task-meta-row');
                const existing = metaRow?.querySelector('.qr-icon');
                if (enabled && !existing) {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'qr-icon';
                    btn.title = 'Print QR code for this task';
                    btn.dataset.taskId = task.id;
                    btn.dataset.qrToken = task.qr_token || '';
                    btn.dataset.taskName = task.name;
                    btn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="#03a9f4" d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm8 0h2v2h-2v-2zm4 0h2v2h-2v-2zm-4 4h2v2h-2v-2zm2 2h2v2h-2v-2zm2-2h2v2h-2v-2zm2 2h2v2h-2v-2zm-2-4h2v2h-2v-2zm-2 2h2v2h-2v-2z"/></svg>';
                    btn.addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        openQrModal(btn);
                    });
                    metaRow.appendChild(btn);
                } else if (!enabled && existing) {
                    existing.remove();
                }
                // Also toggle the footer sheet link, since the enabled count changed
                const qrSheetBtn = document.getElementById('btn-qr-sheet');
                if (qrSheetBtn) {
                    const anyEnabled = !!document.querySelector('.qr-icon');
                    qrSheetBtn.style.display = anyEnabled ? '' : 'none';
                }
            });
        }

        taskList.appendChild(card);

        if (highlightId && task.id === highlightId) {
            card.classList.add('highlight-new');
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });

    // Re-apply any active filter after re-render, then restore scroll
    applyTaskFilter();
    if (!highlightId) taskList.scrollTop = prevScroll;
}

function showLoadError(err) {
    let banner = document.getElementById('load-error');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'load-error';
        banner.className = 'load-error';
        taskList.parentNode.insertBefore(banner, taskList);
    }
    const msg = (err && err.message) ? err.message : String(err);
    const hint = /HTTP 40[13]/.test(msg)
        ? "This usually means the signed-in Home Assistant user isn't allowed to reach the add-on. Try signing out/in, or (temporarily) grant the user Local admin in HA → Settings → People."
        : "Check the add-on is running and reachable.";
    banner.innerHTML = `<strong>Couldn't load tasks.</strong> ${escapeHtml(msg)}<br><span class="load-error-hint">${escapeHtml(hint)}</span>`;
}

function clearLoadError() {
    const banner = document.getElementById('load-error');
    if (banner) banner.remove();
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function applyTaskFilter() {
    const input = document.getElementById('task-filter');
    const q = (input?.value || '').trim().toLowerCase();
    const cards = taskList.querySelectorAll('.task-card');
    let visibleCount = 0;
    cards.forEach(card => {
        const match = !q || (card.dataset.search || '').includes(q);
        card.style.display = match ? '' : 'none';
        if (match) visibleCount++;
    });
    // Hide bucket separators that end up with no visible cards immediately after
    taskList.querySelectorAll('.timeline-sep').forEach(sep => {
        let el = sep.nextElementSibling;
        let hasVisibleCard = false;
        while (el && !el.classList.contains('timeline-sep')) {
            if (el.classList.contains('task-card') && el.style.display !== 'none') {
                hasVisibleCard = true;
                break;
            }
            el = el.nextElementSibling;
        }
        sep.style.display = hasVisibleCard ? '' : 'none';
    });
    // Also collapse the app-logo header when filtering, for more room
    const logo = taskList.querySelector('.app-logo-row');
    if (logo) logo.style.display = q ? 'none' : '';
    // Empty-state message
    let emptyEl = taskList.querySelector('.filter-empty');
    if (q && visibleCount === 0) {
        if (!emptyEl) {
            emptyEl = document.createElement('div');
            emptyEl.className = 'filter-empty';
            taskList.appendChild(emptyEl);
        }
        emptyEl.textContent = `No tasks match "${q}"`;
    } else if (emptyEl) {
        emptyEl.remove();
    }
}

const taskFilterInput = document.getElementById('task-filter');
if (taskFilterInput) {
    taskFilterInput.addEventListener('input', applyTaskFilter);
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTH_ABBR = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatGap(days) {
    if (days >= 365) {
        const y = Math.floor(days / 365);
        return y === 1 ? '1 yr' : `${y} yrs`;
    }
    if (days >= 30) {
        const m = Math.floor(days / 30);
        return m === 1 ? '1 mo' : `${m} mos`;
    }
    if (days >= 7) {
        const w = Math.floor(days / 7);
        return w === 1 ? '1 wk' : `${w} wks`;
    }
    return days === 1 ? '1 day' : `${days} days`;
}

function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatTaskFrequency(task) {
    const stype = task.schedule_type || 'interval';
    if (stype === 'dynamic') {
        if (task.dynamic && task.dynamic.predicted_days) {
            const season = task.dynamic.season === 'overall' ? 'avg' : task.dynamic.season;
            return `~${formatFrequency(task.dynamic.predicted_days)} (${season})`;
        }
        return 'Tracking...';
    }
    if (stype === 'fixed') {
        const unit = task.fixed_unit;
        const val = task.fixed_value;
        if (unit === 'weekly') return `Every ${DAY_NAMES[val]}`;
        if (unit === 'monthly') return `Every ${ordinal(val)}`;
        if (unit === 'yearly') {
            const month = Math.floor(val / 100);
            const day = val % 100;
            return `Every ${MONTH_ABBR[month]} ${day}`;
        }
    }
    return `Every ${formatFrequency(task.frequency_days)}`;
}

function formatFrequency(days) {
    if (days % 365 === 0 && days >= 365) {
        const y = days / 365;
        return y === 1 ? 'year' : `${y} years`;
    }
    if (days % 30 === 0 && days >= 30) {
        const m = days / 30;
        return m === 1 ? 'month' : `${m} months`;
    }
    if (days % 7 === 0 && days >= 7) {
        const w = days / 7;
        return w === 1 ? 'week' : `${w} weeks`;
    }
    return days === 1 ? 'day' : `${days} days`;
}

async function undoLastCompletion(completionId) {
    await fetch(`${BASE}/api/completions/${completionId}`, { method: 'DELETE' });
    loadTasks();
}

async function completeTask(id) {
    await fetch(`${BASE}/api/tasks/${id}/complete`, { method: 'POST' });
    loadTasks(id);
}

async function completeTaskAt(id, dateStr) {
    await fetch(`${BASE}/api/tasks/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed_at: dateStr + 'T12:00:00' })
    });
    loadTasks(id);
}

function deleteTask(id, btn) {
    const card = btn.closest('.task-card');
    const actions = btn.closest('.task-actions');
    const originalChildren = Array.from(actions.children);
    originalChildren.forEach(el => el.style.display = 'none');
    card.classList.add('confirming-delete');

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-done';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
        cancelBtn.remove();
        confirmBtn.remove();
        originalChildren.forEach(el => el.style.display = '');
        card.classList.remove('confirming-delete');
    });

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn-confirm-delete';
    confirmBtn.textContent = 'Confirm';
    // Arm after a beat so a double-tap on Delete can't land on Confirm
    confirmBtn.disabled = true;
    setTimeout(() => { confirmBtn.disabled = false; }, 400);
    confirmBtn.addEventListener('click', async () => {
        await fetch(`${BASE}/api/tasks/${id}`, { method: 'DELETE' });
        loadTasks();
    });

    // Confirm first, Cancel last -- Cancel occupies Delete's old position
    actions.appendChild(confirmBtn);
    actions.appendChild(cancelBtn);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeAttr(text) {
    return escapeHtml(text).replace(/"/g, '&quot;');
}

function linkifyText(escapedHtml) {
    return escapedHtml.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

// Export/Import
document.getElementById('btn-export').addEventListener('click', async () => {
    const res = await fetch(`${BASE}/api/tasks/export`);
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `homefrequency-tasks-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
});

const importFile = document.getElementById('import-file');
document.getElementById('btn-import').addEventListener('click', () => importFile.click());
importFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        alert('Invalid JSON file');
        return;
    }
    if (!confirm(`Import ${data.length} task(s)? This will add them alongside existing tasks.`)) return;
    const res = await fetch(`${BASE}/api/tasks/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    const result = await res.json();
    if (result.ok) {
        loadTasks();
    } else {
        alert('Import failed: ' + (result.error || 'Unknown error'));
    }
    importFile.value = '';
});

// ---------- QR code modal ----------

const QR_BASE_STORAGE_KEY = 'hf_qr_base_url_override';
let qrInfoPromise = null;

function fetchQrInfo() {
    if (!qrInfoPromise) {
        qrInfoPromise = fetch(`${BASE}/api/qr-info`)
            .then(r => r.ok ? r.json() : { available: false })
            .catch(() => ({ available: false }));
    }
    return qrInfoPromise;
}

function buildQrUrl(base, taskId, token) {
    const trimmed = (base || '').replace(/\/+$/, '');
    return `${trimmed}/q/${taskId}/${encodeURIComponent(token)}`;
}

function renderQrInto(container, text) {
    container.innerHTML = '';
    if (!text || typeof qrcode !== 'function') return;
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    container.innerHTML = qr.createSvgTag({ scalable: true, margin: 2 });
    const svg = container.querySelector('svg');
    if (svg) {
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg.style.width = '100%';
        svg.style.height = 'auto';
        svg.style.shapeRendering = 'crispEdges';
    }
}

async function openQrModal(btn) {
    const taskId = btn.dataset.taskId;
    const token = btn.dataset.qrToken;
    const taskName = btn.dataset.taskName;

    if (!token) {
        alert('This task has no QR token yet — reload the page.');
        return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'qr-overlay';
    overlay.innerHTML = `
        <div class="qr-modal" role="dialog" aria-modal="true">
            <div class="qr-print-area">
                <div class="qr-code"></div>
                <div class="qr-task-name"></div>
                <div class="qr-url-preview"></div>
            </div>
            <div class="qr-body"></div>
            <div class="qr-actions">
                <button type="button" class="qr-btn qr-btn-secondary" data-action="close">Close</button>
                <button type="button" class="qr-btn qr-btn-primary" data-action="print" title="Prints just this one QR + task name (2.4in wide). To print multiple QRs on one page, use 'Print QR sheet' on the main screen.">Print</button>
            </div>
        </div>
    `;

    const codeEl = overlay.querySelector('.qr-code');
    const nameEl = overlay.querySelector('.qr-task-name');
    const urlPreviewEl = overlay.querySelector('.qr-url-preview');
    const bodyEl = overlay.querySelector('.qr-body');
    const printBtn = overlay.querySelector('[data-action="print"]');

    nameEl.textContent = taskName;

    function close() {
        document.body.classList.remove('qr-modal-open');
        overlay.remove();
        document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('[data-action="close"]').addEventListener('click', close);
    printBtn.addEventListener('click', () => {
        document.body.classList.add('qr-printing');
        window.print();
        setTimeout(() => document.body.classList.remove('qr-printing'), 500);
    });
    document.addEventListener('keydown', onKey);
    document.body.classList.add('qr-modal-open');
    document.body.appendChild(overlay);

    // Show a placeholder while we fetch qr-info
    bodyEl.innerHTML = '<div class="qr-hint">Loading…</div>';

    const info = await fetchQrInfo();
    let savedOverride = null;
    try { savedOverride = localStorage.getItem(QR_BASE_STORAGE_KEY); } catch {}

    // Choose default base URL
    // Priority: user override (localStorage) > detected LAN URL > current origin fallback
    let baseUrl;
    let source; // 'override' | 'auto' | 'fallback'
    // Prefer hostname (e.g. homeassistant.local) over raw IP so printed QRs
    // don't leak subnet info to anyone who scans a lost printout.
    const autoHost = info.hostname || info.lan_ip;
    if (savedOverride) {
        baseUrl = savedOverride;
        source = 'override';
    } else if (info.available && info.port_enabled && autoHost && info.port) {
        baseUrl = `http://${autoHost}:${info.port}`;
        source = 'auto';
    } else {
        baseUrl = window.location.origin + (BASE || '');
        source = 'fallback';
    }

    const portClosed = info.available && !info.port_enabled;

    function renderControls() {
        let html = '';
        if (portClosed && source !== 'override') {
            html = `
                <div class="qr-hint qr-hint-warn">
                    <strong>Enable port 5050 first.</strong> Printed QR codes reach the add-on directly, not through Home Assistant, so port 5050 needs to be exposed on your network.
                    <ol class="qr-steps">
                        <li>Home Assistant → <strong>Settings → Add-ons → HomeFrequency</strong></li>
                        <li>Open the <strong>Network</strong> section</li>
                        <li>Set <strong>5050</strong> in the Host box (or click "Ok" to accept the default)</li>
                        <li>Save — the add-on will restart</li>
                        <li>Reopen this dialog</li>
                    </ol>
                </div>
                <details class="qr-override-details">
                    <summary>Use a different URL anyway</summary>
                    <label class="qr-base-label">
                        Base URL
                        <input type="url" class="qr-base-input" spellcheck="false" autocomplete="off" value="${escapeAttr(baseUrl)}">
                    </label>
                    <div class="qr-hint">For Nabu Casa or reverse-proxy setups. Saved locally in this browser.</div>
                </details>
            `;
        } else {
            const detected = source === 'auto';
            const usingOverride = source === 'override';
            const portNote = (detected && info.port)
                ? ` (host port <strong>${info.port}</strong> from this add-on's Network settings)`
                : '';
            html = `
                ${detected ? `<div class="qr-hint qr-hint-ok">✓ Auto-detected LAN URL${portNote}. Scan and go.</div>` : ''}
                ${usingOverride ? `<div class="qr-hint">Using your saved custom URL. <button type="button" class="qr-reset-btn">Reset to auto</button></div>` : ''}
                <details class="qr-override-details" ${detected ? '' : 'open'}>
                    <summary>Override URL</summary>
                    <label class="qr-base-label">
                        Base URL
                        <input type="url" class="qr-base-input" spellcheck="false" autocomplete="off" value="${escapeAttr(baseUrl)}">
                    </label>
                    <div class="qr-hint">For Nabu Casa, a reverse proxy, or a different LAN IP. Saved locally in this browser — no change needed unless the auto-detected URL doesn't work from your phone.</div>
                </details>
            `;
        }
        bodyEl.innerHTML = html;

        const baseInput = bodyEl.querySelector('.qr-base-input');
        if (baseInput) {
            baseInput.addEventListener('input', () => {
                baseUrl = baseInput.value;
                source = 'override';
                try { localStorage.setItem(QR_BASE_STORAGE_KEY, baseUrl); } catch {}
                refreshQr();
            });
        }
        const resetBtn = bodyEl.querySelector('.qr-reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                try { localStorage.removeItem(QR_BASE_STORAGE_KEY); } catch {}
                if (info.available && info.port_enabled && autoHost && info.port) {
                    baseUrl = `http://${autoHost}:${info.port}`;
                    source = 'auto';
                } else {
                    baseUrl = window.location.origin + (BASE || '');
                    source = 'fallback';
                }
                renderControls();
                refreshQr();
            });
        }
    }

    function refreshQr() {
        const url = buildQrUrl(baseUrl, taskId, token);
        urlPreviewEl.textContent = url;
        renderQrInto(codeEl, url);
        // Hide print + preview URL when port is closed and no override — QR would just 401
        const usable = !portClosed || source === 'override';
        printBtn.style.display = usable ? '' : 'none';
        codeEl.style.opacity = usable ? '' : '0.3';
        urlPreviewEl.style.display = usable ? '' : 'none';
    }

    renderControls();
    refreshQr();
}

window.openQrModal = openQrModal;

document.addEventListener('DOMContentLoaded', () => {
    loadTasks();
    // Warm the cache so the QR modal opens instantly
    fetchQrInfo();
});
