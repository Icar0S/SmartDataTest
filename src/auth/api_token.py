"""The request gate: who may reach which route.

Every route is protected by default. Rather than decorating each endpoint —
where a newly added route silently ships unauthenticated — this installs a
``before_request`` hook and keeps a small explicit allowlist of public paths.
Forgetting to annotate a new route therefore fails closed.

Two kinds of credential are accepted, both as ``Authorization: Bearer``:

* a *session token*, issued to a person after signing in with Google. The
  account behind it has to be approved, and is checked on every request, so
  blocking someone takes effect immediately.

* a *machine token* from ``API_TOKENS`` (comma-separated, so they can be rotated
  by adding the new one, moving clients over, then dropping the old one). These
  are for scripts. They identify no one, and must never be put in a frontend
  build again: anything in the bundle is public.

In production at least one of the two has to be configured; the only way to run
an internet-facing instance without either is ``API_AUTH_DISABLED=true``, which
is deliberately explicit and logged loudly.

Comparison is constant-time, and a failed attempt never reveals which token was
expected or whether any tokens are configured at all.
"""

import hmac
import logging
import os
import re

from flask import current_app, g, jsonify, request

logger = logging.getLogger(__name__)

# Paths reachable without any credential.
#
#   /                          container HEALTHCHECK and the tunnel's origin probe
#   /api/version               which release is running
#   /api/stats                 rendered on the public login page, before any login
#   /api/auth/config           whether SSO is available, asked by the login page
#   /api/auth/google/*         the login itself
#   /api/auth/exchange         its last step, protected by the one-time code
#
# Plus the "/api/<feature>/health" blueprint probes, matched by pattern below.
PUBLIC_PATHS = frozenset(
    {
        "/",
        "/api/version",
        "/api/stats",
        "/api/auth/config",
        "/api/auth/google/login",
        "/api/auth/google/callback",
        "/api/auth/exchange",
    }
)

# Paths that only mean something for a logged-in person. A machine token does
# not open them, and neither does API_AUTH_DISABLED: "no authentication" cannot
# turn into "anyone is the administrator".
#
# These work while the account is still pending, so that the frontend can say so.
SESSION_PATHS = frozenset({"/api/auth/me", "/api/auth/logout", "/api/auth/profile"})

ADMIN_PREFIX = "/api/auth/admin"

# The whole path, not its ending: matched by suffix, an identifier of "health"
# opened any route that ends in one (DELETE /api/rag/sources/health).
_HEALTH_PROBE = re.compile(r"/api/[a-z_]+/health/?")


# Operations that change or destroy server-side state, matched as
# (method, path prefix). These need a separate, stronger credential.
#
# Neither a session nor an ordinary machine token is enough: being allowed to
# use the platform is not being allowed to empty its knowledge base. Cloudflare
# Access cannot cover these either: it matches on path, and
# "GET /api/rag/sources" (used by the frontend) shares a path with
# "DELETE /api/rag/sources/<id>" (deletes a document from the knowledge base).
ADMIN_OPERATIONS = (
    ("POST", "/api/rag/ingest"),
    ("POST", "/api/rag/reload"),
    ("DELETE", "/api/rag/sources"),
)


def _load_tokens() -> list[str]:
    """Return the configured API tokens."""
    raw = os.environ.get("API_TOKENS", "")
    return [token.strip() for token in raw.split(",") if token.strip()]


def _load_admin_tokens() -> list[str]:
    """Return the configured admin tokens (comma-separated, for rotation)."""
    raw = os.environ.get("ADMIN_TOKENS", "")
    return [token.strip() for token in raw.split(",") if token.strip()]


def _is_admin_operation(method: str, path: str) -> bool:
    """True if this request mutates or destroys server-side state."""
    normalised = path.rstrip("/")
    return any(
        method == required_method and normalised.startswith(prefix)
        for required_method, prefix in ADMIN_OPERATIONS
    )


def _auth_disabled() -> bool:
    return os.environ.get("API_AUTH_DISABLED", "").strip().lower() in ("true", "1", "yes")


def _is_public(path: str) -> bool:
    """True if *path* may be served without a token."""
    return path in PUBLIC_PATHS or bool(_HEALTH_PROBE.fullmatch(path))


