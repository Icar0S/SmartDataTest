"""The request gate with SSO on: who reaches what.

Sessions are created directly in the store here; how a person obtains one is
covered end to end in tests/backend/integration/test_sso_login_flow.py.
"""

import pytest

from tests.support.sso import sso_app, sso_env

MACHINE = "machine-token-aaaaaaaaaaaaaaaaaaaa"
ADMIN_TOKEN = "admin-token-bbbbbbbbbbbbbbbbbbbbbb"
# Never contacted: nothing in this file starts a login.
ISSUER = "http://localhost:9"


class Harness:
    def __init__(self, app):
        self.app = app
        self.client = app.test_client()
        self.store = app.extensions["auth_store"]

    def user(self, sub="s1", email="fulano@gmail.com", status="approved", admin=False):
        user = self.store.record_google_login(
            {"sub": sub, "email": email, "name": "Fulano", "email_verified": True}
        )
        if admin:
            return self.store.set_admin(user["id"], True, actor="test")
        return self.store.set_status(user["id"], status, actor="test")

    def login(self, user, seconds=3600):
        token, _ = self.store.create_session(user["id"], seconds, origin="test")
        return {"Authorization": f"Bearer {token}"}

    def ask(self, headers=None):
        return self.client.post("/ask", json={"answers": {}}, headers=headers)


@pytest.fixture
def make(tmp_path):
    contexts = []

    def build(**env):
        context = sso_app(sso_env(ISSUER, tmp_path / "auth.sqlite3", **env))
        app = context.__enter__()
        contexts.append(context)
        return Harness(app)

    yield build
    for context in contexts:
        context.__exit__(None, None, None)


class TestBusinessRoutes:
    def test_anonymous_is_refused_even_without_api_tokens(self, make):
        """SSO alone closes the API; it does not need a machine token to exist."""
        response = make().ask()
        assert response.status_code == 401
        assert response.get_json() == {"error": "Unauthorized"}

    def test_approved_person_gets_in(self, make):
        h = make()
        assert h.ask(h.login(h.user())).status_code == 200

    def test_pending_person_is_told_so(self, make):
        h = make()
        response = h.ask(h.login(h.user(status="pending")))
        assert response.status_code == 403
        assert response.get_json() == {"error": "access_pending"}

    def test_block_takes_effect_on_the_next_request(self, make):
        h = make()
        user = h.user()
        headers = h.login(user)
        assert h.ask(headers).status_code == 200
        h.store.set_status(user["id"], "blocked", actor="op")
        assert h.ask(headers).status_code == 401

    def test_expired_session_is_refused(self, make):
        h = make()
        assert h.ask(h.login(h.user(), seconds=-1)).status_code == 401

    def test_forged_session_is_refused(self, make):
        assert make().ask({"Authorization": "Bearer sdt_" + "x" * 43}).status_code == 401

    @pytest.mark.parametrize(
        "method,path",
        [
            ("DELETE", "/api/rag/sources/health"),
            ("GET", "/api/checklist/runs/health"),
            ("PUT", "/api/checklist/runs/health"),
            ("GET", "/api/gold/download/x/health"),
            ("GET", "/anything/at/all/health"),
        ],
    )
    def test_an_identifier_called_health_opens_nothing(self, make, method, path):
        """Health probes used to be recognised by the end of the path."""
        assert make().client.open(path, method=method).status_code == 401

    @pytest.mark.parametrize("header", ["Bearer caf\xe9", "Bearer \xff\xfe", "Bearer sdt_\xe9"])
    def test_stray_bytes_in_the_header_are_a_wrong_token(self, make, header):
        h = make(API_TOKENS=MACHINE, ADMIN_TOKENS=ADMIN_TOKEN)
        assert h.ask({"Authorization": header}).status_code == 401
        response = h.client.post("/api/rag/reload", headers={"Authorization": header})
        assert response.status_code == 401

    def test_unknown_path_does_not_reveal_whether_it_exists(self, make):
        """The deploy health check relies on this 401."""
        assert make().client.get("/healthz").status_code == 401

    def test_preflight_still_passes(self, make):
        response = make().client.options(
            "/ask",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization,content-type",
            },
        )
        assert response.status_code == 200
        assert "authorization" in response.headers["Access-Control-Allow-Headers"].lower()


