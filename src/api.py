"""Flask API for Data Quality Chatbot backend."""

import os
import sys

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, abort, jsonify, request
from flask_cors import CORS
from flask_limiter.util import get_remote_address
from werkzeug.exceptions import HTTPException
from werkzeug.middleware.proxy_fix import ProxyFix

from chatbot.main import process_chatbot_request
from limiter import limiter

app = Flask(__name__)

# ── Upload limits ──────────────────────────────────────────────────────────
# MAX_UPLOAD_MB is the single knob every feature module reads (metrics, rag,
# accuracy and gold all call os.getenv("MAX_UPLOAD_MB", ...) in their config).
# MAX_CONTENT_LENGTH is the hard Flask wall enforced before any route code
# runs, so it must sit *above* MAX_UPLOAD_MB — otherwise an upload between the
# two values dies with a bare 413 instead of the module's descriptive JSON
# error. The overhead margin covers multipart/form-data framing.
#
# Previously MAX_CONTENT_LENGTH was hard-coded to 10 MB with no relation to
# MAX_UPLOAD_MB, and ACCURACY_MAX_UPLOAD_MB was declared in render.yaml and
# docker-compose.yml but read by no code at all. That variable is gone; use
# MAX_UPLOAD_MB.
_MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", "10"))
_UPLOAD_OVERHEAD_MB = int(os.environ.get("UPLOAD_OVERHEAD_MB", "2"))
app.config["MAX_UPLOAD_MB"] = _MAX_UPLOAD_MB
app.config["MAX_CONTENT_LENGTH"] = (_MAX_UPLOAD_MB + _UPLOAD_OVERHEAD_MB) * 1024 * 1024

# ── Rate limiting ──────────────────────────────────────────────────────────
# "memory://" is per-process: with N gunicorn workers the effective limit is
# N times the configured one. The deployment runs a single worker with threads
# precisely so these counters are shared and the configured limit is the real
# one. Add workers or replicas and you must move RATELIMIT_STORAGE_URI to a
# shared backend (e.g. redis://...) in the same change.
app.config["RATELIMIT_STORAGE_URI"] = os.environ.get("RATELIMIT_STORAGE_URI", "memory://")
# The config key is RATELIMIT_DEFAULT. It was previously spelled
# RATELIMIT_DEFAULT_LIMITS, which Flask-Limiter does not recognise, so the
# documented "200 per day, 50 per hour" global limit silently never applied —
# only routes carrying an explicit @limiter.limit were ever limited. Verified
# against flask_limiter.constants.ConfigVars.
app.config["RATELIMIT_DEFAULT"] = os.environ.get(
    "RATELIMIT_DEFAULT", "200 per day;50 per hour"
)

# ── CORS ───────────────────────────────────────────────────────────────────
# Allowed origins come from CORS_ALLOWED_ORIGINS. There is deliberately NO
# production fallback: the old built-in default silently allowed a hard-coded
# list of hosts (including the Render domain) on any deployment that forgot to
# set the variable. In production we refuse to start rather than serve an
# origin allowlist nobody chose.
_IS_PRODUCTION = os.environ.get("FLASK_ENV", "").strip().lower() == "production"
_cors_env = os.environ.get("CORS_ALLOWED_ORIGINS", "").strip()

if _cors_env:
    _CORS_ORIGINS = [origin.strip() for origin in _cors_env.split(",") if origin.strip()]
elif _IS_PRODUCTION:
    raise RuntimeError(
        "CORS_ALLOWED_ORIGINS must be set explicitly when FLASK_ENV=production. "
        "Set it to the exact frontend origin(s), comma-separated, e.g. "
        "CORS_ALLOWED_ORIGINS=https://data-forge-test.vercel.app"
    )
else:
    # Development-only convenience default.
    _CORS_ORIGINS = ["http://localhost:3000"]

