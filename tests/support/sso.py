"""Builds the Flask app with SSO on, pointed at the mock provider."""

from __future__ import annotations

import importlib.util
import os
from contextlib import contextmanager
from pathlib import Path
from unittest import mock

_API = Path(__file__).resolve().parents[2] / "src" / "api.py"

FRONTEND = "http://localhost:3000"
REDIRECT_URI = "http://localhost/api/auth/google/callback"


def sso_env(issuer: str, db_path, **overrides) -> dict:
    env = {
        "FLASK_ENV": "development",
        "CORS_ALLOWED_ORIGINS": FRONTEND,
        "API_AUTH_DISABLED": "",
        "API_TOKENS": "",
        "ADMIN_TOKENS": "",
        "GOOGLE_CLIENT_ID": "dev",
        "GOOGLE_CLIENT_SECRET": "dev",
        "SESSION_SECRET": "x" * 64,
        "OIDC_DISCOVERY_URL": f"{issuer}/.well-known/openid-configuration",
        "OIDC_REDIRECT_URI": REDIRECT_URI,
        "FRONTEND_URL": FRONTEND,
        "AUTH_DB_PATH": str(db_path),
        "AUTH_CONTACT": "",
    }
    env.update(overrides)
    return env


@contextmanager
def sso_app(env: dict):
    """A separate instance of the app, started under *env*.

    The application reads its configuration at import time, and the rest of the
    suite shares the app in ``sys.modules["api"]`` through session fixtures. So
    this executes api.py again under another module name instead of reloading
    it: the shared app is never replaced, whatever order the tests run in. For
    the same reason the environment is only altered while it loads — otherwise
    the shared app, if first imported meanwhile, would come up configured too.
    """
    with mock.patch.dict(os.environ, env, clear=False):
        spec = importlib.util.spec_from_file_location("api_with_sso", _API)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    module.app.config["TESTING"] = True
    yield module.app
