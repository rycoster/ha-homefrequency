import os

import aiohttp
import voluptuous as vol

from homeassistant import config_entries
from homeassistant.data_entry_flow import FlowResult

from .const import DOMAIN, ADDON_SLUG, DEFAULT_HOST, DEFAULT_PORT, DEFAULT_NAME


class HomeFrequencyConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Config flow for Home Frequency."""

    VERSION = 1

    async def _async_get_addon_host(self) -> str | None:
        """Try to resolve the add-on hostname via the Supervisor API."""
        token = os.environ.get("SUPERVISOR_TOKEN")
        if not token:
            return None
        try:
            async with aiohttp.ClientSession() as session:
                url = f"http://supervisor/addons/{ADDON_SLUG}/info"
                headers = {"Authorization": f"Bearer {token}"}
                async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        info = data.get("data", {})
                        if info.get("state") == "started":
                            return info.get("hostname", DEFAULT_HOST)
        except Exception:
            pass
        return None

    async def _async_test_connection(self, host: str, port: int) -> bool:
        try:
            async with aiohttp.ClientSession() as session:
                url = f"http://{host}:{port}/api/tasks"
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    resp.raise_for_status()
                    return True
        except Exception:
            return False

    async def async_step_user(self, user_input=None) -> FlowResult:
        # First visit: try auto-detecting the add-on.
        if user_input is None:
            addon_host = await self._async_get_addon_host()
            if addon_host and await self._async_test_connection(addon_host, DEFAULT_PORT):
                await self.async_set_unique_id(f"{addon_host}:{DEFAULT_PORT}")
                self._abort_if_unique_id_configured()
                return self.async_create_entry(
                    title=DEFAULT_NAME,
                    data={"host": addon_host, "port": DEFAULT_PORT},
                )

        # Fall back to manual config.
        errors = {}
        if user_input is not None:
            host = user_input["host"]
            port = user_input["port"]
            if await self._async_test_connection(host, port):
                await self.async_set_unique_id(f"{host}:{port}")
                self._abort_if_unique_id_configured()
                return self.async_create_entry(
                    title=user_input.get("name", DEFAULT_NAME),
                    data={"host": host, "port": port},
                )
            else:
                errors["base"] = "cannot_connect"

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Optional("name", default=DEFAULT_NAME): str,
                vol.Required("host", default=DEFAULT_HOST): str,
                vol.Required("port", default=DEFAULT_PORT): int,
            }),
            errors=errors,
        )

    async def async_step_auto(self, user_input=None) -> FlowResult:
        """Auto-setup triggered by async_setup when no config entry exists."""
        addon_host = await self._async_get_addon_host()
        if addon_host and await self._async_test_connection(addon_host, DEFAULT_PORT):
            await self.async_set_unique_id(f"{addon_host}:{DEFAULT_PORT}")
            self._abort_if_unique_id_configured()
            return self.async_create_entry(
                title=DEFAULT_NAME,
                data={"host": addon_host, "port": DEFAULT_PORT},
            )
        # Add-on not reachable yet -- silently abort, will retry next restart.
        return self.async_abort(reason="addon_not_found")
