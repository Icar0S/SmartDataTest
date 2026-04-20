"""Auth routes — Blueprint for /api/auth endpoints."""

from flask import Blueprint, jsonify, request

from auth.storage import get_user_by_email, user_to_session_dict, verify_password

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.route("/validate", methods=["POST"])
def validate():
    """Validate user credentials.

    Body (JSON): {"email": str, "password": str}

    Returns:
        200 {"valid": true, "user": {...}}   — credentials OK
        400 {"valid": false, "error": "..."}  — missing fields
        401 {"valid": false, "error": "..."}  — bad credentials
    """
    data = request.get_json(silent=True) or {}
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"valid": False, "error": "email and password are required"}), 400

    user = get_user_by_email(email)
    if user is None:
        return jsonify({"valid": False, "error": "User not found"}), 401

    if not verify_password(user["password_hash"], password):
        return jsonify({"valid": False, "error": "Invalid password"}), 401

    return jsonify({"valid": True, "user": user_to_session_dict(user)}), 200
