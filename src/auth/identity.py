"""Small, dependency-free helpers about who a Google account is."""

from __future__ import annotations

import re

_EMAIL = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")
_GMAIL_DOMAINS = ("gmail.com", "googlemail.com")


def is_valid_email(value: str) -> bool:
    email = value.strip()
    return len(email) <= 254 and email.isascii() and bool(_EMAIL.fullmatch(email))


def normalize_email(value: str) -> str:
    """Reduce an address to the form used for comparing invites.

    Gmail ignores dots and anything after ``+`` in the local part, so
    ``Fulano.Silva@gmail.com`` and ``fulanosilva+qa@gmail.com`` are one mailbox.
    Without this, an invite typed with a dot out of place would silently never
    match. Other providers do treat those as different addresses, so for them
    only case and surrounding spaces are normalised.
    """
    email = value.strip().lower()
    local, _, domain = email.rpartition("@")
    if domain in _GMAIL_DOMAINS:
        local = local.split("+", 1)[0].replace(".", "")
        domain = "gmail.com"
    return f"{local}@{domain}"


def is_email_verified(claims: dict) -> bool:
    """Google sends a boolean; some providers send the string ``"true"``."""
    value = claims.get("email_verified")
    return value is True or value == "true"


def google_is_authoritative(claims: dict) -> bool:
    """True when Google itself vouches for who owns this mailbox.

    ``email_verified`` alone only says the address was confirmed at some point.
    For @gmail.com, and for Workspace domains (which carry the ``hd`` claim),
    Google runs the mailbox and the address is proof of identity. For any other
    address — a Google account created over a Yahoo or university mailbox — the
    mailbox may have changed hands since, so an invite must not be consumed on
    the strength of the e-mail alone.
    """
    domain = str(claims.get("email", "")).strip().lower().rpartition("@")[2]
    return domain in _GMAIL_DOMAINS or bool(claims.get("hd"))


def initials(name: str, email: str) -> str:
    """Up to two letters for the avatar circle."""
    parts = [p for p in re.split(r"\s+", name.strip()) if p and p[0].isalpha()]
    if len(parts) >= 2:
        return (parts[0][0] + parts[-1][0]).upper()
    if parts:
        return parts[0][:2].upper()
    return (email.strip()[:1] or "?").upper()
