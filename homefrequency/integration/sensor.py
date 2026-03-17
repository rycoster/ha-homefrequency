import logging
import re

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity
from homeassistant.helpers.device_registry import DeviceInfo

from .const import DOMAIN
from .coordinator import HomeFrequencyCoordinator

_LOGGER = logging.getLogger(__name__)


def _slugify(name: str) -> str:
    """Turn a task name into a safe entity suffix."""
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator: HomeFrequencyCoordinator = hass.data[DOMAIN][entry.entry_id]

    known_ids: set[int] = set()

    @callback
    def _async_add_new_tasks() -> None:
        if not coordinator.data:
            return
        new_entities = []
        for task in coordinator.data:
            task_id = task["id"]
            if task_id not in known_ids:
                known_ids.add(task_id)
                new_entities.append(TaskSensor(coordinator, task))
        if new_entities:
            async_add_entities(new_entities)

    # Add sensors for tasks already present at startup.
    _async_add_new_tasks()

    # Listen for coordinator updates to discover newly-created tasks.
    entry.async_on_unload(
        coordinator.async_add_listener(_async_add_new_tasks)
    )


class TaskSensor(CoordinatorEntity, SensorEntity):
    """Sensor whose state is the days_until value for a task."""

    _attr_native_unit_of_measurement = "days"
    _attr_icon = "mdi:clipboard-check-outline"
    _attr_has_entity_name = True

    def __init__(self, coordinator: HomeFrequencyCoordinator, task: dict) -> None:
        super().__init__(coordinator)
        self._task_id = task["id"]
        self._attr_unique_id = f"hf_task_{self._task_id}"

    @property
    def device_info(self) -> DeviceInfo:
        return DeviceInfo(
            identifiers={(DOMAIN, "homefrequency")},
            name="Home Frequency",
            manufacturer="HomeFrequency",
        )

    @property
    def name(self) -> str:
        task = self._task_data
        if task:
            return task["name"]
        return f"Task {self._task_id}"

    @property
    def _task_data(self) -> dict | None:
        if not self.coordinator.data:
            return None
        for task in self.coordinator.data:
            if task["id"] == self._task_id:
                return task
        return None

    @property
    def available(self) -> bool:
        """Unavailable when the task has been deleted from the API."""
        return super().available and self._task_data is not None

    @property
    def native_value(self) -> int | None:
        task = self._task_data
        if task is None:
            return None
        return task["days_until"]

    @property
    def extra_state_attributes(self) -> dict | None:
        task = self._task_data
        if task is None:
            return None
        dynamic = task.get("dynamic") or {}
        return {
            "next_due": task.get("next_due"),
            "is_overdue": task.get("is_overdue"),
            "frequency_days": task.get("frequency_days"),
            "last_completed": task.get("last_completed"),
            "schedule_type": task.get("schedule_type"),
            "notes": task.get("notes"),
            "is_snoozed": task.get("is_snoozed"),
            "dynamic_predicted_days": dynamic.get("predicted_days"),
            "dynamic_season": dynamic.get("season"),
        }