class TestMachineTokens:
    def test_still_open_business_routes(self, make):
        """Scripts, and the previous frontend until it is replaced."""
        h = make(API_TOKENS=MACHINE)
        assert h.ask({"Authorization": f"Bearer {MACHINE}"}).status_code == 200

    def test_stop_working_once_dropped_from_the_list(self, make):
        """How the token that was published in the old bundle is retired."""
        h = make(API_TOKENS="another-token-cccccccccccccccccc")
        assert h.ask({"Authorization": f"Bearer {MACHINE}"}).status_code == 401

    @pytest.mark.parametrize("path", ["/api/auth/me", "/api/auth/admin/users"])
    def test_do_not_open_personal_or_admin_routes(self, make, path):
        h = make(API_TOKENS=MACHINE, ADMIN_TOKENS=ADMIN_TOKEN)
        for token in (MACHINE, ADMIN_TOKEN):
            response = h.client.get(path, headers={"Authorization": f"Bearer {token}"})
            assert response.status_code == 401


class TestDestructiveOperations:
    """Being allowed to use the platform is not being allowed to empty it."""

    @pytest.mark.parametrize("admin", [False, True])
    def test_a_session_is_not_enough(self, make, admin):
        h = make(ADMIN_TOKENS=ADMIN_TOKEN)
        headers = h.login(h.user(admin=admin))
        assert h.client.delete("/api/rag/sources/doc-1", headers=headers).status_code == 401

    def test_admin_token_still_works(self, make):
        h = make(ADMIN_TOKENS=ADMIN_TOKEN)
        response = h.client.post(
            "/api/rag/reload", headers={"Authorization": f"Bearer {ADMIN_TOKEN}"}
        )
        assert response.status_code != 401


class TestAdminPanel:
    PATHS = [
        ("GET", "/api/auth/admin/users"),
        ("POST", "/api/auth/admin/users/usr_x/status"),
        ("POST", "/api/auth/admin/invites"),
        ("POST", "/api/auth/admin/invites/revoke"),
        ("GET", "/api/auth/admin"),
        ("GET", "/api/auth/admin/anything-new"),
    ]

    @pytest.mark.parametrize("method,path", PATHS)
    def test_anonymous_is_refused(self, make, method, path):
        assert make().client.open(path, method=method).status_code == 401

    @pytest.mark.parametrize("method,path", PATHS)
    def test_does_not_exist_for_an_ordinary_user(self, make, method, path):
        h = make()
        response = h.client.open(path, method=method, headers=h.login(h.user()))
        assert response.status_code == 404

    @pytest.mark.parametrize(
        "path",
        [
            "/api//auth/admin/users",
            "//api/auth/admin/users",
            "/api/auth//admin/users",
            "/api/auth/./admin/users",
            "/api/auth/admin%2Fusers",
            "/api/auth/x/../admin/users",
            "/API/auth/admin/users",
        ],
    )
    def test_other_spellings_of_the_path_do_not_lead_there(self, make, path):
        h = make()
        headers = h.login(h.user())
        response = h.client.get(path, headers=headers, follow_redirects=True)
        assert response.status_code in (401, 404)

    def test_the_panel_has_a_second_lock(self, make):
        """Even if the gate let someone through."""
        h = make()
        h.app.before_request_funcs[None] = [
            f for f in h.app.before_request_funcs[None] if f.__name__ != "_require_credentials"
        ]
        assert h.client.get("/api/auth/admin/users").status_code == 404

    def test_suspended_admin_loses_the_panel(self, make):
        h = make()
        admin = h.user(admin=True)
        headers = h.login(admin)
        assert h.client.get("/api/auth/admin/users", headers=headers).status_code == 200
        h.store.set_status(admin["id"], "pending", "cli", allow_admin=True)
        assert h.client.get("/api/auth/admin/users", headers=headers).status_code == 404

    @pytest.mark.parametrize("path", ["/api/auth/me", "/api/auth/admin/users"])
    def test_api_auth_disabled_does_not_open_it(self, make, path):
        """"No authentication" must not turn into "anyone is the administrator"."""
        h = make(API_AUTH_DISABLED="true")
        assert h.ask().status_code == 200
        assert h.client.get(path).status_code == 401

    def test_no_route_grants_administration(self, make):
        """Every rule under /api/auth, called by an admin with every body that
        could plausibly mean "promote", leaves the target an ordinary user."""
        h = make()
        headers = h.login(h.user(sub="adm", email="adm@gmail.com", admin=True))
        target = h.user()
        body = {"is_admin": True, "admin": 1, "role": "admin", "status": "approved",
                "emails": [target["email"]], "email": target["email"], "id": target["id"]}
        for rule in h.app.url_map.iter_rules():
            if not rule.rule.startswith("/api/auth") or "google" in rule.rule:
                continue
            if rule.rule == "/api/auth/logout":
                continue
            path = rule.rule.replace("<user_id>", target["id"])
            for method in rule.methods - {"HEAD", "OPTIONS"}:
                h.client.open(path, method=method, json=body, headers=headers)
        assert not h.store.get_user(target["id"])["is_admin"]


