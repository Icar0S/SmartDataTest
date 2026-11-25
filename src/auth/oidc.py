"""Google sign-in over OpenID Connect (Authorization Code flow with PKCE).

This module proves who a person is. It decides nothing about what they may do;
see auth.store for that.

Authlib handles state, nonce, PKCE, signature verification and key rotation.
What it does not do by default is compare the token's audience with our client
id, so that check is made here, explicitly.
"""

from __future__ import annotations

import logging

from authlib.integrations.flask_client import OAuth
from flask import Flask

from auth.config import SSOConfig
from auth.identity import is_email_verified

logger = logging.getLogger(__name__)

# Without a timeout a stalled connection to Google would hold one of the eight
# worker threads until gunicorn's own 300s limit.
_HTTP_TIMEOUT = 10

# How long someone may take on Google's screens before starting over.
_LOGIN_COOKIE_SECONDS = 10 * 60


class LoginFailed(Exception):
    """The login cannot proceed; ``reason`` is a code the frontend translates."""

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


def init_oidc(app: Flask, config: SSOConfig) -> None:
    """Register the Google client and the short-lived cookie that carries the
    login across the redirect. The cookie identifies a login in progress, never
    a logged-in person."""
    app.secret_key = config.session_secret
    app.config.update(
        SESSION_COOKIE_NAME="sdt_login",
        SESSION_COOKIE_PATH="/api/auth/google",
        SESSION_COOKIE_HTTPONLY=True,
        # Lax, not Strict: the way back from Google is a cross-site navigation.
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=config.is_production,
        PERMANENT_SESSION_LIFETIME=_LOGIN_COOKIE_SECONDS,
    )
    oauth = OAuth(app)
    oauth.register(
        name="google",
        server_metadata_url=config.discovery_url,
        client_id=config.client_id,
        client_secret=config.client_secret,
        client_kwargs={
            # The minimum that identifies a person.
            "scope": "openid email profile",
            # Authlib only adds PKCE when asked to.
            "code_challenge_method": "S256",
            "default_timeout": _HTTP_TIMEOUT,
        },
    )
    app.extensions["google_oidc"] = oauth.create_client("google")


def _accepted_issuers(client) -> list[str]:
    issuer = client.load_server_metadata()["issuer"]
    # Google documents both spellings of its issuer.
    if issuer == "https://accounts.google.com":
        return [issuer, "accounts.google.com"]
    return [issuer]


def fetch_claims(client, config: SSOConfig) -> dict:
    """Finish the code exchange and return verified identity claims.

    Raises:
        LoginFailed: for any reason at all. The caller gets a code to show; the
            detail goes to the log.
    """
    try:
        token = client.authorize_access_token(
            claims_options={
                "iss": {"essential": True, "values": _accepted_issuers(client)},
                "aud": {"essential": True, "values": [config.client_id]},
            }
        )
        # Absent when the provider sent no ID token: nothing was proven.
        claims = dict(token.get("userinfo") or {})
    except Exception as exc:  # pylint: disable=broad-exception-caught
        logger.warning("OIDC callback rejected: %s: %s", type(exc).__name__, exc)
        raise LoginFailed("failed") from exc

    audience = claims.get("aud")
    if config.client_id not in (audience if isinstance(audience, list) else [audience]):
        logger.warning("OIDC callback rejected: token issued for another client")
        raise LoginFailed("failed")
    if not claims.get("sub") or not claims.get("email"):
        logger.warning("OIDC callback rejected: sub or email missing")
        raise LoginFailed("failed")
    # Otherwise anyone could open a Google account over somebody else's address.
    if not is_email_verified(claims):
        raise LoginFailed("email_unverified")
    return claims
