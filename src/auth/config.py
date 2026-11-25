"""SSO settings, read once from the environment at startup.

The three secrets travel together. With none of them set the platform runs
without SSO, which is what development, CI and the container smoke test need.
With only some of them set the app refuses to start: a half-configured login is
always a mistake, and discovering it at the first login attempt means
discovering it through a user.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit

GOOGLE_DISCOVERY_URL = "https://accounts.google.com/.well-known/openid-configuration"

PRODUCTION_REDIRECT_URI = "https://api.smartdatatest.com/api/auth/google/callback"
DEVELOPMENT_REDIRECT_URI = "http://localhost:5000/api/auth/google/callback"

_REPO_ROOT = Path(__file__).resolve().parents[2]

# Session lifetimes, matching the "remember me for 7 days" checkbox the login
# page has always had.
SESSION_SECONDS = 8 * 60 * 60
REMEMBERED_SESSION_SECONDS = 7 * 24 * 60 * 60


@dataclass(frozen=True)
class SSOConfig:
    """Everything the login needs. ``enabled`` is False when nothing is set."""

    enabled: bool
    client_id: str
    client_secret: str
    session_secret: str
    discovery_url: str
    redirect_uri: str
    frontend_url: str
    db_path: Path
    contact: str
    is_production: bool


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def _is_https(url: str) -> bool:
    return urlsplit(url).scheme == "https"


def _origin(url: str) -> str:
    parts = urlsplit(url)
    return f"{parts.scheme}://{parts.netloc}"


def _cors_origins() -> list[str]:
    return [o.strip().rstrip("/") for o in _env("CORS_ALLOWED_ORIGINS").split(",") if o.strip()]


def load_sso_config() -> SSOConfig:
    """Build the configuration, refusing combinations that cannot work.

    Raises:
        RuntimeError: when only part of the credentials is present, or when the
            URLs contradict each other in production.
    """
    is_production = _env("FLASK_ENV").lower() == "production"
    origins = _cors_origins()

    secrets_by_name = {
        "GOOGLE_CLIENT_ID": _env("GOOGLE_CLIENT_ID"),
        "GOOGLE_CLIENT_SECRET": _env("GOOGLE_CLIENT_SECRET"),
        "SESSION_SECRET": _env("SESSION_SECRET"),
    }
    missing = [name for name, value in secrets_by_name.items() if not value]
    enabled = not missing
    if missing and len(missing) < len(secrets_by_name):
        raise RuntimeError(
            f"SSO is only partially configured: {', '.join(missing)} not set. "
            "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and SESSION_SECRET "
            "together, or none of them."
        )

    config = SSOConfig(
        enabled=enabled,
        client_id=secrets_by_name["GOOGLE_CLIENT_ID"],
        client_secret=secrets_by_name["GOOGLE_CLIENT_SECRET"],
        session_secret=secrets_by_name["SESSION_SECRET"],
        discovery_url=_env("OIDC_DISCOVERY_URL") or GOOGLE_DISCOVERY_URL,
        redirect_uri=_env("OIDC_REDIRECT_URI")
        or (PRODUCTION_REDIRECT_URI if is_production else DEVELOPMENT_REDIRECT_URI),
        frontend_url=(
            _env("FRONTEND_URL") or (origins[0] if origins else "http://localhost:3000")
        ).rstrip("/"),
        db_path=Path(_env("AUTH_DB_PATH") or _REPO_ROOT / "auth-data" / "auth.sqlite3"),
        contact=_env("AUTH_CONTACT"),
        is_production=is_production,
    )
    if enabled:
        _validate(config, origins)
    return config


def _validate(config: SSOConfig, origins: list[str]) -> None:
    if len(config.session_secret) < 32:
        raise RuntimeError(
            "SESSION_SECRET must have at least 32 characters. Generate one with "
            '`python -c "import secrets; print(secrets.token_hex(32))"`.'
        )
    if not re.fullmatch(r"https?://[^/\s]+", config.frontend_url):
        raise RuntimeError(
            f"FRONTEND_URL must be a bare origin such as https://example.com, "
            f"got {config.frontend_url!r}."
        )
    if not config.is_production:
        return
    for name, url in (
        ("OIDC_DISCOVERY_URL", config.discovery_url),
        ("OIDC_REDIRECT_URI", config.redirect_uri),
        ("FRONTEND_URL", config.frontend_url),
    ):
        if not _is_https(url):
            raise RuntimeError(f"{name} must use https in production, got {url!r}.")
    # The browser trades the login code for a session with a cross-origin POST.
    # An origin missing from CORS would let the whole Google round-trip succeed
    # and then fail on that last step.
    if origins and _origin(config.frontend_url) not in origins:
        raise RuntimeError(
            f"FRONTEND_URL {config.frontend_url!r} is not listed in "
            "CORS_ALLOWED_ORIGINS, so the browser could never finish a login."
        )
