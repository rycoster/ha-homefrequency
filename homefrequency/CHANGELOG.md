# Changelog

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
