"""SQLite store for users, invites, sessions and the audit trail.

Two separations run through this module:

* Authenticating is not authorising. Google says *who* someone is; anybody in
  the world has a Google account. Whether they may use the platform is the
  operator's decision, so every new account is born ``pending`` unless its
  e-mail was invited beforehand.

* Secrets never rest in the clear. Session tokens and login codes are 256-bit
  random values and only their SHA-256 is stored, so a copy of the database (a
  backup, say) cannot be used to impersonate anyone. Plain SHA-256 is right
  here, and Argon2 would not be: there is no low-entropy password to stretch.

Journal mode stays on DELETE, SQLite's default. The database lives on a bind
mount shared between macOS and the container's Linux VM, and WAL keeps its index
in shared memory that the two kernels do not share. For the same reason nothing
on the host may open this file while the container runs: use ``python -m
auth.cli`` inside the container, backups included.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import sqlite3
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Iterator

from auth.identity import google_is_authoritative, normalize_email

STATUSES = ("pending", "approved", "blocked")

# Prefix of session tokens, so the request gate can tell one from a machine
# token without a database lookup, and secret scanners can recognise a leak.
SESSION_PREFIX = "sdt_"

LOGIN_CODE_SECONDS = 60

# How stale last_seen_at may get. Writing it on every request would turn each
# read into a write for information nobody needs to the second.
_LAST_SEEN_GRANULARITY = 300

_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id                  TEXT PRIMARY KEY,
    -- Google's permanent identifier. Never the e-mail: addresses change hands.
    google_sub          TEXT NOT NULL UNIQUE,
    email               TEXT NOT NULL,
    email_normalized    TEXT NOT NULL,
    email_authoritative INTEGER NOT NULL DEFAULT 0,
    name                TEXT NOT NULL DEFAULT '',
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'blocked')),
    -- Only ever set by auth.cli, on the server. A route that grants privilege
    -- is a route that can be abused to escalate it.
    is_admin            INTEGER NOT NULL DEFAULT 0,
    profile             TEXT,
    created_at          TEXT NOT NULL,
    approved_at         TEXT,
    last_login_at       TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email_normalized);

CREATE TABLE IF NOT EXISTS invites (
    email_normalized TEXT PRIMARY KEY,
    email            TEXT NOT NULL,
    created_at       TEXT NOT NULL,
    created_by       TEXT NOT NULL,
    used_at          TEXT,
    used_by          TEXT
);

CREATE TABLE IF NOT EXISTS login_codes (
    code_hash  TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    challenge  TEXT NOT NULL,
    remember   INTEGER NOT NULL DEFAULT 0,
    expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash   TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    origin       TEXT NOT NULL,
    created_at   INTEGER NOT NULL,
    expires_at   INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS audit (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    ts     TEXT NOT NULL,
    actor  TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT,
    detail TEXT
);
"""


class UnknownUser(LookupError):
    """No user matches the given id."""


class ProtectedUser(PermissionError):
    """The change is not allowed on an administrator."""


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def challenge_for(verifier: str) -> str:
    """PKCE S256: base64url(sha256(verifier)), without padding."""
    digest = hashlib.sha256(verifier.encode()).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode()


