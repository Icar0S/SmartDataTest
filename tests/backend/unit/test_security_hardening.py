"""Regression tests for the security/config hardening applied on the develop branch.

Each test pins a specific defect found during the self-hosting audit so that it
cannot silently come back.
"""
import ast
import importlib
import os
import re
import sys
import unittest
from pathlib import Path
from unittest import mock

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT / "src"))


class TestDeadDependencyRemoved(unittest.TestCase):
    """pyspark is never imported at runtime and must not be a dependency."""

    def test_pyspark_not_in_requirements(self):
        requirements = (REPO_ROOT / "requirements.txt").read_text(encoding="utf-8")
        declared = [
            line.strip()
            for line in requirements.splitlines()
            if line.strip() and not line.strip().startswith("#")
        ]
        self.assertNotIn(
            "pyspark",
            [line.split("==")[0].lower() for line in declared],
            "pyspark is a 317 MB download that no module imports; it only appears "
            "inside the generated Colab code string.",
        )

    def test_no_real_pyspark_import_in_src(self):
        """No module may actually import pyspark.

        Parsed with ast rather than grepped for text: pyspark_generator.py
        legitimately contains 'from pyspark.sql import ...' *inside* the string
        of Colab code it emits, and that is not an import of this program.
        """
        offenders = []
        for path in (REPO_ROOT / "src").rglob("*.py"):
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    names = [alias.name for alias in node.names]
                elif isinstance(node, ast.ImportFrom):
                    names = [node.module or ""]
                else:
                    continue
                if any(name.split(".")[0] == "pyspark" for name in names):
                    offenders.append(f"{path.relative_to(REPO_ROOT)}:{node.lineno}")
        self.assertEqual(offenders, [], f"real pyspark imports found: {offenders}")


class TestMetricsRateLimitKey(unittest.TestCase):
    """The analyze rate-limit key must not include client-controlled input."""

    def test_key_ignores_client_supplied_session_id(self):
        from metrics.routes import _metrics_rate_limit_key

        # The key must derive from the client address alone. It no longer reads
        # the request body at all, so no request context is needed.
        with mock.patch("metrics.routes.get_remote_address", return_value="203.0.113.9"):
            first = _metrics_rate_limit_key()
            second = _metrics_rate_limit_key()

        self.assertEqual(
            first,
            second,
            "changing sessionId must not produce a fresh rate-limit bucket",
        )
        self.assertEqual(first, "203.0.113.9")


class TestUploadLimits(unittest.TestCase):
    """MAX_CONTENT_LENGTH must sit above the per-module MAX_UPLOAD_MB."""

    def _load_api(self, env):
        base = {"FLASK_ENV": "development", "CORS_ALLOWED_ORIGINS": "http://localhost:3000"}
        base.update(env)
        with mock.patch.dict(os.environ, base, clear=False):
            import api

            return importlib.reload(api)

    def test_content_length_exceeds_module_limit(self):
        api = self._load_api({"MAX_UPLOAD_MB": "5"})
        self.assertEqual(api.app.config["MAX_UPLOAD_MB"], 5)
        self.assertGreater(
            api.app.config["MAX_CONTENT_LENGTH"],
            5 * 1024 * 1024,
            "the hard Flask wall must be above the module limit so oversized "
            "uploads get a descriptive error instead of a bare 413",
        )

    def test_limits_track_each_other(self):
        api = self._load_api({"MAX_UPLOAD_MB": "25", "UPLOAD_OVERHEAD_MB": "2"})
        self.assertEqual(api.app.config["MAX_CONTENT_LENGTH"], 27 * 1024 * 1024)

    def test_accuracy_max_upload_mb_is_not_read(self):
        """The variable was declared in deploy config but read by no code.

        Matches actual environment reads only — the name still appears in
        explanatory comments, which is intentional.
        """
        pattern = re.compile(
            r"""(?:getenv\(\s*|environ(?:\.get\(\s*|\[))["']ACCURACY_MAX_UPLOAD_MB["']"""
        )
        offenders = []
        for path in (REPO_ROOT / "src").rglob("*.py"):
            if pattern.search(path.read_text(encoding="utf-8")):
                offenders.append(str(path.relative_to(REPO_ROOT)))
        self.assertEqual(
            offenders,
            [],
            "ACCURACY_MAX_UPLOAD_MB is dead config; modules read MAX_UPLOAD_MB",
        )


