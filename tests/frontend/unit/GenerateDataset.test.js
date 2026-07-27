/**
 * Tests for GenerateDataset component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import GenerateDataset from '../../../frontend/src/pages/GenerateDataset';

// Mock fetch
global.fetch = jest.fn();

const renderWithRouter = (component) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('GenerateDataset Component', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  test('renders page with all main elements', () => {
    renderWithRouter(<GenerateDataset />);
    
    expect(screen.getByText(/Generate Synthetic Dataset/i)).toBeInTheDocument();
    expect(screen.getByText(/Dataset Schema/i)).toBeInTheDocument();
    expect(screen.getByText(/Output Configuration/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Number of columns/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Output file type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Number of rows to generate/i)).toBeInTheDocument();
  });

  test('renders default 3 columns', () => {
    renderWithRouter(<GenerateDataset />);
    
    const columnNameInputs = screen.getAllByLabelText(/Name for column \d+/i);
    expect(columnNameInputs).toHaveLength(3);
  });

  test('changes number of columns dynamically', () => {
    renderWithRouter(<GenerateDataset />);
    
    const numColumnsSelect = screen.getByLabelText(/Number of columns/i);
    fireEvent.change(numColumnsSelect, { target: { value: '5' } });
    
    const columnNameInputs = screen.getAllByLabelText(/Name for column \d+/i);
    expect(columnNameInputs).toHaveLength(5);
  });

  test('updates column name', () => {
    renderWithRouter(<GenerateDataset />);
    
    const firstColumnInput = screen.getByLabelText(/Name for column 1/i);
    fireEvent.change(firstColumnInput, { target: { value: 'user_id' } });
    
    expect(firstColumnInput.value).toBe('user_id');
  });

  test('updates column type', () => {
    renderWithRouter(<GenerateDataset />);
    
    const firstColumnTypeSelect = screen.getByLabelText(/Type for column 1/i);
    fireEvent.change(firstColumnTypeSelect, { target: { value: 'email' } });
    
    expect(firstColumnTypeSelect.value).toBe('email');
  });

  test('shows validation error for duplicate column names', async () => {
    renderWithRouter(<GenerateDataset />);
    
    // Set duplicate names
    const columnInputs = screen.getAllByLabelText(/Name for column \d+/i);
    fireEvent.change(columnInputs[0], { target: { value: 'duplicate' } });
    fireEvent.change(columnInputs[1], { target: { value: 'duplicate' } });
    
    // Try to preview
    const previewButton = screen.getByLabelText(/Preview 50 rows/i);
    fireEvent.click(previewButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Duplicate column names/i)).toBeInTheDocument();
    });
  });

  test('shows validation error for invalid row count', async () => {
    renderWithRouter(<GenerateDataset />);
    
    // Set invalid row count
    const rowsInput = screen.getByLabelText(/Number of rows to generate/i);
    fireEvent.change(rowsInput, { target: { value: '2000000' } });
    
    // Try to preview
    const previewButton = screen.getByLabelText(/Preview 50 rows/i);
    fireEvent.click(previewButton);
    
    await waitFor(() => {
      expect(screen.getByText(/must be between 1 and 1,000,000/i)).toBeInTheDocument();
    });
  });

  test('calls preview API on preview button click', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        preview: [
          { id: 1, name: 'Test 1', created_at: '2024-01-01' },
          { id: 2, name: 'Test 2', created_at: '2024-01-02' }
        ],
        columns: ['id', 'name', 'created_at'],
        rows_generated: 2,
        duration_sec: 1.5,
        logs: ['Generated preview']
      })
    });

    renderWithRouter(<GenerateDataset />);
    
    const previewButton = screen.getByLabelText(/Preview 50 rows/i);
    fireEvent.click(previewButton);
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/synth/preview',
        expect.objectContaining({
          method: 'POST',
          // objectContaining, not equality: apiFetch also attaches an
          // Authorization header whenever REACT_APP_API_TOKEN is configured,
          // which is exactly the production case.
          headers: expect.objectContaining({ 'Content-Type': 'application/json' })
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/Preview generated: 2 rows/i)).toBeInTheDocument();
    });
  });

  test('displays preview table after successful preview', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        preview: [
          { id: 1, name: 'Alice', email: 'alice@example.com' },
          { id: 2, name: 'Bob', email: 'bob@example.com' }
        ],
        columns: ['id', 'name', 'email'],
        rows_generated: 2,
        duration_sec: 1.0,
        logs: []
      })
    });

    renderWithRouter(<GenerateDataset />);
    
    const previewButton = screen.getByLabelText(/Preview 50 rows/i);
    fireEvent.click(previewButton);
    
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });
  });

  test('calls generate API on generate button click', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        summary: { rows: 1000, cols: 3, fileType: 'csv', durationSec: 5.2 },
        downloadUrl: '/api/synth/download/test-session/dataset.csv',
        logs: ['Generated batch 1/1']
      })
    });

    renderWithRouter(<GenerateDataset />);
    
    const generateButton = screen.getByLabelText(/Generate full dataset/i);
    fireEvent.click(generateButton);
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/synth/generate',
        expect.objectContaining({
          method: 'POST',
          // objectContaining, not equality: apiFetch also attaches an
          // Authorization header whenever REACT_APP_API_TOKEN is configured,
          // which is exactly the production case.
          headers: expect.objectContaining({ 'Content-Type': 'application/json' })
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/Dataset generated successfully/i)).toBeInTheDocument();
    });
  });

  test('displays download button after successful generation', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        summary: { rows: 500, cols: 3, fileType: 'csv', durationSec: 2.1 },
        downloadUrl: '/api/synth/download/test-session/dataset.csv',
        logs: []
      })
    });

    renderWithRouter(<GenerateDataset />);
    
    const generateButton = screen.getByLabelText(/Generate full dataset/i);
    fireEvent.click(generateButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Download Ready/i)).toBeInTheDocument();
    });

    // The download is a button, not an <a href>. Download routes require the
    // API token and an anchor cannot send an Authorization header, so a plain
    // link would 401. The click fetches the blob instead.
    const downloadButton = screen.getByText(/Download Dataset/i).closest('button');
    expect(downloadButton).toBeInTheDocument();
    expect(screen.getByText(/Download Dataset/i).closest('a')).toBeNull();
  });

  test('shows error message on API failure', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: 'API Error',
        details: ['Validation failed']
      })
    });

    renderWithRouter(<GenerateDataset />);
    
    const previewButton = screen.getByLabelText(/Preview 50 rows/i);
    fireEvent.click(previewButton);
    
    await waitFor(() => {
      expect(screen.getByText(/Validation failed/i)).toBeInTheDocument();
    });
  });

  test('clears form on clear button click', () => {
    renderWithRouter(<GenerateDataset />);
    
    // Modify form
    const firstColumnInput = screen.getByLabelText(/Name for column 1/i);
    fireEvent.change(firstColumnInput, { target: { value: 'modified' } });
    
    const rowsInput = screen.getByLabelText(/Number of rows to generate/i);
    fireEvent.change(rowsInput, { target: { value: '5000' } });
    
    // Click clear
    const clearButton = screen.getByLabelText(/Clear form/i);
    fireEvent.click(clearButton);
    
    // Re-query inputs after re-render
    expect(screen.getByLabelText(/Name for column 1/i).value).toBe('id');
    expect(screen.getByLabelText(/Number of rows to generate/i).value).toBe('1000');
  });

  test('disables buttons during generation', async () => {
    fetch.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: async () => ({
          preview: [],
          columns: [],
          rows_generated: 0,
          duration_sec: 0,
          logs: []
        })
      }), 100))
    );

    renderWithRouter(<GenerateDataset />);
    
    const previewButton = screen.getByLabelText(/Preview 50 rows/i);
    const generateButton = screen.getByLabelText(/Generate full dataset/i);
    const clearButton = screen.getByLabelText(/Clear form/i);
    
    fireEvent.click(previewButton);
    
    // Buttons should be disabled during generation
    expect(previewButton).toBeDisabled();
    expect(generateButton).toBeDisabled();
    expect(clearButton).toBeDisabled();
    
    await waitFor(() => {
      expect(previewButton).not.toBeDisabled();
    });
  });

  test('has back button to home', () => {
    renderWithRouter(<GenerateDataset />);
    
    const backLink = screen.getByText(/Back to Home/i);
    expect(backLink.closest('a')).toHaveAttribute('href', '/');
  });

  test('focuses first input on mount', () => {
    renderWithRouter(<GenerateDataset />);
    
    const firstInput = screen.getByLabelText(/Name for column 1/i);
    expect(document.activeElement).toBe(firstInput);
  });

  test('renders type-specific options for integer type', () => {
    renderWithRouter(<GenerateDataset />);
    
    const typeSelect = screen.getByLabelText(/Type for column 1/i);
    fireEvent.change(typeSelect, { target: { value: 'integer' } });
    
    // Check that Min and Max inputs are present
    const inputs = screen.getAllByPlaceholderText(/Min|Max/i);
    expect(inputs.length).toBeGreaterThan(0);
  });

  test('renders type-specific options for date type', () => {
    renderWithRouter(<GenerateDataset />);
    
    const typeSelect = screen.getByLabelText(/Type for column 1/i);
    fireEvent.change(typeSelect, { target: { value: 'date' } });
    
    // Check that date inputs are present
    const dateInputs = screen.getAllByDisplayValue('');
    const hasDateType = dateInputs.some(input => input.type === 'date');
    expect(hasDateType).toBe(true);
  });
});
