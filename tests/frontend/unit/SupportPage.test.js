import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SupportPage from '../../../frontend/src/pages/SupportPage';

// Mock ChatWindow component
jest.mock('../../../frontend/src/components/ChatWindow', () => {
  // eslint-disable-next-line react/prop-types
  const MockChatWindow = ({ onClose }) => {
    return (
      <div data-testid="chat-window">
        <button onClick={onClose}>Close Chat</button>
        <div>Mock Chat Window</div>
      </div>
    );
  };
  
  return MockChatWindow;
});

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
    h1: ({ children, ...props }) => <h1 {...props}>{children}</h1>,
    p: ({ children, ...props }) => <p {...props}>{children}</p>
  }
}));

// Mock react-feather
jest.mock('react-feather', () => ({
  Book: () => <div data-testid="book-icon" />,
  MessageCircle: () => <div data-testid="message-circle-icon" />
}));

describe('SupportPage Integration Tests', () => {
  test('renders SupportPage with title and description', () => {
    render(<SupportPage />);
    
    expect(screen.getByText(/SmartDataTest Support/i)).toBeInTheDocument();
    expect(screen.getByText(/Get help with your data quality testing setup using our AI-powered documentation assistant/i)).toBeInTheDocument();
  });

  test('renders chat window component', () => {
    render(<SupportPage />);
    
    expect(screen.getByTestId('chat-window')).toBeInTheDocument();
    expect(screen.getByText('Mock Chat Window')).toBeInTheDocument();
  });

  test('renders floating icons', () => {
    render(<SupportPage />);
    
    expect(screen.getByTestId('book-icon')).toBeInTheDocument();
    expect(screen.getByTestId('message-circle-icon')).toBeInTheDocument();  
  });

  test('chat window has close button', () => {
    render(<SupportPage />);
    
    const closeChatButton = screen.getByText('Close Chat');
    expect(closeChatButton).toBeInTheDocument();
    
    // Clicking the button should work (calls window.history.back)
    fireEvent.click(closeChatButton);
    
    // Chat window should still be there since we're just mocking
    expect(screen.getByTestId('chat-window')).toBeInTheDocument();
  });

  test('has correct structure and styling', () => {
    render(<SupportPage />);
    
    // Check that the component renders with expected structure
    expect(screen.getByTestId('chat-window')).toBeInTheDocument();
    expect(screen.getByTestId('book-icon')).toBeInTheDocument();
    expect(screen.getByTestId('message-circle-icon')).toBeInTheDocument();
    
    // Check title is present 
    expect(screen.getByText(/SmartDataTest Support/i)).toBeInTheDocument();
  });
});
