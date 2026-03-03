#!/usr/bin/env python3
"""
Script de verificação de conectividade Backend-Frontend
Testa todos os endpoints principais da API
"""

import requests
import json
from datetime import datetime

# URL do backend no Render
BACKEND_URL = "https://dataforgetest-backend.onrender.com"


def print_header(text):
    """Print section header"""
    print("\n" + "=" * 70)
    print(f"  {text}")
    print("=" * 70)


def check_endpoint(name, method, path, data=None, expected_status=200):
    """Check a single endpoint (helper — not collected by pytest)."""
    url = f"{BACKEND_URL}{path}"
    print(f"\n🔍 Testando: {name}")
    print(f"   URL: {url}")
    print(f"   Método: {method}")

    try:
        if method == "GET":
            response = requests.get(url, timeout=10)
        elif method == "POST":
            response = requests.post(url, json=data, timeout=10)
        else:
            print(f"   ❌ Método não suportado: {method}")
            return False

        print(f"   Status: {response.status_code}")

        if response.status_code == expected_status:
            print("✅ SUCESSO")
            try:
                response_data = response.json()
                print(f"   Resposta: {json.dumps(response_data, indent=2)[:200]}...")
            except:
                print(f"   Resposta: {response.text[:200]}...")
            return True
        else:
            print(f"   ⚠️  Status inesperado (esperado: {expected_status})")
            print(f"   Resposta: {response.text[:200]}...")
            return False

    except requests.exceptions.Timeout:
        print("❌ TIMEOUT - O servidor demorou muito para responder")
        return False
    except requests.exceptions.ConnectionError:
        print("❌ ERRO DE CONEXÃO - Não foi possível conectar ao servidor")
        return False
    except Exception as e:
        print(f"   ❌ ERRO: {str(e)}")
        return False


def main():
    """Run all connectivity tests"""
    print_header("TESTE DE CONECTIVIDADE BACKEND-FRONTEND")
    print(f"\nBackend URL: {BACKEND_URL}")
    print(f"Data/Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    results = []

    # Test 1: Health Check (Root)
    print_header("1. Health Check")
    results.append(check_endpoint("Root Endpoint", "GET", "/"))

    # Test 2: RAG Health
    print_header("2. RAG Module")
    results.append(check_endpoint("RAG Health Check", "GET", "/api/rag/health"))

    # Test 3: Accuracy Health
    print_header("3. Data Accuracy Module")
    results.append(
        check_endpoint("Accuracy Health Check", "GET", "/api/accuracy/health")
    )

    # Test 4: Synthetic Data Health
    print_header("4. Synthetic Data Module")
    results.append(check_endpoint("Synthetic Health Check", "GET", "/api/synth/health"))

    # Test 5: GOLD Health
    print_header("5. GOLD Module")
    results.append(check_endpoint("GOLD Health Check", "GET", "/api/gold/health"))

    # Test 6: Metrics Health
    print_header("6. Metrics Module")
    results.append(check_endpoint("Metrics Health Check", "GET", "/api/metrics/health"))

    # Test 7: Dataset Inspector Health
    print_header("7. Dataset Inspector Module")
    results.append(
        check_endpoint("Dataset Inspector Health", "GET", "/api/datasets/health")
    )

    # Test 8: Checklist Health
    print_header("8. Checklist Module")
    results.append(
        check_endpoint("Checklist Health Check", "GET", "/api/checklist/health")
    )

    # Summary
    print_header("RESUMO DOS TESTES")
    passed = sum(results)
    total = len(results)

    print(f"\n✅ Testes Passados: {passed}/{total}")
    print(f"❌ Testes Falhados: {total - passed}/{total}")
    print(f"📊 Taxa de Sucesso: {(passed/total)*100:.1f}%")

    if passed == total:
        print("\n🎉 TODOS OS ENDPOINTS ESTÃO FUNCIONANDO!")
        print("✅ Backend está pronto para conectar com o Frontend")
    else:
        print("\n⚠️  ALGUNS ENDPOINTS NÃO ESTÃO RESPONDENDO")
        print("🔧 Verifique os logs do Render para mais detalhes")

    print("\n" + "=" * 70)

    return 0 if passed == total else 1


if __name__ == "__main__":
    import sys

    sys.exit(main())
