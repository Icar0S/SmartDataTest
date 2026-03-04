# Development Scripts

Scripts for starting the DataForgeTest application in development mode.

## Scripts

### `setup.bat` — First-Time Setup
Use when:
- Running the project for the first time
- After updating dependencies (`requirements.txt` or `frontend/package.json`)
- After pulling major changes

What it does:
1. Checks Python version
2. Activates the `.venv` virtual environment
3. Installs backend dependencies from `requirements.txt`
4. Installs frontend dependencies via `npm install`
5. Starts backend and waits for health check (up to 30s)
6. Starts frontend and waits for it to be available
7. Opens the browser automatically

```bat
scripts\dev\setup.bat
```

### `start.bat` — Daily Development Use
Use when:
- Dependencies are already installed
- Starting the application for regular development

What it does:
1. Validates that `.venv` exists (if not, redirects to `setup.bat`)
2. Activates the `.venv` virtual environment
3. Starts backend and waits for health check (up to 15s)
4. Starts frontend

```bat
scripts\dev\start.bat
```

## Troubleshooting

| Problem | Solution |
|---|---|
| `.venv` not found | Run `python -m venv .venv` from the project root, then run `setup.bat` |
| Backend timeout | Check if port 5000 is already in use |
| Frontend fails to start | Run `npm install` inside the `frontend/` directory |
