"""Tests for bearer-token authentication on the business API."""
import importlib
import os
import sys
import unittest
from pathlib import Path
from unittest import mock

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT / "src"))

TOKEN = "test-token-aaaaaaaaaaaaaaaaaaaaaaaa"
OTHER = "rotation-token-bbbbbbbbbbbbbbbbbbbb"

BASE_ENV = {
    "FLASK_ENV": "development",
    "CORS_ALLOWED_ORIGINS": "http://localhost:3000",
    "API_AUTH_DISABLED": "",
}


def _client(env):
    merged = dict(BASE_ENV)
    merged.update(env)
    with mock.patch.dict(os.environ, merged, clear=False):
        import api

        reloaded = importlib.reload(api)
        reloaded.app.config["TESTING"] = True
        return reloaded.app.test_client()


class TestTokenEnforcement(unittest.TestCase):
    """Business routes require a token; public ones do not."""

    def setUp(self):
        self.client = _client({"API_TOKENS": TOKEN})

    def test_business_route_rejected_without_token(self):
        response = self.client.post("/ask", json={"answers": {}})
        self.assertEqual(response.status_code, 401)

    def test_business_route_accepted_with_bearer(self):
        response = self.client.post(
            "/ask", json={"answers": {}}, headers={"Authorization": f"Bearer {TOKEN}"}
        )
        self.assertNotEqual(response.status_code, 401)

    def test_business_route_accepted_with_x_api_token(self):
        response = self.client.post(
            "/ask", json={"answers": {}}, headers={"X-API-Token": TOKEN}
        )
        self.assertNotEqual(response.status_code, 401)

    def test_wrong_token_rejected(self):
        response = self.client.post(
            "/ask", json={"answers": {}}, headers={"Authorization": "Bearer nope"}
        )
        self.assertEqual(response.status_code, 401)

    def test_error_body_does_not_leak_details(self):
        response = self.client.post("/ask", json={"answers": {}})
        body = response.get_json()
        self.assertEqual(body, {"error": "Unauthorized"})

    def test_admin_route_requires_token(self):
        """Destructive RAG routes must not be reachable anonymously."""
        response = self.client.delete("/api/rag/sources/some-id")
        self.assertEqual(response.status_code, 401)

    def test_synth_generate_requires_token(self):
        """The most expensive route in the system must not be anonymous."""
        response = self.client.post("/api/synth/generate", json={"rows": 10})
        self.assertEqual(response.status_code, 401)


class TestPublicPaths(unittest.TestCase):
    """The allowlist stays reachable so health checks and login keep working."""

    def setUp(self):
        self.client = _client({"API_TOKENS": TOKEN})

    def test_root_health_is_public(self):
        self.assertEqual(self.client.get("/").status_code, 200)

    def test_blueprint_health_is_public(self):
        for feature in ("metrics", "checklist", "accuracy", "gold", "synth", "rag"):
            with self.subTest(feature=feature):
                response = self.client.get(f"/api/{feature}/health")
                self.assertNotEqual(response.status_code, 401)

    def test_auth_validate_is_public(self):
        """The login endpoint cannot itself require a token."""
        response = self.client.post("/api/auth/validate", json={})
        self.assertNotEqual(response.status_code, 401)

    def test_stats_is_public(self):
        """Rendered on the login page before any credential exists."""
        self.assertEqual(self.client.get("/api/stats").status_code, 200)

    def test_cors_preflight_not_blocked(self):
        """Rejecting OPTIONS would break the browser before the real request."""
        response = self.client.options(
            "/ask",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
            },
        )
        self.assertNotEqual(response.status_code, 401)


class TestTokenRotation(unittest.TestCase):
    """Multiple tokens are accepted so they can be rotated without downtime."""

    def test_both_tokens_valid(self):
        client = _client({"API_TOKENS": f"{TOKEN},{OTHER}"})
        for token in (TOKEN, OTHER):
            with self.subTest(token=token):
                response = client.post(
                    "/ask", json={"answers": {}}, headers={"Authorization": f"Bearer {token}"}
                )
                self.assertNotEqual(response.status_code, 401)


class TestFailClosedInProduction(unittest.TestCase):
    """Production must not start unauthenticated by accident."""

    def test_production_without_tokens_refuses_to_start(self):
        with mock.patch.dict(
            os.environ,
            {
                "FLASK_ENV": "production",
                "CORS_ALLOWED_ORIGINS": "https://example.test",
                "API_TOKENS": "",
                "API_AUTH_DISABLED": "",
            },
            clear=False,
        ):
            import api

            with self.assertRaises(RuntimeError):
                importlib.reload(api)

    def test_explicit_opt_out_is_honoured(self):
        """An explicit, greppable opt-out is the only way to run open."""
        client = _client({"API_TOKENS": "", "API_AUTH_DISABLED": "true"})
        response = client.post("/ask", json={"answers": {}})
        self.assertNotEqual(response.status_code, 401)

