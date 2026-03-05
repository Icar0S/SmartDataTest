"""
Auth storage module.

⚠️ NO DATABASE — in-memory list. Migrate to DB when available.
Uses werkzeug.security for password hashing.
"""

from werkzeug.security import check_password_hash, generate_password_hash

# ---------------------------------------------------------------------------
# In-memory user store
# ⚠️ TEMPORARY — migrate to database when available
# ---------------------------------------------------------------------------
USERS = [
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
