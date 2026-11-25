"""Login and session endpoints, under /api/auth.

The login in one paragraph. The browser invents a random *verifier*, keeps it,
and opens /google/login carrying only its hash, the *challenge*. Google does its
part and sends the browser back to /google/callback, which redirects to the
frontend with a one-time code in the URL fragment. The frontend posts that code
together with the verifier to /exchange and receives the session token. The code
alone is worthless, the token never appears in a URL, and a link prepared by
somebody else cannot log a victim into the wrong account.

Why a bearer token rather than a cookie: the frontend (vercel.app) and this API
(smartdatatest.com) are different sites, so a session cookie would be a
third-party cookie — blocked by Safari always and by the others increasingly
often. See docs/AUTH.md.
"""

from __future__ import annotations

import hmac
import logging
import re
import secrets
from urllib.parse import urlencode

from flask import Blueprint, current_app, g, jsonify, redirect, request, session

from auth import oidc
from auth.config import REMEMBERED_SESSION_SECONDS, SESSION_SECONDS, SSOConfig
from auth.identity import initials
from auth.store import AuthStore
from limiter import limiter

logger = logging.getLogger(__name__)

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

# base64url(sha256(x)) without padding is always 43 characters.
_CHALLENGE = re.compile(r"[A-Za-z0-9_-]{43}")
# RFC 7636, section 4.1.
_VERIFIER = re.compile(r"[A-Za-z0-9._~-]{43,128}")
# What secrets.token_urlsafe(32) produces.
_CODE = re.compile(r"[A-Za-z0-9_-]{43}")
# An OAuth error code is a short ASCII token (RFC 6749, section 4.1.2.1).
_PROVIDER_ERROR = re.compile(r"[A-Za-z0-9_.-]{1,40}")

_PROFILE_MAX = 80


def sso_config() -> SSOConfig:
    return current_app.config["SSO_CONFIG"]


def auth_store() -> AuthStore:
    return current_app.extensions["auth_store"]


@auth_bp.after_request
def _never_cache(response):
    response.headers["Cache-Control"] = "no-store"
    return response


def public_user(user: dict) -> dict:
    """What the frontend may know. Google's ``sub`` stays on the server."""
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"] or user["email"],
        "avatar": initials(user["name"], user["email"]),
        "is_admin": bool(user["is_admin"]),
        "profile": user["profile"],
    }


def _session_payload(user: dict, expires_at: int) -> dict:
    payload = {"user": public_user(user), "status": user["status"], "expires_at": expires_at}
    if user["status"] == "pending":
        payload["contact"] = sso_config().contact
    return payload


def _back_to_frontend(**fragment):
    """Redirect to the login page. The fragment is never sent to any server, so
    it stays out of access logs and Referer headers."""
    return redirect(f"{sso_config().frontend_url}/login#{urlencode(fragment)}", code=303)


# Every login that ends in "failed" or "unavailable" leaves one line saying why,
# starting with OIDC: the person only sees "try again", and docs/AUTH.md sends
# the operator to `grep OIDC`. The state, the code and the challenge never go
# into those lines; neither does any secret.


def _why_no_login_in_progress() -> str:
    if not request.args:
        return "the callback was opened directly, not on the way back from the provider"
    if current_app.config["SESSION_COOKIE_NAME"] in request.cookies:
        return "the login cookie could not be read (expired, or signed with another SESSION_SECRET)"
    return "the login cookie did not come back"


def _loggable(provider_error: str) -> str:
    """The provider's error code, safe to log. Anyone can open the callback
    with any ``error``, so only the leading code is kept: no line breaks to
    forge entries with, no unbounded text."""
    match = _PROVIDER_ERROR.match(provider_error)
    code = match.group() if match else "?"
    return code if code == provider_error else f"{code}..."


# ── public ──────────────────────────────────────────────────────────────────


@auth_bp.route("/config", methods=["GET"])
@limiter.limit("120 per minute")
def config():
    """Whether this backend can log anyone in. Read by the login page, and by
    the deploy pipeline before it publishes a frontend that depends on it."""
    return jsonify({"sso": sso_config().enabled, "contact": sso_config().contact})


