import os
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify
from models import (init_db, add_task, complete_task, delete_task, edit_task,
                     get_all_tasks, delete_completion, edit_completion,
                     find_task_by_qr)

app = Flask(__name__)
init_db()


def _valid_iso(value):
    """Return True if value is a parseable ISO timestamp string."""
    try:
        datetime.fromisoformat(value)
        return True
    except (TypeError, ValueError):
        return False


@app.after_request
def allow_iframe(response):
    response.headers.pop('X-Frame-Options', None)
    return response


@app.route('/')
def index():
    ingress_path = request.headers.get('X-Ingress-Path', '')
    return render_template('index.html', ingress_path=ingress_path)


@app.route('/api/tasks', methods=['GET'])
def list_tasks():
    return jsonify(get_all_tasks())


@app.route('/api/tasks', methods=['POST'])
def create_task():
    data = request.get_json()
    name = data.get('name', '').strip()
    schedule_type = data.get('schedule_type', 'interval')

    if not name:
        return jsonify({'error': 'Name is required'}), 400

    notes = data.get('notes', '').strip() or None

    if schedule_type == 'dynamic':
        task_id = add_task(name, frequency_days=0, schedule_type='dynamic', notes=notes)
        complete_task(task_id)
    elif schedule_type == 'fixed':
        fixed_unit = data.get('fixed_unit')
        fixed_value = data.get('fixed_value')
        if not fixed_unit or fixed_value is None:
            return jsonify({'error': 'Fixed schedule requires unit and value'}), 400
        task_id = add_task(name, frequency_days=0, schedule_type='fixed',
                          fixed_unit=fixed_unit, fixed_value=int(fixed_value), notes=notes)
    else:
        frequency_days = data.get('frequency_days')
        if not frequency_days:
            return jsonify({'error': 'Frequency is required for interval tasks'}), 400
        task_id = add_task(name, frequency_days=int(frequency_days), notes=notes)

    return jsonify({'ok': True, 'id': task_id}), 201


@app.route('/api/tasks/<int:task_id>/complete', methods=['POST'])
def mark_complete(task_id):
    data = request.get_json(silent=True) or {}
    completed_at = data.get('completed_at')
    if completed_at is not None and not _valid_iso(completed_at):
        return jsonify({'error': 'completed_at must be an ISO timestamp'}), 400
    recorded = complete_task(task_id, completed_at=completed_at)
    return jsonify({'ok': True, 'deduped': not recorded})


@app.route('/api/tasks/<int:task_id>/snooze', methods=['POST'])
def snooze_task(task_id):
    data = request.get_json(silent=True) or {}
    days = data.get('days')
    try:
        days = int(days)
    except (TypeError, ValueError):
        return jsonify({'error': 'days (int) required'}), 400
    if days <= 0:
        return jsonify({'error': 'days must be positive'}), 400
    until = (datetime.now() + timedelta(days=days)).isoformat()
    edit_task(task_id, snoozed_until=until)
    return jsonify({'ok': True, 'snoozed_until': until})


@app.route('/api/tasks/<int:task_id>/unsnooze', methods=['POST'])
def unsnooze_task(task_id):
    edit_task(task_id, snoozed_until='')
    return jsonify({'ok': True})


@app.route('/api/completions/<int:completion_id>', methods=['DELETE'])
def remove_completion(completion_id):
    task_id = delete_completion(completion_id)
    if task_id is None:
        return jsonify({'error': 'Completion not found'}), 404
    return jsonify({'ok': True, 'task_id': task_id})


@app.route('/api/completions/<int:completion_id>', methods=['PUT'])
def update_completion(completion_id):
    data = request.get_json()
    new_date = data.get('completed_at')
    if not new_date:
        return jsonify({'error': 'completed_at is required'}), 400
    if not _valid_iso(new_date):
        return jsonify({'error': 'completed_at must be an ISO timestamp'}), 400
    task_id = edit_completion(completion_id, new_date)
    if task_id is None:
        return jsonify({'error': 'Completion not found'}), 404
    return jsonify({'ok': True, 'task_id': task_id})


@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def remove_task(task_id):
    delete_task(task_id)
    return jsonify({'ok': True})


