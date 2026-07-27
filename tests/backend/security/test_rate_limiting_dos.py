"""Security tests for rate limiting and denial-of-service protection.

Verifies that:
- The server remains stable under concurrent request load
- Rate limiting exists (tests fail with a security advisory if absent)
- Oversized request bodies are rejected with 413

OWASP Reference: A05:2021 – Security Misconfiguration / DoS
"""

import sys
import os
import threading
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "src"))


def _make_client():
    """Create a fresh test client for use in a worker thread."""
    from api import app as flask_app  # noqa: F401
    flask_app.config["TESTING"] = True
    return flask_app.test_client()


@pytest.mark.security
class TestServerStabilityUnderLoad:
    """Server must stay stable when handling many concurrent requests."""

    def _send_ask(self, results, idx):
        try:
            c = _make_client()
            with c:
                resp = c.post(
                    "/ask",
                    json={"answers": {}},
                    content_type="application/json",
                )
                results[idx] = resp.status_code
        except Exception as exc:  # pylint: disable=broad-except
            results[idx] = str(exc)

    def test_concurrent_ask_requests_stable(self):
        """100 concurrent POST /ask requests must not produce unexpected 5xx errors."""
        n = 100
        results = [None] * n
        threads = [
            threading.Thread(target=self._send_ask, args=(results, i))
            for i in range(n)
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=30)

        unexpected_errors = [
            r for r in results if isinstance(r, int) and r >= 500
        ]
        assert len(unexpected_errors) == 0, (
            f"[SECURITY] {len(unexpected_errors)}/{n} concurrent /ask requests returned "
            f"5xx errors: {unexpected_errors}. Server is unstable under load."
        )

    def _send_metrics(self, results, idx):
        try:
            c = _make_client()
            with c:
                resp = c.post(
                    "/api/metrics/analyze",
                    json={},
                    content_type="application/json",
                )
                results[idx] = resp.status_code
        except Exception as exc:  # pylint: disable=broad-except
            results[idx] = str(exc)

    def test_concurrent_metrics_requests_stable(self):
        """100 concurrent POST /api/metrics/analyze requests must keep server stable."""
        n = 100
        results = [None] * n
        threads = [
            threading.Thread(target=self._send_metrics, args=(results, i))
            for i in range(n)
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=30)

        crashes = [r for r in results if isinstance(r, str)]
        assert len(crashes) == 0, (
            f"[SECURITY] Server threw exceptions under concurrent /api/metrics/analyze load: "
            f"{crashes[:5]}"
        )


@pytest.mark.security
class TestRateLimiting:
    """A rate limiting mechanism must be present on write endpoints.

    VULNERABILITY NOTE: If no rate limiting is detected, these tests will FAIL
    intentionally to document the absence as a security risk.
    """

    def _burst_ask(self, client, n=20):
        """Send n sequential requests to /ask and collect responses."""
        statuses = []
        for _ in range(n):
            resp = client.post(
                "/ask",
                json={"answers": {}},
                content_type="application/json",
            )
            statuses.append(resp.status_code)
        return statuses

    def test_rate_limiting_present_on_ask(self, client):
        """Repeated requests to /ask should eventually return 429 Too Many Requests.

        KNOWN VULNERABILITY: Rate limiting is NOT currently implemented.
        This test will FAIL until rate limiting is added.
        """
        statuses = self._burst_ask(client, n=20)
        has_rate_limit = 429 in statuses
        if not has_rate_limit:
            pytest.fail(
                "[SECURITY] Rate limiting is NOT implemented on POST /ask. "
                "20 sequential requests all succeeded without any throttling. "
                "This endpoint is vulnerable to brute-force and abuse. "
                "Recommendation: add Flask-Limiter or similar middleware. "
                "OWASP A05 – Security Misconfiguration."
            )

    def test_rate_limiting_present_on_metrics(self, client):
        """Repeated requests to /api/metrics/analyze should eventually return 429.

        KNOWN VULNERABILITY: Rate limiting is NOT currently implemented.
        This test will FAIL until rate limiting is added.
        """
        statuses = []
        for _ in range(20):
            resp = client.post(
                "/api/metrics/analyze",
                json={},
                content_type="application/json",
            )
            statuses.append(resp.status_code)

        has_rate_limit = 429 in statuses
        if not has_rate_limit:
            pytest.fail(
                "[SECURITY] Rate limiting is NOT implemented on POST /api/metrics/analyze. "
                "20 sequential requests all succeeded without throttling. "
                "Recommendation: add Flask-Limiter or similar middleware."
            )


@pytest.mark.security
class TestOversizedPayload:
    """Oversized request bodies must be rejected to prevent memory exhaustion."""

    def test_large_body_rejected_on_ask(self, client):
        """A body larger than the configured limit sent to /ask must be rejected."""
        # Derived from the app rather than hard-coded: MAX_CONTENT_LENGTH is now
        # computed from MAX_UPLOAD_MB, so a fixed 11 MB no longer reliably
        # exceeds it.
        limit = client.application.config["MAX_CONTENT_LENGTH"]
        large_body = b"X" * (limit + 1024 * 1024)
        response = client.post(
            "/ask",
            data=large_body,
            content_type="application/json",
        )
        if response.status_code not in (400, 413):
            pytest.fail(
                f"[SECURITY] Oversized payload ({len(large_body)} bytes) was NOT rejected on /ask. "
                f"Got status {response.status_code}. Expected 413 (Request Entity Too Large). "
                "This allows memory exhaustion / DoS attacks. "
                "Recommendation: set Flask MAX_CONTENT_LENGTH. "
                "OWASP A05 – Security Misconfiguration."
            )

    def test_large_body_rejected_on_synth_generate(self, client):
        """A body larger than the configured limit must be rejected."""
        limit = client.application.config["MAX_CONTENT_LENGTH"]
        large_body = b"Y" * (limit + 1024 * 1024)
        response = client.post(
            "/api/synth/generate",
            data=large_body,
            content_type="application/json",
        )
        if response.status_code not in (400, 413):
            pytest.fail(
                f"[SECURITY] Oversized payload ({len(large_body)} bytes) accepted on /api/synth/generate. "
                f"Got status {response.status_code}. Expected 413. "
                "OWASP A05 – Security Misconfiguration."
            )
