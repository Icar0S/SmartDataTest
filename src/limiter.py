"""Shared Flask-Limiter instance and per-route limit configuration."""

import os

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)


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