@app.route('/api/tasks/export', methods=['GET'])
def export_tasks():
    tasks = get_all_tasks()
    export = []
    for t in tasks:
        export.append({
            'name': t['name'],
            'frequency_days': t['frequency_days'],
            'schedule_type': t.get('schedule_type', 'interval'),
            'fixed_unit': t.get('fixed_unit'),
            'fixed_value': t.get('fixed_value'),
            'notes': t.get('notes'),
            'last_completed': t.get('last_completed'),
            'snoozed_until': t.get('snoozed_until'),
            'sensor_enabled': t.get('sensor_enabled', False),
            'qr_enabled': t.get('qr_enabled', False),
            'completions': [c['completed_at'] for c in t.get('completions', [])],
        })
    return jsonify(export)


@app.route('/api/tasks/import', methods=['POST'])
def import_tasks():
    data = request.get_json()
    if not isinstance(data, list):
        return jsonify({'error': 'Expected a JSON array of tasks'}), 400

    # Validate everything before touching the database, so a bad backup
    # is rejected whole instead of half-imported.
    entries = []
    for t in data:
        if not isinstance(t, dict):
            return jsonify({'error': 'Each task must be a JSON object'}), 400
        name = (t.get('name') or '').strip()
        if not name:
            continue
        completions = t.get('completions')
        if completions is None:
            completions = [t['last_completed']] if t.get('last_completed') else []
        if not isinstance(completions, list):
            return jsonify({'error': f'completions must be a list for task "{name}"'}), 400
        for ts in completions:
            if not _valid_iso(ts):
                return jsonify({'error': f'Invalid completion timestamp for task "{name}"'}), 400
        snoozed_until = t.get('snoozed_until')
        if snoozed_until and not _valid_iso(snoozed_until):
            return jsonify({'error': f'Invalid snoozed_until for task "{name}"'}), 400
        entries.append((t, name, completions))

    count = 0
    for t, name, completions in entries:
        freq = t.get('frequency_days')
        task_id = add_task(
            name=name,
            frequency_days=freq if isinstance(freq, int) else 7,
            schedule_type=t.get('schedule_type', 'interval'),
            fixed_unit=t.get('fixed_unit'),
            fixed_value=t.get('fixed_value'),
            notes=t.get('notes'),
            sensor_enabled=t.get('sensor_enabled', False),
        )
        for ts in sorted(completions, key=datetime.fromisoformat):
            complete_task(task_id, completed_at=ts)
        if 'snoozed_until' in t:
            # Restore the exported snooze state, clearing any default snooze
            # add_task applies to dynamic tasks.
            edit_task(task_id, snoozed_until=t['snoozed_until'] or '')
        if t.get('qr_enabled'):
            edit_task(task_id, qr_enabled=True)
        count += 1
    return jsonify({'ok': True, 'imported': count}), 201


@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    data = request.get_json()
    freq = data.get('frequency_days')
    notes = data.get('notes')
    sensor_enabled = data.get('sensor_enabled')
    qr_enabled = data.get('qr_enabled')
    edit_task(
        task_id,
        name=data.get('name'),
        frequency_days=int(freq) if freq is not None else None,
        schedule_type=data.get('schedule_type'),
        fixed_unit=data.get('fixed_unit'),
        fixed_value=int(data['fixed_value']) if data.get('fixed_value') is not None else None,
        notes=notes,
        sensor_enabled=sensor_enabled,
        qr_enabled=qr_enabled
    )
    return jsonify({'ok': True})


@app.route('/q/<int:task_id>/<token>')
def qr_complete(task_id, token):
    task = find_task_by_qr(task_id, token)
    if not task or not task.get('qr_enabled'):
        return render_template('qr_result.html', ok=False, task_name=None,
                               message='This QR code is not active for this task.'), 404
    recorded = complete_task(task_id)
    if recorded:
        return render_template('qr_result.html', ok=True, task_name=task['name'],
                               message='Marked complete.', deduped=False)
    return render_template('qr_result.html', ok=True, task_name=task['name'],
                           message='Already marked complete today.', deduped=True)


if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5050, debug=os.environ.get('DEBUG', 'False') == 'True')
