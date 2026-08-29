"""Self-ping keep-alive.

Render's free web services spin down after ~15 minutes with no inbound HTTP
requests. This background task issues a request to the service's own public
`/health` URL every `KEEPALIVE_INTERVAL_SECONDS` (default 600), which counts as
inbound traffic and keeps the instance warm.

It only runs when a target URL is resolvable (`KEEPALIVE_URL`, or the
`RENDER_EXTERNAL_URL` that Render sets automatically); locally it's a no-op.
For robustness against an instance that has *already* slept, also run an
external pinger — see `.github/workflows/keepalive.yml`.
"""

import asyncio
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger("sheenai.keepalive")


async def _loop(url: str, interval: int) -> None:
    logger.info("keep-alive: pinging %s every %ss", url, interval)
    async with httpx.AsyncClient(timeout=10) as client:
        while True:
            await asyncio.sleep(interval)
            try:
                r = await client.get(url)
                logger.debug("keep-alive ping -> %s", r.status_code)
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001 - never let this task die
                logger.warning("keep-alive ping failed: %r", exc)


def start(app) -> None:
    """Attach a keep-alive task to `app.state` if a target URL is configured."""
    url = settings.self_ping_url
    if not url:
        logger.info("keep-alive disabled (no KEEPALIVE_URL / RENDER_EXTERNAL_URL)")
        return
    interval = max(60, settings.keepalive_interval_seconds)
    app.state.keepalive_task = asyncio.create_task(_loop(url, interval))


async def stop(app) -> None:
    task = getattr(app.state, "keepalive_task", None)
    if task is None:
        return
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
