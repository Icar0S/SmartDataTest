```mermaid
flowchart LR
  %% FRONTEND
  subgraph Frontend [Frontend Layer - React]
    direction TB
    A1[Real-Time Rieclay Interface]
    A2[File Upload System - File Progress]
    A3[Interactive Data Visualization]
    A4[Responsive Dashboard]
    A5[Dark Theme Design]
    note1([React, TypeScript, Tailwind CSS])
  end

  %% BACKEND
  subgraph Backend [Backend Layer - Flask API]
    direction TB
    B1[API Core - api.py<br>RESTful API<br>Error Handling<br>CORS<br>Session Management]
    B2[Chatbot Module<br>PySpark Code Gen<br>NLP<br>QA Checklist Automation]
    B3[Synthetic Module<br>Data Quality Generation<br>GOLD Standard]
    B4[RAG System<br>Chat with Docs<br>6 Indexed Docs<br>Vector Integration]
    note2([Python, Flask, LLM: Claude])
  end

  %% STORAGE
  subgraph Storage [Storage Layer]
    direction TB
    C1[Vector Store - /storage/vectorstore]
    C2[File Storage - /storage/]
    C3[Session Cache]
    C4[Indexed Documentation]
  end

  %% INTEGRATIONS
  D1([LLM API<br>CSV, JSON<br>50MB - 2M rows])
  D2([Automated Validation])
  D3([Interactive Documentation])

  %% EXTERNAL LABELS
  E1([Big Data Quality Testing])
  E2([Synthetic Data Generation])

  %% FLOW CONNECTIONS
  A1 --> B1
  A2 --> B3
  A3 --> B4
  A4 --> B1
  A5 --> B1

  B1 --> C2
  B2 --> D1
  B3 --> D1
  B4 --> C1
  B4 --> C4

  D2 --> B1
  D3 --> B4

  %% External concepts
  E1 --> A1
  E2 --> B3