"""Wires authentication into the Flask app."""

from __future__ import annotations

from flask import Flask

from auth.admin_routes import auth_admin_bp
from auth.api_token import init_api_token_auth
from auth.config import load_sso_config
from auth.oidc import init_oidc
from auth.routes import auth_bp
from auth.store import AuthStore


def init_auth(app: Flask) -> None:
    """Load the SSO settings, open the user database and install the gate.

    Called before the feature blueprints are registered, so the gate covers
    every route they add, including any added later.

    Errors here are fatal on purpose, unlike those of the feature blueprints,
    which are skipped with a message. An app whose login failed to load would
    still answer its health check, and would look fine to everything but a
    person trying to get in.
    """
    config = load_sso_config()
    app.config["SSO_CONFIG"] = config
    app.extensions["auth_store"] = None
    if config.enabled:
        store = AuthStore(config.db_path)
        store.init_schema()
        app.extensions["auth_store"] = store
        init_oidc(app, config)
    init_api_token_auth(app, sso_enabled=config.enabled)
    app.register_blueprint(auth_bp)
    app.register_blueprint(auth_admin_bp)
