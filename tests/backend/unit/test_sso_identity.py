"""E-mail comparison and how far Google vouches for an address."""

import pytest

from auth.identity import (
    google_is_authoritative,
    initials,
    is_email_verified,
    is_valid_email,
    normalize_email,
)


class TestNormalizeEmail:
    @pytest.mark.parametrize(
        "typed",
        ["Fulano.Silva@gmail.com", " fulanosilva@GMAIL.com ", "fulano.silva+qa@googlemail.com"],
    )
    def test_spellings_of_one_gmail_mailbox_are_equal(self, typed):
        assert normalize_email(typed) == "fulanosilva@gmail.com"

    def test_other_providers_keep_dots_and_plus(self):
        """There they are different mailboxes; merging them would let one
        person consume another person's invite."""
        assert normalize_email("A.B+c@empresa.com") == "a.b+c@empresa.com"
        assert normalize_email("a.b@empresa.com") != normalize_email("ab@empresa.com")


class TestAuthority:
    def test_gmail_is_authoritative(self):
        assert google_is_authoritative({"email": "x@gmail.com"})

    def test_workspace_domain_is_authoritative(self):
        assert google_is_authoritative({"email": "x@empresa.com", "hd": "empresa.com"})

    def test_google_account_over_another_mailbox_is_not(self):
        assert not google_is_authoritative({"email": "x@yahoo.com", "email_verified": True})

    def test_a_lookalike_domain_is_not(self):
        assert not google_is_authoritative({"email": "x@notgmail.com"})
        assert not google_is_authoritative({"email": "x@gmail.com.evil.example"})


class TestVerified:
    @pytest.mark.parametrize("value", [True, "true"])
    def test_verified(self, value):
        assert is_email_verified({"email_verified": value})

    @pytest.mark.parametrize("value", [False, "false", None, "", 1])
    def test_anything_else_is_not(self, value):
        assert not is_email_verified({"email_verified": value})

    def test_absent_claim_is_not(self):
        assert not is_email_verified({})


class TestInitials:
    @pytest.mark.parametrize(
        "name,email,expected",
        [
            ("Icaro Santos", "i@x.com", "IS"),
            ("Maria da Silva Souza", "m@x.com", "MS"),
            ("Cher", "c@x.com", "CH"),
            ("", "fulano@x.com", "F"),
            ("123 456", "z@x.com", "Z"),
            ("", "", "?"),
        ],
    )
    def test_initials(self, name, email, expected):
        assert initials(name, email) == expected


@pytest.mark.parametrize("value", ["a@b.co", " a@b.co "])
def test_valid_email(value):
    assert is_valid_email(value)


@pytest.mark.parametrize("value", ["", "a", "a@b", "a b@c.co", "a@b.co, c@d.co", "x" * 250 + "@b.co"])
def test_invalid_email(value):
    assert not is_valid_email(value)
