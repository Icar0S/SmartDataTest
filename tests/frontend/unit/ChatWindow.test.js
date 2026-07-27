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

const token = (content) => JSON.stringify({ type: 'token', content });

describe('ChatWindow Integration Tests', () => {
  let mockOnClose;

  beforeEach(() => {
    mockOnClose = jest.fn();
    jest.clearAllMocks();
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
    fireEvent.change(screen.getByPlaceholderText(/type your message/i), {
      target: { value: 'Hi' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));
    });

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
    fireEvent.change(screen.getByPlaceholderText(/type your message/i), {
      target: { value: 'Hi' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/partial/)).toBeInTheDocument();
    });
  });

  test('handles connection errors gracefully', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

    render(<ChatWindow onClose={mockOnClose} />);
    fireEvent.change(screen.getByPlaceholderText(/type your message/i), {
      target: { value: 'Hello' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/connection error/i)).toBeInTheDocument();
    });
  });

  test('surfaces a non-ok response as an error', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, body: null });

    render(<ChatWindow onClose={mockOnClose} />);
    fireEvent.change(screen.getByPlaceholderText(/type your message/i), {
      target: { value: 'Hello' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/connection error/i)).toBeInTheDocument();
    });
  });

  test('clears chat history when clear button is clicked', async () => {
    render(<ChatWindow onClose={mockOnClose} />);
    fireEvent.change(screen.getByPlaceholderText(/type your message/i), {
      target: { value: 'Test message' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));
    });

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
    global.fetch = jest.fn().mockResolvedValue(
      sseResponse([
        token('Answer with a source'),
        JSON.stringify({
          type: 'citations',
          citations: [{ id: 1, metadata: { filename: 'guide.md' }, text: 'excerpt' }],
        }),
        '[DONE]',
      ])
    );

    render(<ChatWindow onClose={mockOnClose} />);
    fireEvent.change(screen.getByPlaceholderText(/type your message/i), {
      target: { value: 'Where is this documented?' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Answer with a source/)).toBeInTheDocument();
    });
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
    fireEvent.change(screen.getByPlaceholderText(/type your message/i), {
      target: { value: 'Hi' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));
    });

    unmount();
    // An unmounted component must not keep reading a stream.
    expect(abort).toHaveBeenCalled();

    global.AbortController = originalAbortController;
  });
});
