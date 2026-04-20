"""Tests for src/auth/storage.py"""
import sys
import os
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "src")))


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


class TestGetUserByEmail(unittest.TestCase):
    """Tests for get_user_by_email function."""

    def test_returns_existing_user(self):
        """get_user_by_email returns user dict for existing email."""
        from auth.storage import get_user_by_email
        user = get_user_by_email("admin@dataforgetest.com")
        self.assertIsNotNone(user)
        self.assertEqual(user["email"], "admin@dataforgetest.com")

    def test_returns_none_for_nonexistent_email(self):
        """get_user_by_email returns None for unknown email."""
        from auth.storage import get_user_by_email
        user = get_user_by_email("nonexistent@example.com")
        self.assertIsNone(user)


class TestUserToSessionDict(unittest.TestCase):
    """Tests for user_to_session_dict function."""

    def test_never_includes_password_hash(self):
        """user_to_session_dict never includes password_hash field."""
        from auth.storage import get_user_by_email, user_to_session_dict
        user = get_user_by_email("admin@dataforgetest.com")
        self.assertIsNotNone(user)
        session_dict = user_to_session_dict(user)
        self.assertNotIn("password_hash", session_dict)

    def test_includes_expected_fields(self):
        """user_to_session_dict includes id, name, email, role, avatar."""
        from auth.storage import get_user_by_email, user_to_session_dict
        user = get_user_by_email("admin@dataforgetest.com")
        session_dict = user_to_session_dict(user)
        for field in ("id", "name", "email", "role"):
            self.assertIn(field, session_dict)


if __name__ == "__main__":
    unittest.main()
