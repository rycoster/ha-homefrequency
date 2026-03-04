const BASE = document.querySelector('base')?.getAttribute('href')?.replace(/\/$/, '') || '';

const addTaskForm = document.getElementById('add-task-form');
const taskList = document.getElementById('task-list');
const addTaskToggle = document.getElementById('add-task-toggle');
const editModeToggle = document.getElementById('edit-mode-toggle');

let editMode = false;

editModeToggle.addEventListener('click', () => {
    editMode = !editMode;
    document.body.classList.toggle('edit-mode', editMode);
    editModeToggle.classList.toggle('active', editMode);
    editModeToggle.textContent = editMode ? 'Done' : 'Edit';
});

function toggleCardExpanded(card) {
    const wasExpanded = card.classList.contains('card-expanded');
    // Collapse all other cards
    document.querySelectorAll('.task-card.card-expanded').forEach(c => {
        c.classList.remove('card-expanded');
    });
    // Toggle this card
    if (!wasExpanded) {
        card.classList.add('card-expanded');
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
let scheduleType = 'interval';
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
    if (scheduleType === 'interval') {
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
    const res = await fetch(`${BASE}/api/tasks`);
    const tasks = await res.json();
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

        let dueText, dueClass;
        const days = task.days_until;

        if (days < 0) {
            card.classList.add('overdue');
            dueText = `Overdue by ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''}`;
            dueClass = 'overdue';
        } else if (days === 0) {
            card.classList.add('due-soon');
            dueText = 'Due today';
            dueClass = 'due-soon';
        } else if (days <= 7) {
            dueText = `Due in ${days} day${days !== 1 ? 's' : ''}`;
            dueClass = 'ok';
        } else if (days < 30) {
            const weeks = Math.floor(days / 7);
            dueText = `Due in ${weeks} week${weeks !== 1 ? 's' : ''}`;
            dueClass = 'ok';
        } else {
            const months = Math.floor(days / 30);
            dueText = `Due in ${months} month${months !== 1 ? 's' : ''}`;
            dueClass = 'ok';
        }

        const freqLabel = formatTaskFrequency(task);

        if (days > 90) card.classList.add('distant');

        const hasNotes = task.notes && task.notes.trim();
        const hasHistory = task.completions && task.completions.length > 0;
        const notesOpen = hasNotes && (days <= 7 || days < 0);
        const indicatorHtml = `<span class="task-notes-indicator${hasNotes ? ' has-notes' : ''}" title="${hasNotes ? 'View notes' : 'Add notes'}">&#128172;</span>`;

        let historyHtml = '';
        if (hasHistory) {
            const completions = task.completions.slice(0, 10);
            const items = completions.map((ts, i) => {
                const d = new Date(ts);
                const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                if (i < completions.length - 1) {
                    const prev = new Date(completions[i + 1]);
                    const gapDays = Math.round((d - prev) / 86400000);
                    if (gapDays === 0) return '';
                    return `<li>${dateStr}<span class="history-gap">${formatGap(gapDays)}</span></li>`;
                }
                return `<li>${dateStr}</li>`;
            }).join('');
            historyHtml = `<div class="completion-history"><span class="history-label">History</span><ul>${items}</ul></div>`;
        }

        const notesHtml = `<div class="task-notes${notesOpen ? ' open' : ''}">${hasNotes ? escapeHtml(task.notes) : ''}${historyHtml}</div>`;

        card.innerHTML = `
            <div class="task-info">
                <div class="task-name">${escapeHtml(task.name)}</div>
                <div class="task-meta-row">
                    <span class="task-meta">${freqLabel}</span>
                    ${indicatorHtml}
                </div>
                ${notesHtml}
            </div>
            <div class="task-due ${dueClass}" title="Click to set when you last did this" data-id="${task.id}">${dueText}</div>
            <div class="task-actions">
                <button class="btn-done" onclick="completeTask(${task.id})">Reset</button>
                <button class="btn-delete" onclick="deleteTask(${task.id}, this)">Delete</button>
            </div>
        `;

        card.addEventListener('click', (e) => {
            // Don't toggle expand when clicking buttons, inputs, or interactive elements
            if (e.target.closest('button, input, select, textarea, .task-actions')) return;
            toggleCardExpanded(card);
        });

        card.querySelector('.task-name').addEventListener('click', (e) => {
            if (!card.classList.contains('card-expanded')) return;
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
            if (!card.classList.contains('card-expanded')) return;
            const metaEl = e.currentTarget;
            if (metaEl.querySelector('input, select')) return;
            metaEl.style.cursor = 'default';

            const original = metaEl.textContent;
            const stype = task.schedule_type || 'interval';

            function cancelEdit() {
                metaEl.textContent = original;
                metaEl.style.cursor = '';
            }

            if (stype === 'interval') {
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

                const numInput = document.createElement('input');
                numInput.type = 'number';
                numInput.min = '1';
                numInput.value = num;

                const unitSelect = document.createElement('select');
                [{v:1,l:'days'},{v:7,l:'weeks'},{v:30,l:'months'},{v:365,l:'years'}].forEach(o => {
                    const opt = document.createElement('option');
                    opt.value = o.v; opt.textContent = o.l;
                    if (o.v === unitVal) opt.selected = true;
                    unitSelect.appendChild(opt);
                });

                wrap.appendChild(numInput);
                wrap.appendChild(unitSelect);
                metaEl.appendChild(wrap);
                numInput.focus();
                numInput.select();

                let saved = false;
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
                numInput.addEventListener('blur', () => setTimeout(() => {
                    if (!metaEl.contains(document.activeElement)) save();
                }, 0));
                unitSelect.addEventListener('blur', () => setTimeout(() => {
                    if (!metaEl.contains(document.activeElement)) save();
                }, 0));

            } else if (task.fixed_unit === 'weekly') {
                metaEl.innerHTML = '';
                const wrap = document.createElement('span');
                wrap.className = 'freq-edit';
                const sel = document.createElement('select');
                DAY_NAMES.forEach((name, i) => {
                    const opt = document.createElement('option');
                    opt.value = i; opt.textContent = name;
                    if (i === task.fixed_value) opt.selected = true;
                    sel.appendChild(opt);
                });
                wrap.appendChild(sel);
                metaEl.appendChild(wrap);
                sel.focus();

                let saved = false;
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
                sel.addEventListener('blur', save);

            } else if (task.fixed_unit === 'monthly') {
                metaEl.innerHTML = '';
                const wrap = document.createElement('span');
                wrap.className = 'freq-edit';
                const inp = document.createElement('input');
                inp.type = 'number';
                inp.min = '1'; inp.max = '31';
                inp.value = task.fixed_value;
                wrap.appendChild(inp);
                metaEl.appendChild(wrap);
                inp.focus();
                inp.select();

                let saved = false;
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
                inp.addEventListener('blur', save);

            } else if (task.fixed_unit === 'yearly') {
                const curMonth = Math.floor(task.fixed_value / 100);
                const curDay = task.fixed_value % 100;

                metaEl.innerHTML = '';
                const wrap = document.createElement('span');
                wrap.className = 'freq-edit';

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
                dayInp.min = '1'; dayInp.max = '31';
                dayInp.value = curDay;

                wrap.appendChild(monthSel);
                wrap.appendChild(dayInp);
                metaEl.appendChild(wrap);
                monthSel.focus();

                let saved = false;
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
                monthSel.addEventListener('keydown', onKey);
                dayInp.addEventListener('keydown', onKey);
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
                if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); saveNotes(); }
                if (ev.key === 'Escape') { notesDiv.textContent = original; }
            });

            textarea.addEventListener('blur', saveNotes);
        }

        indicator.addEventListener('click', () => {
            if (notesDiv.classList.contains('open')) {
                notesDiv.classList.remove('open');
            } else if (hasNotes || hasHistory) {
                notesDiv.classList.add('open');
            } else if (card.classList.contains('card-expanded')) {
                openNotesEditor();
            }
        });

        notesDiv.addEventListener('click', (e) => {
            if (!card.classList.contains('card-expanded')) return;
            if (e.target.closest('.completion-history')) return;
            if (!notesDiv.querySelector('textarea')) openNotesEditor();
        });

        card.querySelector('.task-due').addEventListener('click', (e) => {
            if (!card.classList.contains('card-expanded')) return;
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
            confirmBtn.style.display = 'none';
            dueEl.appendChild(confirmBtn);

            input.focus();

            input.addEventListener('change', () => {
                if (input.value) {
                    confirmBtn.style.display = '';
                }
            });

            confirmBtn.addEventListener('click', async () => {
                if (input.value) {
                    await completeTaskAt(task.id, input.value);
                }
            });

            input.addEventListener('blur', (e) => {
                if (e.relatedTarget === confirmBtn) return;
                if (!confirmBtn.style.display && confirmBtn.style.display !== 'none') return;
                setTimeout(() => {
                    if (!dueEl.contains(document.activeElement)) {
                        dueEl.textContent = original;
                    }
                }, 0);
            });

            confirmBtn.addEventListener('blur', () => {
                setTimeout(() => {
                    if (!dueEl.contains(document.activeElement)) {
                        dueEl.textContent = original;
                    }
                }, 0);
            });

            input.addEventListener('keydown', (ev) => {
                if (ev.key === 'Escape') {
                    dueEl.textContent = original;
                }
                if (ev.key === 'Enter' && input.value) {
                    completeTaskAt(task.id, input.value);
                }
            });
        });

        taskList.appendChild(card);

        if (highlightId && task.id === highlightId) {
            card.classList.add('highlight-new');
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });
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
    confirmBtn.addEventListener('click', async () => {
        await fetch(`${BASE}/api/tasks/${id}`, { method: 'DELETE' });
        loadTasks();
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

document.addEventListener('DOMContentLoaded', loadTasks);