CORS(
    app,
    resources={
        r"/api/checklist/*": {
            "origins": _CORS_ORIGINS,
            "methods": ["GET", "POST", "PUT", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": False,
        },
        r"/*": {
            "origins": _CORS_ORIGINS,
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": False,
        },
    },
)


@app.before_request
def reject_oversized_requests():
    """Reject requests that exceed MAX_CONTENT_LENGTH before rate limiting runs."""
    max_length = app.config.get("MAX_CONTENT_LENGTH")
    if max_length and request.content_length and request.content_length > max_length:
        abort(413)


limiter.init_app(app)

# Handle proxy headers from Render/reverse proxies
# This ensures request.is_secure correctly detects HTTPS
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=0)


@app.after_request
def add_security_headers(response):
    """Add mandatory HTTP security headers to all responses."""
    # Prevent MIME type sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"
    # Prevent clickjacking
    response.headers["X-Frame-Options"] = "DENY"
    # Legacy XSS protection for older browsers
    response.headers["X-XSS-Protection"] = "1; mode=block"
    # Referrer policy
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # Content Security Policy — allow only own origin + trusted CDNs
    # NOTE: 'unsafe-inline' for script-src/style-src is required for the current
    # React frontend build; tracked for removal when a nonce-based CSP is adopted.
    # Defaults to the self-hosted API. The old default pointed at the Render
    # deployment, which this no longer depends on.
    _backend_url = os.environ.get("BACKEND_URL", "https://api.smartdatatest.com")
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        f"connect-src 'self' {_backend_url}; "
        "frame-ancestors 'none';"
    )
    # HSTS (only meaningful in production/HTTPS, safe to always add)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


@app.errorhandler(HTTPException)
def handle_http_exception(exc):
    """Return HTTP errors as JSON, preserving their status code.

    This is a JSON API, so an error must not fall through to Flask's default
    HTML page — clients parse the body. Registering this centrally also means
    a route that lets a client error propagate (malformed JSON raising
    BadRequest out of get_json(), a 401 from the token check, a 413 from the
    size guard) still answers in the same shape as every other response.
    """
    return jsonify({"error": exc.description, "status": exc.code}), exc.code


# Import and register blueprints with error handling
# Critical blueprints are imported first
blueprints_to_register = [
    # Critical features first (simpler, less dependencies)
    ("metrics", "metrics.routes", "metrics_bp"),
    ("checklist", "checklist.routes", "checklist_bp"),
    ("dataset_inspector", "dataset_inspector.routes", "dataset_inspector_bp"),
    ("accuracy", "accuracy.routes", "accuracy_bp"),
    ("gold", "gold.routes", "gold_bp"),
    ("synthetic", "synthetic.routes", "synth_bp"),
    # RAG last (has complex initialization)
    ("rag", "rag.routes_simple", "rag_bp"),
    # Auth (login validation)
    ("auth", "auth.routes", "auth_bp"),
]

# Token enforcement is installed before the blueprints so that it covers every
# route they register, including any added later. See src/auth/api_token.py:
# everything is protected unless explicitly allowlisted.
from auth.api_token import init_api_token_auth  # noqa: E402

init_api_token_auth(app)

for feature_name, module_path, blueprint_name in blueprints_to_register:
    try:
        module = __import__(module_path, fromlist=[blueprint_name])
        blueprint = getattr(module, blueprint_name)
        app.register_blueprint(blueprint)
        print(f"[OK] Registered blueprint: {feature_name}")
    except Exception as e:
        print(f"[FAIL] Failed to register blueprint {feature_name}: {str(e)}")
        # Continue registering other blueprints even if one fails


