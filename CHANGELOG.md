# Changelog

All notable changes to DataForgeTest are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

## [Unreleased]

## [1.1.0] - 2026-02-xx

### Fixed
- **Accuracy comparison**: key column values now preserved in original case (not normalized to lowercase)
  - Integer key columns (e.g. `ano`, `mes`) remain as integers instead of being cast to strings
  - String key columns (e.g. `uf = "RJ"`) retain original casing instead of being lowercased
- **CSV download button**: fixed using Blob API with explicit MIME types for cross-browser compatibility
- **Anthropic lazy import**: fixed Windows `OSError: [Errno 22]` on `entry_points.txt` by moving import to point-of-use with error handling
- **Startup scripts**: replaced fixed `timeout` delays with health-check polling (backend readiness verified via HTTP before starting frontend)

### Added
- Security test suite with OWASP A01–A07 coverage
- Performance benchmarks with SLA gates
- Load tests with Locust
- Frontend coverage reporting (Istanbul/Jest)
- CI/CD pipeline with GitHub Actions
- Non-root Docker user for security hardening
- HTTP security headers (CSP, HSTS, X-Frame-Options, etc.)
- Flask-Limiter rate limiting
- Docker multi-stage build optimization

## [1.0.0] - 2025-xx-xx

### Added
- Initial release of DataForgeTest
- AI-Powered Synthetic Data Generation using LLMs
- Data Accuracy Validation with GOLD reference standards
- Intelligent RAG Support System
- PySpark Code Generation
- React frontend with dark theme
- Flask backend with RESTful API
- Docker support
