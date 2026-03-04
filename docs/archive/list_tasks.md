# Tasks:

   1. Integração com LLM (Fase 1 - Aprofundamento):
       * O prompt inicial menciona "LLM (if you want it can be
         google-cli) that helps build rules for data quality".
         Atualmente, o chatbot opera com um fluxo de perguntas e
         respostas pré-definido. Para realmente usar um LLM, seria
         necessário:
           * Processamento de Linguagem Natural (PLN): Desenvolver ou
             integrar um módulo que interprete a intenção do usuário a
             partir de linguagem natural (ex: "Quero garantir que a
             coluna 'idade' esteja entre 18 e 65") e mapeie isso para
             as regras de qualidade de dados.
           * Geração de Perguntas Dinâmicas: O LLM poderia gerar
             perguntas de acompanhamento mais inteligentes e
             contextuais, em vez de seguir um script fixo.
           * Refinamento de Regras: Permitir que o LLM ajude a refinar
             as regras com base em exemplos ou feedback do usuário.


   2. Frontend Interativo (React):
       * Desenvolvimento da Interface: Criar uma interface de usuário
         visualmente atraente e interativa usando React para substituir
         a interação via linha de comando. Isso incluiria:
           * Componentes para exibir as perguntas e coletar as
             respostas.
           * Visualização da DSL gerada.
           * Exibição do código PySpark gerado.
           * Funcionalidades para salvar/baixar os arquivos.
       * Criação de uma API Backend: Para que o frontend React possa se
          comunicar com a lógica Python do chatbot, seria necessário
         expor as funcionalidades do chatbot através de uma API (por
         exemplo, usando Flask ou FastAPI).


   3. Execução e Monitoramento dos Scripts PySpark:
       * Atualmente, o projeto gera os scripts PySpark. Para
         completude, seria ideal ter:
           * Mecanismo de Execução: Uma forma de o usuário (ou o
             próprio sistema, se houver uma infraestrutura Spark
             disponível) executar os scripts PySpark gerados.
           * Relatórios de Qualidade de Dados: Capturar e apresentar
             os resultados da execução dos scripts PySpark (quais
             regras passaram/falharam, contagem de registros com
             problemas, etc.) de volta ao usuário, possivelmente no
             frontend.


   4. Gerenciamento de Dados de Exemplo/Configuração:
       * Fornecer um conjunto de dados de exemplo ou um mecanismo mais
         robusto para o usuário especificar e carregar seus próprios
         dados para testes e validação.
