import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// jsdom ships neither, and the component decodes the streamed response body.
global.TextEncoder = global.TextEncoder || TextEncoder;
global.TextDecoder = global.TextDecoder || TextDecoder;
import ChatWindow from '../../../frontend/src/components/ChatWindow';

// The chat streams over fetch, not EventSource.
//
// EventSource cannot set request headers — the spec provides no mechanism —
// so it could not send the Authorization bearer token the API requires and
// every message came back 401. These tests therefore drive a mocked fetch
// whose body is a ReadableStream of SSE frames, which is what the component
// now consumes.
jest.mock('../../../frontend/src/config/api', () => ({
  getApiUrl: (path) => `http://localhost:5000${path}`,
  apiFetch: (path, options) => fetch(`http://localhost:5000${path}`, options),
  apiFetchUrl: (url, options) => fetch(url, options),
  getAuthHeaders: () => ({}),
}));

// useLanguage lança fora do LanguageProvider, então o contexto é mockado —
// mesmo padrão de HomePage.test.js. O idioma é mutável para que um teste
// possa verificar a versão em inglês das mensagens.
const mockLanguageState = { current: 'pt-BR' };
jest.mock('../../../frontend/src/context/LanguageContext', () => ({
  useLanguage: () => ({
    language: mockLanguageState.current,
    changeLanguage: jest.fn(),
  }),
}));

jest.mock('react-markdown', () => {
  function ReactMarkdown({ children }) {
    return <div data-testid="markdown-content">{children}</div>;
  }
  return ReactMarkdown;
});

jest.mock('react-syntax-highlighter', () => ({
  Prism: function SyntaxHighlighter({ children }) {
    return <pre data-testid="syntax-highlighter">{children}</pre>;
  }
}));

jest.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  materialDark: {}
}));

/** Build a Response whose body streams the given SSE frames. */
function sseResponse(frames, { ok = true, status = 200 } = {}) {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    ok,
    status,
    body: {
      getReader: () => ({
        read: async () => {
          if (i >= frames.length) return { value: undefined, done: true };
          const frame = frames[i++];
          return { value: encoder.encode(`data: ${frame}\n\n`), done: false };
        },
        cancel: async () => {},
      }),
    },
  };
}

/**
 * Como sseResponse, mas entrega os frames EXATAMENTE como escritos.
 *
 * Necessário para os batimentos: `: ping` é um comentário SSE e não leva o
 * prefixo `data:` que sseResponse acrescenta.
 */
function rawSseResponse(frames, { ok = true, status = 200 } = {}) {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    ok,
    status,
    body: {
      getReader: () => ({
        read: async () =>
          i < frames.length
            ? { value: encoder.encode(frames[i++]), done: false }
            : { value: undefined, done: true },
        cancel: async () => {},
      }),
    },
  };
}

/** Uma resposta HTTP de erro, sem corpo streamável. */
const httpError = (status) => ({ ok: false, status, body: null });

/** Envia uma pergunta e espera o ciclo terminar. */
async function perguntar(texto = 'Olá') {
  fireEvent.change(screen.getByPlaceholderText(/type your message/i), {
    target: { value: texto },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));
  });
}

const token = (content) => JSON.stringify({ type: 'token', content });

