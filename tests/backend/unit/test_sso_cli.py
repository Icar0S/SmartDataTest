"""The operator's command line: python -m auth.cli."""

import os
from unittest import mock

import pytest

from auth import cli
from auth.store import AuthStore
from tests.support.sso import sso_env


@pytest.fixture
def store(tmp_path):
    s = AuthStore(tmp_path / "auth.sqlite3")
    s.init_schema()
    return s


@pytest.fixture
def run(store, capsys):
    def invoke(*argv, **env):
        with mock.patch.dict(os.environ, sso_env("http://localhost:9", store.path, **env)):
            code = cli.main(list(argv))
        captured = capsys.readouterr()
        return code, captured.out, captured.err

    return invoke


@pytest.fixture
def user(store):
    return store.record_google_login(
        {"sub": "s1", "email": "fulano@gmail.com", "name": "Fulano", "email_verified": True}
    )


class TestFirstAdministrator:
    def test_promoting_breaks_the_chicken_and_egg(self, run, store, user):
        """Every login is born pending, so someone has to be let in from outside."""
        code, out, _ = run("promover", "Fulano@gmail.com")
        assert code == 0 and "administrador" in out
        assert store.get_user(user["id"])["is_admin"]

    def test_someone_who_never_signed_in_cannot_be_promoted(self, run):
        code, _, err = run("promover", "ninguem@gmail.com")
        assert code == 1 and "primeiro login" in err

    def test_ambiguous_email_is_refused(self, run, store, user):
        """Two Google accounts have used this address; guessing could promote
        the wrong person."""
        other = store.record_google_login(
            {"sub": "s2", "email": "fulano@gmail.com", "email_verified": True}
        )
        code, _, err = run("promover", "fulano@gmail.com")
        assert code == 1 and user["id"] in err and other["id"] in err
        assert run("promover", other["id"])[0] == 0
        assert not store.get_user(user["id"])["is_admin"]

    def test_demoting(self, run, store, user):
        run("promover", user["id"])
        assert run("rebaixar", user["id"])[0] == 0
        assert not store.get_user(user["id"])["is_admin"]


class TestAccess:
    @pytest.mark.parametrize(
        "command,status", [("aprovar", "approved"), ("bloquear", "blocked"), ("suspender", "pending")]
    )
    def test_status_commands(self, run, store, user, command, status):
        assert run(command, "fulano@gmail.com")[0] == 0
        assert store.get_user(user["id"])["status"] == status

    def test_the_server_can_block_an_administrator(self, run, store, user):
        """The panel cannot; someone must be able to, if an account is stolen."""
        run("promover", user["id"])
        assert run("bloquear", user["id"])[0] == 0
        assert store.get_user(user["id"])["status"] == "blocked"

    def test_invite_and_cancel(self, run, store):
        assert run("convidar", "a@gmail.com", "b@gmail.com")[0] == 0
        assert len(store.open_invites()) == 2
        assert run("cancelar-convite", "a@gmail.com")[0] == 0
        assert run("cancelar-convite", "a@gmail.com")[0] == 1

    def test_invalid_email_invites_nobody(self, run, store):
        code, _, err = run("convidar", "a@gmail.com", "sem-arroba")
        assert code == 1 and "sem-arroba" in err
        assert store.open_invites() == []


class TestListing:
    def test_empty(self, run):
        assert "Nenhum usuário" in run("listar")[1]

    def test_shows_status_invites_and_warnings(self, run, store, user):
        run("promover", user["id"])
        store.add_invites(["novo@gmail.com", "externo@yahoo.com"], actor="op")
        store.record_google_login(
            {"sub": "s3", "email": "externo@yahoo.com", "email_verified": True}
        )
        out = run("listar")[1]
        assert "[admin]" in out and "novo@gmail.com" in out
        assert "confirme" in out

    def test_never_prints_the_google_identifier(self, run, store):
        store.record_google_login({"sub": "secret-sub", "email": "x@gmail.com"})
        assert "secret-sub" not in run("listar")[1]


class TestSession:
    def test_prints_only_the_token_on_stdout(self, run, store, user):
        """So it can be captured into a variable without being displayed."""
        run("aprovar", user["id"])
        code, out, err = run("sessao", user["id"], "--horas", "1")
        assert code == 0 and "Trate como senha" in err
        assert store.authenticate(out.strip())["id"] == user["id"]

    @pytest.mark.parametrize("hours", ["0", "-1", "25"])
    def test_lifetime_is_bounded(self, run, user, hours):
        run("aprovar", user["id"])
        assert run("sessao", user["id"], "--horas", hours)[0] == 1

    def test_only_for_approved_people(self, run, user):
        code, out, err = run("sessao", user["id"])
        assert code == 1 and out == "" and "não está aprovado" in err


class TestBackup:
    def test_copies_the_database(self, run, user, tmp_path):
        assert run("backup", str(tmp_path / "copy.sqlite3"))[0] == 0
        assert AuthStore(tmp_path / "copy.sqlite3").get_user(user["id"])

    def test_failure_is_an_exit_code(self, run, store, tmp_path):
        store.path.write_bytes(b"")
        with mock.patch.object(AuthStore, "init_schema"):
            code, _, err = run("backup", str(tmp_path / "copy.sqlite3"))
        assert code == 1 and "integrity" in err


def test_without_sso_it_says_what_is_missing(run):
    code, _, err = run(
        "listar", GOOGLE_CLIENT_ID="", GOOGLE_CLIENT_SECRET="", SESSION_SECRET=""
    )
    assert code == 1 and "SSO não configurado" in err


def test_unknown_command_exits_with_usage(run):
    with pytest.raises(SystemExit):
        run("explodir")
