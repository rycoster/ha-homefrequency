import os
from flask import Flask, render_template, request, jsonify
from models import (init_db, add_task, complete_task, delete_task, edit_task,
                     get_all_tasks, delete_completion, edit_completion)

app = Flask(__name__)


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
    complete_task(task_id, completed_at=data.get('completed_at'))
    return jsonify({'ok': True})


@app.route('/api/tasks/<int:task_id>/snooze', methods=['POST'])
def snooze_task(task_id):
    from models import _next_season_start
    edit_task(task_id, snoozed_until=_next_season_start())
    return jsonify({'ok': True})


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
        })
    return jsonify(export)


@app.route('/api/tasks/import', methods=['POST'])
def import_tasks():
    data = request.get_json()
    if not isinstance(data, list):
        return jsonify({'error': 'Expected a JSON array of tasks'}), 400
    count = 0
    for t in data:
        name = t.get('name', '').strip()
        if not name:
            continue
        task_id = add_task(
            name=name,
            frequency_days=t.get('frequency_days', 7),
            schedule_type=t.get('schedule_type', 'interval'),
            fixed_unit=t.get('fixed_unit'),
            fixed_value=t.get('fixed_value'),
            notes=t.get('notes'),
        )
        if t.get('last_completed'):
            complete_task(task_id, completed_at=t['last_completed'])
        count += 1
    return jsonify({'ok': True, 'imported': count}), 201


@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    data = request.get_json()
    freq = data.get('frequency_days')
    notes = data.get('notes')
    edit_task(
        task_id,
        name=data.get('name'),
        frequency_days=int(freq) if freq is not None else None,
        schedule_type=data.get('schedule_type'),
        fixed_unit=data.get('fixed_unit'),
        fixed_value=int(data['fixed_value']) if data.get('fixed_value') is not None else None,
        notes=notes
    )
    return jsonify({'ok': True})


if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5050, debug=os.environ.get('DEBUG', 'False') == 'True')
