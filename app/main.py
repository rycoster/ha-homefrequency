from flask import Flask, render_template, request, jsonify
from models import init_db, add_task, complete_task, delete_task, edit_task, get_all_tasks
from claude_client import send_message

app = Flask(__name__)


@app.after_request
def allow_iframe(response):
    response.headers.pop('X-Frame-Options', None)
    return response


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.get_json()
    messages = data.get('messages', [])
    try:
        reply = send_message(messages)
        return jsonify({'reply': reply})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/tasks', methods=['GET'])
def list_tasks():
    return jsonify(get_all_tasks())


@app.route('/api/tasks', methods=['POST'])
def create_task():
    data = request.get_json()
    name = data.get('name', '').strip()
    frequency_days = data.get('frequency_days')
    if not name or not frequency_days:
        return jsonify({'error': 'Name and frequency are required'}), 400
    add_task(name, int(frequency_days))
    return jsonify({'ok': True}), 201


@app.route('/api/tasks/<int:task_id>/complete', methods=['POST'])
def mark_complete(task_id):
    complete_task(task_id)
    return jsonify({'ok': True})


@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def remove_task(task_id):
    delete_task(task_id)
    return jsonify({'ok': True})


@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    data = request.get_json()
    edit_task(
        task_id,
        name=data.get('name'),
        frequency_days=data.get('frequency_days')
    )
    return jsonify({'ok': True})


if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)
