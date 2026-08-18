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
if [ -d /config ]; then
    # Redeploy fresh so files removed in newer versions don't linger
    rm -rf /config/custom_components/homefrequency
    mkdir -p /config/custom_components/homefrequency
    cp -r /integration/* /config/custom_components/homefrequency/
    echo "Deployed homefrequency integration to /config/custom_components/"

    # Older versions appended a bare "homefrequency:" line to
    # configuration.yaml; setup now happens via Supervisor discovery,
    # so clean the legacy line up to avoid orphan warnings on uninstall.
    if grep -q '^homefrequency:[[:space:]]*$' /config/configuration.yaml 2>/dev/null; then
        sed -i '/^homefrequency:[[:space:]]*$/d' /config/configuration.yaml
        echo "Removed legacy homefrequency: entry from configuration.yaml"
    fi
else
    echo "/config NOT found -- config map not mounted?"
fi

# Register with Supervisor discovery + first-install restart notice
if [ -n "$SUPERVISOR_TOKEN" ]; then
    python /app/announce.py || echo "Supervisor announce failed"
else
    echo "SUPERVISOR_TOKEN not set -- skipping discovery registration"
fi

exec gunicorn --chdir /app --bind 0.0.0.0:5050 --workers 1 --threads 4 main:app
