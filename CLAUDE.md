# PersonalAssistant

Web-based personal assistant with chat (Claude API) and recurring task tracker. Designed for iframe embedding in Home Assistant dashboards.

## Stack
- **Backend**: Flask (Python)
- **Frontend**: Vanilla HTML/CSS/JS
- **Database**: SQLite
- **AI**: Anthropic SDK (claude-sonnet-4-0)

## Key Files
| Path | Description |
|------|-------------|
| `app/main.py` | Flask entry point, all routes |
| `app/claude_client.py` | Anthropic SDK wrapper |
| `app/models.py` | SQLite schema + task CRUD |
| `app/templates/index.html` | Single-page tabbed UI |
| `app/static/style.css` | Dark theme, responsive |
| `app/static/app.js` | Tab switching, chat, task interactions |
| `data/tasks.db` | SQLite database (auto-created, gitignored) |

## Running
```bash
cd ~/Projects/PersonalAssistant
pip install -r requirements.txt
cp .env.example .env   # then add your ANTHROPIC_API_KEY
python app/main.py     # serves on http://0.0.0.0:5000
```

## HA Integration
Add a `webpage` card in Home Assistant pointing to `http://<mac-ip>:5000`

## API Routes
- `GET /` — UI
- `POST /api/chat` — `{messages: [{role, content}]}` → `{reply}`
- `GET /api/tasks` — list all tasks (sorted by next due)
- `POST /api/tasks` — `{name, frequency_days}` → create task
- `POST /api/tasks/<id>/complete` — mark task done
- `PUT /api/tasks/<id>` — `{name?, frequency_days?}` → edit task
- `DELETE /api/tasks/<id>` — delete task

## Rules for This Project
- Keep the UI clean and minimal
- All Claude API calls go through `app/claude_client.py`
- Store API key in `.env` — never commit it
- Use SQLite for persistence, no external DB
