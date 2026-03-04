```mermaid
graph LR
    direction LR

    %% --- Título (Comentado) ---
    %% DataForgeTest
    %% Conceitos: Big Data Quality Testing, Synthetic Data Generation

    %% --- Camada Frontend ---
    subgraph Frontend Layer [Frontend Layer]
        fe1[Real-Time Rieclay Interface]
        fe2[File Upload System]
        fe3[Interactive Data Visualization]
        fe4[Responsive Dashboard]
        fe5[Dark Theme Design]
    end

    %% --- Camada Backend ---
    subgraph Backend Layer [Backend Layer - Flask API]
        be1[API Core api.py]
        be2[Chatbot Module]
        be3[Synthetic Module]
        be4[RAG System]
    end

    %% --- Camada de Storage ---
    subgraph Storage Layer
        st1[Vector Store]
        st2[File Storage]
        st3[Session Cache]
        st4[Indexed Documentation]
    end

    %% --- Serviços Externos ---
    subgraph External API
        llm[LLM API]
    end

    %% --- Processos Finais (Downstream) ---
    subgraph Downstream Processes
        dp1[Automated Validation]
        dp2[Interactive Documentation]
    end

    %% --- Fluxos de Dados (Baseado na imagem) ---

    %% Frontend <-> Backend (seta bi-direcional)
    fe1 <--> be1
    fe2 <--> be1
    fe3 <--> be1
    fe4 <--> be1
    %% fe5 (Dark Theme) é puramente visual, sem link

    %% Backend -> Storage
    be1 --> st1
    be1 --> st2
    be1 --> st3
    
    be4[RAG System] --> st1
    be4[RAG System] --> st4
    
    %% O Módulo Sintético logicamente também salva arquivos
    be3[Synthetic Module] --> st2 

    %% Backend -> External API
    be2[Chatbot Module] --> llm
    be3[Synthetic Module] --> llm
    be4[RAG System] --> llm

    %% Storage -> Downstream
    st4 --> dp1
    st4 --> dp2