class TestAdminActions:
    @pytest.fixture
    def admin(self, make):
        h = make()
        h.headers = h.login(h.user(sub="adm", email="adm@gmail.com", admin=True))
        return h

    def post(self, h, path, body):
        return h.client.post(f"/api/auth/admin{path}", json=body, headers=h.headers)

    def test_lists_users_invites_and_audit(self, admin):
        admin.user(status="pending")
        admin.store.add_invites(["novo@gmail.com"], actor="op")
        data = admin.client.get("/api/auth/admin/users", headers=admin.headers).get_json()
        assert {u["email"] for u in data["users"]} == {"adm@gmail.com", "fulano@gmail.com"}
        assert [i["email"] for i in data["invites"]] == ["novo@gmail.com"]
        assert data["audit"]

    def test_never_exposes_the_google_identifier(self, admin):
        admin.user(sub="very-secret-sub")
        body = admin.client.get("/api/auth/admin/users", headers=admin.headers).get_data(True)
        assert "very-secret-sub" not in body and "google_sub" not in body

    def test_approve(self, admin):
        user = admin.user(status="pending")
        response = self.post(admin, f"/users/{user['id']}/status", {"status": "approved"})
        assert response.get_json()["user"]["status"] == "approved"
        assert admin.store.recent_audit(1)[0]["actor"].startswith("usr_")

    def test_block_ends_sessions(self, admin):
        user = admin.user()
        theirs = admin.login(user)
        self.post(admin, f"/users/{user['id']}/status", {"status": "blocked"})
        assert admin.ask(theirs).status_code == 401

    @pytest.mark.parametrize("body", [{}, {"status": "admin"}, {"status": None}, [], "x"])
    def test_invalid_status(self, admin, body):
        user = admin.user()
        assert self.post(admin, f"/users/{user['id']}/status", body).status_code == 400

    def test_unknown_user(self, admin):
        assert self.post(admin, "/users/usr_nope/status", {"status": "blocked"}).status_code == 404

    def test_cannot_block_an_administrator(self, admin):
        """Including oneself."""
        me = admin.client.get("/api/auth/me", headers=admin.headers).get_json()["user"]["id"]
        response = self.post(admin, f"/users/{me}/status", {"status": "blocked"})
        assert response.status_code == 409

    def test_invite_then_first_login_is_approved(self, admin):
        response = self.post(admin, "/invites", {"emails": ["novo@gmail.com"]})
        assert response.get_json() == {"invited": 1, "approved_now": 0}
        user = admin.store.record_google_login(
            {"sub": "n", "email": "novo@gmail.com", "email_verified": True}
        )
        assert user["status"] == "approved"

    def test_invite_reports_who_was_released_now(self, admin):
        admin.user(status="pending")
        response = self.post(admin, "/invites", {"emails": ["fulano@gmail.com"]})
        assert response.get_json()["approved_now"] == 1

    @pytest.mark.parametrize(
        "emails",
        [None, [], "a@b.co", ["not-an-email"], ["a@b.co", 3], ["a@b.co"] * 51, ["\ud800@b.co"]],
    )
    def test_invalid_invites_are_refused_whole(self, admin, emails):
        assert self.post(admin, "/invites", {"emails": emails}).status_code == 400
        assert admin.store.open_invites() == []

    def test_revoke_invite(self, admin):
        self.post(admin, "/invites", {"emails": ["novo@gmail.com"]})
        assert self.post(admin, "/invites/revoke", {"email": "novo@gmail.com"}).status_code == 204
        assert self.post(admin, "/invites/revoke", {"email": "novo@gmail.com"}).status_code == 404
        assert self.post(admin, "/invites/revoke", {"email": "x"}).status_code == 400


class TestPersonalRoutes:
    def test_me(self, make):
        h = make()
        data = h.client.get("/api/auth/me", headers=h.login(h.user())).get_json()
        assert data["status"] == "approved" and data["expires_at"] > 0
        assert data["user"]["email"] == "fulano@gmail.com"
        assert data["user"]["avatar"] == "FU"
        assert "google_sub" not in data["user"]

    def test_pending_me_carries_the_operator_contact(self, make):
        h = make(AUTH_CONTACT="fale com o operador")
        data = h.client.get("/api/auth/me", headers=h.login(h.user(status="pending"))).get_json()
        assert data["status"] == "pending" and data["contact"] == "fale com o operador"

    def test_logout_ends_the_session(self, make):
        h = make()
        headers = h.login(h.user())
        assert h.client.post("/api/auth/logout", headers=headers).status_code == 204
        assert h.client.get("/api/auth/me", headers=headers).status_code == 401

    def test_profile_is_remembered_across_sessions(self, make):
        h = make()
        user = h.user()
        h.client.post("/api/auth/profile", json={"role": " tester "}, headers=h.login(user))
        data = h.client.get("/api/auth/me", headers=h.login(user)).get_json()
        assert data["user"]["profile"] == "tester"

    @pytest.mark.parametrize("role", [None, "", "   ", "x" * 81, 7, "a\x00b", "\ud800"])
    def test_invalid_profile(self, make, role):
        h = make()
        headers = h.login(h.user())
        response = h.client.post("/api/auth/profile", json={"role": role}, headers=headers)
        assert response.status_code == 400

    def test_pending_person_cannot_set_a_profile(self, make):
        h = make()
        headers = h.login(h.user(status="pending"))
        response = h.client.post("/api/auth/profile", json={"role": "tester"}, headers=headers)
        assert response.status_code == 403

    def test_auth_responses_are_never_cached(self, make):
        h = make()
        headers = h.login(h.user())
        for path in ("/api/auth/config", "/api/auth/me"):
            assert h.client.get(path, headers=headers).headers["Cache-Control"] == "no-store"


