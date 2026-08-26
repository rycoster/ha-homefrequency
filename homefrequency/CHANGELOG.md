# Changelog

## 2.11.1
- Fix: QR icon in a task's meta row now gets the same rounded grey background as the other indicators (notes, history, sensor) when the card is expanded — was floating with no visual container before
- Fix: toggling the QR checkbox no longer collapses the expanded card (the toggle updates the meta-row icon in place instead of re-rendering the whole task list)
- Revert: HA Sensor and QR checkboxes are back to plain labels — the chip styling was a misread of what needed the box
- QR scan → info page adds a "You can close this tab" prompt (with a Close button that tries `window.close()`) after Mark Complete succeeds, so a stale tab left open overnight doesn't invite an accidental re-mark tomorrow. The disabled "Already done today" button is still the primary safety
- Single-QR printout shrunk another 75% (1.8in wide, 12pt label). Print sheet grid tightened to 4 columns to fit more per page

## 2.11.0
- **Scanning a QR no longer auto-completes the task.** It now lands on an info page showing the task name, current status (Overdue / Due today / Due in N days), last completed date + "how long ago", schedule, next due date, and recent completions. A big **Mark Complete** button is the only thing that records a completion — no side effects from just scanning
- After pressing Mark Complete the page reloads with a "✓ Marked complete!" banner and the button greys out ("Already done today") so a follow-up scan can't double-log
- **Print QR sheet** link added to the main-screen footer (next to Export/Import) — opens a printable grid of every QR-enabled task on one page. Link is hidden when no tasks have QR enabled
- **Text filter** in the top bar next to "+ New Task" — instant substring match against task names and notes. Empty buckets get hidden while filtering; a "no tasks match…" message appears when nothing matches
- Single-QR printout is now **75% smaller** (2.4in wide, 16pt label) so it fits better on stickers or shared paper
- Print button in the single-QR modal has a tooltip pointing users at the QR sheet for multi-print scenarios
- Print sheet auto-detects the LAN URL the same way the modal does, warns if port 5050 isn't enabled, and uses your saved override URL if you set one
- Auto-detected URLs now prefer your Home Assistant host's mDNS name (e.g. `homeassistant.local:1234`) over its raw IP (`192.168.1.87:1234`). Printed QRs that end up in the wrong hands no longer leak your subnet — someone off your network can't do anything with the hostname alone. IP fallback still kicks in if the hostname isn't available. Requires `hassio_api: true` (already enabled)

## 2.10.1
- QR modal now shows which host port was auto-detected — e.g. "host port 1234 from this add-on's Network settings" — so you know why the URL uses a port other than 5050 (5050 is the internal container port; HA lets you map it to any external port)
- Renamed "Change URL" to "Override URL" and clarified that you don't need to touch it unless the auto-detected URL doesn't work from your phone
- HA Sensor and QR toggles in a task's edit view now look like proper chip buttons (border + padding + hover state) instead of unstyled checkbox+label pairs. Checked state gets a subtle blue tint so the on/off is obvious at a glance

## 2.10.0
- QR modal now auto-detects the LAN URL your phone should hit — no more editing `http://192.168.x.x:5050` by hand
- If port 5050 isn't enabled in the add-on's Network settings, the modal shows step-by-step instructions and hides the Print button until the port is available (scanning would 401 otherwise)
- The "Change URL" panel is still there (collapsed by default) for Nabu Casa or reverse-proxy setups; overrides save to your browser's localStorage
- Tooltip on the QR toggle now mentions the port-5050 requirement so it's visible before you open the modal
- New endpoint `/api/qr-info` uses the Supervisor API (`hassio_api: true`) to report the host's LAN IP and current port mapping; falls back to `window.location.origin` outside HA

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
