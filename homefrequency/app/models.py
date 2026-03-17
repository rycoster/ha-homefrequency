import sqlite3
import os
from datetime import datetime, timedelta, date
import calendar

DB_DIR = os.environ.get('DB_DIR', os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data'))
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
    # Migrate: add fixed-schedule columns if missing
    cols = {row[1] for row in conn.execute('PRAGMA table_info(recurring_tasks)').fetchall()}
    if 'schedule_type' not in cols:
        conn.execute("ALTER TABLE recurring_tasks ADD COLUMN schedule_type TEXT DEFAULT 'interval'")
    if 'fixed_unit' not in cols:
        conn.execute("ALTER TABLE recurring_tasks ADD COLUMN fixed_unit TEXT")
    if 'fixed_value' not in cols:
        conn.execute("ALTER TABLE recurring_tasks ADD COLUMN fixed_value INTEGER")
    if 'notes' not in cols:
        conn.execute("ALTER TABLE recurring_tasks ADD COLUMN notes TEXT")
    if 'snoozed_until' not in cols:
        conn.execute("ALTER TABLE recurring_tasks ADD COLUMN snoozed_until TIMESTAMP")
    if 'sensor_enabled' not in cols:
        conn.execute("ALTER TABLE recurring_tasks ADD COLUMN sensor_enabled INTEGER DEFAULT 0")
    conn.execute('''
        CREATE TABLE IF NOT EXISTS task_completions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL,
            completed_at TIMESTAMP NOT NULL,
            FOREIGN KEY (task_id) REFERENCES recurring_tasks(id) ON DELETE CASCADE
        )
    ''')
    conn.commit()
    conn.close()


def _get_season(dt):
    """Return season name from a datetime."""
    m = dt.month
    if m in (12, 1, 2):
        return 'winter'
    if m in (3, 4, 5):
        return 'spring'
    if m in (6, 7, 8):
        return 'summer'
    return 'fall'


def _next_season_start():
    """Return the start date of the next season as ISO timestamp."""
    now = datetime.now()
    m = now.month
    y = now.year
    # Season boundaries: Mar 1, Jun 1, Sep 1, Dec 1
    if m < 3:
        return datetime(y, 3, 1).isoformat()
    if m < 6:
        return datetime(y, 6, 1).isoformat()
    if m < 9:
        return datetime(y, 9, 1).isoformat()
    if m < 12:
        return datetime(y, 12, 1).isoformat()
    return datetime(y + 1, 3, 1).isoformat()


def _calc_dynamic_interval(completions):
    """Calculate predicted interval from completion gaps grouped by season.

    Returns (predicted_days, season_used) or (None, None) if < 2 completions.
    """
    if len(completions) < 2:
        return None, None

    # completions are sorted DESC (newest first)
    # Support both dict format {id, completed_at} and plain string format
    gaps_by_season = {}
    all_gaps = []
    for i in range(len(completions) - 1):
        c_later = completions[i]
        c_earlier = completions[i + 1]
        later = datetime.fromisoformat(c_later['completed_at'] if isinstance(c_later, dict) else c_later)
        earlier = datetime.fromisoformat(c_earlier['completed_at'] if isinstance(c_earlier, dict) else c_earlier)
        gap = (later - earlier).days
        if gap <= 0:
            continue
        season = _get_season(later)
        gaps_by_season.setdefault(season, []).append(gap)
        all_gaps.append(gap)

    if not all_gaps:
        return None, None

    current_season = _get_season(datetime.now())
    if current_season in gaps_by_season:
        gaps = gaps_by_season[current_season]
        return round(sum(gaps) / len(gaps)), current_season

    avg = round(sum(all_gaps) / len(all_gaps))
    return avg, 'overall'


def add_task(name, frequency_days=0, schedule_type='interval',
             fixed_unit=None, fixed_value=None, notes=None, sensor_enabled=False):
    conn = get_db()
    # Dynamic tasks start with no implicit first completion
    last_completed = None if schedule_type == 'dynamic' else datetime.now().isoformat()
    cur = conn.execute(
        '''INSERT INTO recurring_tasks
           (name, frequency_days, schedule_type, fixed_unit, fixed_value, notes, last_completed, sensor_enabled)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
        (name, frequency_days, schedule_type, fixed_unit, fixed_value, notes,
         last_completed, 1 if sensor_enabled else 0)
    )
    task_id = cur.lastrowid
    conn.commit()
    conn.close()
    return task_id


def complete_task(task_id, completed_at=None):
    conn = get_db()
    ts = completed_at if completed_at else datetime.now().isoformat()
    conn.execute(
        'UPDATE recurring_tasks SET last_completed = ? WHERE id = ?',
        (ts, task_id)
    )
    conn.execute(
        'INSERT INTO task_completions (task_id, completed_at) VALUES (?, ?)',
        (task_id, ts)
    )
    conn.commit()
    conn.close()


def get_completions(task_id, conn):
    rows = conn.execute(
        'SELECT id, completed_at FROM task_completions WHERE task_id = ? ORDER BY completed_at DESC',
        (task_id,)
    ).fetchall()
    return [{'id': row['id'], 'completed_at': row['completed_at']} for row in rows]


def _recalc_last_completed(task_id, conn):
    """Recalculate last_completed from task_completions table."""
    row = conn.execute(
        'SELECT completed_at FROM task_completions WHERE task_id = ? ORDER BY completed_at DESC LIMIT 1',
        (task_id,)
    ).fetchone()
    new_last = row['completed_at'] if row else None
    conn.execute('UPDATE recurring_tasks SET last_completed = ? WHERE id = ?', (new_last, task_id))


def delete_completion(completion_id):
    conn = get_db()
    row = conn.execute('SELECT task_id FROM task_completions WHERE id = ?', (completion_id,)).fetchone()
    if not row:
        conn.close()
        return None
    task_id = row['task_id']
    conn.execute('DELETE FROM task_completions WHERE id = ?', (completion_id,))
    _recalc_last_completed(task_id, conn)
    conn.commit()
    conn.close()
    return task_id


def edit_completion(completion_id, new_date):
    conn = get_db()
    row = conn.execute('SELECT task_id FROM task_completions WHERE id = ?', (completion_id,)).fetchone()
    if not row:
        conn.close()
        return None
    task_id = row['task_id']
    conn.execute('UPDATE task_completions SET completed_at = ? WHERE id = ?', (new_date, completion_id))
    _recalc_last_completed(task_id, conn)
    conn.commit()
    conn.close()
    return task_id


def delete_task(task_id):
    conn = get_db()
    conn.execute('DELETE FROM recurring_tasks WHERE id = ?', (task_id,))
    conn.commit()
    conn.close()


def edit_task(task_id, name=None, frequency_days=None, schedule_type=None,
              fixed_unit=None, fixed_value=None, notes=None, snoozed_until=None,
              sensor_enabled=None):
    conn = get_db()
    if name is not None:
        conn.execute('UPDATE recurring_tasks SET name = ? WHERE id = ?', (name, task_id))
    if frequency_days is not None:
        conn.execute('UPDATE recurring_tasks SET frequency_days = ? WHERE id = ?', (frequency_days, task_id))
    if schedule_type is not None:
        conn.execute('UPDATE recurring_tasks SET schedule_type = ? WHERE id = ?', (schedule_type, task_id))
    if fixed_unit is not None:
        conn.execute('UPDATE recurring_tasks SET fixed_unit = ? WHERE id = ?', (fixed_unit, task_id))
    if fixed_value is not None:
        conn.execute('UPDATE recurring_tasks SET fixed_value = ? WHERE id = ?', (fixed_value, task_id))
    if notes is not None:
        conn.execute('UPDATE recurring_tasks SET notes = ? WHERE id = ?', (notes, task_id))
    if snoozed_until is not None:
        # Pass empty string to clear snooze
        val = snoozed_until if snoozed_until else None
        conn.execute('UPDATE recurring_tasks SET snoozed_until = ? WHERE id = ?', (val, task_id))
    if sensor_enabled is not None:
        conn.execute('UPDATE recurring_tasks SET sensor_enabled = ? WHERE id = ?',
                     (1 if sensor_enabled else 0, task_id))
    conn.commit()
    conn.close()


def _next_fixed_due(task):
    """Calculate next due date for a fixed-schedule task."""
    now = datetime.now()
    unit = task['fixed_unit']
    val = task['fixed_value']
    last = datetime.fromisoformat(task['last_completed']) if task['last_completed'] else None

    if unit == 'weekly':
        # val = day of week (0=Mon..6=Sun)
        today_dow = now.weekday()
        days_ahead = (val - today_dow) % 7
        candidate = now.date() + timedelta(days=days_ahead if days_ahead > 0 else 7)
        # If completed this week on/after the target day, push to next week
        if last and days_ahead == 0:
            candidate = now.date() + timedelta(days=7)
        if last:
            last_date = last.date()
            # Same week check: if last completed is within this cycle
            last_days_since = (last_date.weekday() - val) % 7
            if last_days_since == 0 and last_date == now.date():
                # Completed today on the target day -- next week
                candidate = now.date() + timedelta(days=7)
            elif days_ahead == 0 and last_date >= (now.date() - timedelta(days=6)):
                # Today is the target day and was completed recently this cycle
                if last_date >= now.date() - timedelta(days=(now.weekday() - val) % 7):
                    candidate = now.date() + timedelta(days=7)
        return datetime(candidate.year, candidate.month, candidate.day)

    elif unit == 'monthly':
        # val = day of month (1-31)
        year, month = now.year, now.month
        max_day = calendar.monthrange(year, month)[1]
        day = min(val, max_day)
        candidate = now.date().replace(day=day)
        # If today is past the target day, or completed this month on/after target
        if now.date() > candidate:
            month += 1
            if month > 12:
                month, year = 1, year + 1
            max_day = calendar.monthrange(year, month)[1]
            candidate = candidate.replace(year=year, month=month, day=min(val, max_day))
        elif now.date() == candidate and last and last.date() >= candidate:
            month += 1
            if month > 12:
                month, year = 1, year + 1
            max_day = calendar.monthrange(year, month)[1]
            candidate = candidate.replace(year=year, month=month, day=min(val, max_day))
        return datetime(candidate.year, candidate.month, candidate.day)

    elif unit == 'yearly':
        # val = MMDD int (e.g. 315 = March 15, 1225 = December 25)
        target_month = val // 100
        target_day = val % 100
        year = now.year
        try:
            candidate = now.date().replace(month=target_month, day=target_day)
        except ValueError:
            max_day = calendar.monthrange(year, target_month)[1]
            candidate = now.date().replace(month=target_month, day=min(target_day, max_day))
        if now.date() > candidate:
            year += 1
            try:
                candidate = candidate.replace(year=year)
            except ValueError:
                max_day = calendar.monthrange(year, target_month)[1]
                candidate = candidate.replace(year=year, day=min(target_day, max_day))
        elif now.date() == candidate and last and last.date() >= candidate:
            year += 1
            try:
                candidate = candidate.replace(year=year)
            except ValueError:
                max_day = calendar.monthrange(year, target_month)[1]
                candidate = candidate.replace(year=year, day=min(target_day, max_day))
        return datetime(candidate.year, candidate.month, candidate.day)

    return now


def get_all_tasks():
    conn = get_db()
    conn.execute("PRAGMA foreign_keys = ON")
    rows = conn.execute('SELECT * FROM recurring_tasks').fetchall()

    now = datetime.now()
    tasks = []

    for row in rows:
        task = dict(row)
        task['sensor_enabled'] = bool(task.get('sensor_enabled'))
        stype = task.get('schedule_type') or 'interval'
        task['completions'] = get_completions(task['id'], conn)

        # Check snooze state
        is_snoozed = False
        if task.get('snoozed_until'):
            snooze_end = datetime.fromisoformat(task['snoozed_until'])
            if now < snooze_end:
                is_snoozed = True
            else:
                # Snooze expired, clear it
                conn.execute('UPDATE recurring_tasks SET snoozed_until = NULL WHERE id = ?', (task['id'],))
                task['snoozed_until'] = None

        task['is_snoozed'] = is_snoozed

        if stype == 'dynamic':
            predicted, season = _calc_dynamic_interval(task['completions'])
            task['dynamic'] = {
                'predicted_days': predicted,
                'season': season,
            }

            if predicted is None:
                # Tracking mode: not enough data
                task['next_due'] = None
                task['days_until'] = None
                task['is_overdue'] = False
            else:
                if task['last_completed']:
                    last = datetime.fromisoformat(task['last_completed'])
                    next_due = last + timedelta(days=predicted)
                else:
                    next_due = now
                task['next_due'] = next_due.isoformat()
                delta = next_due - now
                task['days_until'] = delta.days
                task['is_overdue'] = delta.days < 0

        elif stype == 'fixed' and task.get('fixed_unit') and task.get('fixed_value') is not None:
            next_due = _next_fixed_due(task)
            delta = next_due - now
            task['next_due'] = next_due.isoformat()
            task['days_until'] = delta.days
            task['is_overdue'] = delta.days < 0
        else:
            # Interval logic
            freq = timedelta(days=task['frequency_days'])
            if task['last_completed']:
                last = datetime.fromisoformat(task['last_completed'])
                next_due = last + freq
            else:
                next_due = datetime.fromisoformat(task['created_at'])
            delta = next_due - now
            task['next_due'] = next_due.isoformat()
            task['days_until'] = delta.days
            task['is_overdue'] = delta.days < 0

        tasks.append(task)

    conn.commit()
    conn.close()

    # Sort: snoozed tasks by snooze-until, tracking (days_until=None) at end, rest by next_due
    def sort_key(t):
        if t['is_snoozed']:
            return (1, t.get('snoozed_until', ''))
        if t['days_until'] is None:
            return (2, t.get('name', ''))
        return (0, t.get('next_due', ''))

    tasks.sort(key=sort_key)
    return tasks