class TestPublicRoutes:
    def test_config_says_sso_is_on(self, make):
        assert make().client.get("/api/auth/config").get_json()["sso"] is True

    def test_version_is_public(self, make, monkeypatch):
        monkeypatch.setenv("APP_VERSION", "9.9.9")
        monkeypatch.setenv("APP_COMMIT", "abc1234")
        data = make().client.get("/api/version").get_json()
        assert data == {"version": "9.9.9", "commit": "abc1234"}

    def test_password_login_is_gone(self, make):
        response = make().client.post("/api/auth/validate", json={"email": "a", "password": "b"})
        assert response.status_code == 401


class TestWithoutSSO:
    """Development, CI, and any deployment that has not configured Google yet."""

    @pytest.fixture
    def bare(self, make):
        return make(GOOGLE_CLIENT_ID="", GOOGLE_CLIENT_SECRET="", SESSION_SECRET="",
                    API_TOKENS=MACHINE)

    def test_machine_tokens_keep_working(self, bare):
        assert bare.ask().status_code == 401
        assert bare.ask({"Authorization": f"Bearer {MACHINE}"}).status_code == 200

    def test_config_says_sso_is_off(self, bare):
        assert bare.client.get("/api/auth/config").get_json()["sso"] is False

    @pytest.mark.parametrize(
        "method,path",
        [
            ("GET", "/api/auth/google/login"),
            ("GET", "/api/auth/google/callback"),
            ("POST", "/api/auth/exchange"),
        ],
    )
    def test_login_answers_503(self, bare, method, path):
        response = bare.client.open(path, method=method)
        assert response.status_code == 503
        assert response.get_json()["error"] == "sso_not_configured"

    @pytest.mark.parametrize("path", ["/api/auth/me", "/api/auth/admin/users"])
    def test_personal_routes_stay_closed(self, bare, path):
        headers = {"Authorization": f"Bearer {MACHINE}"}
        assert bare.client.get(path, headers=headers).status_code == 401


class TestProductionStartup:
    PROD = {"FLASK_ENV": "production", "CORS_ALLOWED_ORIGINS": "https://app.example",
            "FRONTEND_URL": "https://app.example",
            "OIDC_REDIRECT_URI": "https://api.example/api/auth/google/callback",
            "OIDC_DISCOVERY_URL": "https://accounts.google.com/.well-known/openid-configuration"}

    def test_sso_alone_is_enough(self, make):
        """API_TOKENS may be left empty once people log in as themselves."""
        assert make(**self.PROD).ask().status_code == 401

    def test_login_cookie_is_locked_down(self, make):
        config = make(**self.PROD).app.config
        assert config["SESSION_COOKIE_SECURE"] and config["SESSION_COOKIE_HTTPONLY"]
        assert config["SESSION_COOKIE_SAMESITE"] == "Lax"
        assert config["SESSION_COOKIE_PATH"] == "/api/auth/google"

    def test_neither_sso_nor_tokens_refuses_to_start(self, make):
        with pytest.raises(RuntimeError, match="Neither SSO nor API_TOKENS"):
            make(**self.PROD, GOOGLE_CLIENT_ID="", GOOGLE_CLIENT_SECRET="", SESSION_SECRET="")


class TestChecklistIdentity:
    def test_run_belongs_to_whoever_is_logged_in(self, make):
        """Not to whatever name the client sends."""
        h = make()
        response = h.client.post(
            "/api/checklist/runs", json={"user_id": "someone-else"}, headers=h.login(h.user())
        )
        assert response.get_json()["user_id"] == "fulano@gmail.com"

    def test_machine_clients_still_name_themselves(self, make):
        h = make(API_TOKENS=MACHINE)
        response = h.client.post(
            "/api/checklist/runs",
            json={"user_id": "script-x"},
            headers={"Authorization": f"Bearer {MACHINE}"},
        )
        assert response.get_json()["user_id"] == "script-x"
