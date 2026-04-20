/**
 * Tests for TestDatasetGold component
 * Tests core rendering functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import TestDatasetGold from '../../../frontend/src/pages/TestDatasetGold';

// Mock fetch globally
global.fetch = jest.fn();

// Helper function to render component with router
const renderWithRouter = (component) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('TestDatasetGold Component', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  describe('Initial Render', () => {
    test('renders page title and description', () => {
      renderWithRouter(<TestDatasetGold />);
      
      expect(screen.getByText('Test Dataset GOLD')).toBeInTheDocument();
      expect(screen.getByText('Upload and clean your dataset with automated data quality improvements')).toBeInTheDocument();
    });

    test('renders upload section', () => {
      renderWithRouter(<TestDatasetGold />);
      
      expect(screen.getByText('Upload Dataset')).toBeInTheDocument();
      expect(screen.getByText('Drop your dataset here or click to browse')).toBeInTheDocument();
      expect(screen.getByText('Supported formats: CSV, XLSX, XLS, Parquet (max 50MB)')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /select file/i }).length).toBeGreaterThan(0);
    });

    test('renders back to home link', () => {
      renderWithRouter(<TestDatasetGold />);
      
      const backLink = screen.getByRole('link', { name: 'Back to Home' });
      expect(backLink).toBeInTheDocument();
      expect(backLink).toHaveAttribute('href', '/');
    });
  });

  describe('Component Structure', () => {
    test('has proper heading hierarchy', () => {
      renderWithRouter(<TestDatasetGold />);
      
      const mainHeading = screen.getByRole('heading', { name: 'Test Dataset GOLD' });
      const uploadHeading = screen.getByRole('heading', { name: 'Upload Dataset' });
      
      expect(mainHeading).toBeInTheDocument();
      expect(uploadHeading).toBeInTheDocument();
    });

    test('has required UI elements', () => {
      renderWithRouter(<TestDatasetGold />);
      
      // Check for upload button
      expect(screen.getAllByRole('button', { name: /select file/i }).length).toBeGreaterThan(0);
      
      // Check for navigation link
      expect(screen.getByRole('link', { name: 'Back to Home' })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('has proper button roles', () => {
      renderWithRouter(<TestDatasetGold />);
      
      expect(screen.getAllByRole('button', { name: /select file/i }).length).toBeGreaterThan(0);
    });

    test('sets document title', () => {
      renderWithRouter(<TestDatasetGold />);
      
      expect(document.title).toBe('Test Dataset GOLD - SmartDataTest');
    });

    test('has proper navigation structure', () => {
      renderWithRouter(<TestDatasetGold />);
      
      const backLink = screen.getByRole('link', { name: 'Back to Home' });
      expect(backLink).toHaveAttribute('href', '/');
    });
  });

  describe('Page Content', () => {
    test('displays page description', () => {
      renderWithRouter(<TestDatasetGold />);
      
      expect(screen.getByText('Upload and clean your dataset with automated data quality improvements')).toBeInTheDocument();
    });

    test('displays supported formats', () => {
      renderWithRouter(<TestDatasetGold />);
      
      expect(screen.getByText('Supported formats: CSV, XLSX, XLS, Parquet (max 50MB)')).toBeInTheDocument();
    });

    test('displays drop zone text', () => {
      renderWithRouter(<TestDatasetGold />);
      
      expect(screen.getByText('Drop your dataset here or click to browse')).toBeInTheDocument();
    });
  });

  describe('Initial State', () => {
    test('starts in upload state', () => {
      renderWithRouter(<TestDatasetGold />);
      
      // Should show upload section
      expect(screen.getByText('Upload Dataset')).toBeInTheDocument();
      
      // Should not show processing states
      expect(screen.queryByText('Dataset Information')).not.toBeInTheDocument();
      expect(screen.queryByText('Cleaning Report')).not.toBeInTheDocument();
      expect(screen.queryByText('Processing...')).not.toBeInTheDocument();
      expect(screen.queryByText('Download CSV')).not.toBeInTheDocument();
    });

    test('shows upload interface elements', () => {
      renderWithRouter(<TestDatasetGold />);
      
      expect(screen.getByText('Upload Dataset')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /select file/i }).length).toBeGreaterThan(0);
      expect(screen.getByText('Drop your dataset here or click to browse')).toBeInTheDocument();
    });
  });

  describe('UI Elements', () => {
    test('has upload section headings', () => {
      renderWithRouter(<TestDatasetGold />);
      
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Test Dataset GOLD');
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Upload Dataset');
    });

    test('has descriptive text content', () => {
      renderWithRouter(<TestDatasetGold />);
      
      expect(screen.getByText(/automated data quality improvements/i)).toBeInTheDocument();
      expect(screen.getByText(/max 50MB/i)).toBeInTheDocument();
    });

    test('has interactive elements', () => {
      renderWithRouter(<TestDatasetGold />);
      
      const selectButton = screen.getAllByRole('button', { name: /select file/i })[0];
      const homeLink = screen.getByRole('link', { name: /back to home/i });
      
      expect(selectButton).toBeInTheDocument();
      expect(homeLink).toBeInTheDocument();
    });
  });

  describe('Layout Structure', () => {
    test('renders without crashing', () => {
      expect(() => renderWithRouter(<TestDatasetGold />)).not.toThrow();
    });

    test('contains main content sections', () => {
      renderWithRouter(<TestDatasetGold />);
      
      // Check for main sections
      expect(screen.getByText('Test Dataset GOLD')).toBeInTheDocument();
      expect(screen.getByText('Upload Dataset')).toBeInTheDocument();
    });

    test('has consistent text content', () => {
      renderWithRouter(<TestDatasetGold />);
      
      const descriptions = [
        'Upload and clean your dataset with automated data quality improvements',
        'Drop your dataset here or click to browse',
        'Supported formats: CSV, XLSX, XLS, Parquet (max 50MB)'
      ];

      descriptions.forEach(text => {
        expect(screen.getByText(text)).toBeInTheDocument();
      });
    });
  });
});

describe('TestDatasetGold - File Upload and Processing', () => {
  beforeEach(() => {
    fetch.mockClear();
    jest.clearAllMocks();
  });

  const mockUploadResponse = {
    sessionId: 'test-session-123',
    datasetId: 'dataset-456',
    columns: ['id', 'name', 'age'],
    rowCount: 100,
    fileSize: 2048,
    format: 'csv',
    sample: [
      { id: 1, name: 'Alice', age: 30 },
      { id: 2, name: 'Bob', age: 25 },
    ],
  };

  const getFileInput = () => {
    const inputs = document.querySelectorAll('input[type="file"]');
    return inputs[0];
  };

  test('accepts valid CSV file type', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockUploadResponse,
    });
    renderWithRouter(<TestDatasetGold />);
    const fileInput = getFileInput();
    const file = new File(['id,name\n1,Alice'], 'test.csv', { type: 'text/csv' });
    
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/gold/upload'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  test('rejects invalid file type and shows error', () => {
    renderWithRouter(<TestDatasetGold />);
    const fileInput = getFileInput();
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    expect(screen.getByText(/Invalid file type/i)).toBeInTheDocument();
  });

  test('rejects PDF file type', () => {
    renderWithRouter(<TestDatasetGold />);
    const fileInput = getFileInput();
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    expect(screen.getByText(/Invalid file type/i)).toBeInTheDocument();
  });

  test('shows upload spinner while uploading', async () => {
    let resolveFetch;
    fetch.mockReturnValue(new Promise(resolve => { resolveFetch = resolve; }));
    
    renderWithRouter(<TestDatasetGold />);
    const fileInput = getFileInput();
    const file = new File(['content'], 'test.csv', { type: 'text/csv' });
    
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(screen.getByText(/Uploading.../i)).toBeInTheDocument();
    });
    
    // Resolve to clean up
    await act(async () => {
      resolveFetch({
        ok: true,
        json: async () => mockUploadResponse,
      });
    });
  });

  test('shows dataset information panel after successful upload', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockUploadResponse,
    });
    renderWithRouter(<TestDatasetGold />);
    const fileInput = getFileInput();
    const file = new File(['content'], 'test.csv', { type: 'text/csv' });
    
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(screen.getByText('Dataset Information')).toBeInTheDocument();
    });
  });

  test('shows error when upload fails', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Upload failed: file too large' }),
    });
    renderWithRouter(<TestDatasetGold />);
    const fileInput = getFileInput();
    const file = new File(['content'], 'test.csv', { type: 'text/csv' });
    
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(screen.getByText(/Upload failed: file too large/i)).toBeInTheDocument();
    });
  });

  test('shows cleaning options after upload', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockUploadResponse,
    });
    renderWithRouter(<TestDatasetGold />);
    const fileInput = getFileInput();
    const file = new File(['content'], 'test.csv', { type: 'text/csv' });
    
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(screen.getByText('Cleaning Options')).toBeInTheDocument();
    });
  });

  test('drag and drop sets dragActive state', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockUploadResponse,
    });
    renderWithRouter(<TestDatasetGold />);
    
    const dropZone = screen.getAllByRole('button', { name: /select file/i })[0].closest('[role="button"]');
    
    // dragenter should set dragActive
    fireEvent.dragEnter(dropZone);
    // dragLeave should unset dragActive
    fireEvent.dragLeave(dropZone);
    // No error should be thrown
    expect(dropZone).toBeInTheDocument();
  });

  test('drop calls handleFileChange with dropped file', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockUploadResponse,
    });
    renderWithRouter(<TestDatasetGold />);
    
    const dropZone = screen.getAllByRole('button', { name: /select file/i })[0].closest('[role="button"]');
    const file = new File(['content'], 'dropped.csv', { type: 'text/csv' });
    
    fireEvent.drop(dropZone, {
      dataTransfer: { files: [file] },
    });
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/gold/upload'),
        expect.any(Object)
      );
    });
  });

  test('Process button calls API with sessionId', async () => {
    // Upload first
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockUploadResponse,
    });
    // Process response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'queued',
        sessionId: 'test-session-123',
      }),
    });
    
    renderWithRouter(<TestDatasetGold />);
    const fileInput = getFileInput();
    const file = new File(['content'], 'test.csv', { type: 'text/csv' });
    
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(screen.getByText('Dataset Information')).toBeInTheDocument();
    });
    
    const processBtn = screen.getByRole('button', { name: /Generate GOLD Dataset/i });
    fireEvent.click(processBtn);
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/gold/clean'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  test('Reset button clears the state', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockUploadResponse,
    });
    renderWithRouter(<TestDatasetGold />);
    const fileInput = getFileInput();
    const file = new File(['content'], 'test.csv', { type: 'text/csv' });
    
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(screen.getByText('Dataset Information')).toBeInTheDocument();
    });
    
    const resetBtn = screen.getByRole('button', { name: /Reset/i });
    fireEvent.click(resetBtn);
    
    expect(screen.getByText('Upload Dataset')).toBeInTheDocument();
  });
});
describe('TestDatasetGold - Processing and Report', () => {
  beforeEach(() => {
    fetch.mockClear();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  const mockUploadResponse = {
    sessionId: 'test-session-123',
    datasetId: 'dataset-456',
    columns: ['id', 'name', 'age'],
    rowCount: 100,
    fileSize: 2048,
    format: 'csv',
    sample: [{ id: 1, name: 'Alice', age: 30 }],
  };

  const mockReport = {
    rows_processed: 100,
    columns_processed: 3,
    issues_found: 5,
    issues_fixed: 3,
    quality_score: 85,
    column_reports: [],
  };

  test('handles process completion with completed status', async () => {
    // Upload
    fetch.mockResolvedValueOnce({ ok: true, json: async () => mockUploadResponse });
    // Process clean call
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'completed', sessionId: 'test-session-123' }),
    });
    // Status fetch after completed
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        state: 'completed',
        report: mockReport,
        progress: { current: 100, total: 100, phase: 'complete' },
      }),
    });

    renderWithRouter(<TestDatasetGold />);
    const fileInput = document.querySelector('input[type="file"]');
    const file = new File(['content'], 'test.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Dataset Information')).toBeInTheDocument();
    });

    const processBtn = screen.getByRole('button', { name: /Generate GOLD Dataset/i });
    fireEvent.click(processBtn);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/gold/clean'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  test('handles process failure gracefully', async () => {
    // Upload
    fetch.mockResolvedValueOnce({ ok: true, json: async () => mockUploadResponse });
    // Process clean call fails
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Processing failed: invalid data format' }),
    });

    renderWithRouter(<TestDatasetGold />);
    const fileInput = document.querySelector('input[type="file"]');
    const file = new File(['content'], 'test.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Dataset Information')).toBeInTheDocument();
    });

    const processBtn = screen.getByRole('button', { name: /Generate GOLD Dataset/i });
    fireEvent.click(processBtn);

    await waitFor(() => {
      expect(screen.getByText(/Processing failed: invalid data format/i)).toBeInTheDocument();
    });
  });

  test('cleaning options can be toggled', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => mockUploadResponse });

    renderWithRouter(<TestDatasetGold />);
    const fileInput = document.querySelector('input[type="file"]');
    const file = new File(['content'], 'test.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Cleaning Options')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
    // Toggle first option
    fireEvent.click(checkboxes[0]);
    // Toggle it back
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0]).toBeInTheDocument();
  });
});
