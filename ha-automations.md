# Home Assistant Automations & Scripts Reference

Last updated: 2026-03-03

## Scripts

### Default Lighting Automation
**Entity:** `script.default_lighting_automation`

Resets lighting to the appropriate scene based on time of day. Used by multiple automations as a "return to normal" action.

- **Daytime** (sunrise-sunset): Activates `scene.gate_is_closed_scene` + `scene.office_warm`, then triggers the baby gate automation to re-evaluate gate state
- **Nighttime**: Activates `scene.office_scene_night_light_duplicate`

**Lights controlled:**
- `light.light_bulb_25_a` (kitchen)
- `light.light_bulb_25_b` (kitchen/baby gate indicator)
- `light.light_bulb_25_c` (office)
- `light.light_bulb_25_d` (office)
- `light.light_bulb_25_e` (office)
- `light.light_bulb_25_f` (office)
- `light.home_school_status_light`
- `light.loft`

**Called by:** Morning Routine, Work Call Automation (after call ends), Light Recovery

---

## Automations

### Safety & Alerts

| Automation | Trigger | What it does |
|---|---|---|
| **Server Room Temp Notification** | `sensor.h5100_0e3f_temperature` > 80F | Persistent notification |
| **Water Leak Alert** | `binary_sensor.leak_sensor_25_b_water_leak` on | Persistent notification, caution scene, plays Leak.m4a on speakers, mobile notifications to both phones every 15min until dry for 5min |
| **Low Battery Notifications** | Battery < 78% (blueprint) | Easy notify via Blackshome blueprint |

### Garage & Entry

| Automation | Trigger | What it does |
|---|---|---|
| **Garage Door Long Open Alert** | Garage door opens | Hourly persistent notifications with open duration counter, dismisses when closed |
| **Doorbell Ring** | MQTT button single press | Plays doorbell sound on 3 speakers (kitchen display, chromecast, one more), pauses media on 2 devices |
| **Open Garage via Doorbell Long Press** | MQTT button long press | Toggles garage door open/closed |

### Baby Gate & Kids

| Automation | Trigger | What it does |
|---|---|---|
| **Baby Gate Open - Alert and Scene Control** | `binary_sensor.door_sensor_25_a_contact` on | Beep on chromecast (if not already playing), daytime: activates gate-open scene, waits for close, activates gate-closed scene |
| **TV Time hits 4 hr** | `sensor.tv_time` > 4 | Pauses Samsung TV (before 8pm only) |
| **Movement in Girls Room pauses TV** | `binary_sensor.motion_sensor_25_a_occupancy` on | Pauses Samsung TV, plays double beep, disables itself for 5min then re-enables. Enabled/disabled by bedtime and morning routines |
| **Hello Kitty Light Auto-Off** | Hello Kitty switch on for 1 hour | Turns it off |
| **Hello Kitty Motion Light** | Girls room motion sensor (blueprint) | Blackshome sensor-light blueprint, toggle: `input_boolean.hello_kitty_toggle` |

### Routines

| Automation | Trigger | What it does |
|---|---|---|
| **Nighttime Routine (Bedtime)** | 7:30 PM daily | Multi-stage: hall lights warm 50% + sleep scene + lullaby -> 30min -> wind down scene + Hello Kitty on + enable girls room motion pause + ocean sounds -> 30min -> Hello Kitty off + office night light |
| **Morning Routine** | Sunrise + 5min | Disables girls room motion TV pause, runs default lighting script |
| **Water Heater Pump** | 7:00 AM and 7:45 PM daily | Turns pump on for 2 hours, then off |

### Work & Office

