"""Tests for src/auth/storage.py"""
import importlib
import json
import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "src")))

from werkzeug.security import generate_password_hash  # noqa: E402


def _reload_storage():
    """Re-import auth.storage so it re-reads the environment."""
    import auth.storage

    return importlib.reload(auth.storage)


# A user store built for the tests. Credentials are no longer hard-coded in the
# application, so the tests supply their own instead of relying on demo
# accounts that used to ship in the repository.
TEST_USERS = [
    {
        "id": "user-test-001",
        "name": "Test Admin",
        "email": "admin@example.test",
        "password_hash": generate_password_hash("s3cret-for-tests"),
        "role": "admin",
    }
]


class TestHashPassword(unittest.TestCase):
    """Tests for hash_password function."""

    def test_hash_password_returns_different_string(self):
        """hash_password returns a string different from the original password."""
        from auth.storage import hash_password
        password = "mypassword123"
        hashed = hash_password(password)
        self.assertIsInstance(hashed, str)
        self.assertNotEqual(hashed, password)

    def test_verify_password_correct(self):
        """verify_password returns True for correct password."""
        from auth.storage import hash_password, verify_password
        password = "mypassword123"
        hashed = hash_password(password)
        self.assertTrue(verify_password(hashed, password))

    def test_verify_password_incorrect(self):
        """verify_password returns False for incorrect password."""
        from auth.storage import hash_password, verify_password
        password = "mypassword123"
        hashed = hash_password(password)
        self.assertFalse(verify_password(hashed, "wrongpassword"))


class TestUserStoreLoading(unittest.TestCase):
    """Tests for how the user store is built from the environment."""

    def test_loads_users_from_env(self):
        """AUTH_USERS is parsed into the in-memory store."""
        with mock.patch.dict(os.environ, {"AUTH_USERS": json.dumps(TEST_USERS)}):
            storage = _reload_storage()
            self.assertEqual(len(storage.USERS), 1)
            self.assertEqual(storage.USERS[0]["email"], "admin@example.test")

    def test_production_without_auth_users_is_empty(self):
        """In production an unset AUTH_USERS fails closed rather than using demo accounts."""
        with mock.patch.dict(os.environ, {"AUTH_USERS": "", "FLASK_ENV": "production"}):
            storage = _reload_storage()
            self.assertEqual(storage.USERS, [])

    def test_invalid_json_raises(self):
        """Malformed AUTH_USERS is a startup error, not a silent empty store."""
        with mock.patch.dict(os.environ, {"AUTH_USERS": "{not json"}):
            with self.assertRaises(RuntimeError):
                _reload_storage()

    def test_missing_keys_raises(self):
        """A user entry missing required keys is rejected."""
        bad = json.dumps([{"id": "x", "email": "a@b.c"}])
        with mock.patch.dict(os.environ, {"AUTH_USERS": bad}):
            with self.assertRaises(RuntimeError):
                _reload_storage()

    def test_loads_users_from_file(self):
        """AUTH_USERS_FILE is read literally, bypassing $-interpolation."""
        import tempfile

        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as handle:
            json.dump(TEST_USERS, handle)
            path = handle.name
        with mock.patch.dict(os.environ, {"AUTH_USERS_FILE": path, "AUTH_USERS": ""}):
            storage = _reload_storage()
            self.assertEqual(storage.USERS[0]["email"], "admin@example.test")
        os.unlink(path)

    def test_file_takes_precedence_over_env(self):
        import tempfile

        other = [dict(TEST_USERS[0], email="from-file@example.test")]
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as handle:
            json.dump(other, handle)
            path = handle.name
        with mock.patch.dict(
            os.environ, {"AUTH_USERS_FILE": path, "AUTH_USERS": json.dumps(TEST_USERS)}
        ):
            storage = _reload_storage()
            self.assertEqual(storage.USERS[0]["email"], "from-file@example.test")
        os.unlink(path)

    def test_unreadable_file_raises(self):
        with mock.patch.dict(os.environ, {"AUTH_USERS_FILE": "/nonexistent/nope.json"}):
            with self.assertRaises(RuntimeError):
                _reload_storage()

    def test_truncated_password_hash_fails_loudly(self):
        """A hash mangled by $-interpolation must not load silently.

        Compose expands $ in .env and env_file values alike, so an unescaped
        werkzeug hash ("method$salt$digest") arrives cut at the first $. That
        used to produce a store that loaded fine and rejected every correct
        password. It must be a startup error instead.
        """
        mangled = [dict(TEST_USERS[0], password_hash="scrypt:32768:8:1")]
        with mock.patch.dict(os.environ, {"AUTH_USERS": json.dumps(mangled)}):
            with self.assertRaises(RuntimeError) as ctx:
                _reload_storage()
        self.assertIn("malformed", str(ctx.exception))

    def test_intact_password_hash_accepted(self):
        with mock.patch.dict(os.environ, {"AUTH_USERS": json.dumps(TEST_USERS)}):
            storage = _reload_storage()
            self.assertEqual(len(storage.USERS[0]["password_hash"].split("$")), 3)

    def test_no_hardcoded_demo_credentials_in_source(self):
        """The historical demo passwords must not reappear in the module source."""
        import auth.storage

        with open(auth.storage.__file__, "r", encoding="utf-8") as fh:
            source = fh.read()
        for secret in ("admin123", "engineer123", "qa123456"):
            self.assertNotIn(secret, source)


class TestGetUserByEmail(unittest.TestCase):
    """Tests for get_user_by_email function."""

    def setUp(self):
        self._env = mock.patch.dict(os.environ, {"AUTH_USERS": json.dumps(TEST_USERS)})
        self._env.start()
        self.storage = _reload_storage()

    def tearDown(self):
        self._env.stop()
        _reload_storage()

    def test_returns_existing_user(self):
        """get_user_by_email returns user dict for existing email."""
        user = self.storage.get_user_by_email("admin@example.test")
        self.assertIsNotNone(user)
        self.assertEqual(user["email"], "admin@example.test")

    def test_returns_none_for_nonexistent_email(self):
        """get_user_by_email returns None for unknown email."""
        user = self.storage.get_user_by_email("nonexistent@example.com")
        self.assertIsNone(user)


class TestUserToSessionDict(unittest.TestCase):
    """Tests for user_to_session_dict function."""

    def setUp(self):
        self._env = mock.patch.dict(os.environ, {"AUTH_USERS": json.dumps(TEST_USERS)})
        self._env.start()
        self.storage = _reload_storage()

    def tearDown(self):
        self._env.stop()
        _reload_storage()

    def test_never_includes_password_hash(self):
        """user_to_session_dict never includes password_hash field."""
        user = self.storage.get_user_by_email("admin@example.test")
        self.assertIsNotNone(user)
        session_dict = self.storage.user_to_session_dict(user)
        self.assertNotIn("password_hash", session_dict)

    def test_includes_expected_fields(self):
        """user_to_session_dict includes id, name, email, role, avatar."""
        user = self.storage.get_user_by_email("admin@example.test")
        session_dict = self.storage.user_to_session_dict(user)
        for field in ("id", "name", "email", "role"):
            self.assertIn(field, session_dict)


if __name__ == "__main__":
    unittest.main()
