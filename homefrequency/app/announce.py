"""Register with Supervisor discovery and post the first-install notice.

Runs once at add-on startup (from run.sh). Discovery lets the Home Frequency
integration configure itself in Home Assistant without touching the user's
configuration.yaml.
"""
import json
import os
import urllib.request

SUPERVISOR = "http://supervisor"
TOKEN = os.environ.get("SUPERVISOR_TOKEN", "")
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
NOTIFIED_FLAG = "/data/.integration_notified"
PORT = 5050


def api(method, path, payload=None):
    req = urllib.request.Request(
        SUPERVISOR + path,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers=HEADERS,
        method=method,
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read() or "{}")


def main():
    try:
        hostname = api("GET", "/addons/self/info")["data"]["hostname"]
    except Exception:
        hostname = "local-homefrequency"

    try:
        api("POST", "/discovery", {
            "service": "homefrequency",
            "config": {"host": hostname, "port": PORT},
        })
        print("Registered integration via Supervisor discovery")
    except Exception as err:
        print(f"Discovery registration failed: {err}")

    if not os.path.exists(NOTIFIED_FLAG):
        try:
            api("POST", "/core/api/services/persistent_notification/create", {
                "notification_id": "homefrequency_restart",
                "title": "Home Frequency",
                "message": "Home Frequency sensors have been installed. "
                           "Please restart Home Assistant to activate them.",
            })
            open(NOTIFIED_FLAG, "w").close()
            print("Posted restart notification")
        except Exception as err:
            print(f"Restart notification failed: {err}")


if __name__ == "__main__":
    main()
