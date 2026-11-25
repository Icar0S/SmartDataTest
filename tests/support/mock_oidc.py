"""A small OpenID Connect provider that stands in for Google.

It speaks the real protocol over HTTP — discovery, authorization with PKCE,
token endpoint, signed ID tokens, rotating keys — so the login can be exercised
end to end, in the tests and in a browser on a developer's machine, without a
Google project. It approves whoever asks; it must never be reachable from
anywhere but localhost.

    python -m tests.support.mock_oidc --port 5200 --email fulano@gmail.com

and, for the backend:

    OIDC_DISCOVERY_URL=http://localhost:5200/.well-known/openid-configuration
    GOOGLE_CLIENT_ID=dev GOOGLE_CLIENT_SECRET=dev SESSION_SECRET=<32+ characters>
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import secrets
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlencode, urlsplit

from joserfc import jwt
from joserfc.jwk import RSAKey


class MockProvider:
    """State of the fake provider. Tests reach in to make it misbehave."""

    def __init__(self, client_id: str = "dev", client_secret: str = "dev"):
        self.client_id = client_id
        self.client_secret = client_secret
        self.issuer = ""
        # Who is "logged in to Google".
        self.identity = {
            "sub": "google-sub-1",
            "email": "fulano@gmail.com",
            "email_verified": True,
            "name": "Fulano de Tal",
        }
        # Overrides applied to the next ID token, for the hostile cases.
        self.claim_overrides: dict = {}
        self.omit_id_token = False
        self.sign_with_unknown_key = False
        self.hang_seconds = 0.0
        self.codes: dict[str, dict] = {}
        self.token_requests: list[dict] = []
        self.rotate_key()

    def rotate_key(self) -> None:
        self.key = RSAKey.generate_key(2048, {"kid": secrets.token_hex(4), "use": "sig"})

    def metadata(self) -> dict:
        return {
            "issuer": self.issuer,
            "authorization_endpoint": f"{self.issuer}/authorize",
            "token_endpoint": f"{self.issuer}/token",
            "jwks_uri": f"{self.issuer}/jwks",
            "response_types_supported": ["code"],
            "subject_types_supported": ["public"],
            "id_token_signing_alg_values_supported": ["RS256"],
            "code_challenge_methods_supported": ["S256"],
        }

    def authorize(self, query: dict) -> str:
        code = secrets.token_urlsafe(16)
        self.codes[code] = query
        return f"{query['redirect_uri']}?{urlencode({'code': code, 'state': query['state']})}"

    def id_token(self, query: dict) -> str:
        now = int(time.time())
        claims = {
            "iss": self.issuer,
            "aud": self.client_id,
            "azp": self.client_id,
            "iat": now,
            "exp": now + 3600,
            "nonce": query.get("nonce"),
            **self.identity,
            **self.claim_overrides,
        }
        claims = {k: v for k, v in claims.items() if v is not None}
        key = self.key
        if self.sign_with_unknown_key:
            key = RSAKey.generate_key(2048, {"kid": self.key.kid})
        return jwt.encode({"alg": "RS256", "kid": key.kid}, claims, key)

    def token(self, form: dict, authorization: str) -> tuple[int, dict]:
        self.token_requests.append(form)
        client = (form.get("client_id"), form.get("client_secret"))
        if authorization.startswith("Basic "):
            client = tuple(base64.b64decode(authorization[6:]).decode().split(":", 1))
        if client != (self.client_id, self.client_secret):
            return 401, {"error": "invalid_client"}
        query = self.codes.pop(form.get("code", ""), None)
        if query is None or query["redirect_uri"] != form.get("redirect_uri"):
            return 400, {"error": "invalid_grant"}
        digest = hashlib.sha256(form.get("code_verifier", "").encode()).digest()
        challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
        if query.get("code_challenge_method") != "S256" or query["code_challenge"] != challenge:
            return 400, {"error": "invalid_grant"}
        body = {"access_token": secrets.token_urlsafe(16), "token_type": "Bearer", "expires_in": 3600}
        if not self.omit_id_token:
            body["id_token"] = self.id_token(query)
        return 200, body


def _handler(provider: MockProvider):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):  # silence
            pass

        def _json(self, status: int, body: dict) -> None:
            data = json.dumps(body).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):  # noqa: N802
            time.sleep(provider.hang_seconds)
            url = urlsplit(self.path)
            query = {k: v[0] for k, v in parse_qs(url.query).items()}
            if url.path == "/.well-known/openid-configuration":
                self._json(200, provider.metadata())
            elif url.path == "/jwks":
                self._json(200, {"keys": [provider.key.as_dict(private=False)]})
            elif url.path == "/authorize":
                self.send_response(302)
                self.send_header("Location", provider.authorize(query))
                self.end_headers()
            else:
                self._json(404, {"error": "not_found"})

        def do_POST(self):  # noqa: N802
            raw = self.rfile.read(int(self.headers.get("Content-Length", 0))).decode()
            form = {k: v[0] for k, v in parse_qs(raw).items()}
            self._json(*provider.token(form, self.headers.get("Authorization", "")))

    return Handler


class RunningProvider:
    """``with RunningProvider() as provider: ...`` on a free local port."""

    def __init__(
        self, provider: MockProvider | None = None, port: int = 0, bind: str = "127.0.0.1"
    ):
        self.provider = provider or MockProvider()
        self._server = ThreadingHTTPServer((bind, port), _handler(self.provider))
        self.provider.issuer = f"http://localhost:{self._server.server_port}"

    def __enter__(self) -> MockProvider:
        # shutdown() waits for the next poll; the default half second would be
        # paid by every test.
        serve = lambda: self._server.serve_forever(poll_interval=0.02)  # noqa: E731
        threading.Thread(target=serve, daemon=True).start()
        return self.provider

    def __exit__(self, *_exc) -> None:
        self._server.shutdown()
        self._server.server_close()

    def serve_forever(self) -> None:
        self._server.serve_forever()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--port", type=int, default=5200)
    parser.add_argument("--bind", default="127.0.0.1", help="0.0.0.0 only inside a container")
    parser.add_argument("--email", default="fulano@gmail.com")
    parser.add_argument("--name", default="Fulano de Tal")
    parser.add_argument("--sub", default="google-sub-1")
    parser.add_argument("--hd", default=None, help="Workspace domain, as Google's hd claim")
    args = parser.parse_args()
    provider = MockProvider()
    provider.identity = {
        "sub": args.sub,
        "email": args.email,
        "email_verified": True,
        "name": args.name,
        "hd": args.hd,
    }
    running = RunningProvider(provider, args.port, args.bind)
    print(f"mock OIDC provider on {provider.issuer} as {args.email}")
    running.serve_forever()


if __name__ == "__main__":
    main()