describe('ChatWindow Integration Tests', () => {
  let mockOnClose;

  beforeEach(() => {
    mockOnClose = jest.fn();
    jest.clearAllMocks();
    mockLanguageState.current = 'pt-BR';
    global.fetch = jest.fn().mockResolvedValue(sseResponse(['[DONE]']));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('renders ChatWindow with initial UI elements', () => {
    render(<ChatWindow onClose={mockOnClose} />);

    expect(screen.getByText('AI Documentation Assistant')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/type your message/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear chat/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close chat/i })).toBeInTheDocument();
  });

  test('sends message and posts to the streaming endpoint', async () => {
    render(<ChatWindow onClose={mockOnClose} />);

    const input = screen.getByPlaceholderText(/type your message/i);
    fireEvent.change(input, { target: { value: 'Hello, how can you help?' } });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    expect(screen.getByText('Hello, how can you help?')).toBeInTheDocument();
    expect(input.value).toBe('');

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const [url, options] = global.fetch.mock.calls[0];
    // POST, so the message travels in the body: a GET with the message in the
    // query string is what the EventSource version had to do.
    expect(url).toContain('/api/rag/chat-stream');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body).message).toBe('Hello, how can you help?');
  });

  test('renders streamed tokens as they arrive', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      sseResponse([token('Hello '), token('from '), token('the assistant'), '[DONE]'])
    );

    render(<ChatWindow onClose={mockOnClose} />);
    await perguntar('Hi');

    await waitFor(() => {
      expect(screen.getByText(/Hello from the assistant/)).toBeInTheDocument();
    });
  });

  test('handles a frame split across two reads', async () => {
    // The stream boundary can fall anywhere, so a frame may arrive in pieces.
    const encoder = new TextEncoder();
    const chunks = [
      encoder.encode('data: {"type":"token","content":"par'),
      encoder.encode('tial"}\n\ndata: [DONE]\n\n'),
    ];
    let i = 0;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        getReader: () => ({
          read: async () =>
            i < chunks.length
              ? { value: chunks[i++], done: false }
              : { value: undefined, done: true },
          cancel: async () => {},
        }),
      },
    });

    render(<ChatWindow onClose={mockOnClose} />);
    await perguntar('Hi');

    await waitFor(() => {
      expect(screen.getByText(/partial/)).toBeInTheDocument();
    });
  });

  test('clears chat history when clear button is clicked', async () => {
    render(<ChatWindow onClose={mockOnClose} />);
    await perguntar('Test message');

    expect(screen.getByText('Test message')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /clear chat/i }));
    expect(screen.queryByText('Test message')).not.toBeInTheDocument();
  });

  test('calls onClose when close button is clicked', () => {
    render(<ChatWindow onClose={mockOnClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close chat/i }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('prevents sending empty messages', () => {
    render(<ChatWindow onClose={mockOnClose} />);
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('handles form submission', async () => {
    render(<ChatWindow onClose={mockOnClose} />);
    const input = screen.getByPlaceholderText(/type your message/i);
    fireEvent.change(input, { target: { value: 'Form submission test' } });
    // The component submits through <form onSubmit>, so drive the form.
    await act(async () => {
      fireEvent.submit(input.closest('form'));
    });

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.getByText('Form submission test')).toBeInTheDocument();
  });

  test('displays citations with proper formatting', async () => {
    // O frame de citações vem como {type, content: {citations: [...]}} — é o
    // formato que o backend emite (src/rag/routes_simple.py) e o que o
    // componente lê. Este teste usava {type, citations: [...]}, sem o
    // `content`, então o componente estourava no acesso e caía no catch de
    // parsing: as citações nunca foram exercitadas, e o teste passava mesmo
    // assim porque só conferia o texto da resposta.
    global.fetch = jest.fn().mockResolvedValue(
      sseResponse([
        token('Answer with a source'),
        JSON.stringify({
          type: 'citations',
          content: {
            citations: [{ id: 1, metadata: { filename: 'guide.md' }, text: 'excerpt' }],
          },
        }),
        '[DONE]',
      ])
    );

    render(<ChatWindow onClose={mockOnClose} />);
    await perguntar('Where is this documented?');

    await waitFor(() => {
      expect(screen.getByText(/Answer with a source/)).toBeInTheDocument();
    });
    expect(screen.getByText('Sources:')).toBeInTheDocument();
    expect(screen.getByText('excerpt')).toBeInTheDocument();
    expect(screen.getByText(/guide\.md/)).toBeInTheDocument();
  });

  test('aborts the in-flight stream on unmount', async () => {
    const abort = jest.fn();
    const originalAbortController = global.AbortController;
    global.AbortController = function () {
      this.signal = {};
      this.abort = abort;
    };

    // A stream that never completes: otherwise the component finishes and
    // clears the ref before unmount, leaving nothing to abort.
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: { getReader: () => ({ read: () => new Promise(() => {}), cancel: async () => {} }) },
    });

    const { unmount } = render(<ChatWindow onClose={mockOnClose} />);
    await perguntar('Hi');

    unmount();
    // An unmounted component must not keep reading a stream.
    expect(abort).toHaveBeenCalled();

    global.AbortController = originalAbortController;
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Mensagens de erro
//
// Até 19/11 TODA falha — rede caída, sessão expirada, limite de uso, servidor
// ocupado, erro interno — mostrava a mesma frase: "Connection error. Please
// try again.", em inglês, num app cujo idioma padrão é português. Numa
// apresentação em 18/11 ela apareceu sem que ninguém pudesse dizer se o
// problema era o notebook, a internet da sala ou o servidor.
//
// Cada teste abaixo trava um diagnóstico distinto. Se alguém voltar a
// colapsar tudo numa frase só, estes testes quebram.
// ───────────────────────────────────────────────────────────────────────────
describe('ChatWindow — diagnóstico de falhas', () => {
  const comOnline = (valor) =>
    Object.defineProperty(window.navigator, 'onLine', {
      value: valor,
      configurable: true,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguageState.current = 'pt-BR';
    comOnline(true);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    comOnline(true);
    jest.restoreAllMocks();
  });

  test('dispositivo offline: aponta a rede do usuário, não o servidor', async () => {
    comOnline(false);
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    render(<ChatWindow onClose={jest.fn()} />);
    await perguntar();

    await waitFor(() => {
      expect(screen.getByText(/Sem conexão com a internet/i)).toBeInTheDocument();
    });
  });

  test('falha de rede com o usuário online: diz que a pergunta não foi processada', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    render(<ChatWindow onClose={jest.fn()} />);
    await perguntar();

    await waitFor(() => {
      expect(
        screen.getByText(/Não conseguimos falar com o servidor/i)
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(/não chegou a ser processada/i)
    ).toBeInTheDocument();
  });

  test('524 da Cloudflare: explica a demora, não inventa erro de conexão', async () => {
    // Era este o caso campeão: o endpoint não emitia byte nenhum até o modelo
    // terminar, e 16% das respostas passam dos 100s que a Cloudflare espera.
    global.fetch = jest.fn().mockResolvedValue(httpError(524));

    render(<ChatWindow onClose={jest.fn()} />);
    await perguntar();

    await waitFor(() => {
      expect(screen.getByText(/demorou mais do que o esperado/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/não foi perdida/i)).toBeInTheDocument();
  });

  test('503: servidor ocupado, com instrução de esperar', async () => {
    global.fetch = jest.fn().mockResolvedValue(httpError(503));

    render(<ChatWindow onClose={jest.fn()} />);
    await perguntar();

    await waitFor(() => {
      expect(screen.getByText(/servidor está ocupado/i)).toBeInTheDocument();
    });
  });

  test('429: limite de uso, não falha de infraestrutura', async () => {
    global.fetch = jest.fn().mockResolvedValue(httpError(429));

    render(<ChatWindow onClose={jest.fn()} />);
    await perguntar();

    await waitFor(() => {
      expect(screen.getByText(/Muitas perguntas em pouco tempo/i)).toBeInTheDocument();
    });
  });

  test('401: sessão expirada, com a ação certa (entrar de novo)', async () => {
    global.fetch = jest.fn().mockResolvedValue(httpError(401));

    render(<ChatWindow onClose={jest.fn()} />);
    await perguntar();

    await waitFor(() => {
      expect(screen.getByText(/sessão expirou/i)).toBeInTheDocument();
    });
  });

  test('500: falha do assistente, sem culpar a conexão do usuário', async () => {
    global.fetch = jest.fn().mockResolvedValue(httpError(500));

    render(<ChatWindow onClose={jest.fn()} />);
    await perguntar();

    await waitFor(() => {
      expect(screen.getByText(/falhou ao responder/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/conexão com a internet/i)).not.toBeInTheDocument();
  });

  test('abort por tempo esgotado é tratado como demora, não como rede', async () => {
    const abortErr = new Error('The operation was aborted.');
    abortErr.name = 'AbortError';
    global.fetch = jest.fn().mockRejectedValue(abortErr);

    render(<ChatWindow onClose={jest.fn()} />);
    await perguntar();

    await waitFor(() => {
      expect(screen.getByText(/demorou mais do que o esperado/i)).toBeInTheDocument();
    });
  });

  test('a pergunta volta para o campo depois de uma falha', async () => {
    // Obrigar alguém a redigitar o que já escreveu, na frente de uma plateia,
    // é o pior momento possível para perder texto.
    global.fetch = jest.fn().mockResolvedValue(httpError(503));

    render(<ChatWindow onClose={jest.fn()} />);
    await perguntar('Como gerar dados sintéticos?');

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/type your message/i).value).toBe(
        'Como gerar dados sintéticos?'
      );
    });
  });

  test('a exceção crua do servidor não chega à tela', async () => {
    // O backend manda a exceção Python no frame de erro. Mostrá-la não ajuda
    // ninguém e expõe detalhe interno.
    global.fetch = jest.fn().mockResolvedValue(
      sseResponse([
        JSON.stringify({
          type: 'error',
          content: "ConnectionError: HTTPConnectionPool(host='host.docker.internal', port=11434)",
        }),
        '[DONE]',
      ])
    );

    render(<ChatWindow onClose={jest.fn()} />);
    await perguntar();

    await waitFor(() => {
      expect(screen.getByText(/falhou ao responder/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/HTTPConnectionPool/)).not.toBeInTheDocument();
    expect(screen.queryByText(/host.docker.internal/)).not.toBeInTheDocument();
  });

  test('a mensagem acompanha o idioma selecionado', async () => {
    mockLanguageState.current = 'en-US';
    global.fetch = jest.fn().mockResolvedValue(httpError(503));

    render(<ChatWindow onClose={jest.fn()} />);
    await perguntar();

    await waitFor(() => {
      expect(screen.getByText(/server is busy/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/servidor está ocupado/i)).not.toBeInTheDocument();
  });

  test('o aviso é anunciado como alerta para leitores de tela', async () => {
    global.fetch = jest.fn().mockResolvedValue(httpError(503));

    render(<ChatWindow onClose={jest.fn()} />);
    await perguntar();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Batimentos e sinal de espera
// ───────────────────────────────────────────────────────────────────────────
describe('ChatWindow — espera e batimentos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguageState.current = 'pt-BR';
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('frames de batimento são ignorados e não viram texto na resposta', async () => {
    // O backend emite `: ping` a cada 15s enquanto o modelo pensa, para o
    // primeiro byte sair na hora e a Cloudflare não cortar em 100s. São
    // comentários SSE: o cliente os descarta por definição do protocolo.
    global.fetch = jest.fn().mockResolvedValue(
      rawSseResponse([
        ': ping\n\n',
        ': ping\n\n',
        'data: {"type":"token","content":"Resposta "}\n\n',
        ': ping\n\n',
        'data: {"type":"token","content":"final"}\n\n',
        'data: [DONE]\n\n',
      ])
    );

    render(<ChatWindow onClose={jest.fn()} />);
    await perguntar('Pergunta longa');

    await waitFor(() => {
      expect(screen.getByText('Resposta final')).toBeInTheDocument();
    });
    expect(screen.queryByText(/ping/)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('um batimento partido entre dois reads não corrompe a resposta', async () => {
    const encoder = new TextEncoder();
    const pedacos = [
      encoder.encode(': pi'),
      encoder.encode('ng\n\ndata: {"type":"token","content":"ok"}'),
      encoder.encode('\n\ndata: [DONE]\n\n'),
    ];
    let i = 0;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        getReader: () => ({
          read: async () =>
            i < pedacos.length
              ? { value: pedacos[i++], done: false }
              : { value: undefined, done: true },
          cancel: async () => {},
        }),
      },
    });

    render(<ChatWindow onClose={jest.fn()} />);
    await perguntar();

    await waitFor(() => {
      expect(screen.getByText('ok')).toBeInTheDocument();
    });
  });

  test('mostra sinal de atividade enquanto o modelo pensa', async () => {
    // Antes a tela ficava parada com uma bolha vazia por minutos, e quem
    // assistia concluía que tinha travado.
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: { getReader: () => ({ read: () => new Promise(() => {}), cancel: async () => {} }) },
    });

    render(<ChatWindow onClose={jest.fn()} />);
    await perguntar();

    await waitFor(() => {
      expect(screen.getByText(/Consultando a documentação/i)).toBeInTheDocument();
    });
  });

  test('o sinal de atividade some quando a resposta chega', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      sseResponse([token('pronto'), '[DONE]'])
    );

    render(<ChatWindow onClose={jest.fn()} />);
    await perguntar();

    await waitFor(() => {
      expect(screen.getByText('pronto')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Consultando a documentação/i)).not.toBeInTheDocument();
  });
});
