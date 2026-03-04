# HomeAssistant

Home Assistant projects workspace. Contains **HomeFrequency** (recurring task tracker) and HA config reference docs.

## Stack
- **Backend**: Flask (Python)
- **Frontend**: Vanilla HTML/CSS/JS
- **Database**: SQLite

## Project Structure
```
~/Projects/HomeAssistant/
├── app/                        # Flask source (dev)
│   ├── main.py                 # Entry point, all routes
│   ├── models.py               # SQLite schema + task CRUD
│   ├── templates/index.html    # Single-page UI
│   └── static/                 # JS, CSS, logos
├── custom_components/
│   └── homefrequency/          # HA custom integration (sensors)
├── homefrequency/              # HA add-on package
│   ├── config.yaml             # Add-on metadata + version
│   ├── Dockerfile
│   ├── run.sh
│   ├── CHANGELOG.md
│   ├── app/                    # (synced by deploy script)
│   └── integration/            # (synced by deploy script)
├── scripts/
│   └── deploy-to-ha.sh         # Syncs source into addon, commits, pushes
├── repository.yaml             # HA add-on repo metadata
├── requirements.txt
├── ha-automations.md           # HA automations reference doc
└── data/                       # SQLite DB (gitignored)
```

## Running (local dev)
```bash
cd ~/Projects/HomeAssistant
pip install -r requirements.txt
python app/main.py     # serves on http://0.0.0.0:5050
```

## Deploying to HA
```bash
# 1. Bump version in homefrequency/config.yaml
# 2. Bump cache-busting versions if CSS/JS changed
# 3. Update homefrequency/CHANGELOG.md
# 4. Run deploy script
bash scripts/deploy-to-ha.sh
# 5. Check for update in HA Add-on Store and rebuild
```

## Custom Integration (Sensors)
`custom_components/homefrequency/` exposes each task as a sensor entity in HA.
- State = `days_until` (integer, negative when overdue)
- All sensors grouped under a single "Home Frequency" device
- Polls `/api/tasks` every 5 minutes; new tasks auto-discovered, deleted tasks become unavailable
- Deployed automatically by the add-on's `run.sh` on startup

## API Routes
- `GET /` — UI
- `GET /api/tasks` — list all tasks (sorted by next due)
- `POST /api/tasks` — `{name, frequency_days}` → create task
- `POST /api/tasks/<id>/complete` — mark task done
- `PUT /api/tasks/<id>` — `{name?, frequency_days?}` → edit task
- `DELETE /api/tasks/<id>` — delete task

## Rules for This Project
- Keep the UI clean and minimal
- Use SQLite for persistence, no external DB
