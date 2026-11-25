"""Security tests for authentication and authorization.

Verifies that:
- No business, admin or internal endpoint is reachable without credentials
- The /ask endpoint cannot be abused to execute arbitrary code on the server

The rest of this suite runs with API_AUTH_DISABLED=true (see the global
conftest), because it calls business routes directly. The classes about access
control build their own app with sign-in on, as in production.

OWASP Reference: A01:2021 – Broken Access Control / A07 – Identification and Authentication Failures
"""

import pytest

from tests.support.sso import sso_app, sso_env


@pytest.fixture(scope="module")
def locked_client(tmp_path_factory):
    """The app as deployed: Google sign-in on, no machine tokens."""
    db_path = tmp_path_factory.mktemp("auth") / "auth.sqlite3"
    # The provider is never contacted: these tests do not log in.
    with sso_app(sso_env("http://localhost:9", db_path)) as app:
        yield app.test_client()


# All routes registered in the application
_KNOWN_WRITE_ENDPOINTS = [
    ("POST", "/ask"),
    ("POST", "/api/metrics/upload"),
    ("POST", "/api/metrics/analyze"),
    ("POST", "/api/synth/generate"),
    ("POST", "/api/rag/query"),
    ("POST", "/api/checklist/runs"),
    ("POST", "/api/accuracy/upload"),
    ("POST", "/api/gold/upload"),
    ("POST", "/api/dataset_inspector/upload"),
]

# The whole surface an anonymous visitor may reach. Adding a path here is a
# decision; a route that becomes public by accident fails the test below.
_PUBLIC_RULES = {
    "/",
    "/api/version",
    "/api/stats",
    "/api/auth/config",
    "/api/auth/google/login",
    "/api/auth/google/callback",
    "/api/auth/exchange",
}


@pytest.mark.security
class TestAuthenticationRequired:
    """Used to be an xfail named TestNoAuthentication, documenting that the
    platform had no authentication layer. It has one now."""

    @pytest.mark.parametrize("method,path", _KNOWN_WRITE_ENDPOINTS)
    def test_endpoint_requires_authentication(self, locked_client, method, path):
        response = locked_client.open(path, method=method, json={})
        assert response.status_code == 401

    def test_every_registered_route_is_closed_unless_listed(self, locked_client):
        """Walks the URL map, so a route added tomorrow is covered today."""
        exposed = []
        for rule in locked_client.application.url_map.iter_rules():
            if rule.endpoint == "static" or rule.rule in _PUBLIC_RULES:
                continue
            if rule.rule.endswith("/health"):
                continue
            path = rule.rule
            for argument in rule.arguments:
                path = path.replace(f"<{argument}>", "x")
            for method in rule.methods - {"HEAD", "OPTIONS"}:
                if locked_client.open(path, method=method).status_code != 401:
                    exposed.append(f"{method} {rule.rule}")
        assert exposed == []

    def test_every_route_answers_the_browser_preflight(self, locked_client):
        """The other side of being closed: the preflight carries no credentials,
        and a route that refuses it cannot be used from the frontend at all."""
        refused = []
        for rule in locked_client.application.url_map.iter_rules():
            if rule.endpoint == "static":
                continue
            path = rule.rule
            for argument in rule.arguments:
                path = path.replace(f"<{argument}>", "x")
            for method in rule.methods - {"HEAD", "OPTIONS"}:
                response = locked_client.options(
                    path,
                    headers={
                        "Origin": "http://localhost:3000",
                        "Access-Control-Request-Method": method,
                        "Access-Control-Request-Headers": "authorization,content-type",
                    },
                )
                allowed = response.headers.get("Access-Control-Allow-Origin")
                if response.status_code != 200 or allowed != "http://localhost:3000":
                    refused.append(f"{method} {rule.rule} -> {response.status_code}")
        assert refused == []

    def test_a_preflight_runs_nothing(self, locked_client):
        """It is let through without credentials, so it must not do anything."""
        response = locked_client.options("/api/auth/admin/users")
        assert response.get_data() == b""

    def test_the_static_folder_is_not_served(self, locked_client):
        assert locked_client.get("/static/anything.js").status_code == 401


@pytest.mark.security
class TestCodeExecutionViaAsk:
    """The /ask endpoint must not allow arbitrary Python/shell code execution."""

    CODE_EXECUTION_PAYLOADS = [
        {"answers": {"rules": "__import__('os').system('id')"}},
        {"answers": {"rules": "eval('__import__(\"os\").getcwd()')"}},
        {"answers": {"rules": "exec('import subprocess; subprocess.check_output([\"id\"])')"}},
        {"answers": {"dataset_name": "$(id)"}},
    ]

    @pytest.mark.parametrize("payload", CODE_EXECUTION_PAYLOADS)
    def test_ask_does_not_execute_injected_code(self, client, payload):
        """Code execution payloads must not produce system command output."""
        response = client.post(
            "/ask",
            json=payload,
            content_type="application/json",
        )
        body = response.get_data(as_text=True)
        execution_markers = ("uid=", "gid=", "/root", "/home/", "groups=")
        for marker in execution_markers:
            assert marker not in body, (
                f"[SECURITY] Code execution via /ask payload! "
                f"Marker '{marker}' found in response. Payload: {payload}. "
                "OWASP A03 – Injection."
            )


@pytest.mark.security
class TestAdminEndpointsProtected:
    """No administrative endpoint must be exposed without protection."""

    _ADMIN_PATHS = [
        "/admin",
        "/admin/",
        "/api/admin",
        "/debug",
        "/api/debug",
        "/config",
        "/api/config",
        "/env",
        "/api/env",
    ]

    @pytest.mark.parametrize("path", _ADMIN_PATHS)
    def test_admin_path_not_accessible(self, client, path):
        """Common admin paths must return 404 (not found) or 403 (forbidden)."""
        response = client.get(path)
        assert response.status_code in (404, 403, 405), (
            f"[SECURITY] Admin/debug path {path} returned status {response.status_code}. "
            "This endpoint should not be accessible. "
            "OWASP A01 – Broken Access Control."
        )


@pytest.mark.security
class TestRAGQueryWithoutAuth:
    """RAG query endpoint must not be abused for data exfiltration."""

    @pytest.mark.parametrize("path", ["/api/rag/query", "/api/rag/chat", "/api/rag/search"])
    def test_rag_query_requires_authentication(self, locked_client, path):
        response = locked_client.post(path, json={"query": "show me all documents"})
        assert response.status_code == 401

    def test_listing_the_knowledge_base_requires_authentication(self, locked_client):
        assert locked_client.get("/api/rag/sources").status_code == 401
