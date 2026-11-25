"""SSO settings: which combinations are accepted, and which refuse to start."""

import os
from unittest import mock

import pytest

from auth.config import GOOGLE_DISCOVERY_URL, load_sso_config

CREDENTIALS = {
    "GOOGLE_CLIENT_ID": "id.apps.googleusercontent.com",
    "GOOGLE_CLIENT_SECRET": "GOCSPX-x",
    "SESSION_SECRET": "s" * 64,
}
BLANK = {
    "FLASK_ENV": "",
    "CORS_ALLOWED_ORIGINS": "",
    "GOOGLE_CLIENT_ID": "",
    "GOOGLE_CLIENT_SECRET": "",
    "SESSION_SECRET": "",
    "OIDC_DISCOVERY_URL": "",
    "OIDC_REDIRECT_URI": "",
    "FRONTEND_URL": "",
    "AUTH_DB_PATH": "",
    "AUTH_CONTACT": "",
}
PRODUCTION = {
    **CREDENTIALS,
    "FLASK_ENV": "production",
    "CORS_ALLOWED_ORIGINS": "https://smart-data-test.vercel.app,https://outro.example",
}


def load(**env):
    with mock.patch.dict(os.environ, {**BLANK, **env}, clear=False):
        return load_sso_config()


class TestEnabling:
    def test_nothing_set_runs_without_sso(self):
        """Development, CI and the container smoke test depend on this."""
        assert load().enabled is False

    def test_all_credentials_enable_it(self):
        assert load(**CREDENTIALS).enabled is True

    @pytest.mark.parametrize("missing", sorted(CREDENTIALS))
    def test_half_configured_refuses_to_start(self, missing):
        env = {k: v for k, v in CREDENTIALS.items() if k != missing}
        with pytest.raises(RuntimeError, match=missing):
            load(**env)

    def test_short_session_secret_is_refused(self):
        with pytest.raises(RuntimeError, match="SESSION_SECRET"):
            load(**{**CREDENTIALS, "SESSION_SECRET": "short"})


class TestDefaults:
    def test_production_points_at_the_real_hosts(self):
        config = load(**PRODUCTION)
        assert config.discovery_url == GOOGLE_DISCOVERY_URL
        assert config.redirect_uri == "https://api.smartdatatest.com/api/auth/google/callback"

    def test_frontend_is_the_first_cors_origin(self):
        assert load(**PRODUCTION).frontend_url == "https://smart-data-test.vercel.app"

    def test_development_stays_on_localhost(self):
        config = load(**CREDENTIALS)
        assert config.redirect_uri.startswith("http://localhost:5000/")
        assert config.frontend_url == "http://localhost:3000"

    def test_database_lives_outside_the_storage_tree(self):
        """storage/ holds files the API serves back for download."""
        path = load(**CREDENTIALS).db_path
        assert "storage" not in path.parts and "uploads" not in path.parts


class TestProductionChecks:
    @pytest.mark.parametrize(
        "name,value",
        [
            ("OIDC_DISCOVERY_URL", "http://accounts.google.com/x"),
            ("OIDC_REDIRECT_URI", "http://api.smartdatatest.com/cb"),
            ("FRONTEND_URL", "http://smart-data-test.vercel.app"),
        ],
    )
    def test_plain_http_is_refused(self, name, value):
        with pytest.raises(RuntimeError, match=name):
            load(**PRODUCTION, **{name: value})

    def test_frontend_missing_from_cors_is_refused(self):
        """Google's round-trip would work and the last step fail in the browser."""
        with pytest.raises(RuntimeError, match="CORS_ALLOWED_ORIGINS"):
            load(**PRODUCTION, FRONTEND_URL="https://elsewhere.example")

    def test_frontend_with_a_path_is_refused(self):
        with pytest.raises(RuntimeError, match="bare origin"):
            load(**PRODUCTION, FRONTEND_URL="https://smart-data-test.vercel.app/login")

    def test_the_checks_do_not_apply_without_sso(self):
        assert load(FLASK_ENV="production", FRONTEND_URL="http://x.example").enabled is False
