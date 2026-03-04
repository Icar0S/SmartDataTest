# Deploy Scripts

Scripts for deploying DataForgeTest services to production environments.

## Scripts

### `deploy_ollama.sh` — Ollama Deployment Helper
Sets up Ollama with the recommended model for DataForgeTest in production.

**Requirements:**
- Docker and Docker Compose installed
- Linux/Mac (or WSL on Windows)

```bash
chmod +x scripts/deploy/deploy_ollama.sh
scripts/deploy/deploy_ollama.sh
```

## Related Documentation

- [Docker Deployment Guide](../../docs/DOCKER.md)
- [Deployment Guide](../../docs/DEPLOYMENT.md)
- [Ollama Setup](../../docs/OLLAMA_SETUP.md)
- [Render Environment Config](../../docs/RENDER_ENV_CONFIG.md)
