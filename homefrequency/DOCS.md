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

- Create, edit, delete, snooze, and mark tasks complete
- Completion history — view, delete, or date-correct past entries
- Notes on any task, with clickable URL support
- Snooze overdue tasks to the start of the next season
- Export/Import your task list as JSON
- Light and dark mode (follows system preference)

## Home Assistant Integration

HomeFrequency automatically installs a custom integration that provides:

- **Per-task sensors** — toggle individually per task; state is days until due, with attributes for schedule type, next due date, notes, and more
- **Overdue count sensor** — always active; counts how many tasks are overdue (excludes snoozed)
- **Completion buttons** — one per sensor-enabled task to mark it complete from HA dashboards or automations
- **Persistent notifications** — alerts when tasks become overdue, auto-dismisses when caught up

Restart Home Assistant after first install to activate sensors and buttons.

## Data Storage

Task data is stored at `/config/homefrequency/tasks.db`. This location persists across add-on reinstalls. Use the Export button in the UI to create JSON backups.
