# Frontend Tests

Este diretório contém os testes de frontend do SmartDataTest, organizados por tipo.

## Estrutura

```
tests/frontend/
├── unit/               # Testes unitários de componentes e páginas React
│   ├── DataAccuracy.test.js
│   ├── DatasetMetrics.test.js
│   ├── GenerateDataset.test.js
│   └── TestDatasetGold.test.js
├── api/                # Testes de chamadas de API frontend
├── security/           # Testes de segurança frontend
├── integration/        # Testes de integração entre componentes
│   └── RAGIntegration.test.js
└── e2e/                # Testes end-to-end de fluxos completos
```

## Descrição dos Testes

### Testes Unitários (`unit/`)

| Arquivo | Descrição | Cobertura |
|---------|-----------|-----------|
| `DataAccuracy.test.js` | Testa a página de Acurácia de Dados: upload de arquivos, validações, fluxo de comparação | 6 testes |
| `DatasetMetrics.test.js` | Testa o componente de Métricas de Dataset: upload, análise, exibição de resultados | 11 testes |
| `GenerateDataset.test.js` | Testa a geração de datasets sintéticos: schema, preview, download | 15 testes |
| `TestDatasetGold.test.js` | Testa o componente TestDatasetGold: upload, limpeza, estrutura da UI | 14 testes |

### Testes de Integração (`integration/`)

| Arquivo | Descrição |
|---------|-----------|
| `RAGIntegration.test.js` | Testa o fluxo completo do chat RAG na SupportPage: interface, interações, erros, citações |

## Como Executar

Os testes deste diretório são executados a partir da pasta `frontend/` usando React Scripts.
As importações dos componentes estão configuradas com caminhos relativos ao diretório `frontend/src/`.

```bash
# A partir do diretório raiz do projeto
cd frontend

# Executar todos os testes unitários de frontend (em src/)
npm test -- --watchAll=false

# Para executar os testes deste diretório diretamente, execute como parte do projeto frontend
# Os arquivos em tests/frontend/ podem ser executados individualmente:
npx react-scripts test --testPathPattern=DataAccuracy.test.js --watchAll=false

# Ou com jest diretamente (requer configuração de babel/jest)
# Ver documentação em tests/README.md
```

## Tecnologias Utilizadas

- **React Testing Library**: Renderização e interação com componentes React
- **Jest**: Framework de testes JavaScript
- **@testing-library/jest-dom**: Matchers customizados para DOM

## Status dos Testes

| Suite | Testes | Status |
|-------|--------|--------|
| DataAccuracy | 8 | ✅ |
| DatasetMetrics | 11 | ✅ |
| GenerateDataset | 15 | ✅ |
| TestDatasetGold | 14 | ✅ |
| RAGIntegration | 6 | ✅ |

**Total: 54 testes**
