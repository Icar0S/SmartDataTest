"""
Auth storage module.

⚠️ NO DATABASE — in-memory list. Migrate to DB when available.
Uses werkzeug.security for password hashing.

Users are loaded from the AUTH_USERS environment variable, which holds a JSON
array of objects with the keys: id, name, email, password_hash, role and
(optionally) avatar. Generate a hash with:

    python -c "from werkzeug.security import generate_password_hash as g; \\
               print(g('your-password'))"

Credentials are deliberately NOT hard-coded here any more. This module used to
ship three fixed demo accounts (admin/engineer/qa) whose plain-text passwords
were readable in the repository, which made them public knowledge for anyone
who could see the source. When AUTH_USERS is unset the store is empty in
production and every login attempt fails closed; a development fallback is
only enabled when FLASK_ENV is not "production".
"""

import json
import logging
import os

from werkzeug.security import check_password_hash, generate_password_hash

logger = logging.getLogger(__name__)


def _load_users() -> list[dict]:
    """Build the in-memory user store from the environment."""
    raw = os.environ.get("AUTH_USERS", "").strip()

    if raw:
        try:
            users = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"AUTH_USERS is not valid JSON: {exc}") from exc

        if not isinstance(users, list):
            raise RuntimeError("AUTH_USERS must be a JSON array of user objects")

        for user in users:
            missing = {"id", "name", "email", "password_hash", "role"} - set(user)
            if missing:
                raise RuntimeError(f"AUTH_USERS entry is missing keys: {sorted(missing)}")
            user.setdefault("avatar", None)
        return users

    if os.environ.get("FLASK_ENV", "").strip().lower() == "production":
        logger.critical(
            "AUTH_USERS is not set and FLASK_ENV=production: the user store is "
            "empty and all authentication will fail."
        )
        return []

    # Development-only fallback. The password is random per process, so these
    # accounts cannot be used to reach a deployed instance.
    logger.warning(
        "AUTH_USERS is not set — creating a development-only admin account "
        "with a random password. Set AUTH_USERS for any real deployment."
    )
    return [
        {
            "id": "user-dev-001",
            "name": "Development Admin",
            "email": "admin@localhost",
            "password_hash": generate_password_hash(os.urandom(16).hex()),
            "role": "admin",
            "avatar": None,
        }
    ]


USERS = _load_users()


def hash_password(password: str) -> str:
    """Hash a plain-text password using werkzeug."""
    return generate_password_hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    """Return True if *password* matches *password_hash*."""
    return check_password_hash(password_hash, password)


def get_user_by_email(email: str) -> dict | None:
    """Return the user dict for *email*, or None if not found."""
    for user in USERS:
        if user["email"] == email:
            return user
    return None


def user_to_session_dict(user: dict) -> dict:
    """Return a safe dict for the session — password_hash is never included."""
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "avatar": user.get("avatar"),
    }
