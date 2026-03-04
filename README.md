# HomeFrequency

A recurring task tracker for Home Assistant. Track household chores, maintenance schedules, and routines with a clean dark-themed UI that embeds directly in your HA dashboard.

![Home Assistant Add-on](https://img.shields.io/badge/Home%20Assistant-Add--on-blue)
![Python](https://img.shields.io/badge/Python-3.11-green)
![License](https://img.shields.io/badge/License-Private-lightgrey)

## Features

- **Interval scheduling** -- "every N days" tasks (change filters, mow the lawn)
- **Fixed scheduling** -- tasks pinned to a specific day of the week, day of the month, or month of the year
- **Visual urgency** -- color-coded progress bars show how overdue each task is
- **Notes** -- attach context to any task (product links, instructions, etc.)
- **Import/Export** -- backup and restore your task list as JSON
- **HA Sensors** -- each task becomes a sensor entity (state = days until due) for use in automations and dashboards
- **Ingress support** -- runs inside the HA sidebar, no extra ports needed
- **SQLite storage** -- data persists in `/config/homefrequency/` and survives add-on reinstalls

## Installation

### Prerequisites

- Home Assistant OS (or Supervised)
- Access to the Add-on Store

### Step 1: Add the Repository

1. In Home Assistant, go to **Settings > Add-ons > Add-on Store**
2. Click the **three dots** (top right) > **Repositories**
3. Paste the repository URL:
   ```
   https://github.com/rycoster/ha-homefrequency
   ```
4. Click **Add**, then close the dialog

### Step 2: Install the Add-on

1. The **HomeFrequency** add-on should now appear in the store (you may need to refresh)
2. Click it, then click **Install**
3. Once installed, toggle **Show in sidebar** if you want quick access
4. Click **Start**

### Step 3: Sensor Integration (Optional)

HomeFrequency automatically deploys a custom integration that exposes each task as a sensor entity in Home Assistant.

1. After starting the add-on for the first time, **restart Home Assistant** (the add-on will show a notification reminding you)
2. Go to **Settings > Devices & Services**
3. HomeFrequency should auto-configure. If not, click **Add Integration** and search for "Home Frequency"
4. Each task appears as a sensor with state = `days_until` (negative when overdue)

Use these sensors in automations, template sensors, or Lovelace cards:

```yaml
# Example: notify when a task is overdue
trigger:
  - trigger: numeric_state
    entity_id: sensor.homefrequency_change_hvac_filter
    below: 0
action:
  - action: notify.mobile_app_your_phone
    data:
      title: Overdue Task
      message: "Time to change the HVAC filter!"
```

## Usage

### Adding a Task

1. Click the **+** button
2. Enter a task name (e.g., "Change HVAC Filter")
3. Choose a schedule:
   - **Every N days** -- repeats on an interval from last completion
   - **Fixed** -- repeats on a specific day (e.g., every Monday, the 1st of each month, every January)
4. Optionally add notes
5. Click **Save**

### Completing a Task

Click the **checkmark** on any task to mark it done. The due date resets based on the task's schedule.

### Dashboard Card

Add HomeFrequency to any dashboard as a webpage card:

```yaml
type: iframe
url: /api/hassio_ingress/<your-ingress-id>/
aspect_ratio: 100%
```

Or simply use the sidebar link if you enabled **Show in sidebar**.

## API

All endpoints return JSON.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tasks` | List all tasks (sorted by next due) |
| `POST` | `/api/tasks` | Create a task |
| `POST` | `/api/tasks/<id>/complete` | Mark a task complete |
| `PUT` | `/api/tasks/<id>` | Edit a task |
| `DELETE` | `/api/tasks/<id>` | Delete a task |
| `GET` | `/api/tasks/export` | Export all tasks as JSON |
| `POST` | `/api/tasks/import` | Import tasks from JSON array |

## Architecture

```
homefrequency/          # HA add-on (what gets installed)
  config.yaml           # Add-on metadata
  Dockerfile            # Python 3.11-slim image
  run.sh                # Startup: DB setup, integration deploy, Flask
  app/                  # Flask web app
  integration/          # Custom HA integration (sensors)

app/                    # Source code (development)
custom_components/      # Integration source (development)
scripts/
  deploy-to-ha.sh       # Syncs source into add-on dir, commits, pushes
```

## Tech Stack

- **Backend**: Flask (Python 3.11)
- **Frontend**: Vanilla HTML/CSS/JS
- **Database**: SQLite
- **Deployment**: Docker via HA Add-on Store
