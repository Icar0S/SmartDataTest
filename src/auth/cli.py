"""Administração de usuários, para quem tem acesso ao servidor.

    docker exec dataforgetest-backend python -m auth.cli listar

Existe fora da API de propósito. Uma rota que concede administração é uma rota
que pode ser abusada para escalar privilégio; aqui a credencial é ter um shell
na máquina, e quem tem isso já tem tudo mesmo. É também o desbloqueio do "ovo e
galinha": todo login nasce pendente, então alguém precisa ser o primeiro
administrador sem que exista um para aprová-lo.

Roda DENTRO do contêiner. O banco fica num volume partilhado com o macOS, e as
travas do SQLite não atravessam essa fronteira.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path

from auth.config import load_sso_config
from auth.identity import is_valid_email
from auth.store import AuthStore

_ACTOR = "cli"
_STATUS_PT = {"pending": "pendente", "approved": "aprovado", "blocked": "bloqueado"}
_MAX_SESSION_HOURS = 24


class CommandError(Exception):
    """Mensagem para o operador; vira código de saída 1."""


def _one_user(store: AuthStore, who: str) -> dict:
    """A conta indicada por e-mail ou id.

    Um e-mail pode ter passado por mais de uma conta Google. Nesse caso escolher
    por conta própria seria arriscar promover a pessoa errada.
    """
    if who.startswith("usr_"):
        matches = [u for u in store.list_users() if u["id"] == who]
    else:
        matches = store.find_by_email(who)
    if not matches:
        raise CommandError(
            f"'{who}' não encontrado. A conta só existe depois do primeiro login "
            "com Google; para liberar antes disso, use: convidar EMAIL"
        )
    if len(matches) > 1:
        ids = ", ".join(u["id"] for u in matches)
        raise CommandError(f"'{who}' corresponde a mais de uma conta ({ids}). Repita usando o id.")
    return matches[0]


def _cmd_list(store: AuthStore, _args) -> None:
    users = store.list_users()
    if not users:
        print("Nenhum usuário ainda.")
    for user in users:
        tags = " [admin]" if user["is_admin"] else ""
        tags += " [convidado, e-mail não é do Google: confirme]" if user["invited"] else ""
        print(
            f"{user['id']}  {_STATUS_PT[user['status']]:<10} {user['email']:<36}"
            f" último login {(user['last_login_at'] or '—')[:16]} UTC{tags}"
        )
    for invite in store.open_invites():
        print(
            f"{'convite aberto':<22} {'':<8} {invite['email']:<36} desde {invite['created_at'][:10]}"
        )


def _cmd_invite(store: AuthStore, args) -> None:
    invalid = [e for e in args.emails if not is_valid_email(e)]
    if invalid:
        raise CommandError(f"e-mail inválido: {', '.join(invalid)}")
    approved = store.add_invites(args.emails, actor=_ACTOR)
    print(f"{len(args.emails)} convite(s). Quem já esperava e foi liberado agora: {len(approved)}.")


def _cmd_revoke_invite(store: AuthStore, args) -> None:
    if not store.revoke_invite(args.email, actor=_ACTOR):
        raise CommandError(f"não há convite aberto para '{args.email}'")
    print("Convite cancelado.")


def _status_command(status: str):
    def run(store: AuthStore, args) -> None:
        user = _one_user(store, args.quem)
        store.set_status(user["id"], status, actor=_ACTOR, allow_admin=True)
        print(f"{user['email']} agora está {_STATUS_PT[status]}.")

    return run


def _cmd_promote(store: AuthStore, args) -> None:
    user = store.set_admin(_one_user(store, args.quem)["id"], True, actor=_ACTOR)
    print(f"{user['email']} agora é administrador e está aprovado.")


def _cmd_demote(store: AuthStore, args) -> None:
    user = store.set_admin(_one_user(store, args.quem)["id"], False, actor=_ACTOR)
    print(f"{user['email']} não é mais administrador.")


def _cmd_session(store: AuthStore, args) -> None:
    if not 0 < args.horas <= _MAX_SESSION_HOURS:
        raise CommandError(f"--horas deve ficar entre 1 e {_MAX_SESSION_HOURS}")
    user = _one_user(store, args.quem)
    if user["status"] != "approved":
        raise CommandError(f"{user['email']} não está aprovado")
    token, expires_at = store.create_session(user["id"], args.horas * 3600, origin=_ACTOR)
    until = datetime.fromtimestamp(expires_at).strftime("%d/%m %H:%M")
    print(f"Sessão de {user['email']} até {until}. Trate como senha.", file=sys.stderr)
    print(token)


def _cmd_backup(store: AuthStore, args) -> None:
    store.backup_to(Path(args.destino))
    print(f"cópia verificada em {args.destino}")


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m auth.cli", description=__doc__.split("\n")[0])
    commands = parser.add_subparsers(dest="comando", required=True)

    def add(name: str, handler, help_text: str, **argument) -> argparse.ArgumentParser:
        sub = commands.add_parser(name, help=help_text)
        for dest, options in argument.items():
            sub.add_argument(dest, **options)
        sub.set_defaults(handler=handler)
        return sub

    who = {"help": "e-mail ou id (usr_...)"}
    add("listar", _cmd_list, "usuários e convites abertos")
    add("convidar", _cmd_invite, "libera e-mails antes do primeiro login", emails={"nargs": "+"})
    add("cancelar-convite", _cmd_revoke_invite, "desfaz um convite ainda não usado", email={})
    add("aprovar", _status_command("approved"), "libera o acesso", quem=who)
    add("bloquear", _status_command("blocked"), "corta o acesso e encerra as sessões", quem=who)
    add("suspender", _status_command("pending"), "volta para 'pendente'", quem=who)
    add("promover", _cmd_promote, "torna administrador", quem=who)
    add("rebaixar", _cmd_demote, "retira a administração", quem=who)
    session = add("sessao", _cmd_session, "abre uma sessão sem passar pelo Google", quem=who)
    session.add_argument("--horas", type=int, default=2)
    add("backup", _cmd_backup, "cópia consistente do banco em uso", destino={})
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    config = load_sso_config()
    if not config.enabled:
        print("SSO não configurado neste ambiente (ver docs/AUTH.md).", file=sys.stderr)
        return 1
    store = AuthStore(config.db_path)
    store.init_schema()
    try:
        args.handler(store, args)
    except (CommandError, RuntimeError) as exc:
        print(f"erro: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
