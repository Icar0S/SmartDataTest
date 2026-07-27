"""Global conftest for all backend tests."""
import json
import sys
import os

# Ensure src/ is always on the path for all backend tests
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "src")))

from werkzeug.security import generate_password_hash  # noqa: E402

# ── Test environment ───────────────────────────────────────────────────────
# Everything below must be set before any test module imports `api`, because
# the application reads all of it at import time.

# CORS no longer has a built-in production fallback; give the suite an origin.
os.environ.setdefault("CORS_ALLOWED_ORIGINS", "http://localhost:3000")

# The per-category production rate limits (see src/limiter.py) are sized for a
# human using a browser. The suite drives dozens of uploads and heavy requests
# per second from a single address, which would otherwise return 429 and fail
# tests for reasons unrelated to what they assert. Raise them here. The tests
# that specifically verify rate limiting target /ask and /api/metrics/analyze,
# whose limits are declared inline and are deliberately left untouched.
for _category in ("LLM", "GENERATE", "UPLOAD", "HEAVY", "ADMIN"):
    os.environ.setdefault(f"RATELIMIT_{_category}", "1000000 per hour")

# The application no longer ships built-in accounts, so the suite brings its
# own. These are test fixtures, not deployable credentials.
os.environ.setdefault(
    "AUTH_USERS",
    json.dumps(
        [
            {
                "id": "user-admin-001",
                "name": "Admin DataForge",
                "email": "admin@dataforgetest.com",
                "password_hash": generate_password_hash("admin123"),
                "role": "admin",
                "avatar": None,
            },
            {
                "id": "user-eng-002",
                "name": "Engineer DataForge",
                "email": "engineer@dataforgetest.com",
                "password_hash": generate_password_hash("engineer123"),
                "role": "data_eng",
                "avatar": None,
            },
            {
                "id": "user-qa-003",
                "name": "QA DataForge",
                "email": "qa@dataforgetest.com",
                "password_hash": generate_password_hash("qa123456"),
                "role": "tester",
                "avatar": None,
            },
        ]
    ),
)

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
