import logging
from datetime import timedelta

import aiohttp

from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import DOMAIN, SCAN_INTERVAL_SECONDS

_LOGGER = logging.getLogger(__name__)


class HomeFrequencyCoordinator(DataUpdateCoordinator):
    """Fetch tasks from the HomeFrequency API."""

    def __init__(self, hass: HomeAssistant, host: str, port: int) -> None:
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(seconds=SCAN_INTERVAL_SECONDS),
        )
        self._base_url = f"http://{host}:{port}"
        self._session = async_get_clientsession(hass)

    async def _async_update_data(self) -> list[dict]:
        try:
            async with self._session.get(
                f"{self._base_url}/api/tasks",
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                resp.raise_for_status()
                return await resp.json()
        except Exception as err:
            raise UpdateFailed(f"Error fetching tasks: {err}") from err

    async def async_complete_task(self, task_id: int) -> None:
        """Mark a task as complete via the API."""
        async with self._session.post(
            f"{self._base_url}/api/tasks/{task_id}/complete",
            timeout=aiohttp.ClientTimeout(total=10),
        ) as resp:
            resp.raise_for_status()
        await self.async_request_refresh()
