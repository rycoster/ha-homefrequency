# Changelog

## 2.9.1
- Fix: add-on failed to start on fresh image builds because `gunicorn` was missing from `requirements.txt` (regressed in the 2.6.0 switch away from the Flask dev server; masked until now by a cached image). The 2.9.0 image build surfaced it as `exec: gunicorn: not found` in the restart loop

## 2.9.0
- New: QR codes per task. Turn on the QR toggle in a task's edit view (alongside HA Sensor) and a scannable QR icon appears on the card next to the house icon. Click the icon to open a printable modal — scan the printout with a phone camera to mark the task complete instantly.
- QR is off by default per task. Disabling the QR toggle removes the icon and invalidates any printed codes for that task.
- Each task gets its own random QR token, auto-generated on creation and backfilled for existing tasks on upgrade. Anyone with a printout for an active task can trigger a completion, so treat printouts as trusted.
- QR modal has an editable base URL, saved to your browser's localStorage. Point it at whatever URL your phone can actually reach the add-on from. Ingress URLs will not work — they rotate on each login; the modal warns you if it detects one.
- The direct-port mapping (5050/tcp) is back, still opt-in — enable it in the add-on's Network settings before the LAN URL (e.g. `http://homeassistant.local:5050`) will resolve from a phone. Users who don't use QR keep the ingress-only defaults from 2.6.0.
- Behavior change: task completions are now idempotent per calendar day, everywhere. Pressing Reset (or scanning a QR) more than once on the same day records exactly one completion. Manually editing or backfilling completion dates is unaffected. `/api/tasks/<id>/complete` now returns `{ok, deduped}`.
- QR-enabled state is included in export/import.

## 2.8.0
- Editing is now per-card instead of a global mode: each expanded card has its own Edit button that unlocks editing (name, schedule, dates, notes, history, HA sensor toggle, Undo, Delete) for that card only
- The global Edit toggle and page-wide blue glow are gone; the card being edited gets a blue outline instead
- Editing exits automatically when the card collapses or you tap another card — no mode left on to forget

## 2.7.1
- Collapsing a card (tapping it again or tapping another card) now resets it to its default state — an open history panel closes, and notes return to their default (still auto-shown on due-soon/overdue tasks)

## 2.7.0

Mobile UI overhaul — same features and layout, made touch-friendly:

- All buttons and tap targets sized for fingers (44px) on touch devices: card actions, snooze menu, top bar, history rows, indicators
- Form inputs no longer trigger iOS auto-zoom on focus (16px on touch devices)
- Stacked phone layout now applies up to 600px wide, covering modern phones (previously only below 400px); the New Task form wraps instead of crushing
- Date editing reworked for mobile: the native date picker opens immediately, dates save only when you tap Set (previously iOS could save a half-picked date mid-scroll), and editing a history date works the same way as backdating
- In edit mode, tappable fields (name, frequency, due date) show a dotted underline so you can see what's editable
- Snooze menu: dismissing it by tapping elsewhere no longer presses whatever was underneath; the menu flips upward instead of clipping off-screen near the bottom of the list
- Delete confirmation: Cancel now sits where Delete was and Confirm arms after a moment, so an accidental double-tap can't instantly delete a task
- Notes: multi-line notes now work on phones (Enter adds a newline; tap outside to save)
- Tapping a collapsed card just expands it — no more accidentally toggling notes/history at the same time
- Number fields bring up the numeric keypad; the list keeps its scroll position after actions; editors scroll into view above the keyboard
- Stuck hover states (red Delete, faded cards) no longer occur on touch; snoozed/distant cards are more readable on phones

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
