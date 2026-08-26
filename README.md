# HomeFrequency

A Home Assistant add-on for tracking recurring household tasks. Know when things were last done, when they're due next, and stay on top of home maintenance.

## Features

- **Three schedule types**
  - **Dynamic** — learns your patterns from completion history and predicts when tasks are due, adjusting by season
  - **Fixed** — set tasks for a specific day of the week, month, or year
  - **Interval** — simple repeating frequency (every N days, weeks, months, or years)
- **Task management** — create, edit, delete, and mark tasks complete. Each expanded task has its own Edit button that unlocks inline editing for that card
- **Completion history** — view, delete, or date-correct past completions. Completions are idempotent per calendar day, so pressing Reset (or scanning a QR) more than once on the same day only records one entry
- **Notes** — attach notes to any task, with clickable URL support
- **Snooze** — snooze any overdue task from a duration picker (1 day / 3 days / 1 week / 2 weeks / 1 month). Snoozed tasks sort inline by their snooze-until date
- **QR codes per task** — opt-in per task; print a QR that marks the task complete when scanned from your phone. Auto-detects your LAN URL and walks you through opening port 5050 if needed
- **Export/Import** — back up and restore your task list as JSON, including full completion history and QR state
- **Mobile-friendly** — touch-friendly targets, native date pickers, stacked phone layout up to 600px
- **Light and dark mode** — follows your system preference
- **Home Assistant integration** — per-task sensors, overdue count sensor, completion buttons, and persistent notifications; installs automatically via Supervisor discovery (no `configuration.yaml` edit)

## Installation

1. In Home Assistant, go to **Settings > Add-ons > Add-on Store**
2. Click the three-dot menu (top right) and select **Repositories**
3. Add this repository URL:
   ```
   https://github.com/rycoster/ha-homefrequency
   ```
4. Find **HomeFrequency** in the add-on store and click **Install**
5. Start the add-on — it will appear in the sidebar as **Home Frequency**
6. On first install, restart Home Assistant when prompted to activate the sensors and buttons (the add-on posts a persistent notification to remind you)

## Home Assistant Integration

HomeFrequency registers itself via Supervisor discovery — no `configuration.yaml` entry needed. On first start it deploys the custom integration to `/config/custom_components/homefrequency/` and asks HA to restart. From then on, integration files are redeployed fresh on every add-on start so stale files can't linger.

It provides:

- **Per-task sensors** — toggle individually per task; state is days until due, with attributes for schedule type, next due date, notes, and more
- **Overdue count sensor** — always active; counts how many tasks are overdue (excludes snoozed)
- **Completion buttons** — one per sensor-enabled task to mark it complete from HA dashboards or automations
- **Persistent notifications** — alerts when tasks become overdue, auto-dismisses when caught up

Panel is visible to non-admin HA users.

## QR Codes

You can print a QR code per task that marks the task complete when scanned from a phone. Useful for sticking on the AC filter, water pitcher, coffee grinder, etc.

**Setup (one-time):**

1. Enable port **5050** in the add-on's **Network** settings (HA → Settings → Add-ons → HomeFrequency → Configuration → Network). This is opt-in for security — QR scans need to reach the app directly, not through HA ingress
2. In the app, expand a task and hit **Edit**
3. Check the **QR** box (next to HA Sensor). A small QR icon appears in the task's meta row
4. Click that icon to open the print dialog. It auto-detects your LAN URL and shows a scannable code
5. Print it, stick it wherever the task lives, scan with your phone camera

Scans record one completion per calendar day — repeat scans on the same day are deduped. Turning the QR toggle off removes the icon and invalidates the printed code.

For Nabu Casa or reverse-proxy setups, the print dialog has a **Change URL** panel to override the auto-detected LAN URL (saved to your browser's localStorage).

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
