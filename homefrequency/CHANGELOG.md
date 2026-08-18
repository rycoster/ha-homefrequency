# Changelog

## 2.6.0
- Security: the API is now ingress-only — removed the optional direct port mapping (the HA integration talks to the add-on over the internal Docker network, so nothing changes for it) and dropped the unused `share` and `data` mounts
- The add-on no longer writes to your `configuration.yaml`. The integration now registers itself through Supervisor discovery; the legacy `homefrequency:` line from older versions is cleaned up automatically, so uninstalling the add-on no longer leaves an orphaned config entry behind
- Integration files are redeployed fresh on every add-on start, so files removed in newer versions no longer linger in `custom_components`
- The web app now runs under gunicorn instead of the Flask development server
- The integration reuses Home Assistant's shared HTTP session instead of opening a new one every poll
- The task list now loads completion history in a single query
- The add-on no longer logs any portion of the Supervisor token
- Integration manifest version now tracks the add-on version

## 2.5.6
- Fixed-schedule tasks (weekly, monthly, yearly) now stay overdue at their missed date until you mark them done, instead of silently rolling forward to the next occurrence — completing then advances to the next date. A completion counts for the occurrence nearest to it, so doing a task a few days early or late still settles the date you meant
- Fix: weekly fixed-schedule tasks could never show as due or overdue — on the target day they skipped straight to the following week
- Fix: timestamps are now validated on the API (complete, edit completion, import return 400 on bad dates), and malformed timestamps already in the database no longer break the task list
- Export now includes full completion history; import restores it along with snooze state, so dynamic tasks keep their learned cadence after a backup/restore

## 2.5.5
- Sidebar panel is now visible to non-admin Home Assistant users (set `panel_admin: false`)

## 2.5.4
- Snooze: any overdue task (interval, fixed, or dynamic) can now be snoozed from a duration picker (1 day / 3 days / 1 week / 2 weeks / 1 month)
- Dynamic tracking-mode tasks also get the snooze button — lets you re-estimate when the task will next come due
- New dynamic tasks auto-snooze for 7 days on creation so they place inline in the list instead of stacking at the bottom
- Snoozed tasks now sort inline by their snooze-until date (as if it were a due date), so they work their way up the list naturally
- Replaces the dynamic-only "?" snooze button that snoozed until next season

## 2.5.3
- Added README with project overview, installation guide, and feature documentation

## 2.5.2
- Fix: monthly/yearly fixed-schedule tasks no longer show due prematurely when completed early in the cycle
- Fix: tapping anywhere on a collapsed card (including auto-expanded notes) now selects it
- Selected card now has a subtle background tint for better visibility

## 2.5.1
- Overdue tasks now trigger a persistent notification in HA — shows count and task names, auto-dismisses when all caught up

## 2.5.0
- New "Overdue Tasks" sensor — counts overdue (non-snoozed) tasks, usable in automations

## 2.4.3
- Fix: tapping notes/history buttons no longer deselects the task card
- Notes now render URLs as clickable hyperlinks (open in new tab)

## 2.4.2
- Dynamic tasks now auto-complete on creation — starts the cycle immediately instead of showing "Tracking..."

## 2.4.1
- Due-approaching gradient coloring — tasks within 25% of their cycle show yellow/warning text and border instead of green

## 2.4.0
- Per-task HA sensor toggle — enable sensors only for tasks you care about (off by default)
- Blue house icon indicator on tasks with sensors enabled
- Undo button in edit mode to remove accidental completions

## 2.3.0
- Completion history editing — delete or date-correct entries in edit mode
- Separate history indicator (clock icon) toggles independently from notes
- Default schedule type changed to dynamic
- Restructured add-task form layout
- HA config version control scripts (pull/push/diff via Samba rsync)

## 2.2.2
- Fixed integration default hostname (`local-homefrequency`) for GitHub repo install
- Added version label to bottom-left of UI

## 2.2.1
- Visual feedback for edit mode (soft blue edge glow) and selected tasks (blue card glow)
- Stronger glow in dark mode for visibility

## 2.2.0
- Dynamic frequency intervals (daily/weekly/monthly/yearly presets with custom option)
- Snooze tasks (push due date forward by 1 day)
- HA reset buttons — one button entity per task to mark complete from HA dashboards/automations
- New sensor attributes: notes, snooze status

## 2.1.1
- Tapping a task now shows Reset button directly; Delete only visible in Edit mode
- Inline editing (name, frequency, due date, notes) locked unless Edit mode is active
- Swapped Edit and New Task button positions in top bar

## 2.1.0
- Migrated to GitHub-based deploy workflow (replaces SMB copy)
- Restructured add-on directory to be self-contained

## 2.0.4
- Previous release (SMB deploy)
