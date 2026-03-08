"""Flask API for Data Quality Chatbot backend."""

import os
import sys

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, abort, jsonify, request
from flask_cors import CORS
from flask_limiter.util import get_remote_address
from werkzeug.middleware.proxy_fix import ProxyFix

from chatbot.main import process_chatbot_request
from limiter import limiter

app = Flask(__name__)
# Limit request body size to 10 MB to prevent DoS via oversized payloads
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 10 MB
# Rate limiting configuration
app.config["RATELIMIT_STORAGE_URI"] = "memory://"
app.config["RATELIMIT_DEFAULT_LIMITS"] = ["200 per day", "50 per hour"]

# Allowed origins for CORS — loaded from env var with safe default
_CORS_ORIGINS = os.environ.get(
    "CORS_ALLOWED_ORIGINS",
    "https://data-forge-test.vercel.app,https://dataforgetest.onrender.com,http://localhost:3000",
).split(",")

CORS(
    app,
    origins=_CORS_ORIGINS,
    methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    supports_credentials=False,
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
    _backend_url = os.environ.get("BACKEND_URL", "https://dataforgetest-backend.onrender.com")
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
]

for feature_name, module_path, blueprint_name in blueprints_to_register:
    try:
        module = __import__(module_path, fromlist=[blueprint_name])
        blueprint = getattr(module, blueprint_name)
        app.register_blueprint(blueprint)
        print(f"[OK] Registered blueprint: {feature_name}")
    except Exception as e:
        print(f"[FAIL] Failed to register blueprint {feature_name}: {str(e)}")
        # Continue registering other blueprints even if one fails


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
    except Exception as ex:  # pylint: disable=broad-exception-caught
        # Catching all exceptions to provide a stable API response
        print(f"Error in ask_question: {ex}")
        return (
            jsonify({"error": str(ex), "dsl": {}, "pyspark_code": "", "errors": [str(ex)]}),
            500,
        )


if __name__ == "__main__":
    app.run(debug=True)
