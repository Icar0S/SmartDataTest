# Backend Deployment Guide

This guide explains how to deploy the DataForgeTest backend using Docker.

## Prerequisites

- Docker installed on your system
- Docker Compose (optional, for easier management)
- Access to an Anthropic API key (for LLM features)

## Quick Start with Docker

### 1. Build the Docker Image

```bash
docker build -t dataforgetest-backend .
```

### 2. Run the Container

```bash
docker run -d \
  --name dataforgetest-backend \
  -p 5000:5000 \
  -e LLM_API_KEY=your-anthropic-api-key \
  -v $(pwd)/storage:/app/storage \
  -v $(pwd)/uploads:/app/uploads \
  dataforgetest-backend
```

### 3. Verify the Deployment

```bash
# Check if container is running
docker ps

# Check logs
docker logs dataforgetest-backend

# Test the API
curl http://localhost:5000/
```

## Deployment with Docker Compose

### 1. Configure Environment Variables

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Edit `.env` and set your configuration:

```env
LLM_API_KEY=your-actual-anthropic-api-key
LLM_MODEL=claude-3-haiku-20240307
FLASK_ENV=production
FLASK_DEBUG=False
```

### 2. Start Services

```bash
# Build and start in detached mode
docker-compose up -d --build

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down
```

## Cloud Deployment Options

### Deploy to Render.com

1. **Create a new Web Service**
   - Connect your GitHub repository
   - Select "Docker" as the environment
   - Render will automatically detect the Dockerfile

2. **Configure Environment Variables**
   - Add all variables from `.env.example`
   - Set `LLM_API_KEY` with your Anthropic API key

3. **Deploy**
   - Render will automatically build and deploy your application
   - You'll receive a URL like `https://your-app.onrender.com`

### Deploy to Railway.app

1. **Create a new Project**
   - Connect your GitHub repository
   - Railway will detect the Dockerfile automatically

2. **Configure Environment Variables**
   - Go to Variables tab
   - Add all variables from `.env.example`

3. **Deploy**
   - Railway will build and deploy automatically
   - Generate a domain or use custom domain

### Deploy to Google Cloud Run

1. **Build and push image to Google Container Registry**

```bash
# Configure gcloud
gcloud config set project YOUR_PROJECT_ID

# Build and push
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/dataforgetest-backend

# Deploy
gcloud run deploy dataforgetest-backend \
  --image gcr.io/YOUR_PROJECT_ID/dataforgetest-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars LLM_API_KEY=your-key
```

### Deploy to AWS Elastic Container Service (ECS)

1. **Push to Amazon ECR**

```bash
# Create ECR repository
aws ecr create-repository --repository-name dataforgetest-backend

# Get login credentials
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com

# Build and tag
docker build -t dataforgetest-backend .
docker tag dataforgetest-backend:latest YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/dataforgetest-backend:latest

# Push
docker push YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/dataforgetest-backend:latest
```

2. **Create ECS Service**
   - Create a task definition using the ECR image
   - Configure environment variables
   - Create a service with Application Load Balancer

### Deploy to DigitalOcean App Platform

1. **Create a new App**
   - Connect your GitHub repository
   - Select "Dockerfile" as build method

2. **Configure Environment**
   - Add environment variables from `.env.example`
   - Set resources (minimum 1GB RAM recommended)

3. **Deploy**
   - DigitalOcean will build and deploy
   - You'll get a URL like `https://your-app.ondigitalocean.app`

## Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `LLM_API_KEY` | Anthropic API key for LLM features | - | No* |
| `LLM_MODEL` | Claude model to use | claude-3-haiku-20240307 | No |
| `FLASK_ENV` | Flask environment | production | No |
| `FLASK_DEBUG` | Enable debug mode | False | No |
| `SYNTH_MAX_ROWS` | Max rows for synthetic data | 1000000 | No |
| `ACCURACY_MAX_UPLOAD_MB` | Max upload size for accuracy check | 50 | No |
| `GOLD_REQUEST_TIMEOUT` | Timeout for GOLD processing | 300 | No |

*Note: Some features require an API key, but the basic functionality works without it.

## Connecting Frontend to Backend

After deploying the backend, you need to update the frontend to connect to your deployed backend URL.

### Update Frontend Configuration

In your frontend deployment (Vercel), add an environment variable:

```bash
REACT_APP_API_URL=https://your-backend-url.com
```

Or update the proxy in `frontend/package.json` for local development:

```json
{
  "proxy": "https://your-backend-url.com"
}
```

### CORS Configuration

The backend already has CORS enabled for all origins. If you need to restrict it:

1. Edit `src/api.py`
2. Modify the CORS configuration:

```python
from flask_cors import CORS

CORS(app, resources={
    r"/api/*": {
        "origins": ["https://data-forge-test.vercel.app"]
    }
})
```

## Health Checks and Monitoring

### Health Check Endpoint

The backend provides a health check endpoint at `/`:

```bash
curl https://your-backend-url.com/
```

