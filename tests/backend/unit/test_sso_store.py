"""The user database: who gets in, for how long, and what a leak would reveal."""

import os
import sqlite3
import stat
import threading

import pytest

from auth.store import AuthStore, ProtectedUser, UnknownUser, challenge_for

VERIFIER = "v" * 43
CHALLENGE = challenge_for(VERIFIER)
LIFETIMES = {"seconds": 100, "remembered_seconds": 1000}


class Clock:
    def __init__(self):
        self.now = 1_800_000_000.0

    def __call__(self):
        return self.now


@pytest.fixture
def clock():
    return Clock()


@pytest.fixture
def store(tmp_path, clock):
    s = AuthStore(tmp_path / "data" / "auth.sqlite3", clock=clock)
    s.init_schema()
    return s


def claims(sub="sub-1", email="fulano@gmail.com", name="Fulano de Tal", **extra):
    return {"sub": sub, "email": email, "name": name, "email_verified": True, **extra}


def approved(store, **kwargs):
    user = store.record_google_login(claims(**kwargs))
    return store.set_status(user["id"], "approved", actor="test")


class TestFirstLogin:
    def test_new_account_is_born_pending(self, store):
        """Anyone in the world has a Google account."""
        user = store.record_google_login(claims())
        assert user["status"] == "pending" and not user["is_admin"]

    def test_second_login_updates_name_and_email_but_not_status(self, store):
        user = approved(store)
        again = store.record_google_login(claims(email="novo@gmail.com", name="Outro Nome"))
        assert again["id"] == user["id"]
        assert (again["email"], again["name"]) == ("novo@gmail.com", "Outro Nome")
        assert again["status"] == "approved"

    def test_identity_is_the_sub_not_the_email(self, store):
        """A recycled address must not inherit the previous owner's access."""
        first = approved(store, sub="sub-1")
        second = store.record_google_login(claims(sub="sub-2"))
        assert second["id"] != first["id"] and second["status"] == "pending"
        assert len(store.find_by_email("fulano@gmail.com")) == 2

    def test_missing_name_is_tolerated(self, store):
        assert store.record_google_login(claims(name=None))["name"] == ""

    def test_concurrent_first_logins_create_one_account(self, store):
        errors = []

        def login():
            try:
                store.record_google_login(claims())
            except Exception as exc:  # pylint: disable=broad-exception-caught
                errors.append(exc)

        threads = [threading.Thread(target=login) for _ in range(8)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        assert errors == [] and len(store.list_users()) == 1


class TestInvites:
    def test_invited_email_gets_in_on_first_login(self, store):
        store.add_invites(["Fulano@Gmail.com"], actor="op")
        assert store.record_google_login(claims())["status"] == "approved"

    def test_dots_and_case_do_not_matter_for_gmail(self, store):
        store.add_invites(["fu.la.no@gmail.com"], actor="op")
        assert store.record_google_login(claims())["status"] == "approved"

    def test_invite_works_once(self, store):
        store.add_invites(["fulano@gmail.com"], actor="op")
        store.record_google_login(claims(sub="sub-1"))
        assert store.record_google_login(claims(sub="sub-2"))["status"] == "pending"
        assert store.open_invites() == []

    def test_invite_approves_someone_already_waiting(self, store):
        user = store.record_google_login(claims())
        assert store.add_invites(["fulano@gmail.com"], actor="op") == [user["id"]]
        assert store.get_user(user["id"])["status"] == "approved"

    def test_address_google_does_not_vouch_for_stays_pending_and_flagged(self, store):
        store.add_invites(["fulano@yahoo.com"], actor="op")
        user = store.record_google_login(claims(email="fulano@yahoo.com"))
        assert user["status"] == "pending"
        assert store.list_users()[0]["invited"]

    def test_workspace_address_is_accepted(self, store):
        store.add_invites(["fulano@empresa.com"], actor="op")
        user = store.record_google_login(claims(email="fulano@empresa.com", hd="empresa.com"))
        assert user["status"] == "approved"

    def test_invite_does_not_undo_a_block(self, store):
        user = store.record_google_login(claims())
        store.set_status(user["id"], "blocked", actor="op")
        store.add_invites(["fulano@gmail.com"], actor="op")
        assert store.record_google_login(claims())["status"] == "blocked"

    def test_revoked_invite_no_longer_works(self, store):
        store.add_invites(["fulano@gmail.com"], actor="op")
        assert store.revoke_invite("FULANO@gmail.com", actor="op")
        assert store.record_google_login(claims())["status"] == "pending"

    def test_revoking_an_unknown_or_used_invite_says_so(self, store):
        assert not store.revoke_invite("ninguem@gmail.com", actor="op")
        store.add_invites(["fulano@gmail.com"], actor="op")
        store.record_google_login(claims())
        assert not store.revoke_invite("fulano@gmail.com", actor="op")

    def test_inviting_twice_is_harmless(self, store):
        store.add_invites(["a@gmail.com", "a@gmail.com"], actor="op")
        assert len(store.open_invites()) == 1


class TestStatus:
    def test_unknown_status_is_refused(self, store):
        user = store.record_google_login(claims())
        with pytest.raises(ValueError):
            store.set_status(user["id"], "root", actor="op")

    def test_unknown_user(self, store):
        with pytest.raises(UnknownUser):
            store.set_status("usr_nope", "approved", actor="op")

    def test_administrators_are_protected(self, store):
        user = approved(store)
        store.set_admin(user["id"], True, actor="cli")
        with pytest.raises(ProtectedUser):
            store.set_status(user["id"], "blocked", actor="op")
        assert store.set_status(user["id"], "blocked", "cli", allow_admin=True)["status"] == "blocked"

    def test_promoting_also_approves(self, store):
        user = store.record_google_login(claims())
        promoted = store.set_admin(user["id"], True, actor="cli")
        assert promoted["is_admin"] and promoted["status"] == "approved"
        assert promoted["approved_at"]

    def test_demoting_keeps_access(self, store):
        user = approved(store)
        store.set_admin(user["id"], True, actor="cli")
        demoted = store.set_admin(user["id"], False, actor="cli")
        assert not demoted["is_admin"] and demoted["status"] == "approved"

    def test_pending_accounts_are_listed_first(self, store):
        approved(store, sub="a", email="a@gmail.com")
        store.record_google_login(claims(sub="b", email="b@gmail.com"))
        assert [u["status"] for u in store.list_users()] == ["pending", "approved"]


class TestLoginCodes:
    def redeem(self, store, code, verifier=VERIFIER):
        return store.redeem_login_code(code, verifier, **LIFETIMES)

    def test_code_with_the_right_verifier_opens_a_session(self, store):
        user = approved(store)
        token, _, who = self.redeem(store, store.issue_login_code(user["id"], CHALLENGE, False))
        assert who["id"] == user["id"]
        assert store.authenticate(token)["id"] == user["id"]

    def test_code_works_once(self, store):
        code = store.issue_login_code(approved(store)["id"], CHALLENGE, False)
        assert self.redeem(store, code) and self.redeem(store, code) is None

    def test_stolen_code_without_the_verifier_is_worthless_and_burned(self, store):
        code = store.issue_login_code(approved(store)["id"], CHALLENGE, False)
        assert self.redeem(store, code, "w" * 43) is None
        assert self.redeem(store, code) is None

    def test_code_expires(self, store, clock):
        code = store.issue_login_code(approved(store)["id"], CHALLENGE, False)
        clock.now += 61
        assert self.redeem(store, code) is None

    def test_expired_codes_are_cleaned_up(self, store, clock):
        user = approved(store)
        store.issue_login_code(user["id"], CHALLENGE, False)
        clock.now += 61
        store.issue_login_code(user["id"], CHALLENGE, False)
        with sqlite3.connect(store.path) as con:
            assert con.execute("SELECT COUNT(*) FROM login_codes").fetchone()[0] == 1

    def test_unknown_code(self, store):
        assert self.redeem(store, "nope") is None

    def test_blocking_discards_a_code_in_flight(self, store):
        user = approved(store)
        code = store.issue_login_code(user["id"], CHALLENGE, False)
        store.set_status(user["id"], "blocked", actor="op")
        assert self.redeem(store, code) is None

    def test_two_tabs_racing_for_one_code_get_one_session(self, store):
        code = store.issue_login_code(approved(store)["id"], CHALLENGE, False)
        results = []
        threads = [
            threading.Thread(target=lambda: results.append(self.redeem(store, code)))
            for _ in range(6)
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        assert len([r for r in results if r]) == 1


class TestSessions:
    def session(self, store, remember=False):
        user = approved(store)
        code = store.issue_login_code(user["id"], CHALLENGE, remember)
        token, expires_at, _ = store.redeem_login_code(code, VERIFIER, **LIFETIMES)
        return user, token, expires_at

    def test_expiry_follows_remember_me(self, store, clock):
        _, _, expires_at = self.session(store, remember=False)
        assert expires_at == int(clock.now) + 100
        _, _, expires_at = self.session(store, remember=True)
        assert expires_at == int(clock.now) + 1000

    def test_session_expires(self, store, clock):
        _, token, _ = self.session(store)
        clock.now += 100
        assert store.authenticate(token) is None

    def test_block_takes_effect_on_the_next_request(self, store):
        user, token, _ = self.session(store)
        assert store.authenticate(token)
        store.set_status(user["id"], "blocked", actor="op")
        assert store.authenticate(token) is None

    def test_unblocking_does_not_revive_old_sessions(self, store):
        user, token, _ = self.session(store)
        store.set_status(user["id"], "blocked", actor="op")
        store.set_status(user["id"], "approved", actor="op")
        assert store.authenticate(token) is None

    def test_suspending_is_visible_on_the_next_request(self, store):
        user, token, _ = self.session(store)
        store.set_status(user["id"], "pending", actor="op")
        assert store.authenticate(token)["status"] == "pending"

    def test_logout_ends_only_that_session(self, store):
        _, first, _ = self.session(store)
        _, second, _ = self.session(store)
        assert store.end_session(first)
        assert store.authenticate(first) is None and store.authenticate(second)

    def test_logging_out_twice_is_harmless(self, store):
        _, token, _ = self.session(store)
        store.end_session(token)
        assert store.end_session(token) is False

    @pytest.mark.parametrize("token", ["", "nope", "sdt_", "sdt_" + "x" * 43, "Bearer x"])
    def test_garbage_is_not_a_session(self, store, token):
        assert store.authenticate(token) is None

    def test_last_seen_is_written_at_most_every_five_minutes(self, store, clock):
        _, token, _ = self.session(store, remember=True)

        def last_seen():
            with sqlite3.connect(store.path) as con:
                return con.execute("SELECT last_seen_at FROM sessions").fetchone()[0]

        start = last_seen()
        clock.now += 299
        store.authenticate(token)
        assert last_seen() == start
        clock.now += 1
        store.authenticate(token)
        assert last_seen() == start + 300

    def test_expired_sessions_are_cleaned_up(self, store, clock):
        self.session(store)
        clock.now += 101
        self.session(store)
        with sqlite3.connect(store.path) as con:
            assert con.execute("SELECT COUNT(*) FROM sessions").fetchone()[0] == 1

    def test_operator_session_is_audited(self, store):
        user = approved(store)
        token, _ = store.create_session(user["id"], 60, origin="cli")
        assert store.authenticate(token)["id"] == user["id"]
        assert store.recent_audit(1)[0]["action"] == "session_created"


class TestWhatALeakWouldReveal:
    def test_neither_token_nor_code_is_stored_in_the_clear(self, store):
        user = approved(store)
        code = store.issue_login_code(user["id"], CHALLENGE, False)
        token, _ = store.create_session(user["id"], 60, origin="cli")
        raw = store.path.read_bytes()
        assert token.encode() not in raw and code.encode() not in raw

    def test_database_is_readable_by_its_owner_only(self, store):
        assert stat.S_IMODE(os.stat(store.path).st_mode) == 0o600
        assert stat.S_IMODE(os.stat(store.path.parent).st_mode) == 0o700

    def test_schema_creation_is_idempotent(self, store):
        approved(store)
        store.init_schema()
        assert len(store.list_users()) == 1


class TestAudit:
    def test_every_decision_leaves_a_trail(self, store):
        store.add_invites(["b@gmail.com"], actor="op")
        user = store.record_google_login(claims())
        store.set_status(user["id"], "approved", actor="op")
        store.set_admin(user["id"], True, actor="cli")
        actions = [a["action"] for a in store.recent_audit()]
        assert actions == ["admin_granted", "status_approved", "user_created", "invited"]

    def test_failed_change_leaves_nothing_behind(self, store):
        """The audit entry and the change are one transaction."""
        before = len(store.recent_audit())
        with pytest.raises(UnknownUser):
            store.set_admin("usr_nope", True, actor="cli")
        assert len(store.recent_audit()) == before


class TestBackup:
    def test_copy_restores_the_same_users(self, store, tmp_path):
        user = approved(store)
        store.backup_to(tmp_path / "copy.sqlite3")
        assert AuthStore(tmp_path / "copy.sqlite3").get_user(user["id"])["email"] == user["email"]

    def test_copy_is_a_single_private_file(self, store, tmp_path):
        out = tmp_path / "out"
        out.mkdir()
        store.backup_to(out / "copy.sqlite3")
        assert [p.name for p in out.iterdir()] == ["copy.sqlite3"]
        assert stat.S_IMODE(os.stat(out / "copy.sqlite3").st_mode) == 0o600

    def test_overwrites_a_previous_copy(self, store, tmp_path):
        (tmp_path / "copy.sqlite3").write_bytes(b"lixo")
        store.backup_to(tmp_path / "copy.sqlite3")
        assert AuthStore(tmp_path / "copy.sqlite3").list_users() == []

    def test_copy_of_an_empty_file_is_refused(self, tmp_path):
        """A zero-byte file is a valid, empty database: integrity_check says ok."""
        empty = AuthStore(tmp_path / "empty.sqlite3")
        empty.path.touch()
        with pytest.raises(RuntimeError, match="integrity"):
            empty.backup_to(tmp_path / "copy.sqlite3")
        assert not (tmp_path / "copy.sqlite3").exists()
