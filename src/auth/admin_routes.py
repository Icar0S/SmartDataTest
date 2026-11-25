"""Operator endpoints, under /api/auth/admin.

The request gate only lets an approved administrator in, and answers 404 to
everyone else who is logged in: for them these routes do not exist.

There is deliberately no endpoint that grants administration. That is done on
the server, with ``python -m auth.cli promover``.
"""

from __future__ import annotations

from flask import Blueprint, g, jsonify, request

from auth.identity import is_valid_email
from auth.routes import _never_cache, auth_store
from auth.store import STATUSES, ProtectedUser, UnknownUser
from limiter import limiter

auth_admin_bp = Blueprint("auth_admin", __name__, url_prefix="/api/auth/admin")
auth_admin_bp.after_request(_never_cache)

_MAX_INVITES_PER_CALL = 50


@auth_admin_bp.before_request
def _administrators_only():
    """The gate already checked. This is the second lock on the same door: the
    gate decides by path, and a disagreement between its idea of the path and
    the router's must not be enough to get in."""
    # The browser's preflight carries no credentials, and runs no view.
    if request.method == "OPTIONS":
        return None
    user = g.get("user")
    if not user or not user["is_admin"] or user["status"] != "approved":
        return jsonify({"error": "Not found"}), 404
    return None


def _admin_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "status": user["status"],
        "is_admin": bool(user["is_admin"]),
        "profile": user["profile"],
        "invited": bool(user.get("invited")),
        "email_authoritative": bool(user["email_authoritative"]),
        "created_at": user["created_at"],
        "approved_at": user["approved_at"],
        "last_login_at": user["last_login_at"],
    }


def _json_object() -> dict:
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


@auth_admin_bp.route("/users", methods=["GET"])
@limiter.limit("120 per minute")
def users():
    store = auth_store()
    return jsonify(
        {
            "users": [_admin_user(u) for u in store.list_users()],
            "invites": store.open_invites(),
            "audit": store.recent_audit(20),
        }
    )


@auth_admin_bp.route("/users/<user_id>/status", methods=["POST"])
@limiter.limit("60 per minute")
def set_status(user_id: str):
    status = _json_object().get("status")
    if status not in STATUSES:
        return jsonify({"error": "invalid_status"}), 400
    try:
        user = auth_store().set_status(user_id, status, actor=g.user["id"])
    except UnknownUser:
        return jsonify({"error": "unknown_user"}), 404
    except ProtectedUser:
        # Covers the administrator's own account: nobody locks the door from
        # the outside by accident, and one compromised admin session cannot
        # shut the others out.
        return jsonify({"error": "protected_user"}), 409
    return jsonify({"user": _admin_user(user)})


@auth_admin_bp.route("/invites", methods=["POST"])
@limiter.limit("30 per minute")
def add_invites():
    emails = _json_object().get("emails")
    if not isinstance(emails, list) or not 0 < len(emails) <= _MAX_INVITES_PER_CALL:
        return jsonify({"error": "invalid_emails"}), 400
    invalid = [e for e in emails if not isinstance(e, str) or not is_valid_email(e)]
    if invalid:
        # All or nothing: half a list accepted leaves the operator guessing.
        return jsonify({"error": "invalid_emails", "invalid": [str(e) for e in invalid]}), 400
    approved = auth_store().add_invites(emails, actor=g.user["id"])
    return jsonify({"invited": len(emails), "approved_now": len(approved)})


@auth_admin_bp.route("/invites/revoke", methods=["POST"])
@limiter.limit("30 per minute")
def revoke_invite():
    email = _json_object().get("email")
    if not isinstance(email, str) or not is_valid_email(email):
        return jsonify({"error": "invalid_emails"}), 400
    if not auth_store().revoke_invite(email, actor=g.user["id"]):
        return jsonify({"error": "unknown_invite"}), 404
    return "", 204
