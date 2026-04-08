# HomeFrequency

A Home Assistant add-on for tracking recurring household tasks. Know when things were last done, when they're due next, and stay on top of home maintenance.

## Features

- **Three schedule types**
  - **Dynamic** — learns your patterns from completion history and predicts when tasks are due, adjusting by season
  - **Fixed** — set tasks for a specific day of the week, month, or year
  - **Interval** — simple repeating frequency (every N days, weeks, months, or years)
- **Task management** — create, edit, delete, snooze, and mark tasks complete
- **Completion history** — view, delete, or date-correct past completions
- **Notes** — attach notes to any task, with clickable URL support
- **Snooze** — push overdue tasks to the start of the next season
- **Export/Import** — back up and restore your task list as JSON
- **Light and dark mode** — follows your system preference
- **Home Assistant integration** — per-task sensors, overdue count sensor, completion buttons, and persistent notifications

## Installation

1. In Home Assistant, go to **Settings > Add-ons > Add-on Store**
2. Click the three-dot menu (top right) and select **Repositories**
3. Add this repository URL:
   ```
   https://github.com/rycoster/ha-homefrequency
   ```
4. Find **HomeFrequency** in the add-on store and click **Install**
5. Start the add-on — it will appear in the sidebar as **Home Frequency**
6. Restart Home Assistant to activate the sensors and buttons

## Home Assistant Integration

HomeFrequency automatically installs a custom integration that provides:

- **Per-task sensors** — toggle individually per task; state is days until due, with attributes for schedule type, next due date, notes, and more
- **Overdue count sensor** — always active; counts how many tasks are overdue (excludes snoozed)
- **Completion buttons** — one per sensor-enabled task to mark it complete from HA dashboards or automations
- **Persistent notifications** — alerts when tasks become overdue, auto-dismisses when caught up

## How It Works

### Dynamic Schedule

Track a task and let HomeFrequency figure out the cadence. It groups your completion gaps by season and uses the current season's average to predict when the task is next due. Needs at least 2 completions to start predicting.

### Fixed Schedule

Set a task to recur on a specific day:
- **Weekly** — e.g. every Tuesday
- **Monthly** — e.g. every 15th
- **Yearly** — e.g. every March 1st

### Interval

Simple repeat: every N days, weeks, months, or years. The timer resets each time you complete the task.

## Data Storage

Task data is stored in a SQLite database at `/config/homefrequency/tasks.db`. This location persists across add-on reinstalls. Use the Export button in the UI to create JSON backups.

## Supported Architectures

- amd64
- aarch64
- armv7
- armhf
- i386

## Changelog

See [CHANGELOG.md](homefrequency/CHANGELOG.md) for release notes.
