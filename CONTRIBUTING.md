# Contributing to DataForgeTest

## Development Setup

### Prerequisites
- Python 3.12+
- Node.js 20+
- Git

### First-Time Setup (Windows)

```bat
REM 1. Clone the repository
git clone https://github.com/Icar0S/DataForgeTest.git
cd DataForgeTest

REM 2. Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate

REM 3. Install development dependencies
pip install -r requirements-dev.txt

REM 4. Setup and start the application
scripts\dev\setup.bat
```

### Daily Use (Windows)

```bat
scripts\dev\start.bat
```

### Running the Tests

```bat
run_integration_tests.bat
```

## Project Structure

| Path | Responsibility |
|---|---|
| `src/` | Backend Flask API and modules |
| `frontend/` | React frontend |
| `tests/` | Automated tests (backend + frontend) |
| `utilities/` | RAG debug and maintenance scripts |
| `docs/` | Technical documentation |
| `scripts/` | Automation scripts |
| `scripts/dev/` | Development startup scripts |
| `scripts/deploy/` | Deployment scripts |
| `docker-compose.yml` | Local Docker stack |
| `run_integration_tests.bat` | Local test pipeline |

## Conventions

### Commits (Conventional Commits)
- `feat:` new functionality
- `fix:` bug fix
- `test:` adding/modifying tests
- `docs:` documentation
- `refactor:` refactoring without behavior change
- `ci:` CI/CD pipeline changes

### Python
- Formatting: `black --line-length 100`
- Imports: `isort --profile black`
- Linting: `flake8 src/`
- Config: `pyproject.toml`

### JavaScript/React
- Formatting: Prettier (configured via CRACO)
- Linting: ESLint (configured in `frontend/.eslintrc`)
- CSS linting: `npm run lint:css` (from `frontend/`)
