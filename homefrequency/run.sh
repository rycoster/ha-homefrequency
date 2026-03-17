#!/bin/sh
echo "=== HomeFrequency starting at $(date '+%Y-%m-%d %H:%M:%S') ==="

# Store DB in /config so it survives add-on uninstall/reinstall
mkdir -p /config/homefrequency
export DB_DIR=/config/homefrequency

# Migrate old DB from /data if it exists
if [ ! -f /config/homefrequency/tasks.db ] && [ -f /data/tasks.db ]; then
    cp /data/tasks.db /config/homefrequency/tasks.db
    echo "Migrated tasks.db from /data to /config/homefrequency"
fi

# Deploy custom integration to HA config
echo "Checking for /config directory..."
if [ -d /config ]; then
    mkdir -p /config/custom_components/homefrequency
    cp -r /integration/* /config/custom_components/homefrequency/
    echo "Deployed homefrequency integration to /config/custom_components/"

    # Ensure integration is loaded on next HA restart
    if ! grep -q "^homefrequency:" /config/configuration.yaml 2>/dev/null; then
        echo "" >> /config/configuration.yaml
        echo "homefrequency:" >> /config/configuration.yaml
        echo "Added homefrequency to configuration.yaml"
    fi

    # Notify on first run after install (flag file tracks this)
    if [ ! -f /data/.integration_notified ] && [ -n "$SUPERVISOR_TOKEN" ]; then
        python -c "
import urllib.request, json, os
token = os.environ['SUPERVISOR_TOKEN']
req = urllib.request.Request(
    'http://supervisor/core/api/services/persistent_notification/create',
    data=json.dumps({
        'notification_id': 'homefrequency_restart',
        'title': 'Home Frequency',
        'message': 'Home Frequency sensors have been installed. Please restart Home Assistant to activate them.'
    }).encode(),
    headers={
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
    },
    method='POST'
)
print('Sending notification with token: ' + token[:8] + '...')
try:
    urllib.request.urlopen(req)
    print('Posted restart notification')
except Exception as e:
    print('Notification via Core API failed: ' + str(e))
    # Try via Supervisor notification API instead
    req2 = urllib.request.Request(
        'http://supervisor/resolution/notification',
        data=json.dumps({
            'type': 'info',
            'message': 'Home Frequency sensors installed. Restart Home Assistant to activate.'
        }).encode(),
        headers={
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        },
        method='POST'
    )
    try:
        urllib.request.urlopen(req2)
        print('Posted via Supervisor notification API')
    except Exception as e2:
        print('Supervisor notification also failed: ' + str(e2))
" 2>&1 || echo "Failed to post restart notification"
        touch /data/.integration_notified
    fi
else
    echo "/config NOT found -- config map not mounted?"
fi

python /app/main.py