@app.route("/api/stats", methods=["GET"])
def platform_stats():
    """Return live platform stats used by the login page dashboard."""
    import re
    from pathlib import Path

    base = Path(__file__).resolve().parent.parent  # workspace root

    # ── Backend tests: count `def test_` functions ──────────────────────────
    backend_tests = 0
    for f in base.glob("tests/backend/**/*.py"):
        try:
            content = f.read_text(encoding="utf-8", errors="ignore")
            backend_tests += len(re.findall(r"^\s*def test_", content, re.MULTILINE))
        except OSError:
            pass

    # ── Frontend tests: count test( / it( calls ──────────────────────────────
    frontend_tests = 0
    for f in base.glob("tests/frontend/**/*.test.js"):
        try:
            content = f.read_text(encoding="utf-8", errors="ignore")
            frontend_tests += len(re.findall(r"(?:^|\s)(?:test|it)\s*\(", content, re.MULTILINE))
        except OSError:
            pass

    total_tests = backend_tests + frontend_tests

    # The container image deliberately excludes tests/ (see .dockerignore), so
    # the globs above find nothing and the dashboard would report "0 tests".
    # Fall back to a build-time baseline instead of publishing a wrong zero.
    if total_tests == 0:
        total_tests = int(os.environ.get("PLATFORM_TESTS_TOTAL", "0"))

    # ── Dataset files in storage ─────────────────────────────────────────────
    # Capped walk: storage/ grows without bound as sessions accumulate, and an
    # uncapped rglob on every request turns a public endpoint into disk I/O
    # amplification.
    storage_path = base / "storage"
    dataset_count = 0
    if storage_path.exists():
        scan_limit = int(os.environ.get("STATS_SCAN_LIMIT", "5000"))
        for path in storage_path.rglob("*"):
            if path.is_file():
                dataset_count += 1
                if dataset_count >= scan_limit:
                    break

    # ── Coverage from cobertura XML (generated by Jest --coverage) ───────────
    coverage_pct = 86  # last known baseline
    coverage_xml = base / "test-results" / "frontend" / "coverage" / "cobertura-coverage.xml"
    if coverage_xml.exists():
        try:
            xml_content = coverage_xml.read_text(encoding="utf-8")
            m = re.search(r'line-rate="([0-9.]+)"', xml_content)
            if m:
                coverage_pct = round(float(m.group(1)) * 100)
        except OSError:
            pass

    return jsonify(
        {
            "tests_total": total_tests,
            "datasets_total": dataset_count,
            "coverage_pct": coverage_pct,
            "response_sla_ms": 2000,
        }
    )


@app.route("/", methods=["GET"])
def health_check():
    """Health check endpoint to verify API is running."""
    return jsonify({"status": "Backend is running", "message": "Data Quality Chatbot API"})


@app.route("/ask", methods=["POST"])
@limiter.limit("10 per minute")
def ask_question():
    """Process user answers and generate DSL and PySpark code."""
    try:
        data = request.get_json()
        user_answers = data.get("answers", {})

        print(f"Received answers: {list(user_answers.keys())}")

        # This is a simplified integration. In a real scenario, you'd manage the conversation state.
        # For now, we'll just process the answers and return the generated DSL and PySpark code.

        dsl, pyspark_code, errors, warnings = process_chatbot_request(user_answers)

        print(f"Generated DSL with {len(dsl.get('rules', []))} rules")
        print(f"Generated PySpark code length: {len(pyspark_code)}")
        if warnings:
            print(f"Warnings: {len(warnings)}")
        if errors:
            print(f"Errors: {len(errors)}")

        return jsonify(
            {
                "dsl": dsl,
                "pyspark_code": pyspark_code,
                "errors": errors,
                "warnings": warnings,
            }
        )
    except HTTPException:
        # Malformed JSON makes get_json() raise BadRequest. Letting the broad
        # handler below catch it turned a client error into a 500, so the
        # response said "400 Bad Request" while the status code said 500.
        # Re-raise so Flask returns the status the exception carries.
        raise
    except Exception as ex:  # pylint: disable=broad-exception-caught
        # Catching all exceptions to provide a stable API response
        print(f"Error in ask_question: {ex}")
        return (
            jsonify({"error": str(ex), "dsl": {}, "pyspark_code": "", "errors": [str(ex)]}),
            500,
        )


if __name__ == "__main__":
    app.run(debug=True)
