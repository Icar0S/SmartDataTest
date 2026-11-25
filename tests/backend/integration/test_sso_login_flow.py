"""Google sign-in end to end, against a provider that speaks the real protocol.

Nothing is mocked between the browser and the provider: discovery, PKCE, the
token endpoint, signed ID tokens and key rotation all happen over HTTP. The
provider can be told to misbehave, which is how the hostile cases are covered.
"""

import base64
import time
from urllib.parse import parse_qs, urlsplit

import pytest
import requests

from auth import oidc
from auth.store import challenge_for
from tests.support.mock_oidc import RunningProvider
from tests.support.sso import FRONTEND, REDIRECT_URI, sso_app, sso_env

VERIFIER = "browser-verifier-" + "v" * 40
CHALLENGE = challenge_for(VERIFIER)


def fragment(response):
    """What the login page receives. Asserts it only ever goes to our frontend."""
    assert response.status_code == 303
    location = response.headers["Location"]
    assert location.startswith(f"{FRONTEND}/login#"), location
    return {k: v[0] for k, v in parse_qs(urlsplit(location).fragment).items()}


class Browser:
    """One browser: a cookie jar for our API, and Google in the middle."""

    def __init__(self, app):
        self.client = app.test_client()

    def start(self, challenge=CHALLENGE, remember=False):
        query = {"challenge": challenge, "remember": "1" if remember else "0"}
        return self.client.get("/api/auth/google/login", query_string=query)

    def google(self, login_response):
        """Follow the redirect to Google and return its callback URL."""
        assert login_response.status_code == 302, login_response.get_data(as_text=True)
        answer = requests.get(
            login_response.headers["Location"], allow_redirects=False, timeout=5
        )
        assert answer.status_code == 302
        return answer.headers["Location"]

    def back(self, callback_url):
        parts = urlsplit(callback_url)
        return self.client.get(f"{parts.path}?{parts.query}")

    def exchange(self, code, verifier=VERIFIER):
        return self.client.post("/api/auth/exchange", json={"code": code, "verifier": verifier})

    def sign_in(self, **start):
        outcome = fragment(self.back(self.google(self.start(**start))))
        assert "code" in outcome, outcome
        return self.exchange(outcome["code"])

    def failure(self):
        """The reason a whole login attempt ends with, instead of a code."""
        outcome = fragment(self.back(self.google(self.start())))
        assert "code" not in outcome
        return outcome["error"]


@pytest.fixture
def provider():
    with RunningProvider() as running:
        yield running


@pytest.fixture
def app(provider, tmp_path):
    with sso_app(sso_env(provider.issuer, tmp_path / "auth.sqlite3")) as flask_app:
        yield flask_app


@pytest.fixture
def store(app):
    return app.extensions["auth_store"]


@pytest.fixture
def browser(app):
    return Browser(app)


class TestSigningIn:
    def test_stranger_signs_in_and_waits_for_approval(self, browser):
        data = browser.sign_in().get_json()
        assert data["status"] == "pending"
        assert data["user"]["email"] == "fulano@gmail.com"
        headers = {"Authorization": f"Bearer {data['token']}"}
        response = browser.client.post("/ask", json={"answers": {}}, headers=headers)
        assert response.status_code == 403

    def test_approval_takes_effect_without_signing_in_again(self, browser, store):
        data = browser.sign_in().get_json()
        store.set_status(data["user"]["id"], "approved", actor="op")
        headers = {"Authorization": f"Bearer {data['token']}"}
        assert browser.client.get("/api/auth/me", headers=headers).get_json()["status"] == "approved"
        response = browser.client.post("/ask", json={"answers": {}}, headers=headers)
        assert response.status_code == 200

    def test_invited_person_goes_straight_in(self, browser, store):
        store.add_invites(["fulano@gmail.com"], actor="op")
        assert browser.sign_in().get_json()["status"] == "approved"

    def test_invite_for_a_mailbox_google_does_not_run_waits(self, browser, store, provider):
        provider.identity["email"] = "fulano@yahoo.com"
        store.add_invites(["fulano@yahoo.com"], actor="op")
        assert browser.sign_in().get_json()["status"] == "pending"

    def test_returning_person_keeps_the_same_account(self, browser, provider):
        first = browser.sign_in().get_json()["user"]["id"]
        provider.identity["email"] = "novo.endereco@gmail.com"
        assert browser.sign_in().get_json()["user"]["id"] == first

    @pytest.mark.parametrize("remember,seconds", [(False, 8 * 3600), (True, 7 * 24 * 3600)])
    def test_remember_me_sets_how_long_the_session_lasts(self, browser, remember, seconds):
        expires_at = browser.sign_in(remember=remember).get_json()["expires_at"]
        assert abs(expires_at - time.time() - seconds) < 30

    def test_signing_in_twice_at_once_from_two_browsers(self, app):
        one, two = Browser(app), Browser(app)
        callback_one, callback_two = one.google(one.start()), two.google(two.start())
        assert "code" in fragment(two.back(callback_two))
        assert "code" in fragment(one.back(callback_one))


