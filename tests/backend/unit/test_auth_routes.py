"""Tests for POST /api/auth/validate endpoint."""
import sys
import os
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "src")))


class TestAuthValidateEndpoint(unittest.TestCase):
    """Tests for /api/auth/validate route."""

    def setUp(self):
        from api import app
        app.config["TESTING"] = True
        app.config["WTF_CSRF_ENABLED"] = False
        self.client = app.test_client()

    def test_valid_credentials_returns_200(self):
        """POST /api/auth/validate with valid credentials returns 200 and valid=true."""
        response = self.client.post(
            "/api/auth/validate",
            json={"email": "admin@dataforgetest.com", "password": "admin123"},
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(data.get("valid"))
        self.assertIn("user", data)

    def test_wrong_password_returns_401(self):
        """POST /api/auth/validate with wrong password returns 401 and valid=false."""
        response = self.client.post(
            "/api/auth/validate",
            json={"email": "admin@dataforgetest.com", "password": "wrongpassword"},
        )
        self.assertEqual(response.status_code, 401)
        data = response.get_json()
        self.assertFalse(data.get("valid"))
        self.assertIn("error", data)

    def test_nonexistent_email_returns_401(self):
        """POST /api/auth/validate with unknown email returns 401."""
        response = self.client.post(
            "/api/auth/validate",
            json={"email": "nobody@example.com", "password": "anypassword"},
        )
        self.assertEqual(response.status_code, 401)
        data = response.get_json()
        self.assertFalse(data.get("valid"))

    def test_missing_email_field_returns_400(self):
        """POST /api/auth/validate without email returns 400."""
        response = self.client.post(
            "/api/auth/validate",
            json={"password": "somepassword"},
        )
        self.assertEqual(response.status_code, 400)

    def test_missing_password_field_returns_400(self):
        """POST /api/auth/validate without password returns 400."""
        response = self.client.post(
            "/api/auth/validate",
            json={"email": "admin@dataforgetest.com"},
        )
        self.assertEqual(response.status_code, 400)

    def test_response_never_includes_password_hash(self):
        """Response JSON never includes password_hash."""
        response = self.client.post(
            "/api/auth/validate",
            json={"email": "admin@dataforgetest.com", "password": "admin123"},
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        user_data = data.get("user", {})
        self.assertNotIn("password_hash", user_data)


if __name__ == "__main__":
    unittest.main()
