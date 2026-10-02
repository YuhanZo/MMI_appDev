"""Client for the Aivana MMI API. Every call to Aivana goes through here.

Docs: https://main.duoh9hfelybuv.amplifyapp.com/docs/generate
Only 429, 502, 504 and network failures are retried, as the docs advise; failed
requests aren't charged, so retries don't double the cost.
"""

import random
import time
from typing import Any

import httpx

from app.config import settings

RETRYABLE_STATUSES = {429, 502, 504}
MAX_RETRIES = 2
TIMEOUT_S = 60.0  # live runs took 5-21s in testing
MAX_WAIT_S = 30.0

# Test hooks: tests swap in an httpx.MockTransport and a no-op sleep, so they never
# reach the real API.
_transport: httpx.BaseTransport | None = None
_sleep = time.sleep


class AivanaError(Exception):
    def __init__(
        self,
        message: str,
        *,
        status: int | None = None,
        code: str | None = None,
        request_id: str | None = None,
        retry_after_s: float | None = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.request_id = request_id
        self.retry_after_s = retry_after_s


def generate(prompt: str, *, output_shape: str | None = None, effort: str = "low") -> dict[str, Any]:
    """POST /v1/generate and return the response body. Raises AivanaError on failure."""
    body: dict[str, Any] = {"prompt": prompt, "effort": effort}
    if output_shape:
        body["output_shape"] = output_shape

    with httpx.Client(
        base_url=settings.aivana_base_url,
        headers={"X-API-Key": settings.aivana_api_key},
        timeout=TIMEOUT_S,
        transport=_transport,
    ) as client:
        for attempt in range(MAX_RETRIES + 1):
            last_attempt = attempt == MAX_RETRIES
            try:
                res = client.post("/v1/generate", json=body)
            except httpx.TransportError as e:  # includes timeouts
                if last_attempt:
                    raise AivanaError(f"Could not reach Aivana ({type(e).__name__})", code="network_error") from e
                _sleep(_backoff(attempt))
                continue

            if res.status_code == 200:
                return res.json()

            err = _error_from(res)
            if res.status_code not in RETRYABLE_STATUSES or last_attempt:
                raise err
            _sleep(min(err.retry_after_s or _backoff(attempt), MAX_WAIT_S))

    raise AssertionError("unreachable")


def _backoff(attempt: int) -> float:
    return 2**attempt + random.uniform(0, 0.25)


def _error_from(res: httpx.Response) -> AivanaError:
    """Parse Aivana's {"error": {...}} body; fall back gracefully if it isn't JSON."""
    try:
        info = res.json().get("error") or {}
    except ValueError:
        info = {}

    retry_after_s = None
    if info.get("retry_after_ms") is not None:
        retry_after_s = info["retry_after_ms"] / 1000
    elif res.headers.get("retry-after", "").isdigit():
        retry_after_s = float(res.headers["retry-after"])

    return AivanaError(
        info.get("message") or f"Aivana returned HTTP {res.status_code}",
        status=res.status_code,
        code=info.get("code"),
        request_id=info.get("request_id") or res.headers.get("x-request-id"),
        retry_after_s=retry_after_s,
    )
