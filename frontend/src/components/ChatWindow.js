import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { MessageCircle, Send, Trash2, X } from 'react-feather';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { materialDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { apiFetch } from '../config/api';

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
      setError(parsed.content);
      setIsLoading(false);
    }
    
    return currentMessage;
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { id: generateMessageId(), role: 'user', content: userMessage }]);
    
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

      const response = await apiFetch('/api/rag/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Chat failed (${response.status})`);
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

      setIsLoading(false);
      eventSourceRef.current = null;
    } catch (err) {
      console.error('Chat error:', err);
      setError('Connection error. Please try again.');
      setMessages(prev => prev.slice(0, -1));
      setIsLoading(false);
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
        
        {error && (
          <div className="p-4 text-red-300 bg-red-900/30 border border-red-700/50 rounded-lg backdrop-blur-sm">
            {error}
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