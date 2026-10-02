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
# One user action (e.g. a fit analysis) gets one Budget shared by every retry, so
# nested retries can't multiply: at most MAX_CALLS requests within BUDGET_S.
MAX_CALLS = 3
BUDGET_S = 90.0
TIMEOUT_S = 60.0  # per request; live runs took 5-21s in testing
MIN_CALL_S = 5.0  # don't start a request with less time than this left
MAX_WAIT_S = 30.0

# Test hooks: tests swap in an httpx.MockTransport and a no-op sleep, so they never
# reach the real API.
_transport: httpx.BaseTransport | None = None
_sleep = time.sleep


class Budget:
    """Calls and seconds left for one user action, across all of its retries."""

    def __init__(self, calls: int = MAX_CALLS, seconds: float = BUDGET_S, clock=time.monotonic) -> None:
        self.calls_left = calls
        self._clock = clock
        self._deadline = clock() + seconds

    def has_call(self, after_wait_s: float = 0.0) -> bool:
        time_left = self._deadline - self._clock() - after_wait_s
        return self.calls_left > 0 and time_left >= MIN_CALL_S

    def take_call(self) -> float:
        """Use up one call; return the timeout it may take."""
        if not self.has_call():
            raise AivanaError("Gave up: the Aivana call budget for this request is used up", code="budget_exhausted")
        self.calls_left -= 1
        return min(TIMEOUT_S, self._deadline - self._clock())


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


def generate(
    prompt: str,
    *,
    output_shape: str | None = None,
    effort: str = "low",
    budget: Budget | None = None,
) -> dict[str, Any]:
    """POST /v1/generate and return the response body. Raises AivanaError on failure.

    Pass the caller's Budget when one action makes several generate() calls.
    """
    budget = budget or Budget()
    body: dict[str, Any] = {"prompt": prompt, "effort": effort}
    if output_shape:
        body["output_shape"] = output_shape

    with httpx.Client(
        base_url=settings.aivana_base_url,
        headers={"X-API-Key": settings.aivana_api_key},
        transport=_transport,
    ) as client:
        attempt = 0
        while True:
            timeout = budget.take_call()
            try:
                res = client.post("/v1/generate", json=body, timeout=timeout)
            except NOT_SENT_ERRORS as e:
                err = AivanaError(f"Could not reach Aivana ({type(e).__name__})", code="network_error")
                wait = _backoff(attempt)
            except httpx.TransportError as e:
                raise AivanaError(
                    f"No response from Aivana ({type(e).__name__}); the request may still have run",
                    code="timeout" if isinstance(e, httpx.TimeoutException) else "network_error",
                ) from e
            else:
                if res.status_code == 200:
                    return _body_or_raise(res)
                err = _error_from(res)
                if res.status_code not in RETRYABLE_STATUSES:
                    raise err
                wait = err.retry_after_s or _backoff(attempt)

            wait = min(wait, MAX_WAIT_S)
            if not budget.has_call(after_wait_s=wait):
                raise err
            _sleep(wait)
            attempt += 1


def _body_or_raise(res: httpx.Response) -> dict[str, Any]:
    data = _json_object(res)
    if data is None:
        raise AivanaError(
            "Aivana returned an invalid response",
            status=200,
            code="invalid_response",
            request_id=res.headers.get("x-request-id"),
        )
    return data


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
