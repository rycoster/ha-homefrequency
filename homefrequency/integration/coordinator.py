import logging
from datetime import timedelta

import aiohttp

from homeassistant.core import HomeAssistant
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
        self._url = f"http://{host}:{port}/api/tasks"

    async def _async_update_data(self) -> list[dict]:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self._url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    resp.raise_for_status()
                    return await resp.json()
        except Exception as err:
            raise UpdateFailed(f"Error fetching tasks: {err}") from err