Expected response:
```json
{
  "status": "Backend is running",
  "message": "Data Quality Chatbot API"
}
```

### Module-Specific Health Checks

- Synthetic Data: `GET /api/synth/health`
- Data Accuracy: `GET /api/accuracy/health`
- GOLD Testing: `GET /api/gold/health`
- RAG System: `GET /api/rag/health`

### Monitoring Logs

```bash
# Docker
docker logs -f dataforgetest-backend

# Docker Compose
docker-compose logs -f backend
```

## Troubleshooting

### Container fails to start

Check logs:
```bash
docker logs dataforgetest-backend
```

Common issues:
- Missing environment variables
- Port 5000 already in use
- Insufficient memory

### API returns 500 errors

1. Check container logs
2. Verify environment variables are set correctly
3. Ensure storage directories are writable
4. Check API key is valid (if using LLM features)

### High memory usage

For large dataset processing:
1. Increase container memory limit
2. Adjust `SYNTH_MAX_ROWS` and `ACCURACY_MAX_ROWS`
3. Consider using external storage for uploads

### Connection refused from frontend

1. Verify backend is running: `curl http://your-backend:5000/`
2. Check CORS settings in `src/api.py`
3. Ensure firewall allows incoming connections
4. Verify frontend has correct API URL

## Performance Tuning

### Gunicorn Workers

The default configuration uses 4 workers. Adjust based on your CPU:

```bash
# In Dockerfile, modify CMD line:
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "8", ...]
```

Recommended: `(2 × CPU cores) + 1`

### Timeout Settings

For large file processing, increase timeout:

```bash
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--timeout", "300", ...]
```

### Memory Optimization

For constrained environments:
- Reduce `SYNTH_MAX_ROWS`
- Reduce `ACCURACY_MAX_ROWS`
- Decrease number of gunicorn workers

## Security Best Practices

1. **Never commit `.env` files** - Use environment variables in production
2. **Use secrets management** - Store API keys in cloud provider's secrets manager
3. **Enable HTTPS** - Use SSL/TLS certificates for production
4. **Restrict CORS** - Limit origins to your frontend domain
5. **Set resource limits** - Prevent DoS via large uploads
6. **Keep dependencies updated** - Regularly update `requirements.txt`

## Scaling Considerations

### Horizontal Scaling

The backend is stateless (except for file storage), so you can:
- Run multiple container instances
- Use load balancer to distribute traffic
- Share storage via network file system (NFS, S3, etc.)

### Vertical Scaling

Minimum recommended resources:
- **CPU**: 1 vCPU
- **RAM**: 1GB (2GB+ for large datasets)
- **Storage**: 10GB+ (depends on usage)

For production with heavy usage:
- **CPU**: 2-4 vCPUs
- **RAM**: 4-8GB
- **Storage**: 50GB+

## Backup and Recovery

### Important Directories

Backup these directories regularly:
- `storage/vectorstore` - RAG indexed documents
- `storage/synth` - Generated datasets
- `storage/accuracy` - Comparison results
- `storage/gold` - Cleaned datasets

### Backup Strategy

```bash
# Create backup
tar -czf backup-$(date +%Y%m%d).tar.gz storage/

# Restore backup
tar -xzf backup-20240101.tar.gz
```

## Support

For issues or questions:
- **GitHub Issues**: https://github.com/Icar0S/DataForgeTest/issues
- **Documentation**: See `/docs` directory
- **Email**: Check repository for contact information

## Next Steps

1. Deploy backend using your preferred method
2. Update frontend with backend URL
3. Configure environment variables
4. Test all features work correctly
5. Set up monitoring and alerts
6. Configure backups

---

## 🇧🇷 Resumo em Português

O backend do DataForgeTest está totalmente configurado para deploy e pronto para conectar com o frontend na Vercel (https://data-forge-test.vercel.app/).

### Opções de Deploy

**Render.com (Recomendado):**
1. Acesse https://render.com e faça cadastro com GitHub
2. Clique em "New +" → "Web Service" → conecte `Icar0S/DataForgeTest`
3. O Render detecta o Dockerfile automaticamente
4. Adicione `LLM_API_KEY` em "Advanced" se for usar recursos de IA
5. Clique em "Create Web Service" e aguarde 5-10 minutos

**Railway.app (Alternativa):**
1. Acesse https://railway.app → "Deploy from GitHub repo"
2. Selecione `Icar0S/DataForgeTest` — detecta Dockerfile automaticamente
3. Gere o domínio em Settings → Generate Domain

**Docker Local:**
```bash
docker compose up -d
# OU
docker build -t dataforgetest-backend .
docker run -d -p 5000:5000 dataforgetest-backend
```

### Próximos Passos Após o Deploy

1. Copie a URL gerada pelo Render/Railway
2. Crie `frontend/vercel.json` com a URL do backend
3. Configure monitoramento de uptime (ex: UptimeRobot)
4. Revise configurações de CORS e secrets
