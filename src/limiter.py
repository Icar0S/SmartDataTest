"""Shared Flask-Limiter instance and per-route limit configuration."""

import os

from flask import request
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address


def _exempt_from_default_limits() -> bool:
    """Keep liveness probes out of the global default limit.

    The container HEALTHCHECK polls "/" every 30s — 120 requests an hour, well
    past the 50/hour default. Counting those would drive the container
    unhealthy on a completely idle system. Routes that cost something carry
    their own explicit limits (see limit_for) and are unaffected by this.
    """
    path = request.path.rstrip("/")
    return path == "" or path.endswith("/health")


limiter = Limiter(
    key_func=get_remote_address,
    default_limits_exempt_when=_exempt_from_default_limits,
)


# Default per-route limits.
#
# The global default ("200 per day, 50 per hour") is far too generous for the
# routes that cost real CPU, memory or LLM time. These are the ones that can
# tie up the box, so they get their own much tighter budgets:
#
#   llm      — every call runs an LLM round-trip
#   generate — synthetic generation; a single request may ask for up to
#              SYNTH_MAX_ROWS rows and run batched LLM calls for minutes
#   upload   — writes attacker-supplied files to disk
#   heavy    — large-dataframe processing (compare/clean/analyze)
#   admin    — reindex, reload and delete operations on the knowledge base
#
# Every value is overridable at deploy time via RATELIMIT_<NAME>, so an
# internet-exposed instance can tighten them further without a code change.
_DEFAULT_LIMITS = {
    "LLM": "10 per minute;100 per hour",
    "GENERATE": "3 per minute;20 per hour",
    "UPLOAD": "10 per minute;60 per hour",
    "HEAVY": "20 per minute;200 per hour",
    "ADMIN": "5 per hour",
}


def limit_for(name: str) -> str:
    """Return the configured rate limit string for *name*.

    Overridable via the ``RATELIMIT_<NAME>`` environment variable.
    """
    key = name.upper()
    return os.environ.get(f"RATELIMIT_{key}", _DEFAULT_LIMITS[key])