def _presented_token() -> str | None:
    """Extract the token from the request, if present.

    Accepts ``Authorization: Bearer <token>`` and, for clients that cannot set
    an Authorization header, ``X-API-Token: <token>``.
    """
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return header[len("Bearer ") :].strip()
    direct = request.headers.get("X-API-Token", "").strip()
    return direct or None


def _matches_any(presented: str | None, known_tokens: list[str]) -> bool:
    """Constant-time comparison, as bytes: hmac refuses non-ASCII text, and a
    stray byte in the header should be a wrong token, not an error."""
    if not presented:
        return False
    given = presented.encode("utf-8", "surrogateescape")
    return any(hmac.compare_digest(given, known.encode()) for known in known_tokens)


def _session_user(token: str | None) -> dict | None:
    """The person behind a session token, or None."""
    store = current_app.extensions.get("auth_store")
    if store is None or not token:
        return None
    return store.authenticate(token)


def _unauthorized():
    # Deliberately uninformative: no hint about token format or count.
    return jsonify({"error": "Unauthorized"}), 401


def init_api_token_auth(app, sso_enabled: bool = False) -> None:
    """Install credential enforcement on *app*.

    Raises:
        RuntimeError: in production when there is no SSO, no API_TOKENS and no
            explicit API_AUTH_DISABLED opt-out.
    """
    is_production = os.environ.get("FLASK_ENV", "").strip().lower() == "production"
    tokens = _load_tokens()
    # Read once at startup, like `tokens`. Reading per request would make the
    # effective configuration depend on the environment at call time.
    admin_tokens = _load_admin_tokens()

    # Destructive operations are guarded even when general API authentication
    # is off. Without this, a deployment that simply lacks API_TOKENS — as
    # happened on the Render instance, where FLASK_ENV is not "production" —
    # left POST /api/rag/reload and DELETE /api/rag/sources/<id> callable by
    # anyone, which is precisely what ADMIN_TOKENS exists to prevent.
    general_auth_off = _auth_disabled() or not (tokens or sso_enabled)

    if _auth_disabled():
        logger.critical(
            "API_AUTH_DISABLED is set: business routes are reachable without a "
            "token. Never do this on an internet-facing instance. Destructive "
            "operations remain gated by ADMIN_TOKENS."
        )
    elif general_auth_off:
        if is_production:
            raise RuntimeError(
                "Neither SSO nor API_TOKENS is configured and FLASK_ENV=production. "
                "Set up Google sign-in (see docs/AUTH.md), or set API_TOKENS: "
                'generate one with `python -c "import secrets; '
                'print(secrets.token_urlsafe(32))"` and pass it comma-separated. '
                "To run without authentication on purpose, set API_AUTH_DISABLED=true."
            )
        logger.warning(
            "Neither SSO nor API_TOKENS is set — business routes are "
            "unauthenticated. This is allowed outside production only. "
            "Destructive operations remain gated by ADMIN_TOKENS."
        )

    @app.before_request
    def _require_credentials():  # pylint: disable=unused-variable,too-many-return-statements
        g.user = None
        # CORS preflight carries no credentials by design; rejecting it would
        # break the browser before the real request is ever sent.
        if request.method == "OPTIONS":
            return None

        if _is_public(request.path):
            return None

        presented = _presented_token()
        path = request.path.rstrip("/")
        is_admin_path = path == ADMIN_PREFIX or path.startswith(ADMIN_PREFIX + "/")

        if is_admin_path or path in SESSION_PATHS:
            user = _session_user(presented)
            if user is None:
                return _unauthorized()
            if is_admin_path and not (user["is_admin"] and user["status"] == "approved"):
                # 404, not 403: for anyone else there is no panel here.
                return jsonify({"error": "Not found"}), 404
            g.user = user
            g.session_token = presented
            return None

        if _is_admin_operation(request.method, request.path):
            # Enforced regardless of general_auth_off.
            # Fails closed: with no ADMIN_TOKENS configured, destructive routes
            # are unreachable rather than falling back to a weaker credential.
            return None if _matches_any(presented, admin_tokens) else _unauthorized()

        user = _session_user(presented)
        if user is not None:
            if user["status"] != "approved":
                return jsonify({"error": "access_pending"}), 403
            g.user = user
            return None

        if general_auth_off:
            return None

        return None if _matches_any(presented, tokens) else _unauthorized()
