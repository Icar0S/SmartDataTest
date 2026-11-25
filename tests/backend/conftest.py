"""Global conftest for all backend tests."""
import sys
import os

# Ensure src/ is always on the path for all backend tests
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "src")))

# ── Test environment ───────────────────────────────────────────────────────
# Everything below must be set before any test module imports `api`, because
# the application reads all of it at import time.

# CORS no longer has a built-in production fallback; give the suite an origin.
os.environ.setdefault("CORS_ALLOWED_ORIGINS", "http://localhost:3000")

# Business routes require a session or a machine token (src/auth/api_token.py).
# The bulk of the suite predates that and calls those routes directly, so
# authentication is explicitly disabled here. Enforcement is exercised by
# test_api_token_auth.py, which restores this afterwards, and by the test_sso_*
# and security suites, which build an app of their own (tests/support/sso.py).
os.environ.setdefault("API_AUTH_DISABLED", "true")

# Some modules load the repository's .env, which on the server holds the real
# credentials. Already set, even if empty, these are not overridden by it.
for _name in ("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "SESSION_SECRET"):
    os.environ.setdefault(_name, "")

# The per-category production rate limits (see src/limiter.py) are sized for a
# human using a browser. The suite drives dozens of uploads and heavy requests
# per second from a single address, which would otherwise return 429 and fail
# tests for reasons unrelated to what they assert. Raise them here. The tests
# that specifically verify rate limiting target /ask and /api/metrics/analyze,
# whose limits are declared inline and are deliberately left untouched.
for _category in ("LLM", "GENERATE", "UPLOAD", "HEAVY", "ADMIN"):
    os.environ.setdefault(f"RATELIMIT_{_category}", "1000000 per hour")

# Same reasoning for the global default. It only started taking effect once the
# config key was corrected from RATELIMIT_DEFAULT_LIMITS (which Flask-Limiter
# ignores) to RATELIMIT_DEFAULT; before that the suite never met it.
os.environ.setdefault("RATELIMIT_DEFAULT", "1000000 per hour")

import pytest  # noqa: E402


@pytest.fixture(scope="session")
def app():
    """Global Flask test app fixture."""
    from api import app as flask_app
    flask_app.config["TESTING"] = True
    flask_app.config["WTF_CSRF_ENABLED"] = False
    return flask_app


@pytest.fixture(scope="session")
def client(app):
    """Global Flask test client fixture."""
    with app.test_client() as test_client:
        yield test_client
