# HomeFrequency

A recurring task tracker for your home. Know when things were last done, when they're due next, and stay on top of home maintenance.

## How It Works

HomeFrequency supports three schedule types:

### Dynamic

Track a task and let HomeFrequency figure out the cadence. It groups your completion gaps by season and uses the current season's average to predict when the task is next due. Needs at least 2 completions to start predicting.

### Fixed

Set a task to recur on a specific day:
- **Weekly** — e.g. every Tuesday
- **Monthly** — e.g. every 15th
- **Yearly** — e.g. every March 1st

### Interval

Simple repeat: every N days, weeks, months, or years. The timer resets each time you complete the task.

## Features

- Create, edit, delete, and mark tasks complete. Each expanded task has its own Edit button that unlocks inline editing for that card
- Completion history — view, delete, or date-correct past entries; completions are idempotent per calendar day
- Notes on any task, with clickable URL support
- Snooze overdue tasks from a duration picker (1 day, 3 days, 1 week, 2 weeks, or 1 month)
- QR codes per task — print a code that marks the task complete when scanned. Opt-in per task; requires port 5050 to be enabled in Network settings
- Export/Import your task list as JSON (includes full completion history and QR state)
- Mobile-friendly UI: touch-friendly targets, native date pickers, stacked layout on phones
- Light and dark mode (follows system preference)

## Home Assistant Integration

HomeFrequency registers itself via Supervisor discovery — no `configuration.yaml` edit needed. On first start it deploys the custom integration to `/config/custom_components/homefrequency/` and asks HA to restart via a persistent notification. From then on, integration files are redeployed fresh on every add-on start.

It provides:

- **Per-task sensors** — toggle individually per task; state is days until due
- **Overdue count sensor** — always active; counts how many tasks are overdue (excludes snoozed)
- **Completion buttons** — one per sensor-enabled task to mark it complete from HA dashboards or automations
- **Persistent notifications** — alerts when tasks become overdue, auto-dismisses when caught up

The sidebar panel is visible to non-admin HA users.

## QR Codes

Print a QR that marks a specific task complete when scanned from your phone camera. Useful for sticking on things like the AC filter or water pitcher.

**Setup:**

1. Enable port **5050** in this add-on's Configuration → Network settings (opt-in for security)
2. In the app, expand a task, hit **Edit**, and check the **QR** box
3. Click the small QR icon that appears in the task's meta row to open the print dialog
4. The dialog auto-detects your LAN URL. Print, stick, scan

Repeat scans on the same day are deduped to one completion. Disabling the QR toggle invalidates any printed codes for that task.

## Data Storage

Task data is stored at `/config/homefrequency/tasks.db`. This location persists across add-on reinstalls. Use the Export button in the UI to create JSON backups.