class AuthStore:
    """Access to the authentication database at *path*."""

    def __init__(self, path: Path | str, clock=time.time):
        self.path = Path(path)
        self._clock = clock

    # ── plumbing ────────────────────────────────────────────────────────────

    def init_schema(self) -> None:
        """Create the database if needed. Idempotent."""
        self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        is_new = not self.path.exists()
        with self._open() as con:
            con.executescript(_SCHEMA)
        if is_new:
            self.path.chmod(0o600)

    @contextmanager
    def _open(self) -> Iterator[sqlite3.Connection]:
        con = sqlite3.connect(self.path, timeout=10, isolation_level=None)
        con.row_factory = sqlite3.Row
        con.execute("PRAGMA foreign_keys = ON")
        try:
            yield con
        finally:
            con.close()

    @contextmanager
    def _write(self) -> Iterator[sqlite3.Connection]:
        """A write transaction. IMMEDIATE takes the lock up front, so a
        read-then-write inside it cannot interleave with another writer."""
        with self._open() as con:
            con.execute("BEGIN IMMEDIATE")
            try:
                yield con
            except BaseException:
                con.execute("ROLLBACK")
                raise
            con.execute("COMMIT")

    def _now(self) -> int:
        return int(self._clock())

    def _now_iso(self) -> str:
        return datetime.fromtimestamp(self._clock(), timezone.utc).isoformat(timespec="seconds")

    def _audit(self, con, actor: str, action: str, target: str | None, detail: str = "") -> None:
        con.execute(
            "INSERT INTO audit (ts, actor, action, target, detail) VALUES (?,?,?,?,?)",
            (self._now_iso(), actor, action, target, detail),
        )

    @staticmethod
    def _user_row(con, user_id: str) -> dict:
        row = con.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if row is None:
            raise UnknownUser(user_id)
        return dict(row)

    # ── users ───────────────────────────────────────────────────────────────

    def record_google_login(self, claims: dict) -> dict:
        """Create or refresh the user behind a verified set of Google claims.

        Name and e-mail follow whatever Google says today; status and privilege
        never do.
        """
        sub = claims["sub"]
        email = str(claims["email"]).strip()
        name = str(claims.get("name") or "").strip()
        normalized = normalize_email(email)
        authoritative = int(google_is_authoritative(claims))
        now = self._now_iso()

        with self._write() as con:
            row = con.execute("SELECT id FROM users WHERE google_sub = ?", (sub,)).fetchone()
            if row is None:
                user_id = f"usr_{secrets.token_hex(8)}"
                con.execute(
                    """INSERT INTO users (id, google_sub, email, email_normalized,
                                          email_authoritative, name, created_at, last_login_at)
                       VALUES (?,?,?,?,?,?,?,?)""",
                    (user_id, sub, email, normalized, authoritative, name, now, now),
                )
                self._audit(con, user_id, "user_created", user_id, email)
            else:
                user_id = row["id"]
                con.execute(
                    """UPDATE users SET email = ?, email_normalized = ?,
                              email_authoritative = ?, name = ?, last_login_at = ?
                       WHERE id = ?""",
                    (email, normalized, authoritative, name, now, user_id),
                )
            self._apply_invite(con, user_id)
            return self._user_row(con, user_id)

    def get_user(self, user_id: str) -> dict:
        with self._open() as con:
            return self._user_row(con, user_id)

    def find_by_email(self, email: str) -> list[dict]:
        """All accounts on this address. More than one is possible: an address
        can be recycled into a different Google account."""
        with self._open() as con:
            rows = con.execute(
                "SELECT * FROM users WHERE email_normalized = ? ORDER BY created_at",
                (normalize_email(email),),
            )
            return [dict(r) for r in rows]

    def list_users(self) -> list[dict]:
        """Every user, pending first, flagged when an invite is waiting."""
        with self._open() as con:
            rows = con.execute("""SELECT u.*, i.email_normalized IS NOT NULL AS invited
                   FROM users u
                   LEFT JOIN invites i
                     ON i.email_normalized = u.email_normalized AND i.used_at IS NULL
                   ORDER BY CASE u.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1
                            ELSE 2 END, u.created_at DESC""")
            return [dict(r) for r in rows]

    def set_status(
        self, user_id: str, status: str, actor: str, *, allow_admin: bool = False
    ) -> dict:
        """Approve, block or send back to pending.

        Blocking deletes the sessions in the same transaction. Without it the
        person would be refused at the next login while whatever they have open
        kept working until it expired.
        """
        if status not in STATUSES:
            raise ValueError(f"unknown status {status!r}")
        with self._write() as con:
            user = self._user_row(con, user_id)
            if user["is_admin"] and not allow_admin:
                raise ProtectedUser(user_id)
            con.execute(
                "UPDATE users SET status = ?, approved_at = ? WHERE id = ?",
                (status, self._now_iso() if status == "approved" else None, user_id),
            )
            if status == "blocked":
                con.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
                con.execute("DELETE FROM login_codes WHERE user_id = ?", (user_id,))
            self._audit(con, actor, f"status_{status}", user_id, user["email"])
            return self._user_row(con, user_id)

    def set_admin(self, user_id: str, is_admin: bool, actor: str) -> dict:
        """Grant or remove administration. Called from auth.cli only."""
        with self._write() as con:
            user = self._user_row(con, user_id)
            if is_admin:
                con.execute(
                    """UPDATE users SET is_admin = 1, status = 'approved',
                              approved_at = COALESCE(approved_at, ?) WHERE id = ?""",
                    (self._now_iso(), user_id),
                )
            else:
                con.execute("UPDATE users SET is_admin = 0 WHERE id = ?", (user_id,))
            action = "admin_granted" if is_admin else "admin_removed"
            self._audit(con, actor, action, user_id, user["email"])
            return self._user_row(con, user_id)

    def set_profile(self, user_id: str, profile: str) -> dict:
        with self._write() as con:
            con.execute("UPDATE users SET profile = ? WHERE id = ?", (profile, user_id))
            return self._user_row(con, user_id)

    # ── invites ─────────────────────────────────────────────────────────────

    def _apply_invite(self, con, user_id: str) -> bool:
        """Approve a pending user whose e-mail was invited.

        Blocked users are left alone: an old invite must not undo a block. So
        are addresses Google does not vouch for — those stay pending, flagged as
        invited, for the operator to confirm with the person.
        """
        user = self._user_row(con, user_id)
        if user["status"] != "pending" or not user["email_authoritative"]:
            return False
        invite = con.execute(
            "SELECT 1 FROM invites WHERE email_normalized = ? AND used_at IS NULL",
            (user["email_normalized"],),
        ).fetchone()
        if invite is None:
            return False
        now = self._now_iso()
        con.execute(
            "UPDATE users SET status = 'approved', approved_at = ? WHERE id = ?", (now, user_id)
        )
        con.execute(
            "UPDATE invites SET used_at = ?, used_by = ? WHERE email_normalized = ?",
            (now, user_id, user["email_normalized"]),
        )
        self._audit(con, "system", "approved_by_invite", user_id, user["email"])
        return True

    def add_invites(self, emails: Iterable[str], actor: str) -> list[str]:
        """Invite addresses; returns the ids of pending users approved on the spot."""
        approved = []
        with self._write() as con:
            for email in emails:
                email = email.strip()
                normalized = normalize_email(email)
                con.execute(
                    """INSERT INTO invites (email_normalized, email, created_at, created_by)
                       VALUES (?,?,?,?)
                       ON CONFLICT (email_normalized) DO UPDATE SET
                           email = excluded.email, created_at = excluded.created_at,
                           created_by = excluded.created_by, used_at = NULL, used_by = NULL""",
                    (normalized, email, self._now_iso(), actor),
                )
                self._audit(con, actor, "invited", None, email)
                waiting = con.execute(
                    "SELECT id FROM users WHERE email_normalized = ? AND status = 'pending'",
                    (normalized,),
                ).fetchall()
                approved += [r["id"] for r in waiting if self._apply_invite(con, r["id"])]
        return approved

    def revoke_invite(self, email: str, actor: str) -> bool:
        with self._write() as con:
            removed = con.execute(
                "DELETE FROM invites WHERE email_normalized = ? AND used_at IS NULL",
                (normalize_email(email),),
            ).rowcount
            if removed:
                self._audit(con, actor, "invite_revoked", None, email.strip())
        return bool(removed)

    def open_invites(self) -> list[dict]:
        with self._open() as con:
            rows = con.execute(
                "SELECT email, created_at FROM invites WHERE used_at IS NULL ORDER BY created_at"
            )
            return [dict(r) for r in rows]

    # ── login codes and sessions ────────────────────────────────────────────

    def issue_login_code(self, user_id: str, challenge: str, remember: bool) -> str:
        """One-time code handed to the browser on the way back from Google.

        It travels in a URL, so on its own it must be worthless: it lives a
        minute, works once, and only for whoever holds the verifier behind
        *challenge* — which never left the browser that started the login.
        """
        code = secrets.token_urlsafe(32)
        with self._write() as con:
            con.execute("DELETE FROM login_codes WHERE expires_at <= ?", (self._now(),))
            con.execute(
                """INSERT INTO login_codes (code_hash, user_id, challenge, remember, expires_at)
                   VALUES (?,?,?,?,?)""",
                (_hash(code), user_id, challenge, int(remember), self._now() + LOGIN_CODE_SECONDS),
            )
        return code

    def redeem_login_code(
        self, code: str, verifier: str, *, seconds: int, remembered_seconds: int
    ) -> tuple[str, int, dict] | None:
        """Trade a code for ``(session token, expiry, user)``, or None.

        The row is deleted before anything is checked, so a wrong verifier burns
        the code instead of leaving it there to be guessed at.
        """
        with self._write() as con:
            row = con.execute(
                "DELETE FROM login_codes WHERE code_hash = ? RETURNING *", (_hash(code),)
            ).fetchone()
            if row is None or row["expires_at"] <= self._now():
                return None
            if not hmac.compare_digest(row["challenge"], challenge_for(verifier)):
                return None
            user = self._user_row(con, row["user_id"])
            if user["status"] == "blocked":
                return None
            lifetime = remembered_seconds if row["remember"] else seconds
            token, expires_at = self._new_session(con, user["id"], lifetime, "google")
            return token, expires_at, user

    def create_session(self, user_id: str, seconds: int, origin: str) -> tuple[str, int]:
        """Open a session outside the Google flow. Called from auth.cli only."""
        with self._write() as con:
            user = self._user_row(con, user_id)
            token, expires_at = self._new_session(con, user_id, seconds, origin)
            self._audit(con, origin, "session_created", user_id, user["email"])
            return token, expires_at

    def _new_session(self, con, user_id: str, seconds: int, origin: str) -> tuple[str, int]:
        now = self._now()
        con.execute("DELETE FROM sessions WHERE expires_at <= ?", (now,))
        token = SESSION_PREFIX + secrets.token_urlsafe(32)
        con.execute(
            """INSERT INTO sessions (token_hash, user_id, origin, created_at,
                                     expires_at, last_seen_at) VALUES (?,?,?,?,?,?)""",
            (_hash(token), user_id, origin, now, now + seconds, now),
        )
        return token, now + seconds

    def authenticate(self, token: str) -> dict | None:
        """The user behind a live session, with ``session_expires_at`` added.

        Status is read from the database on every call rather than carried in
        the token. That is what makes a block take effect immediately.
        """
        if not token.startswith(SESSION_PREFIX):
            return None
        token_hash = _hash(token)
        now = self._now()
        with self._open() as con:
            row = con.execute(
                """SELECT u.*, s.expires_at AS session_expires_at, s.last_seen_at
                   FROM sessions s JOIN users u ON u.id = s.user_id
                   WHERE s.token_hash = ? AND s.expires_at > ?""",
                (token_hash, now),
            ).fetchone()
        if row is None or row["status"] == "blocked":
            return None
        if now - row["last_seen_at"] >= _LAST_SEEN_GRANULARITY:
            with self._write() as con:
                con.execute(
                    "UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?", (now, token_hash)
                )
        return dict(row)

    def end_session(self, token: str) -> bool:
        with self._write() as con:
            return bool(
                con.execute("DELETE FROM sessions WHERE token_hash = ?", (_hash(token),)).rowcount
            )

    # ── audit and backup ────────────────────────────────────────────────────

    def recent_audit(self, limit: int = 20) -> list[dict]:
        with self._open() as con:
            rows = con.execute(
                "SELECT ts, actor, action, target, detail FROM audit ORDER BY id DESC LIMIT ?",
                (limit,),
            )
            return [dict(r) for r in rows]

    def backup_to(self, destination: Path | str) -> None:
        """Consistent copy of the live database, verified before it is trusted.

        A copy that does not verify is removed: keeping it would mean finding
        out on the day it is needed. Counting users is part of the check because
        an empty file passes integrity_check — it is a valid, empty database.
        """
        destination = Path(destination)
        destination.unlink(missing_ok=True)
        target = sqlite3.connect(destination)
        try:
            with self._open() as source:
                source.backup(target)
            verdict = target.execute("PRAGMA integrity_check").fetchone()[0]
            target.execute("SELECT COUNT(*) FROM users").fetchone()
        except sqlite3.Error as exc:
            verdict = str(exc)
        finally:
            target.close()
        if verdict != "ok":
            destination.unlink(missing_ok=True)
            raise RuntimeError(f"backup failed its integrity check: {verdict}")
        destination.chmod(0o600)
