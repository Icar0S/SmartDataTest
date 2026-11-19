import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle, MessageCircle, Send, Trash2, X } from 'react-feather';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { materialDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { apiFetch } from '../config/api';
import { useLanguage } from '../context/LanguageContext';

// Quanto esperar antes de desistir de uma resposta.
//
// O assistente roda num modelo local; respostas longas levam minutos. Sem
// teto, uma falha de rede deixa a interface "pensando" para sempre e o
// usuário não sabe se espera ou desiste. 4 minutos cobre o pior caso medido
// no servidor (p99 ≈ 4,5 min) sem prender ninguém indefinidamente.
const CHAT_TIMEOUT_MS = 4 * 60 * 1000;

// Mensagens de erro: dizem O QUE houve, se o usuário perdeu a pergunta e o
// que fazer agora.
//
// Antes havia uma única frase — "Connection error. Please try again." — para
// TODA falha: rede caída, sessão expirada, limite de uso, servidor ocupado,
// erro interno. Numa apresentação em 18/11 ela apareceu sem que ninguém
// pudesse dizer se o problema era o notebook, a internet da sala ou o
// servidor. Uma mensagem que serve para tudo não informa nada.
//
// Em português por padrão: é o idioma padrão do app (LanguageContext).
const ERROS = {
  'pt-BR': {
    offline: {
      titulo: 'Sem conexão com a internet',
      corpo: 'Seu dispositivo está offline. Verifique a rede e envie a pergunta de novo — ela continua no campo abaixo.',
    },
    rede: {
      titulo: 'Não conseguimos falar com o servidor',
      corpo: 'A pergunta não chegou a ser processada. Pode ser instabilidade momentânea da conexão. Tente novamente em alguns segundos.',
    },
    demorou: {
      titulo: 'O assistente demorou mais do que o esperado',
      corpo: 'O modelo roda localmente e às vezes leva alguns minutos. Sua pergunta não foi perdida — reenvie, ou tente uma pergunta mais curta e específica.',
    },
    ocupado: {
      titulo: 'O servidor está ocupado agora',
      corpo: 'O assistente atende uma pergunta por vez. Aguarde cerca de um minuto e tente de novo.',
    },
    limite: {
      titulo: 'Muitas perguntas em pouco tempo',
      corpo: 'Você atingiu o limite de uso do assistente. Aguarde um minuto antes da próxima pergunta.',
    },
    sessao: {
      titulo: 'Sua sessão expirou',
      corpo: 'Entre novamente para continuar usando o assistente.',
    },
    servidor: {
      titulo: 'O assistente falhou ao responder',
      corpo: 'O erro foi registrado do nosso lado. Tente novamente; se continuar, avise o suporte.',
    },
  },
  'en-US': {
    offline: {
      titulo: 'No internet connection',
      corpo: 'Your device is offline. Check the network and send the question again — it is still in the box below.',
    },
    rede: {
      titulo: 'We could not reach the server',
      corpo: 'The question was never processed. This is usually a brief connection hiccup. Try again in a few seconds.',
    },
    demorou: {
      titulo: 'The assistant took longer than expected',
      corpo: 'The model runs locally and sometimes needs a few minutes. Your question was not lost — send it again, or try a shorter, more specific one.',
    },
    ocupado: {
      titulo: 'The server is busy right now',
      corpo: 'The assistant answers one question at a time. Wait about a minute and try again.',
    },
    limite: {
      titulo: 'Too many questions in a short time',
      corpo: 'You have hit the assistant usage limit. Wait a minute before the next question.',
    },
    sessao: {
      titulo: 'Your session expired',
      corpo: 'Sign in again to keep using the assistant.',
    },
    servidor: {
      titulo: 'The assistant failed to answer',
      corpo: 'The error was recorded on our side. Try again; if it persists, let support know.',
    },
  },
};

// Textos da espera. Separados de ERROS porque não são erro: descrevem o
// estado normal de um modelo que roda localmente e leva o tempo que leva.
const TEXTOS = {
  'pt-BR': {
    pensando: 'Consultando a documentação…',
    esperaLonga: 'Ainda processando. O modelo roda neste servidor e perguntas mais longas podem levar alguns minutos.',
  },
  'en-US': {
    pensando: 'Searching the documentation…',
    esperaLonga: 'Still working. The model runs on this server and longer questions can take a few minutes.',
  },
};

// A partir de quanto tempo avisar que a espera vai ser longa. 20s fica acima
// da mediana medida (29s inclui o carregamento do modelo; respostas com o
// modelo quente saem em ~5-12s) sem deixar ninguém no escuro.
const AVISO_ESPERA_MS = 20 * 1000;

/**
 * Traduz uma falha em uma das mensagens acima.
 *
 * Recebe o erro capturado e, quando houve resposta HTTP, o seu status. A
 * distinção que mais importa para quem está olhando a tela é entre "não
 * chegou ao servidor" (rede/offline) e "chegou e algo deu errado lá"
 * (ocupado/limite/servidor) — são ações diferentes.
 */
const classificarFalha = (err, status) => {
  if (status) {
    if (status === 401 || status === 403) return 'sessao';
    if (status === 429) return 'limite';
    // 524 é o Cloudflare desistindo de esperar a origem; 502/503/504 são o
    // servidor fora do ar ou sobrecarregado. Para o usuário, é a mesma ação.
    if (status === 524) return 'demorou';
    if (status === 502 || status === 503 || status === 504) return 'ocupado';
    if (status >= 500) return 'servidor';
    return 'servidor';
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  if (err?.name === 'AbortError') return 'demorou';
  return 'rede';
};

// Generate unique IDs for messages
let messageIdCounter = 0;
const generateMessageId = () => {
  messageIdCounter += 1;
  return `msg-${Date.now()}-${messageIdCounter}`;
};

const CodeComponent = ({node, inline, className, children, ...props}) => {
  const match = /language-(\w+)/.exec(className || '');
  const codeString = Array.isArray(children) ? String(children).replace(/\n$/, '') : String(children);
  
  return !inline && match ? (
    <SyntaxHighlighter
      style={materialDark}
      language={match[1]}
      PreTag="div"
      {...props}
    >
      {codeString}
    </SyntaxHighlighter>
  ) : (
    <code className={className} {...props}>
      {children}
    </code>
  );
};

CodeComponent.propTypes = {
  node: PropTypes.object,
  inline: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node
};

const ChatWindow = ({ onClose }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sources, setSources] = useState([]);
  const messagesEndRef = useRef(null);
  const eventSourceRef = useRef(null);
  const [esperaLonga, setEsperaLonga] = useState(false);
  const { language } = useLanguage();
  const erros = ERROS[language] ?? ERROS['pt-BR'];
  const textos = TEXTOS[language] ?? TEXTOS['pt-BR'];

  useEffect(() => {
    if (!isLoading) {
      setEsperaLonga(false);
      return undefined;
    }
    const id = setTimeout(() => setEsperaLonga(true), AVISO_ESPERA_MS);
    return () => clearTimeout(id);
  }, [isLoading]);

  useEffect(() => {
    // Scroll to bottom on new messages
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  useEffect(() => {
    // Cleanup EventSource on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.abort();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // Process SSE event data
  const processEventData = (parsed, currentMessage) => {
    if (parsed.type === 'token') {
      const newMessage = currentMessage + parsed.content;
      const messageContent = newMessage;
      setMessages(prev => [
        ...prev.slice(0, -1),
        { id: prev[prev.length - 1]?.id || generateMessageId(), role: 'assistant', content: messageContent }
      ]);
      return newMessage;
    }
    
    if (parsed.type === 'citations') {
      setSources(parsed.content.citations);
    }
    
    if (parsed.type === 'error') {
      // O backend manda a exceção Python crua neste campo. Mostrá-la ao
      // usuário não ajuda ninguém e expõe detalhe interno; o texto vai para
      // o console, onde quem dá suporte consegue ler.
      console.error('Chat stream error from server:', parsed.content);
      setError(erros.servidor);
      setIsLoading(false);
    }
    
    return currentMessage;
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { id: generateMessageId(), role: 'user', content: userMessage }]);

    // Declarado aqui, e não dentro do try, para o catch conseguir limpá-lo:
    // um timer órfão dispararia um abort depois de a requisição já ter
    // terminado.
    let timeoutId;

    try {
      setIsLoading(true);
      setError(null);
      setSources([]);

      // Abort any stream still running before starting another
      if (eventSourceRef.current) {
        eventSourceRef.current.abort();
      }

      const assistantMessageId = generateMessageId();
      setMessages(prev => [...prev, { id: assistantMessageId, role: 'assistant', content: '' }]);

      // Streamed over fetch rather than EventSource.
      //
      // EventSource cannot set request headers — the spec gives no way to do
      // it — so it cannot send the Authorization bearer token the API now
      // requires, and every message came back 401. fetch can, and reading
      // response.body gives the same incremental rendering.
      const controller = new AbortController();
      eventSourceRef.current = controller;
      let currentMessage = '';

      // Teto de espera. Sem ele, uma conexão que morre sem fechar deixa o
      // `await reader.read()` pendurado e a interface gira para sempre.
      timeoutId = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);

      let response;
      try {
        response = await apiFetch('/api/rag/chat-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: userMessage }),
          signal: controller.signal,
        });
      } catch (netErr) {
        clearTimeout(timeoutId);
        throw netErr;
      }

      if (!response.ok || !response.body) {
        clearTimeout(timeoutId);
        // O status viaja junto: é o que separa "ocupado" de "sessão expirada"
        // de "demorou demais" na mensagem mostrada ao usuário.
        const httpErr = new Error(`Chat failed (${response.status})`);
        httpErr.status = response.status;
        throw httpErr;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let done = false;

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (!value) continue;

        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line; keep the trailing partial
        // frame in the buffer until the rest of it arrives.
        const frames = buffer.split('\n\n');
        buffer = frames.pop() || '';

        for (const frame of frames) {
          const dataLine = frame.split('\n').find(l => l.startsWith('data:'));
          if (!dataLine) continue;
          const payload = dataLine.slice(5).trim();
          if (payload === '[DONE]') {
            done = true;
            break;
          }
          try {
            currentMessage = processEventData(JSON.parse(payload), currentMessage);
          } catch (parseError) {
            console.warn('Failed to parse SSE data:', parseError);
          }
        }
      }

      clearTimeout(timeoutId);
      setIsLoading(false);
      eventSourceRef.current = null;
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('Chat error:', err);
      setError(erros[classificarFalha(err, err?.status)]);
      // Tira a bolha vazia do assistente, mas devolve a pergunta ao campo:
      // obrigar a pessoa a redigitar o que ela já escreveu, na frente de uma
      // plateia, é o pior momento possível para perder texto.
      setMessages(prev => prev.slice(0, -1));
      setInput(userMessage);
      setIsLoading(false);
      eventSourceRef.current = null;
    }
  };
  
  const clearChat = () => {
    setMessages([]);
    setSources([]);
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
        <div className="flex items-center space-x-3">
          <MessageCircle className="w-6 h-6 text-purple-400" />
          <h2 className="text-lg font-semibold text-white">AI Documentation Assistant</h2>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={clearChat}
            className="p-2 text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Clear chat"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Close chat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-lg ${
              msg.role === 'user' 
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white' 
                : 'bg-gray-800/50 text-gray-100 border border-gray-700/50'
            }`}>
              <ReactMarkdown
                components={{
                  code: CodeComponent
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
          </div>
        ))}
        {/* Sinal de vida enquanto o modelo pensa.
            A resposta leva de 5s a vários minutos — sem isto a tela fica
            parada com uma bolha vazia, e quem está assistindo conclui que
            travou. O aviso de espera longa aparece só depois de 20s, para
            não alarmar nas respostas rápidas. */}
        {isLoading && !messages[messages.length - 1]?.content && (
          <div className="flex justify-start">
            <div className="max-w-[80%] p-3 rounded-lg bg-gray-800/50 border border-gray-700/50">
              <div className="flex items-center space-x-2 text-gray-300 text-sm">
                <span className="flex space-x-1" aria-hidden="true">
                  <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
                <span>{textos.pensando}</span>
              </div>
              {esperaLonga && (
                <p className="text-xs text-gray-400 mt-2">{textos.esperaLonga}</p>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />

        {/* Citations */}
        {sources.length > 0 && (
          <div className="mt-4 p-4 bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700/50">
            <h3 className="font-semibold mb-2 text-purple-300">Sources:</h3>
            <ul className="space-y-2">
              {sources.map((source) => (
                <li key={source.id || `source-${source.metadata?.filename || Math.random()}`} className="text-sm">
                  <span className="font-mono text-purple-400">[{source.id}]</span>{" "}
                  <span className="text-gray-300">{source.text}</span>
                  <div className="text-xs text-gray-400">
                    From: {source.metadata.filename}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Aviso, não alarme.
            O vermelho berrante dizia "algo quebrou gravemente" para o que
            quase sempre é "tente de novo em 30 segundos". Âmbar, título em
            uma linha e a explicação logo abaixo: a pessoa lê o que houve e
            o que fazer sem precisar interpretar nada. */}
        {error && (
          <div
            role="alert"
            className="p-4 bg-amber-900/25 border border-amber-600/40 rounded-lg backdrop-blur-sm"
          >
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-200">{error.titulo}</p>
                <p className="text-sm text-amber-100/80 mt-1">{error.corpo}</p>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Input */}
      <div className="p-4 border-t border-gray-700/50 bg-gray-900/30">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSend();
          }}
          className="flex space-x-2"
        >
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 p-3 bg-gray-800/90 text-white border border-gray-700/50 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            type="submit"
            aria-label="Send message"
            className="p-3 text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 disabled:opacity-50"
            disabled={isLoading}
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

ChatWindow.propTypes = {
  onClose: PropTypes.func.isRequired
};

export default ChatWindow;