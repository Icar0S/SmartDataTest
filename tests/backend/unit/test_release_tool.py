"""scripts/release/release.py: which version comes next, and its notes."""

import importlib.util
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
_SPEC = importlib.util.spec_from_file_location(
    "release_tool", REPO_ROOT / "scripts" / "release" / "release.py"
)
release = importlib.util.module_from_spec(_SPEC)
sys.modules["release_tool"] = release
_SPEC.loader.exec_module(release)

Commit = release.Commit


def commit(subject, body=""):
    return Commit("a" * 40, subject, body)


def merge(title):
    return commit("Merge pull request #85 from Icar0S/develop", title)


class TestVersions:
    @pytest.mark.parametrize("tag", ["v1.0.0", "v10.20.30"])
    def test_version_tags(self, tag):
        assert release.parse(tag)

    @pytest.mark.parametrize("tag", ["1.0.0", "v1.0", "v1.0.0-rc1", "vx.y.z", "", "prod"])
    def test_anything_else_is_not_a_version(self, tag):
        assert release.parse(tag) is None

    def test_newest_compares_numbers_not_text(self):
        assert release.newest(["v1.9.0", "v1.10.0", "v1.2.0", "nightly"]) == "v1.10.0"

    def test_newest_of_nothing(self):
        assert release.newest(["nightly"]) is None

    @pytest.mark.parametrize(
        "level,expected", [("patch", "v1.5.1"), ("minor", "v1.6.0"), ("major", "v2.0.0")]
    )
    def test_step(self, level, expected):
        assert release.step("v1.5.0", level) == expected

    def test_first_version(self):
        assert release.step(None, "patch") == "v1.0.0"


class TestLevel:
    @pytest.mark.parametrize(
        "subject,expected",
        [
            ("fix: x", "patch"),
            ("feat: x", "minor"),
            ("feat(auth): x", "minor"),
            ("feat!: x", "major"),
            ("fix(api)!: x", "major"),
            ("docs: x", "patch"),
            ("Stop silently discarding half the answers", "patch"),
            ("feature: not a conventional type", "patch"),
        ],
    )
    def test_from_the_subject(self, subject, expected):
        assert release.level_of(commit(subject)) == expected

    def test_breaking_footer(self):
        assert release.level_of(commit("fix: x", "why\n\nBREAKING CHANGE: y")) == "major"

    def test_mentioning_breaking_change_in_prose_is_not_a_footer(self):
        assert release.level_of(commit("fix: x", "this is not a BREAKING CHANGE: really")) == "patch"

    def test_pr_title_is_read_from_the_merge_commit(self):
        assert release.level_of(merge("feat!: Login com Google")) == "major"

    def test_the_largest_wins(self):
        """A PR called "fix: develop into main" that carries a feature."""
        commits = [merge("fix: Develop into main"), commit("feat: x"), commit("fix: y")]
        assert release.level_for(commits) == "minor"

    def test_merge_without_a_body(self):
        assert release.level_of(commit("Merge pull request #1 from a/b")) == "patch"

    def test_no_commits(self):
        assert release.level_for([]) == "patch"


CHANGELOG = """# Changelog

## [Unreleased]

## [1.10.0] - 2026-01-02

### Added
- ten

## [1.1.0] - 2026-01-01

### Added
- one
"""


class TestNotes:
    def test_section_of_the_changelog(self):
        assert release.changelog_section(CHANGELOG, "v1.10.0") == "### Added\n- ten"

    def test_a_version_is_not_confused_with_one_that_starts_the_same(self):
        assert release.changelog_section(CHANGELOG, "v1.1.0") == "### Added\n- one"

    @pytest.mark.parametrize("tag", ["v9.9.9", "v1.1", "vUnreleased"])
    def test_absent_section(self, tag):
        assert release.changelog_section(CHANGELOG, tag) is None

    def test_empty_section_counts_as_absent(self):
        assert release.changelog_section("## [1.0.0]\n\n## [0.9.0]\n- x", "v1.0.0") is None

    def test_written_from_commits_when_there_is_no_section(self):
        text = release.notes_from(
            [
                commit("feat(auth): sign in with Google"),
                commit("fix: the range check"),
                commit("Stop discarding answers"),
                merge("fix: Develop into main"),
                commit("Merge main into develop"),
            ]
        )
        assert "### Features\n- sign in with Google (aaaaaaa)" in text
        assert "### Fixes\n- the range check" in text
        assert "### Other changes\n- Stop discarding answers" in text
        assert "Merge" not in text and "Develop into main" not in text

    def test_other_conventional_types_keep_their_prefix(self):
        assert "- ci: cache npm" in release.notes_from([commit("ci: cache npm")])

    def test_nothing_to_say(self):
        assert release.notes_from([merge("fix: x")])

    def test_full_notes_prefer_the_changelog_and_link_the_comparison(self):
        text = release.full_notes("v1.10.0", "v1.1.0", [commit("fix: x")], CHANGELOG)
        assert text.startswith("### Added\n- ten")
        assert "compare/v1.1.0...v1.10.0" in text

    def test_first_version_has_nothing_to_compare_with(self):
        assert "compare" not in release.full_notes("v1.0.0", None, [commit("fix: x")], "")