def tearDownModule():
    """Leave `api` in the unauthenticated state the rest of the suite expects.

    Every helper here reloads the module, which replaces the global `api.app`.
    Without this, whichever state the last test happened to install would leak
    into every test module that runs afterwards.
    """
    with mock.patch.dict(
        os.environ,
        {
            "FLASK_ENV": "development",
            "CORS_ALLOWED_ORIGINS": "http://localhost:3000",
            "API_TOKENS": "",
            "API_AUTH_DISABLED": "true",
        },
        clear=False,
    ):
        import api

        importlib.reload(api)


if __name__ == "__main__":
    unittest.main()


ADMIN_TOKEN = "admin-token-cccccccccccccccccccccc"


class TestAdminOperations(unittest.TestCase):
    """Destructive routes need a separate credential from the public one.

    The ordinary token ships inside the Vercel bundle, so it cannot protect an
    operation that deletes data. Cloudflare Access cannot cover these either:
    it matches on path, and GET /api/rag/sources (used by the frontend) shares
    a path with DELETE /api/rag/sources/<id>.
    """

    def setUp(self):
        self.client = _client({"API_TOKENS": TOKEN, "ADMIN_TOKENS": ADMIN_TOKEN})

    def test_delete_source_rejects_public_token(self):
        response = self.client.delete(
            "/api/rag/sources/doc-1", headers={"Authorization": f"Bearer {TOKEN}"}
        )
        self.assertEqual(response.status_code, 401)

    def test_delete_source_accepts_admin_token(self):
        response = self.client.delete(
            "/api/rag/sources/doc-1", headers={"Authorization": f"Bearer {ADMIN_TOKEN}"}
        )
        self.assertNotEqual(response.status_code, 401)

    def test_ingest_and_reload_reject_public_token(self):
        for path in ("/api/rag/ingest", "/api/rag/reload"):
            with self.subTest(path=path):
                response = self.client.post(
                    path, headers={"Authorization": f"Bearer {TOKEN}"}
                )
                self.assertEqual(response.status_code, 401)

    def test_get_sources_still_works_with_public_token(self):
        """Same path, safe method: the frontend must not be broken by this."""
        response = self.client.get(
            "/api/rag/sources", headers={"Authorization": f"Bearer {TOKEN}"}
        )
        self.assertNotEqual(response.status_code, 401)

    def test_chat_still_works_with_public_token(self):
        response = self.client.post(
            "/api/rag/chat",
            json={"message": "oi"},
            headers={"Authorization": f"Bearer {TOKEN}"},
        )
        self.assertNotEqual(response.status_code, 401)


class TestAdminFailsClosed(unittest.TestCase):
    """With no ADMIN_TOKENS set, destructive routes are simply unreachable."""

    def setUp(self):
        self.client = _client({"API_TOKENS": TOKEN, "ADMIN_TOKENS": ""})

    def test_delete_rejected_even_with_valid_public_token(self):
        response = self.client.delete(
            "/api/rag/sources/doc-1", headers={"Authorization": f"Bearer {TOKEN}"}
        )
        self.assertEqual(response.status_code, 401)

    def test_read_routes_unaffected(self):
        response = self.client.get(
            "/api/rag/sources", headers={"Authorization": f"Bearer {TOKEN}"}
        )
        self.assertNotEqual(response.status_code, 401)


class TestAdminGatedEvenWithoutGeneralAuth(unittest.TestCase):
    """Destructive routes stay closed when general API auth is not configured.

    A deployment that merely lacks API_TOKENS — the state the Render instance
    was found in, where FLASK_ENV is not "production" — must not end up with
    POST /api/rag/reload and DELETE /api/rag/sources/<id> callable by anyone.
    """

    def test_no_tokens_at_all_still_blocks_admin(self):
        client = _client({"API_TOKENS": "", "ADMIN_TOKENS": ""})
        self.assertEqual(client.post("/api/rag/reload").status_code, 401)
        self.assertEqual(client.delete("/api/rag/sources/doc-1").status_code, 401)

    def test_explicit_opt_out_still_blocks_admin(self):
        client = _client({"API_TOKENS": "", "API_AUTH_DISABLED": "true", "ADMIN_TOKENS": ""})
        self.assertEqual(client.post("/api/rag/reload").status_code, 401)
        # Business routes remain open, which is what the opt-out is for.
        self.assertNotEqual(client.post("/ask", json={"answers": {}}).status_code, 401)

    def test_admin_token_still_works_without_general_auth(self):
        client = _client({"API_TOKENS": "", "ADMIN_TOKENS": ADMIN_TOKEN})
        response = client.post(
            "/api/rag/reload", headers={"Authorization": f"Bearer {ADMIN_TOKEN}"}
        )
        self.assertNotEqual(response.status_code, 401)
