"""Bearer-token authentication for the business API.

Every route is protected by default. Rather than decorating each endpoint —
where a newly added route silently ships unauthenticated — this installs a
``before_request`` hook and keeps a small explicit allowlist of public paths.
Forgetting to annotate a new route therefore fails closed.

Tokens come from ``API_TOKENS`` (comma-separated, so they can be rotated by
adding the new one, moving clients over, then dropping the old one). In
production the variable is mandatory; the only way to run an internet-facing
instance without it is to set ``API_AUTH_DISABLED=true``, which is deliberately
explicit and logged loudly.

Comparison is constant-time, and a failed attempt never reveals which token was
expected or whether any tokens are configured at all.
"""

import hmac
import logging
import os

from flask import jsonify, request

logger = logging.getLogger(__name__)

# Paths reachable without a token.
#
#   /                    container HEALTHCHECK and the tunnel's origin probe
#   /api/auth/validate   the login endpoint itself
#   /api/stats           rendered on the public login page, before any login
#
# Plus every "*/health" blueprint probe, matched by suffix below.
PUBLIC_PATHS = frozenset(
    {
        "/",
        "/api/auth/validate",
        "/api/stats",
    }
)


def _load_tokens() -> list[str]:
    """Return the configured API tokens."""
    raw = os.environ.get("API_TOKENS", "")
    return [token.strip() for token in raw.split(",") if token.strip()]


def _auth_disabled() -> bool:
    return os.environ.get("API_AUTH_DISABLED", "").strip().lower() in ("true", "1", "yes")


def _is_public(path: str) -> bool:
    """True if *path* may be served without a token."""
    if path in PUBLIC_PATHS:
        return True
    # Blueprint health probes: /api/<feature>/health
    return path.rstrip("/").endswith("/health")


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


def init_api_token_auth(app) -> None:
    """Install token enforcement on *app*.

    Raises:
        RuntimeError: in production when neither API_TOKENS nor an explicit
            API_AUTH_DISABLED opt-out is configured.
    """
    is_production = os.environ.get("FLASK_ENV", "").strip().lower() == "production"
    tokens = _load_tokens()

    if _auth_disabled():
        logger.critical(
            "API_AUTH_DISABLED is set: every business route is reachable "
            "without a token. Never do this on an internet-facing instance."
        )
        return

    if not tokens:
        if is_production:
            raise RuntimeError(
                "API_TOKENS must be set when FLASK_ENV=production. Generate one "
                "with `python -c \"import secrets; print(secrets.token_urlsafe(32))\"` "
                "and pass it comma-separated. To run without API authentication "
                "on purpose, set API_AUTH_DISABLED=true."
            )
        logger.warning(
            "API_TOKENS is not set — business routes are unauthenticated. "
            "This is allowed outside production only."
        )
        return

    @app.before_request
    def _require_api_token():  # pylint: disable=unused-variable
        # CORS preflight carries no credentials by design; rejecting it would
        # break the browser before the real request is ever sent.
        if request.method == "OPTIONS":
            return None

        if _is_public(request.path):
            return None

        presented = _presented_token()
        if presented and any(hmac.compare_digest(presented, known) for known in tokens):
            return None

        # Deliberately uninformative: no hint about token format or count.
        return jsonify({"error": "Unauthorized"}), 401