class TestWhatGoesToGoogle:
    @pytest.fixture
    def query(self, browser):
        location = browser.start().headers["Location"]
        return {k: v[0] for k, v in parse_qs(urlsplit(location).query).items()}

    def test_asks_only_for_identity(self, query):
        assert set(query["scope"].split()) == {"openid", "email", "profile"}

    def test_uses_pkce_state_and_nonce(self, query):
        assert query["code_challenge_method"] == "S256" and query["code_challenge"]
        assert len(query["state"]) >= 32 and query["nonce"]

    def test_the_secret_and_the_browser_challenge_stay_home(self, query):
        assert "client_secret" not in query
        assert CHALLENGE not in query.values()

    def test_lets_the_person_choose_the_account(self, query):
        assert query["prompt"] == "select_account"

    def test_pkce_verifier_reaches_the_token_endpoint(self, browser, provider):
        browser.sign_in()
        assert len(provider.token_requests[0]["code_verifier"]) >= 43

    def test_return_address_ignores_the_host_header(self, app):
        response = app.test_client().get(
            "/api/auth/google/login",
            query_string={"challenge": CHALLENGE},
            headers={"Host": "evil.example", "X-Forwarded-Host": "evil.example"},
        )
        query = parse_qs(urlsplit(response.headers["Location"]).query)
        assert query["redirect_uri"] == [REDIRECT_URI]


class TestForgedReturns:
    def test_wrong_state(self, browser):
        callback = browser.google(browser.start())
        assert fragment(browser.back(callback.replace("state=", "state=x")))["error"] == "failed"

    def test_state_that_is_not_even_text_we_would_send(self, browser):
        browser.start()
        response = browser.client.get("/api/auth/google/callback?code=abc&state=caf%C3%A9")
        assert fragment(response)["error"] == "failed"

    def test_missing_state(self, browser):
        browser.start()
        response = browser.client.get("/api/auth/google/callback?code=abc")
        assert fragment(response)["error"] == "failed"

    def test_callback_out_of_nowhere(self, browser):
        response = browser.client.get("/api/auth/google/callback?code=a&state=b")
        assert fragment(response)["error"] == "failed"

    def test_callback_opened_in_another_browser(self, app):
        """Login CSRF: a link prepared by someone else."""
        attacker, victim = Browser(app), Browser(app)
        callback = attacker.google(attacker.start())
        assert fragment(victim.back(callback))["error"] == "failed"

    def test_callback_replayed(self, browser):
        callback = browser.google(browser.start())
        assert "code" in fragment(browser.back(callback))
        assert fragment(browser.back(callback))["error"] == "failed"

    def test_tampered_cookie(self, browser, app):
        callback = browser.google(browser.start())
        forged = app.test_client()
        forged.set_cookie("sdt_login", "eyJsb2dpbiI6e319.x.y", path="/api/auth/google")
        parts = urlsplit(callback)
        response = forged.get(f"{parts.path}?{parts.query}")
        assert fragment(response)["error"] == "failed"

    def test_a_victim_led_through_an_attackers_challenge(self, app):
        """The victim signs in for real, but the code answers to a verifier
        only the attacker has — and only the victim's browser gets the code."""
        victim = Browser(app)
        code = fragment(victim.back(victim.google(victim.start())))["code"]
        assert victim.exchange(code, "victims-own-verifier-" + "z" * 40).status_code == 400


