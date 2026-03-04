#!/bin/bash
# Ollama deployment helper script for production environments
# This script helps set up Ollama with the recommended model for DataForgeTest

set -e

echo "======================================================================"
echo "DataForgeTest - Ollama Deployment Helper"
echo "======================================================================"
echo ""

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null && ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker and Docker Compose are required but not installed."
    echo "   Please install Docker Desktop or Docker Engine with Docker Compose."
    exit 1
fi

# Detect docker compose command (v1 vs v2)
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    DOCKER_COMPOSE="docker compose"
fi

echo "Using: $DOCKER_COMPOSE"
echo ""

# Function to check if Ollama is running
check_ollama() {
    echo "Checking if Ollama service is running..."
    if $DOCKER_COMPOSE ps ollama | grep -q "Up"; then
        echo "✅ Ollama service is running"
        return 0
    else
        echo "⚠️  Ollama service is not running"
        return 1
    fi
}

# Function to pull Ollama model
pull_model() {
    local model=$1
    echo ""
    echo "Pulling Ollama model: $model"
    echo "This may take a few minutes depending on your internet connection..."
    echo ""
    
    if $DOCKER_COMPOSE exec ollama ollama pull "$model"; then
        echo "✅ Successfully pulled model: $model"
        return 0
    else
        echo "❌ Failed to pull model: $model"
        return 1
    fi
}

# Function to list available models
list_models() {
    echo ""
    echo "Currently available models in Ollama:"
    echo "----------------------------------------------------------------------"
    $DOCKER_COMPOSE exec ollama ollama list
    echo "----------------------------------------------------------------------"
    echo ""
}

# Main deployment flow
echo "Step 1: Starting services with Docker Compose..."
echo ""

if $DOCKER_COMPOSE up -d; then
    echo "✅ Services started successfully"
else
    echo "❌ Failed to start services"
    exit 1
fi

echo ""
echo "Step 2: Waiting for Ollama service to be ready..."
sleep 5

# Wait for Ollama to be ready (max 30 seconds)
for i in {1..6}; do
    if check_ollama; then
        break
    fi
    if [ $i -eq 6 ]; then
        echo "❌ Ollama service failed to start after 30 seconds"
        echo "   Check logs with: $DOCKER_COMPOSE logs ollama"
        exit 1
    fi
    echo "   Waiting... (attempt $i/6)"
    sleep 5
done

echo ""
echo "Step 3: Pulling recommended model (qwen2.5-coder:7b)..."

if pull_model "qwen2.5-coder:7b"; then
    echo ""
    echo "✅ Model pulled successfully!"
else
    echo ""
    echo "⚠️  Failed to pull model. You may need to:"
    echo "   1. Check your internet connection"
    echo "   2. Try pulling manually: $DOCKER_COMPOSE exec ollama ollama pull qwen2.5-coder:7b"
    echo "   3. Or choose a different model from: https://ollama.com/library"
fi

# List currently available models
list_models

echo ""
echo "======================================================================"
echo "Deployment Complete!"
echo "======================================================================"
echo ""
echo "Your DataForgeTest environment is ready with Ollama!"
echo ""
echo "📊 Service URLs:"
echo "   - Backend API: http://localhost:5000"
echo "   - Frontend: http://localhost:3000 (if running)"
echo "   - Ollama API: http://localhost:11434"
echo ""
echo "🔧 Configuration:"
echo "   The system is configured to use:"
echo "   - Provider: Ollama"
echo "   - Model: qwen2.5-coder:7b"
echo "   - Base URL: http://ollama:11434"
echo ""
echo "📖 Documentation:"
echo "   - Ollama Setup Guide: docs/OLLAMA_SETUP.md"
echo "   - Main README: README.md"
echo ""
echo "🛠️  Useful Commands:"
echo "   - View logs: $DOCKER_COMPOSE logs -f"
echo "   - Stop services: $DOCKER_COMPOSE down"
echo "   - Restart services: $DOCKER_COMPOSE restart"
echo "   - Pull different model: $DOCKER_COMPOSE exec ollama ollama pull <model-name>"
echo "   - List models: $DOCKER_COMPOSE exec ollama ollama list"
echo ""
echo "💡 Tips:"
echo "   - To use a different model, update LLM_MODEL in your .env file"
echo "   - To switch to Anthropic Claude, set LLM_PROVIDER=anthropic in .env"
echo "   - Check status: $DOCKER_COMPOSE ps"
echo ""
echo "======================================================================"
