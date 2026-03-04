# Handoff Notes — HomeAssistant

> Updated: 2026-03-03
> Session summary for the next Claude agent picking up this project.

## What Was Accomplished This Session

### Spotify Playlist Button for Girls' Room
Added a one-tap button to play a Spotify playlist on the Google Mini in Addy & Livy's room:

- **New script** in `scripts.yaml`: `play_girls_playlist`
  - Sets Spotify volume to 30%
  - Selects "Girl's Mini" as playback source on `media_player.spotify_ryan_coster`
  - 2-second delay for source switch
  - Plays playlist `spotify:playlist:2jNM66lmYhUOql6jetkVhp`
- **New dashboard badge** on "12 Stratford" Home view (`lovelace.dashboard_test`)
  - Green music icon, labeled "Girls' Playlist"
  - Tap triggers `script.play_girls_playlist`
  - Placed after the TV Pause badge

### Key Entities Used
- `media_player.spotify_ryan_coster` — Spotify integration
- `media_player.chromecastaudio4922` — Girl's Mini (Google Cast device)
- Source name in Spotify: `"Girl's Mini"`

## Current State
- Script and dashboard changes are live on the Samba share at `/Volumes/config/`
- User needs to reload **Scripts** and **Dashboards** in HA Developer Tools > YAML
- No git commits this session (config lives on HA, not in this repo)

## Still TODO (carried forward)
- Set up GitHub repo as HA add-on repository (replacing SMB copy workflow)
- Expose HomeFrequency port 5050 to host network
- Commit local HomeFrequency code changes to git
- Rebuild add-on on HA and verify v2.0.4 is running

## Key Decisions
- **Always confirm edits** to HA root YAML files before making changes (memory rule added)
- Studio Code Server schema warnings are cosmetic — fix is in extension settings, not file-level

## Gotchas (carried forward)
- Samba shares disconnect on HA reboot — remount via `open "smb://192.168.1.87"`
- Always bump add-on version before rebuild
- Do NOT `rsync --delete` the addon dir
- `localhost` doesn't work from HA Core to add-ons — use slug hostname
- Changing `unique_id` creates new entities — old ones need manual deletion

## Key File Locations
| Local | HA (via Samba) |
|-------|----------------|
| `custom_components/homefrequency/` | `/Volumes/config/custom_components/homefrequency/` |
| `homefrequency-addon/` | `/Volumes/addons/homefrequency/` |
| `app/` | `/Volumes/addons/homefrequency/app/` |
| `data/tasks.db` | `/config/homefrequency/tasks.db` (on HA) |
| Samba: `smb://192.168.1.87` | Shares: addons, config, share |
