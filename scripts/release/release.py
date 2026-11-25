#!/usr/bin/env python3
"""Decides the next version and writes its release notes.

Used by .github/workflows/deploy.yml after the CI passes on main. The git tags
are the source of truth: there is no version number to remember to bump, and so
none to forget.

    release.py next            key=value lines for $GITHUB_OUTPUT
    release.py notes v1.5.0    Markdown for the GitHub Release

The size of the step comes from Conventional Commits, which the PR titles of
this repository already have to follow (pr-checks.yml):

    feat!: ... or a BREAKING CHANGE: footer   ->  major
    feat: ...                                 ->  minor
    anything else                             ->  patch

Both PR titles and commit messages count, and the largest wins: a pull request
called "fix: develop into main" that carries a feature is a minor release.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CHANGELOG = REPO_ROOT / "CHANGELOG.md"
REPOSITORY_URL = "https://github.com/Icar0S/SmartDataTest"

_TAG = re.compile(r"v(\d+)\.(\d+)\.(\d+)")
_CONVENTIONAL = re.compile(r"(?P<type>[a-z]+)(?:\([^)]*\))?(?P<breaking>!)?:\s+(?P<text>.+)")
_MERGE = re.compile(r"Merge pull request #\d+ from ")
_LEVELS = ("patch", "minor", "major")

_SECTIONS = (
    ("feat", "Features"),
    ("fix", "Fixes"),
    ("perf", "Performance"),
    ("", "Other changes"),
)


@dataclass(frozen=True)
class Commit:
    sha: str
    subject: str
    body: str

    @property
    def is_merge(self) -> bool:
        return bool(_MERGE.match(self.subject)) or self.subject.startswith("Merge ")

    @property
    def title(self) -> str:
        """The line that describes the change. GitHub puts the PR title in the
        body of its merge commits."""
        if _MERGE.match(self.subject):
            lines = [line.strip() for line in self.body.splitlines() if line.strip()]
            return lines[0] if lines else self.subject
        return self.subject


# ── pure functions ──────────────────────────────────────────────────────────


def parse(tag: str) -> tuple[int, int, int] | None:
    match = _TAG.fullmatch(tag)
    return tuple(int(n) for n in match.groups()) if match else None


def newest(tags: list[str]) -> str | None:
    """Highest version. Compared as numbers: v1.10.0 comes after v1.9.0."""
    versions = [tag for tag in tags if parse(tag)]
    return max(versions, key=parse, default=None)


def level_of(commit: Commit) -> str:
    match = _CONVENTIONAL.fullmatch(commit.title)
    breaking_footer = re.search(r"^BREAKING[ -]CHANGE: ", commit.body, flags=re.MULTILINE)
    if breaking_footer or (match and match["breaking"]):
        return "major"
    if match and match["type"] == "feat":
        return "minor"
    return "patch"


def level_for(commits: list[Commit]) -> str:
    return max((level_of(c) for c in commits), key=_LEVELS.index, default="patch")


def step(tag: str | None, level: str) -> str:
    if tag is None:
        return "v1.0.0"
    major, minor, patch = parse(tag)
    if level == "major":
        return f"v{major + 1}.0.0"
    if level == "minor":
        return f"v{major}.{minor + 1}.0"
    return f"v{major}.{minor}.{patch + 1}"


def changelog_section(text: str, tag: str) -> str | None:
    """The body of ``## [1.5.0] ...`` in a Keep a Changelog file, if written."""
    heading = re.search(rf"^## \[{re.escape(tag.lstrip('v'))}\].*$", text, flags=re.MULTILINE)
    if not heading:
        return None
    rest = text[heading.end() :]
    following = re.search(r"^## ", rest, flags=re.MULTILINE)
    return rest[: following.start() if following else None].strip() or None


def notes_from(commits: list[Commit]) -> str:
    """Notes out of the commit subjects, for a version nobody wrote up."""
    grouped: dict[str, list[str]] = {prefix: [] for prefix, _ in _SECTIONS}
    for commit in commits:
        if commit.is_merge:
            continue
        match = _CONVENTIONAL.fullmatch(commit.subject)
        kind = match["type"] if match else ""
        text = match["text"] if match and kind in grouped else commit.subject
        grouped[kind if kind in grouped else ""].append(f"- {text} ({commit.sha[:7]})")
    parts = [f"### {title}\n" + "\n".join(grouped[p]) for p, title in _SECTIONS if grouped[p]]
    return "\n\n".join(parts) or "No described changes."


def full_notes(tag: str, previous: str | None, commits: list[Commit], changelog: str) -> str:
    body = changelog_section(changelog, tag) or notes_from(commits)
    if previous:
        body += f"\n\n**Full comparison:** {REPOSITORY_URL}/compare/{previous}...{tag}"
    return body + "\n"


# ── git ─────────────────────────────────────────────────────────────────────


def _git(*args: str, cwd: Path) -> str:
    # strip("\n"), not strip(): to Python the separators used below (\x1e, \x1f)
    # are whitespace too, and a commit without a body ends in one.
    return subprocess.run(
        ["git", *args], cwd=cwd, check=True, capture_output=True, text=True
    ).stdout.strip("\n")


def tags_reachable_from(ref: str, cwd: Path) -> list[str]:
    return _git("tag", "--merged", ref, "--list", "v*", cwd=cwd).split()


def commits_between(start: str | None, end: str, cwd: Path) -> list[Commit]:
    span = f"{start}..{end}" if start else end
    raw = _git("log", "--format=%H%x1f%s%x1f%b%x1e", span, cwd=cwd)
    records = [r.strip("\n") for r in raw.split("\x1e") if r.strip("\n")]
    return [Commit(*record.split("\x1f", 2)) for record in records]


def plan(cwd: Path, ref: str = "HEAD") -> dict[str, str]:
    """What to do about *ref*: nothing if some version already includes it."""
    released = newest(_git("tag", "--contains", ref, "--list", "v*", cwd=cwd).split())
    if released:
        return {
            "tag": released,
            "version": released.lstrip("v"),
            "previous": "",
            "level": "",
            "create": "false",
        }
    existing = newest(tags_reachable_from(ref, cwd))
    level = level_for(commits_between(existing, ref, cwd))
    tag = step(existing, level)
    # A version is never reused, not even one that lives on another branch.
    everywhere = set(_git("tag", "--list", "v*", cwd=cwd).split())
    while tag in everywhere:
        tag = step(tag, "patch")
    return {
        "tag": tag,
        "version": tag.lstrip("v"),
        "previous": existing or "",
        "level": level,
        "create": "true",
    }


def notes(tag: str, cwd: Path, changelog: str) -> str:
    earlier = [t for t in tags_reachable_from(tag, cwd) if parse(t) and t != tag]
    previous = newest(earlier)
    return full_notes(tag, previous, commits_between(previous, tag, cwd), changelog)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("next", help="the next version, as key=value lines")
    commands.add_parser("notes", help="release notes of a tag").add_argument("tag")
    args = parser.parse_args(argv)

    if args.command == "next":
        for key, value in plan(REPO_ROOT).items():
            print(f"{key}={value}")
        return 0
    if not parse(args.tag):
        print(f"not a version tag: {args.tag}", file=sys.stderr)
        return 1
    changelog = CHANGELOG.read_text(encoding="utf-8") if CHANGELOG.exists() else ""
    print(notes(args.tag, REPO_ROOT, changelog), end="")
    return 0


if __name__ == "__main__":
    sys.exit(main())
