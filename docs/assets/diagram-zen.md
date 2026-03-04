```mermaid
zenuml
title DataForgeTest - Fluxo de Interação por Camadas

// --- Participantes (agrupados para caber na tela) ---
@Actor User
Frontend as "Frontend Layer"
Backend as "Backend (API, Chat, RAG, Synth)"
Storage as "Storage (Vector & File Store)"
LLM as "LLM API"
External as "Automated Validation"

// --- Cenário: Upload de Arquivo e Geração de Dados ---
User->Frontend: 1. Acessa Interface e faz Upload (A1, A2)
Frontend->Backend: 2. POST /upload (file) {
    // API (B1) salva o arquivo original (C2)
    Backend->Storage: 3. Salva arquivo original em /storage/
    
    // Módulo Synthetic (B3) chama o LLM (D1)
    Backend->LLM: 4. Gera "GOLD Standard"
    LLM->Backend: 5. return goldData
    
    // Módulo Synthetic (B3) salva o dado gerado (C2)
    Backend->Storage: 6. Salva "GOLD Standard" em /storage/
    
    return
}
Frontend->User: 7. Confirma Upload

// --- Cenário: Usuário faz uma pergunta (Chat) ---
User->Frontend: 8. Faz pergunta no Dashboard (A3, A4)
Frontend->Backend: 9. GET /chat (query) {
    
    // Módulo RAG (B4) busca no Vector Store (C1/C4)
    Backend->Storage: 10. Busca contexto (query)
    Storage->Backend: 11. return context
    
    // Módulo Chatbot (B2) chama o LLM (D1)
    Backend->LLM: 12. Gera resposta (query, context)
    LLM->Backend: 13. return answer
    
    return answer
}
Frontend->User: 14. Exibe resposta

// --- Cenário: Validação Externa ---
External->Backend: 15. POST /validateResults (Fluxo D2 -> B1)