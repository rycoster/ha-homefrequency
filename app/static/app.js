// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');

        if (tab.dataset.tab === 'tasks') loadTasks();
    });
});

// --- Chat ---
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const messagesDiv = document.getElementById('messages');
let conversationHistory = [];

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = userInput.value.trim();
    if (!text) return;

    appendMessage('user', text);
    conversationHistory.push({ role: 'user', content: text });
    userInput.value = '';

    const sendBtn = chatForm.querySelector('button');
    sendBtn.disabled = true;

    const thinkingEl = appendMessage('thinking', 'Thinking...');

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: conversationHistory })
        });
        const data = await res.json();
        thinkingEl.remove();

        if (data.error) {
            appendMessage('assistant', 'Error: ' + data.error);
        } else {
            appendMessage('assistant', data.reply);
            conversationHistory.push({ role: 'assistant', content: data.reply });
        }
    } catch (err) {
        thinkingEl.remove();
        appendMessage('assistant', 'Connection error. Is the server running?');
    }

    sendBtn.disabled = false;
    userInput.focus();
});

function appendMessage(role, text) {
    const div = document.createElement('div');
    div.className = 'message ' + role;
    div.textContent = text;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    return div;
}

// --- Tasks ---
const addTaskForm = document.getElementById('add-task-form');
const taskList = document.getElementById('task-list');

addTaskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('task-name').value.trim();
    const freq = parseInt(document.getElementById('task-freq').value);
    const unit = parseInt(document.getElementById('task-unit').value);

    if (!name || !freq) return;

    await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, frequency_days: freq * unit })
    });

    document.getElementById('task-name').value = '';
    document.getElementById('task-freq').value = '';
    loadTasks();
});

async function loadTasks() {
    const res = await fetch('/api/tasks');
    const tasks = await res.json();
    taskList.innerHTML = '';

    tasks.forEach(task => {
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
            card.classList.add('due-soon');
            dueText = `Due in ${days} day${days !== 1 ? 's' : ''}`;
            dueClass = 'due-soon';
        } else if (days < 30) {
            const weeks = Math.floor(days / 7);
            dueText = `Due in ${weeks} week${weeks !== 1 ? 's' : ''}`;
            dueClass = 'ok';
        } else {
            const months = Math.floor(days / 30);
            dueText = `Due in ${months} month${months !== 1 ? 's' : ''}`;
            dueClass = 'ok';
        }

        const freqLabel = formatFrequency(task.frequency_days);

        card.innerHTML = `
            <div class="task-info">
                <div class="task-name">${escapeHtml(task.name)}</div>
                <div class="task-meta">Every ${freqLabel}</div>
            </div>
            <div class="task-due ${dueClass}">${dueText}</div>
            <div class="task-actions">
                <button class="btn-done" onclick="completeTask(${task.id})">Done</button>
                <button class="btn-delete" onclick="deleteTask(${task.id})">Delete</button>
            </div>
        `;

        taskList.appendChild(card);
    });
}

function formatFrequency(days) {
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
    await fetch(`/api/tasks/${id}/complete`, { method: 'POST' });
    loadTasks();
}

async function deleteTask(id) {
    if (!confirm('Delete this task?')) return;
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    loadTasks();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load tasks on initial page load if tasks tab is visible
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('tasks').classList.contains('active')) {
        loadTasks();
    }
});