class TestRejectedIdentities:
    @pytest.mark.parametrize(
        "overrides",
        [
            # The case Authlib alone lets through: it compares azp, not aud.
            {"aud": "another-client"},
            {"aud": "another-client", "azp": "another-client"},
            {"aud": ["another-client"], "azp": None},
            {"iss": "https://evil.example"},
            {"nonce": "another-login"},
            {"nonce": None},
            {"exp": 1_000_000_000},
            {"sub": None},
            {"email": None},
        ],
        ids=["aud", "aud-and-azp", "aud-list", "iss", "nonce", "no-nonce", "expired", "no-sub", "no-email"],
    )
    def test_id_token_that_does_not_add_up(self, browser, provider, store, overrides):
        provider.claim_overrides = overrides
        assert browser.failure() == "failed"
        assert store.list_users() == []

    def test_signature_from_a_key_the_provider_does_not_publish(self, browser, provider, store):
        provider.sign_with_unknown_key = True
        assert browser.failure() == "failed"
        assert store.list_users() == []

    def test_unsigned_token(self, browser, provider, store, monkeypatch):
        def unsigned(query):
            def part(obj):
                import json

                return base64.urlsafe_b64encode(json.dumps(obj).encode()).rstrip(b"=").decode()

            claims = {"iss": provider.issuer, "aud": "dev", "iat": int(time.time()),
                      "exp": int(time.time()) + 600, "nonce": query["nonce"], **provider.identity}
            return f"{part({'alg': 'none'})}.{part(claims)}."

        monkeypatch.setattr(provider, "id_token", unsigned)
        assert browser.failure() == "failed"
        assert store.list_users() == []

    def test_no_id_token_at_all(self, browser, provider, store):
        provider.omit_id_token = True
        assert browser.failure() == "failed"
        assert store.list_users() == []

    @pytest.mark.parametrize("value", [False, "false", None])
    def test_unverified_email(self, browser, provider, store, value):
        provider.identity["email_verified"] = value
        assert browser.failure() == "email_unverified"
        assert store.list_users() == []

    def test_blocked_person_gets_no_code(self, browser, store):
        user = browser.sign_in().get_json()["user"]
        store.set_status(user["id"], "blocked", actor="op")
        assert browser.failure() == "blocked"


class TestProviderTrouble:
    def test_person_gives_up_at_google(self, browser):
        state = parse_qs(urlsplit(browser.start().headers["Location"]).query)["state"][0]
        response = browser.client.get(
            f"/api/auth/google/callback?error=access_denied&state={state}"
        )
        assert fragment(response)["error"] == "cancelled"

    def test_other_provider_error(self, browser):
        state = parse_qs(urlsplit(browser.start().headers["Location"]).query)["state"][0]
        response = browser.client.get(f"/api/auth/google/callback?error=server_error&state={state}")
        assert fragment(response)["error"] == "failed"

    def test_keys_rotated_between_two_logins(self, browser, provider):
        """Google rotates its keys every few days; nobody should notice."""
        assert browser.sign_in().status_code == 200
        provider.rotate_key()
        assert browser.sign_in().status_code == 200

    def test_wrong_client_secret(self, browser, provider):
        provider.client_secret = "rotated-on-the-other-side"
        assert browser.failure() == "failed"

    def test_provider_unreachable_when_starting(self, tmp_path):
        env = sso_env("http://localhost:9", tmp_path / "auth.sqlite3")
        with sso_app(env) as app:
            assert fragment(Browser(app).start())["error"] == "unavailable"

    def test_provider_that_never_answers_does_not_hold_the_worker(
        self, provider, tmp_path, monkeypatch
    ):
        monkeypatch.setattr(oidc, "_HTTP_TIMEOUT", 0.3)
        provider.hang_seconds = 3
        with sso_app(sso_env(provider.issuer, tmp_path / "auth.sqlite3")) as app:
            started = time.monotonic()
            assert fragment(Browser(app).start())["error"] == "unavailable"
            assert time.monotonic() - started < 2

    def test_provider_dies_between_the_two_halves(self, tmp_path):
        with RunningProvider() as provider:
            with sso_app(sso_env(provider.issuer, tmp_path / "auth.sqlite3")) as app:
                browser = Browser(app)
                callback = browser.google(browser.start())
                provider.hang_seconds = 0
                provider.codes.clear()
                assert fragment(browser.back(callback))["error"] == "failed"