@pytest.mark.skipif(shutil.which("git") is None, reason="needs git")
class TestAgainstARealRepository:
    @pytest.fixture
    def repo(self, tmp_path):
        self.path = tmp_path
        self.git("init", "-q", "-b", "main")
        self.git("config", "user.email", "t@example.test")
        self.git("config", "user.name", "T")
        self.git("config", "commit.gpgsign", "false")
        self.git("config", "tag.gpgsign", "false")
        self.save("Initial commit")
        return self

    def git(self, *args):
        return subprocess.run(
            ["git", *args], cwd=self.path, check=True, capture_output=True, text=True
        ).stdout.strip()

    def save(self, message):
        self.git("commit", "-q", "--allow-empty", "-m", message)

    def tag(self, name):
        self.git("tag", "-a", name, "-m", name)

    def plan(self):
        return release.plan(self.path)

    def test_first_release(self, repo):
        assert repo.plan()["tag"] == "v1.0.0"
        assert repo.plan()["create"] == "true"

    def test_already_released_commit_creates_nothing(self, repo):
        """Re-running the pipeline must not invent a version."""
        repo.tag("v1.0.0")
        assert repo.plan() == {
            "tag": "v1.0.0", "version": "1.0.0", "previous": "", "level": "", "create": "false",
        }

    def test_commit_already_inside_a_later_version_creates_nothing(self, repo):
        """Two merges in a row, and the second one's CI finished first."""
        repo.save("fix: first")
        first = repo.git("rev-parse", "HEAD")
        repo.save("feat: second")
        repo.tag("v1.1.0")
        plan = release.plan(repo.path, first)
        assert (plan["tag"], plan["create"]) == ("v1.1.0", "false")

    def test_counts_only_what_came_after_the_last_version(self, repo):
        repo.save("feat!: an old breaking change")
        repo.tag("v2.0.0")
        repo.save("fix: something small")
        plan = repo.plan()
        assert (plan["tag"], plan["previous"], plan["level"]) == ("v2.0.1", "v2.0.0", "patch")

    def test_merge_commit_as_github_writes_it(self, repo):
        repo.tag("v1.5.0")
        repo.save("Merge pull request #86 from Icar0S/develop\n\nfeat!: Login com Google")
        assert repo.plan()["tag"] == "v2.0.0"

    def test_a_version_on_another_branch_is_not_reused(self, repo):
        repo.tag("v1.0.0")
        repo.git("checkout", "-q", "-b", "hotfix")
        repo.save("fix: elsewhere")
        repo.tag("v1.0.1")
        repo.git("checkout", "-q", "main")
        repo.save("fix: here")
        assert repo.plan()["tag"] == "v1.0.2"

    def test_other_tags_are_ignored(self, repo):
        repo.tag("v1.0.0")
        repo.save("fix: x")
        repo.git("tag", "vnext")
        assert repo.plan()["tag"] == "v1.0.1"

    def test_messages_with_awkward_characters(self, repo):
        repo.tag("v1.0.0")
        repo.save("feat: aspas \"duplas\", `crase`, $HOME e\ttab\n\ncorpo\n\ncom parágrafos")
        assert repo.plan()["tag"] == "v1.1.0"

    def test_notes_cover_exactly_one_version(self, repo):
        repo.tag("v1.0.0")
        repo.save("feat: second")
        repo.tag("v1.1.0")
        repo.save("feat: third")
        repo.tag("v1.2.0")
        text = release.notes("v1.1.0", repo.path, "")
        assert "second" in text and "third" not in text and "v1.0.0...v1.1.0" in text


class TestCommandLine:
    def test_next_prints_what_the_workflow_reads(self, capsys):
        if shutil.which("git") is None or not (REPO_ROOT / ".git").exists():
            pytest.skip("needs the repository's own history")
        assert release.main(["next"]) == 0
        keys = [line.split("=")[0] for line in capsys.readouterr().out.splitlines()]
        assert keys == ["tag", "version", "previous", "level", "create"]

    def test_notes_refuses_something_that_is_not_a_version(self, capsys):
        assert release.main(["notes", "main"]) == 1
        assert "not a version tag" in capsys.readouterr().err
