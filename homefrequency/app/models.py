import sqlite3
import os
import secrets
from datetime import datetime, timedelta, date
import calendar


def _new_qr_token():
    return secrets.token_urlsafe(12)

DB_DIR = os.environ.get('DB_DIR', os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data'))
DB_PATH = os.path.join(DB_DIR, 'tasks.db')


def normalize_fixed(unit, value, selection):
    """Normalize a fixed schedule to (unit, value, fixed_set).

    weekly:  fixed_set = selected weekdays (0=Mon..6=Sun); value = first one.
    monthly: fixed_set = selected months (1-12); value = day of month (1-31).
    A legacy yearly schedule (value = MMDD) becomes monthly with one month.
    A missing selection falls back to the old single-choice meaning: the one
    weekday in value, or every month. Raises ValueError on bad input.
    """
    if unit == 'yearly':
        value = int(value)
        unit, selection, value = 'monthly', [value // 100], value % 100
    if unit == 'weekly':
        if selection is None:
            selection = [int(value)]
        days = sorted({int(d) for d in selection})
        if not days or not all(0 <= d <= 6 for d in days):
            raise ValueError('Weekly schedule needs weekdays 0-6')
        return 'weekly', days[0], ','.join(map(str, days))
    if unit == 'monthly':
        value = int(value)
        if not 1 <= value <= 31:
            raise ValueError('Day of month must be 1-31')
        if selection is None:
            selection = range(1, 13)
        months = sorted({int(m) for m in selection})
        if not months or not all(1 <= m <= 12 for m in months):
            raise ValueError('Monthly schedule needs months 1-12')
        return 'monthly', value, ','.join(map(str, months))
    raise ValueError(f'Unknown fixed unit: {unit}')


def parse_fixed_set(value):
    """Turn a stored fixed_set string ("1,4,10") into a list of ints."""
    if not value:
        return []
    if isinstance(value, list):
        return value
    return [int(x) for x in value.split(',') if x.strip()]


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
    if 'qr_token' not in cols:
        conn.execute("ALTER TABLE recurring_tasks ADD COLUMN qr_token TEXT")
    if 'qr_enabled' not in cols:
        conn.execute("ALTER TABLE recurring_tasks ADD COLUMN qr_enabled INTEGER DEFAULT 0")
    if 'fixed_set' not in cols:
        conn.execute("ALTER TABLE recurring_tasks ADD COLUMN fixed_set TEXT")
    if 'archived_at' not in cols:
        conn.execute("ALTER TABLE recurring_tasks ADD COLUMN archived_at TIMESTAMP")
    # Backfill fixed_set for fixed tasks created before multi-select existing
    # (single weekday, every month, or a yearly MMDD date)
    legacy = conn.execute(
        "SELECT id, fixed_unit, fixed_value FROM recurring_tasks "
        "WHERE schedule_type = 'fixed' AND (fixed_set IS NULL OR fixed_unit = 'yearly')"
    ).fetchall()
    for row in legacy:
        try:
            unit, value, fixed_set = normalize_fixed(row[1], row[2], None)
        except (TypeError, ValueError):
            continue  # malformed legacy row; leave it as-is
        conn.execute('UPDATE recurring_tasks SET fixed_unit = ?, fixed_value = ?, fixed_set = ? WHERE id = ?',
                     (unit, value, fixed_set, row[0]))
    # Backfill qr_token for any rows missing one (existing or newly-migrated)
    missing = conn.execute(
        "SELECT id FROM recurring_tasks WHERE qr_token IS NULL OR qr_token = ''"
    ).fetchall()
    for row in missing:
        conn.execute('UPDATE recurring_tasks SET qr_token = ? WHERE id = ?',
                     (_new_qr_token(), row[0]))
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


def _parse_ts(value):
    """Parse an ISO timestamp, returning None for missing or malformed values.

    Timestamps written before API validation existed may be malformed; a bad
    row must not take down the whole task list.
    """
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except (TypeError, ValueError):
        return None


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
        later = _parse_ts(c_later['completed_at'] if isinstance(c_later, dict) else c_later)
        earlier = _parse_ts(c_earlier['completed_at'] if isinstance(c_earlier, dict) else c_earlier)
        if later is None or earlier is None:
            continue
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
             fixed_unit=None, fixed_value=None, notes=None, sensor_enabled=False,
             fixed_set=None):
    conn = get_db()
    # Dynamic tasks start with no implicit first completion; neither do fixed
    # tasks, whose first scheduled date on/after today should be due (an
    # implicit completion would be credited to it and skip it)
    last_completed = None if schedule_type in ('dynamic', 'fixed') else datetime.now().isoformat()
    # Dynamic tasks get a default 7-day snooze so they place inline in the list
    # instead of piling up at the bottom while tracking
    snoozed_until = (datetime.now() + timedelta(days=7)).isoformat() if schedule_type == 'dynamic' else None
    cur = conn.execute(
        '''INSERT INTO recurring_tasks
           (name, frequency_days, schedule_type, fixed_unit, fixed_value, fixed_set, notes, last_completed, sensor_enabled, snoozed_until, qr_token)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (name, frequency_days, schedule_type, fixed_unit, fixed_value, fixed_set, notes,
         last_completed, 1 if sensor_enabled else 0, snoozed_until, _new_qr_token())
    )
    task_id = cur.lastrowid
    conn.commit()
    conn.close()
    return task_id


def complete_task(task_id, completed_at=None):
    """Record a completion. Idempotent per calendar day: if a completion for
    this task already exists on the same day, this is a no-op.

    Returns True if a new completion was recorded, False if deduped.
    """
    conn = get_db()
    ts = completed_at if completed_at else datetime.now().isoformat()
    parsed = _parse_ts(ts)
    ts_date = parsed.date().isoformat() if parsed else None
    if ts_date:
        existing = conn.execute(
            "SELECT id FROM task_completions WHERE task_id = ? AND date(completed_at) = ? LIMIT 1",
            (task_id, ts_date)
        ).fetchone()
        if existing:
            conn.close()
            return False
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
    return True


def find_task_by_qr(task_id, token):
    """Return task row as dict if id+token match and token is non-empty, else None."""
    if not token:
        return None
    conn = get_db()
    row = conn.execute(
        'SELECT * FROM recurring_tasks WHERE id = ? AND qr_token = ? AND archived_at IS NULL',
        (task_id, token)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def get_completions_by_task(conn):
    """Fetch all completions in one query, grouped by task, newest first."""
    rows = conn.execute(
        'SELECT id, task_id, completed_at FROM task_completions ORDER BY completed_at DESC'
    ).fetchall()
    by_task = {}
    for row in rows:
        by_task.setdefault(row['task_id'], []).append(
            {'id': row['id'], 'completed_at': row['completed_at']})
    return by_task


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


def set_archived(task_id, archived, archived_at=None):
    """Archive (hide, keeping history) or restore a task."""
    value = (archived_at or datetime.now().isoformat()) if archived else None
    conn = get_db()
    conn.execute('UPDATE recurring_tasks SET archived_at = ? WHERE id = ?', (value, task_id))
    conn.commit()
    conn.close()


def delete_task(task_id):
    conn = get_db()
    conn.execute('DELETE FROM recurring_tasks WHERE id = ?', (task_id,))
    conn.commit()
    conn.close()


def edit_task(task_id, name=None, frequency_days=None, schedule_type=None,
              fixed_unit=None, fixed_value=None, notes=None, snoozed_until=None,
              sensor_enabled=None, qr_enabled=None, fixed_set=None):
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
    if fixed_set is not None:
        conn.execute('UPDATE recurring_tasks SET fixed_set = ? WHERE id = ?', (fixed_set, task_id))
    if notes is not None:
        conn.execute('UPDATE recurring_tasks SET notes = ? WHERE id = ?', (notes, task_id))
    if snoozed_until is not None:
        # Pass empty string to clear snooze
        val = snoozed_until if snoozed_until else None
        conn.execute('UPDATE recurring_tasks SET snoozed_until = ? WHERE id = ?', (val, task_id))
    if sensor_enabled is not None:
        conn.execute('UPDATE recurring_tasks SET sensor_enabled = ? WHERE id = ?',
                     (1 if sensor_enabled else 0, task_id))
    if qr_enabled is not None:
        conn.execute('UPDATE recurring_tasks SET qr_enabled = ? WHERE id = ?',
                     (1 if qr_enabled else 0, task_id))
    conn.commit()
    conn.close()


def _add_interval(start, frequency_days):
    """Advance start by an interval task's frequency.

    Frequencies that are whole years (multiples of 365) or whole months
    (multiples of 30) -- how the UI stores "N years"/"N months" -- advance by
    calendar months, keeping the day of the month (clamped to the month's
    length). Anything else advances by plain days.
    """
    if frequency_days >= 365 and frequency_days % 365 == 0:
        months = frequency_days // 365 * 12
    elif frequency_days >= 30 and frequency_days % 30 == 0:
        months = frequency_days // 30
    else:
        return start + timedelta(days=frequency_days)
    total = start.year * 12 + (start.month - 1) + months
    y, m = divmod(total, 12)
    m += 1
    return start.replace(year=y, month=m,
                         day=min(start.day, calendar.monthrange(y, m)[1]))


def _next_fixed_due(task):
    """Calculate the due date for a fixed-schedule task.

    The due date is anchored to the schedule, not to today: a missed
    occurrence stays due (overdue) until the task is completed. A completion
    counts for the occurrence nearest to it -- completing a few days late
    settles the missed date, completing a few days early settles the upcoming
    one -- and the due date then advances to the following occurrence.
    """
    now = datetime.now()
    unit = task['fixed_unit']
    val = task['fixed_value']
    selected = set(parse_fixed_set(task.get('fixed_set')))
    if not selected:
        return now
    last = _parse_ts(task['last_completed'])

    def _to_dt(d):
        return datetime(d.year, d.month, d.day)

    if unit == 'weekly':
        # selected = weekdays (0=Mon..6=Sun)
        def occ_on_or_after(d):
            for i in range(7):
                c = d + timedelta(days=i)
                if c.weekday() in selected:
                    return c

        def occ_before(d):
            for i in range(1, 8):
                c = d - timedelta(days=i)
                if c.weekday() in selected:
                    return c

    elif unit == 'monthly':
        # selected = months (1-12); val = day of month, clamped to month length
        def occ(y, m):
            return date(y, m, min(val, calendar.monthrange(y, m)[1]))

        def occ_on_or_after(d):
            y, m = d.year, d.month
            for _ in range(13):
                if m in selected and occ(y, m) >= d:
                    return occ(y, m)
                y, m = (y + 1, 1) if m == 12 else (y, m + 1)

        def occ_before(d):
            y, m = d.year, d.month
            for _ in range(13):
                if m in selected and occ(y, m) < d:
                    return occ(y, m)
                y, m = (y - 1, 12) if m == 1 else (y, m - 1)

    else:
        return now

    if not last:
        return _to_dt(occ_on_or_after(now.date()))
    # Credit the completion to whichever occurrence it's nearest (ties go to
    # the earlier one), then the task is due at the occurrence after that.
    ld = last.date()
    t_prev, t_next = occ_before(ld), occ_on_or_after(ld)
    covered = t_prev if (ld - t_prev) <= (t_next - ld) else t_next
    return _to_dt(occ_on_or_after(covered + timedelta(days=1)))


def get_all_tasks(archived=False):
    """Active tasks by default; archived=True for archived only, None for all."""
    conn = get_db()
    conn.execute("PRAGMA foreign_keys = ON")
    where = {False: ' WHERE archived_at IS NULL',
             True: ' WHERE archived_at IS NOT NULL', None: ''}[archived]
    rows = conn.execute('SELECT * FROM recurring_tasks' + where).fetchall()
    completions_by_task = get_completions_by_task(conn)

    now = datetime.now()
    tasks = []

    for row in rows:
        task = dict(row)
        task['sensor_enabled'] = bool(task.get('sensor_enabled'))
        task['qr_enabled'] = bool(task.get('qr_enabled'))
        task['fixed_set'] = parse_fixed_set(task.get('fixed_set'))
        stype = task.get('schedule_type') or 'interval'
        task['completions'] = completions_by_task.get(task['id'], [])

        # Check snooze state
        is_snoozed = False
        if task.get('snoozed_until'):
            snooze_end = _parse_ts(task['snoozed_until'])
            if snooze_end and now < snooze_end:
                is_snoozed = True
            else:
                # Snooze expired (or timestamp malformed), clear it
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
                last = _parse_ts(task['last_completed'])
                if last:
                    next_due = last + timedelta(days=predicted)
                else:
                    next_due = now
                task['next_due'] = next_due.isoformat()
                delta = next_due - now
                task['days_until'] = delta.days
                task['is_overdue'] = delta.days < 0

        elif stype == 'fixed' and task.get('fixed_unit') and task.get('fixed_value') is not None:
            next_due = _next_fixed_due(task)
            # Fixed dates are whole days (due at midnight), so count calendar
            # days -- a timedelta would read "overdue by 1 day" all due-day long
            days = (next_due.date() - now.date()).days
            task['next_due'] = next_due.isoformat()
            task['days_until'] = days
            task['is_overdue'] = days < 0
        else:
            # Interval logic
            last = _parse_ts(task['last_completed'])
            if last:
                next_due = _add_interval(last, task['frequency_days'])
            else:
                next_due = _parse_ts(task['created_at']) or now
            delta = next_due - now
            task['next_due'] = next_due.isoformat()
            task['days_until'] = delta.days
            task['is_overdue'] = delta.days < 0

        tasks.append(task)

    conn.commit()
    conn.close()

    # Sort: snoozed tasks sort inline by snoozed_until (treated as a due date),
    # non-snoozed tracking tasks (no prediction yet) go to the end.
    def sort_key(t):
        if t['is_snoozed']:
            return (0, t.get('snoozed_until', ''))
        if t['days_until'] is None:
            return (2, t.get('name', ''))
        return (0, t.get('next_due', ''))

    tasks.sort(key=sort_key)
    return tasks
