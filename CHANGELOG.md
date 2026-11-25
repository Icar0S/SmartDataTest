# Changelog

All notable changes to SmartDataTest are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) ·
Versions: [Semantic Versioning](https://semver.org/), marked by git tags.

Each version is a tag and a page under
[Releases](https://github.com/Icar0S/SmartDataTest/releases). Both are created
by the CD pipeline when a pull request reaches `main`; a section written here
beforehand becomes the notes of that release. See
[docs/VERSIONAMENTO.md](docs/VERSIONAMENTO.md).

## [1.5.0] - 2026-11-23

### Added
- Checklist question for columns calculated from other columns, such as
  `Total_Spent = Price per Item * Quantity`
- Type checks, date detection and detection of numeric columns with stray text

### Fixed
- Half of the checklist answers were silently discarded, because questions were
  matched by their exact wording
- Generated PySpark that crashed (`|` without parentheses) and checks that could
  never fail (unanchored regular expressions, ranges taken from the file itself,
  text in numeric columns vanishing as NULL)

## [1.4.1] - 2026-11-19

### Fixed
- Chat answers that took longer than the tunnel's limit failed with error 524
- Chat errors now say what happened, in the user's language

## [1.4.0] - 2026-10-23

### Added
- The SmartDataTest LLM API as an LLM provider
- Recorded end-to-end tour of the platform (Playwright)

### Changed
- The deploy pipeline publishes the frontend only; the backend is self-hosted

### Fixed
- Synthetic generation returning the CSV header as a row, or falling back to
  mock rows without saying so
- Encoding of Latin-1 files in the metrics and accuracy modules

## [1.3.0] - 2026-07-27

### Added
- Self-hosting behind a Cloudflare Tunnel (`compose.prod.yaml`), with a local LLM
- Bearer token on every business route, and a separate one for destructive operations
- Backup routine for stored data

### Fixed
- Global rate limit that was configured under a key nobody reads
- Encoding detection corrupting Portuguese text

## [1.2.0] - 2026-04-21

### Added
- Login page, profiles, and Portuguese/English interface
- Platform statistics on the login page

### Changed
- The project was renamed from DataForgeTest to SmartDataTest

## [1.1.1] - 2026-03-12

### Fixed
- 502 errors and out-of-memory kills when uploading to the metrics module
- CORS for the Vercel frontend and for checklist updates
- Session loss between workers, and synthetic batches of 200 rows or more
- Encoding detection for ISO-8859 variants

## [1.1.0] - 2026-03-04

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

## [1.0.0] - 2025-12-23

### Added
- Initial release of DataForgeTest
- AI-Powered Synthetic Data Generation using LLMs
- Data Accuracy Validation with GOLD reference standards
- Intelligent RAG Support System
- PySpark Code Generation
- React frontend with dark theme
- Flask backend with RESTful API
- Docker support
