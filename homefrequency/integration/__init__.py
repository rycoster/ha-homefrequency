from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.components.persistent_notification import (
    async_create as pn_create,
    async_dismiss as pn_dismiss,
)

from .const import DOMAIN
from .coordinator import HomeFrequencyCoordinator

PLATFORMS = ["sensor", "button"]
NOTIFICATION_ID = "homefrequency_overdue"


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Auto-create a config entry if the add-on is running and none exists."""
    if hass.config_entries.async_entries(DOMAIN):
        return True

    hass.async_create_task(
        hass.config_entries.flow.async_init(
            DOMAIN, context={"source": "auto"}
        )
    )
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    coordinator = HomeFrequencyCoordinator(
        hass,
        entry.data["host"],
        entry.data["port"],
    )
    await coordinator.async_config_entry_first_refresh()

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = coordinator

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    @callback
    def _check_overdue() -> None:
        if not coordinator.data:
            return
        overdue = [
            task for task in coordinator.data
            if task.get("is_overdue") and not task.get("is_snoozed")
        ]
        if overdue:
            names = "\n".join(f"- {t['name']}" for t in overdue)
            pn_create(
                hass,
                title=f"HomeFrequency: {len(overdue)} overdue task{'s' if len(overdue) != 1 else ''}",
                message=names,
                notification_id=NOTIFICATION_ID,
            )
        else:
            pn_dismiss(hass, NOTIFICATION_ID)

    entry.async_on_unload(coordinator.async_add_listener(_check_overdue))
    _check_overdue()

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)
    return unload_ok
