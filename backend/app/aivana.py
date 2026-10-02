"""Client for the Aivana MMI API. Every call to Aivana goes through here.

Docs: https://main.duoh9hfelybuv.amplifyapp.com/docs/generate
Retried: 429, 502 and 504 (the docs say failed requests aren't charged) and
errors raised before the request was sent. Not retried: a timeout or broken
connection after sending -- the run may already have executed and been charged,
and Aivana has no idempotency key to make a resend safe.
"""

import random
import time
from typing import Any

import httpx

from app.config import settings

RETRYABLE_STATUSES = {429, 502, 504}
# Raised before any bytes reached Aivana, so resending can't run the prompt twice.
NOT_SENT_ERRORS = (httpx.ConnectError, httpx.ConnectTimeout, httpx.PoolTimeout)
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
            except NOT_SENT_ERRORS as e:
                if last_attempt:
                    raise AivanaError(f"Could not reach Aivana ({type(e).__name__})", code="network_error") from e
                _sleep(_backoff(attempt))
                continue
            except httpx.TransportError as e:
                raise AivanaError(
                    f"No response from Aivana ({type(e).__name__}); the request may still have run",
                    code="timeout" if isinstance(e, httpx.TimeoutException) else "network_error",
                ) from e

            if res.status_code == 200:
                data = _json_object(res)
                if data is None:
                    raise AivanaError(
                        "Aivana returned an invalid response",
                        status=200,
                        code="invalid_response",
                        request_id=res.headers.get("x-request-id"),
                    )
                return data

            err = _error_from(res)
            if res.status_code not in RETRYABLE_STATUSES or last_attempt:
                raise err
            _sleep(min(err.retry_after_s or _backoff(attempt), MAX_WAIT_S))

    raise AssertionError("unreachable")


def _backoff(attempt: int) -> float:
    return 2**attempt + random.uniform(0, 0.25)


def _json_object(res: httpx.Response) -> dict[str, Any] | None:
    """The body as a JSON object, or None if it is not valid JSON or not an object."""
    try:
        data = res.json()
    except ValueError:
        return None
    return data if isinstance(data, dict) else None


def _str_or_none(value: Any) -> str | None:
    return value if isinstance(value, str) and value else None


def _error_from(res: httpx.Response) -> AivanaError:
    """Parse Aivana's {"error": {...}} body. Any other shape becomes invalid_response;
    the HTTP status still decides whether to retry."""
    body = _json_object(res) or {}
    info = body.get("error")
    if not isinstance(info, dict):
        info = {"code": "invalid_response"}

    retry_after_s = None
    ms = info.get("retry_after_ms")
    if isinstance(ms, (int, float)) and not isinstance(ms, bool) and ms >= 0:
        retry_after_s = ms / 1000
    elif res.headers.get("retry-after", "").isdigit():
        retry_after_s = float(res.headers["retry-after"])

    return AivanaError(
        _str_or_none(info.get("message")) or f"Aivana returned HTTP {res.status_code}",
        status=res.status_code,
        code=_str_or_none(info.get("code")),
        request_id=_str_or_none(info.get("request_id")) or res.headers.get("x-request-id"),
        retry_after_s=retry_after_s,
    )
