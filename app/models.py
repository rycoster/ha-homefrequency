import sqlite3
import os
from datetime import datetime, timedelta

DB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
DB_PATH = os.path.join(DB_DIR, 'tasks.db')


def get_db():
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS recurring_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            frequency_days INTEGER NOT NULL,
            last_completed TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()


def add_task(name, frequency_days):
    conn = get_db()
    conn.execute(
        'INSERT INTO recurring_tasks (name, frequency_days) VALUES (?, ?)',
        (name, frequency_days)
    )
    conn.commit()
    conn.close()


def complete_task(task_id):
    conn = get_db()
    conn.execute(
        'UPDATE recurring_tasks SET last_completed = ? WHERE id = ?',
        (datetime.now().isoformat(), task_id)
    )
    conn.commit()
    conn.close()


def delete_task(task_id):
    conn = get_db()
    conn.execute('DELETE FROM recurring_tasks WHERE id = ?', (task_id,))
    conn.commit()
    conn.close()


def edit_task(task_id, name=None, frequency_days=None):
    conn = get_db()
    if name is not None:
        conn.execute('UPDATE recurring_tasks SET name = ? WHERE id = ?', (name, task_id))
    if frequency_days is not None:
        conn.execute('UPDATE recurring_tasks SET frequency_days = ? WHERE id = ?', (frequency_days, task_id))
    conn.commit()
    conn.close()


def get_all_tasks():
    conn = get_db()
    rows = conn.execute('SELECT * FROM recurring_tasks').fetchall()
    conn.close()

    now = datetime.now()
    tasks = []

    for row in rows:
        task = dict(row)
        freq = timedelta(days=task['frequency_days'])

        if task['last_completed']:
            last = datetime.fromisoformat(task['last_completed'])
            next_due = last + freq
        else:
            next_due = datetime.fromisoformat(task['created_at'])

        delta = next_due - now
        days_until = delta.days

        task['next_due'] = next_due.isoformat()
        task['days_until'] = days_until
        task['is_overdue'] = days_until < 0

        tasks.append(task)

    tasks.sort(key=lambda t: t['next_due'])
    return tasks