@auth_bp.route("/google/login", methods=["GET"])
@limiter.limit("30 per minute")
def google_login():
    settings = sso_config()
    if not settings.enabled:
        return jsonify({"error": "sso_not_configured"}), 503
    challenge = request.args.get("challenge", "")
    if not _CHALLENGE.fullmatch(challenge):
        return jsonify({"error": "invalid_challenge"}), 400

    # Earlier attempts are dropped: each one leaves a few hundred bytes in the
    # cookie, and past 4 KB browsers discard it whole.
    session.clear()
    session.permanent = True
    state = secrets.token_urlsafe(32)
    session["login"] = {
        "state": state,
        "challenge": challenge,
        "remember": request.args.get("remember") == "1",
    }
    try:
        return current_app.extensions["google_oidc"].authorize_redirect(
            settings.redirect_uri, state=state, prompt="select_account"
        )
    except Exception as exc:  # pylint: disable=broad-exception-caught
        logger.warning(
            "OIDC login not started, could not reach the identity provider: %s: %s",
            type(exc).__name__,
            exc,
        )
        session.clear()
        return _back_to_frontend(error="unavailable")


@auth_bp.route("/google/callback", methods=["GET"])
@limiter.limit("30 per minute")
def google_callback():
    settings = sso_config()
    if not settings.enabled:
        return jsonify({"error": "sso_not_configured"}), 503
    login = session.get("login") or {}
    try:
        state = request.args.get("state", "")
        if not login:
            logger.warning(
                "OIDC callback rejected: no login in progress, %s", _why_no_login_in_progress()
            )
            raise oidc.LoginFailed("failed")
        if not hmac.compare_digest(login["state"].encode(), state.encode()):
            # A later login in the same browser replaced this one, or the link
            # was made somewhere else.
            logger.warning("OIDC callback rejected: state does not match the login in progress")
            raise oidc.LoginFailed("failed")
        provider_error = request.args.get("error")
        if provider_error == "access_denied":
            # The person pressed cancel: not something for the operator to fix.
            logger.info("OIDC login cancelled at the provider")
            raise oidc.LoginFailed("cancelled")
        if provider_error:
            logger.warning(
                "OIDC callback rejected: the provider returned error=%s", _loggable(provider_error)
            )
            raise oidc.LoginFailed("failed")
        claims = oidc.fetch_claims(current_app.extensions["google_oidc"], settings)
        user = auth_store().record_google_login(claims)
        if user["status"] == "blocked":
            raise oidc.LoginFailed("blocked")
    except oidc.LoginFailed as exc:
        return _back_to_frontend(error=exc.reason)
    finally:
        # Single use, whatever happened.
        session.clear()

    code = auth_store().issue_login_code(user["id"], login["challenge"], login["remember"])
    return _back_to_frontend(code=code)


@auth_bp.route("/exchange", methods=["POST"])
@limiter.limit("20 per minute")
def exchange():
    """Trade the one-time code for a session token."""
    if not sso_config().enabled:
        return jsonify({"error": "sso_not_configured"}), 503
    data = request.get_json(silent=True)
    data = data if isinstance(data, dict) else {}
    code, verifier = data.get("code"), data.get("verifier")
    if not isinstance(code, str) or not isinstance(verifier, str):
        return jsonify({"error": "invalid_request"}), 400
    if not _VERIFIER.fullmatch(verifier):
        return jsonify({"error": "invalid_request"}), 400
    if not _CODE.fullmatch(code):
        return jsonify({"error": "invalid_code"}), 400
    result = auth_store().redeem_login_code(
        code,
        verifier,
        seconds=SESSION_SECONDS,
        remembered_seconds=REMEMBERED_SESSION_SECONDS,
    )
    if result is None:
        return jsonify({"error": "invalid_code"}), 400
    token, expires_at, user = result
    return jsonify({"token": token, **_session_payload(user, expires_at)})


# ── session required (the request gate sets g.user) ─────────────────────────


@auth_bp.route("/me", methods=["GET"])
@limiter.limit("120 per minute")
def me():
    return jsonify(_session_payload(g.user, g.user["session_expires_at"]))


@auth_bp.route("/logout", methods=["POST"])
@limiter.limit("60 per minute")
def logout():
    auth_store().end_session(g.session_token)
    return "", 204


@auth_bp.route("/profile", methods=["POST"])
@limiter.limit("30 per minute")
def profile():
    """Remember the professional profile, so it is asked once and not per login."""
    if g.user["status"] != "approved":
        return jsonify({"error": "access_pending"}), 403
    data = request.get_json(silent=True)
    role = data.get("role") if isinstance(data, dict) else None
    role = role.strip() if isinstance(role, str) else ""
    if not role or len(role) > _PROFILE_MAX or not role.isprintable():
        return jsonify({"error": "invalid_role"}), 400
    user = auth_store().set_profile(g.user["id"], role)
    return jsonify({"user": public_user(user)})