| Automation | Trigger | What it does |
|---|---|---|
| **Work Call Automation** | MacBook camera on for 15s | Sets office to warm scene, notifies Sharyn, kitchen light red. Waits for camera+mic off for 1min (2hr timeout), then runs default lighting |
| **FXN Event Happening** | FXN calendar event starts (5min before) | Star Wars office scene + beep, waits for camera on (4min timeout), then switches to warm |
| **Office Lighting - Motion Sensor** | `binary_sensor.motion_sensor_25_b_occupancy` (blueprint) | Blackshome sensor-light for office bulbs 25.C-F, toggle: `input_boolean.office_lighting_toggle` |
| **Office Lighting - Activate Selected Scene** | `input_select.office_scenes` changes | Activates whatever scene is selected in the input_select |
| **Office Button - Next Lighting Scene** | MQTT button single press | Cycles `input_select.office_scenes` to next option |

### Presence & Vacuum

| Automation | Trigger | What it does |
|---|---|---|
| **When Sharyn Gets Home** | `device_tracker.sharyn_s_pixel_6` -> home | Notifies Ryan, sets ecobee to home mode (main floor + upstairs), docks vacuum if cleaning |
| **When Sharyn Leaves** | `person.sharyn_coster` leaves home for 5min | Condition: vacuum hasn't cleaned in 12hrs. Sends actionable notification (Start/Skip), waits 2hrs for response, starts vacuum if approved |

### Appliances & Devices

| Automation | Trigger | What it does |
|---|---|---|
| **Master Bathroom Exhaust Fan** | Humidity > 70% for 1min | Turns fan on, waits for humidity < 60% for 5min (1hr timeout), turns fan off |
| **MK4 Attention** | `sensor.prusa_mk4` -> attention | Mobile notification to Ryan |
| **Canon Printer Status** | Printer goes from printing -> stopped | TTS "Printing Failed" on chromecast |
| **Wet Laundry Reminder** | `sensor.washer_current_status` -> end | Hourly persistent notifications with sitting duration until dryer starts |
| **Plant Dry Alert** | Pathos moisture < 25% or Monsterra < 40% for 1hr | Persistent notification |

### Seasonal / Christmas

| Automation | Trigger | What it does |
|---|---|---|
| **Front Yard Christmas Lights** | Garage opens, outdoor motion, or sunset+10min | Turns on lights. Daytime: auto-off after 10min. Stays on after sunset |
| **Christmas Lights Inside Master/Slave** | Master switch changes | Syncs slave lights (by label `xmas_lights_inside_slave`) with master on/off |

### Light Recovery

| Automation | Trigger | What it does |
|---|---|---|
| **Light Recovery - Run Default Lighting** | Any of the 8 scene-controlled lights transitions from `unavailable` -> `on` for 5s | Runs `script.default_lighting_automation` to correct the light's state. Mode: restart (debounces multiple lights recovering at once) |

---

## Key Entities Referenced

### Notification Targets
- `notify.mobile_app_pixel_9_pro` (Ryan)
- `notify.mobile_app_sharyn_s_pixel_6` (Sharyn)
- `notify.persistent_notification` (HA dashboard)

### Media Players
- `media_player.chromecastaudio4922` (main speakers)
- `media_player.kitchen_display`
- `media_player.samsung_q80_series_55_qn55q80rafxza` (Samsung TV)

### Input Helpers
- `input_select.office_scenes` -- cycles through office lighting scenes
- `input_boolean.office_lighting_toggle` -- enables/disables office motion light
- `input_boolean.hello_kitty_toggle` -- enables/disables Hello Kitty motion light
- `counter.garage_door_hours_open`
- `counter.wet_laundry_timer`
- `input_button.battery_check` -- manual battery check trigger

### Presence
- `person.sharyn_coster` / `device_tracker.sharyn_s_pixel_6`
- `binary_sensor.ryans_macbook_pro_camera_in_use`

### Office Scenes (via input_select)
- `scene.office_warm` -- warm white, 80% brightness
- `scene.office_starwars` -- blue/red theme
- `scene.office_scene_night_light_duplicate` -- dim warm nightlight
- `scene.office_scene_bright` -- full bright 5000K
- `scene.office_christmas` -- red/green (seasonal, currently disabled in bedtime)