class TestCorsFailsClosedInProduction(unittest.TestCase):
    """The built-in origin allowlist must not apply in production."""

    def test_production_without_origins_refuses_to_start(self):
        with mock.patch.dict(
            os.environ, {"FLASK_ENV": "production", "CORS_ALLOWED_ORIGINS": ""}, clear=False
        ):
            import api

            with self.assertRaises(RuntimeError):
                importlib.reload(api)

    def test_explicit_origins_are_used_verbatim(self):
        with mock.patch.dict(
            os.environ,
            {"FLASK_ENV": "production", "CORS_ALLOWED_ORIGINS": "https://example.test"},
            clear=False,
        ):
            import api

            reloaded = importlib.reload(api)
            self.assertEqual(reloaded._CORS_ORIGINS, ["https://example.test"])

    def tearDown(self):
        with mock.patch.dict(
            os.environ,
            {"FLASK_ENV": "development", "CORS_ALLOWED_ORIGINS": "http://localhost:3000"},
            clear=False,
        ):
            import api

            importlib.reload(api)


class TestRagDebugEndpointGated(unittest.TestCase):
    """/api/rag/debug leaks provider, key presence and paths; it must be opt-in."""

    def test_source_checks_the_feature_flag(self):
        source = (REPO_ROOT / "src" / "rag" / "routes_simple.py").read_text(encoding="utf-8")
        self.assertIn("RAG_DEBUG_ENDPOINT", source)


if __name__ == "__main__":
    unittest.main()


class TestDocumentMetadataDoesNotLeakPaths(unittest.TestCase):
    """Chat citations must not disclose the ingest machine's filesystem layout."""

    def test_windows_absolute_path_reduced_to_basename(self):
        from rag.simple_rag import _sanitise_filepath

        leaked = r"C:\Users\Icaro\Documents\projetos\docs_to_import\strategies.md"
        self.assertEqual(_sanitise_filepath(leaked), "strategies.md")

    def test_posix_absolute_path_reduced_to_basename(self):
        from rag.simple_rag import _sanitise_filepath

        self.assertEqual(_sanitise_filepath("/app/docs_to_import/a.pdf"), "a.pdf")

    def test_already_relative_value_untouched(self):
        from rag.simple_rag import _sanitise_filepath

        self.assertEqual(_sanitise_filepath("notes.txt"), "notes.txt")

    def test_loaded_documents_are_sanitised(self):
        from rag.simple_rag import _sanitise_documents

        documents = {
            "a": {"metadata": {"filepath": r"C:\Users\Icaro\docs\x.md", "filename": "x.md"}},
            "b": {"metadata": {"filepath": "y.md"}},
            "c": {"metadata": {}},
            "d": "not-a-dict",
        }
        fixed = _sanitise_documents(documents)
        self.assertEqual(fixed, 1)
        self.assertEqual(documents["a"]["metadata"]["filepath"], "x.md")
        self.assertEqual(documents["b"]["metadata"]["filepath"], "y.md")

    def test_shipped_index_has_no_absolute_paths(self):
        """The committed vectorstore must not carry absolute paths either."""
        import json

        index = REPO_ROOT / "storage" / "vectorstore" / "documents.json"
        if not index.exists():
            self.skipTest("no local vectorstore")
        data = json.loads(index.read_text(encoding="utf-8"))
        offenders = [
            meta.get("filepath")
            for doc in data.get("documents", {}).values()
            if isinstance(doc, dict)
            for meta in [doc.get("metadata") or {}]
            if isinstance(meta.get("filepath"), str)
            and ("\\" in meta["filepath"] or meta["filepath"].startswith("/"))
        ]
        self.assertEqual(offenders, [], f"absolute paths in index: {offenders[:3]}")