class TestTheOneTimeCode:
    @pytest.fixture
    def code(self, browser):
        return fragment(browser.back(browser.google(browser.start())))["code"]

    def test_works_once(self, browser, code):
        assert browser.exchange(code).status_code == 200
        response = browser.exchange(code)
        assert response.status_code == 400
        assert response.get_json()["error"] == "invalid_code"

    def test_needs_the_verifier(self, browser, code):
        assert browser.exchange(code, "w" * 43).status_code == 400

    @pytest.mark.parametrize(
        "body",
        [
            None,
            [],
            "x",
            {},
            {"code": "a"},
            {"verifier": VERIFIER},
            {"code": 1, "verifier": VERIFIER},
            {"code": "a", "verifier": None},
            {"code": "", "verifier": VERIFIER},
            {"code": "\ud800", "verifier": VERIFIER},
            {"code": "x" * 100_000, "verifier": VERIFIER},
            {"code": "a", "verifier": "short"},
            {"code": "a", "verifier": "v" * 129},
            {"code": "a", "verifier": "'; DROP TABLE users; --" + "v" * 30},
        ],
    )
    def test_malformed_requests(self, browser, body):
        assert browser.client.post("/api/auth/exchange", json=body).status_code == 400

    def test_guessing_is_rate_limited(self, browser):
        statuses = {browser.exchange(f"guess-{i}").status_code for i in range(25)}
        assert 429 in statuses


class TestStartingALogin:
    @pytest.mark.parametrize(
        "challenge", ["", "short", "x" * 42, "x" * 44, "x" * 42 + "=", "x" * 42 + "\n", "../" * 14 + "x"]
    )
    def test_invalid_challenge(self, browser, challenge):
        assert browser.start(challenge=challenge).status_code == 400

    def test_abandoned_attempts_do_not_break_the_next_one(self, browser):
        """Each attempt used to pile up in the cookie; past 4 KB browsers drop
        it and every login after that fails."""
        for _ in range(15):
            response = browser.start()
            cookie = response.headers["Set-Cookie"]
            assert len(cookie) < 2000
        assert browser.sign_in().status_code == 200

    def test_cookie_is_gone_after_the_callback(self, browser):
        response = browser.back(browser.google(browser.start()))
        assert "sdt_login=;" in response.headers["Set-Cookie"]

    def test_parameters_cannot_redirect_elsewhere(self, app):
        browser = Browser(app)
        response = browser.client.get(
            "/api/auth/google/login",
            query_string={"challenge": CHALLENGE, "next": "https://evil.example",
                          "redirect_uri": "https://evil.example", "state": "chosen-by-attacker"},
        )
        query = parse_qs(urlsplit(response.headers["Location"]).query)
        assert query["redirect_uri"] == [REDIRECT_URI]
        assert query["state"] != ["chosen-by-attacker"]
        assert "code" in fragment(browser.back(browser.google(response)))


class TestCrossOrigin:
    def test_the_frontend_may_finish_the_login(self, browser):
        code = fragment(browser.back(browser.google(browser.start())))["code"]
        response = browser.client.post(
            "/api/auth/exchange",
            json={"code": code, "verifier": VERIFIER},
            headers={"Origin": FRONTEND},
        )
        assert response.headers["Access-Control-Allow-Origin"] == FRONTEND

    def test_another_site_may_not_read_the_answer(self, browser):
        code = fragment(browser.back(browser.google(browser.start())))["code"]
        response = browser.client.post(
            "/api/auth/exchange",
            json={"code": code, "verifier": VERIFIER},
            headers={"Origin": "https://evil.example"},
        )
        assert "Access-Control-Allow-Origin" not in response.headers

    def test_no_cookie_authenticates_anything(self, browser, store):
        """Which is why there is no CSRF to defend against."""
        data = browser.sign_in().get_json()
        store.set_status(data["user"]["id"], "approved", actor="op")
        browser.client.set_cookie("sdt_session", data["token"])
        browser.client.set_cookie("sdt_login", data["token"])
        assert browser.client.post("/ask", json={"answers": {}}).status_code == 401
