import logging
import re

from homeassistant.components.button import ButtonEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity
from homeassistant.helpers.device_registry import DeviceInfo

from .const import DOMAIN
from .coordinator import HomeFrequencyCoordinator

_LOGGER = logging.getLogger(__name__)


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
                new_entities.append(TaskCompleteButton(coordinator, task))
        if new_entities:
            async_add_entities(new_entities)

    _async_add_new_tasks()

    entry.async_on_unload(
        coordinator.async_add_listener(_async_add_new_tasks)
    )


class TaskCompleteButton(CoordinatorEntity, ButtonEntity):
    """Button that marks a task as complete."""

    _attr_icon = "mdi:check-circle-outline"
    _attr_has_entity_name = True

    def __init__(self, coordinator: HomeFrequencyCoordinator, task: dict) -> None:
        super().__init__(coordinator)
        self._task_id = task["id"]
        self._attr_unique_id = f"hf_task_{self._task_id}_complete"

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
            return f"{task['name']} Reset"
        return f"Task {self._task_id} Reset"

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
        return super().available and self._task_data is not None

    async def async_press(self) -> None:
        await self.coordinator.async_complete_task(self._task_id)
