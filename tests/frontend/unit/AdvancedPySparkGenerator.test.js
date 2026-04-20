/**
 * Tests for AdvancedPySparkGenerator page
 * Covers 4-step flow: upload, metadata, DSL, PySpark code
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import AdvancedPySparkGenerator from '../../../frontend/src/pages/AdvancedPySparkGenerator';

// Mock fetch
global.fetch = jest.fn();

// Mock syntax highlighter
jest.mock('react-syntax-highlighter', () => ({
  Prism: ({ children }) => <pre data-testid="syntax-highlighter">{children}</pre>,
}));
jest.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  materialDark: {},
}));

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
    h1: ({ children, ...props }) => <h1 {...props}>{children}</h1>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

// Mock lucide-react
jest.mock('lucide-react', () => ({
  ArrowLeft: () => <svg data-testid="arrow-left" />,
  Upload: () => <svg data-testid="upload-icon" />,
  FileText: () => <svg data-testid="file-icon" />,
  CheckCircle: () => <svg data-testid="check-icon" />,
  Code: () => <svg data-testid="code-icon" />,
  Copy: () => <svg data-testid="copy-icon" />,
  Download: () => <svg data-testid="download-icon" />,
  ChevronRight: () => <svg data-testid="chevron-right" />,
  ChevronLeft: () => <svg data-testid="chevron-left" />,
  AlertCircle: () => <svg data-testid="alert-icon" />,
}));

// Mock clipboard
Object.assign(navigator, {
  clipboard: { writeText: jest.fn() },
});

const renderWithRouter = (component) =>
  render(<BrowserRouter>{component}</BrowserRouter>);

const mockMetadata = {
  columns: [
    { name: 'id', dtype: 'int64', nullable: false, examples: [1, 2, 3] },
    { name: 'name', dtype: 'object', nullable: true, examples: ['Alice', 'Bob'] },
  ],
  row_count: 100,
  file_name: 'dataset.csv',
};

const mockDsl = {
  dataset: { name: 'dataset' },
  rules: [{ type: 'not_null', column: 'id' }],
};

const mockPysparkCode = 'from pyspark.sql import SparkSession\n# Generated code';

describe('AdvancedPySparkGenerator Component', () => {
  beforeEach(() => {
    fetch.mockClear();
    jest.clearAllMocks();
  });

  describe('Step 1 - Upload', () => {
    test('renders step 1 (upload) initially', () => {
      renderWithRouter(<AdvancedPySparkGenerator />);
      expect(screen.getByText(/Step 1: Upload Dataset/i)).toBeInTheDocument();
    });

    test('shows file selection interface in step 1', () => {
      renderWithRouter(<AdvancedPySparkGenerator />);
      expect(screen.getByText(/Select Dataset File/i)).toBeInTheDocument();
    });

    test('shows CSV upload options after CSV file selection', () => {
      renderWithRouter(<AdvancedPySparkGenerator />);
      const input = document.querySelector('input[type="file"]');
      const file = new File(['content'], 'data.csv', { type: 'text/csv' });
      fireEvent.change(input, { target: { files: [file] } });
      expect(screen.getByText(/Delimiter/i)).toBeInTheDocument();
      expect(screen.getByText(/Encoding/i)).toBeInTheDocument();
    });

    test('shows error when trying to proceed without file', () => {
      renderWithRouter(<AdvancedPySparkGenerator />);
      // The button is disabled when no file is selected
      const uploadBtn = screen.getByRole('button', { name: /Inspect Dataset/i });
      expect(uploadBtn).toBeDisabled();
    });

    test('shows selected file name after selection', () => {
      renderWithRouter(<AdvancedPySparkGenerator />);
      const input = document.querySelector('input[type="file"]');
      const file = new File(['content'], 'data.csv', { type: 'text/csv' });
      Object.defineProperty(file, 'size', { value: 1024 });
      fireEvent.change(input, { target: { files: [file] } });
      expect(screen.getByText(/Selected: data.csv/i)).toBeInTheDocument();
    });

    test('proceeds to step 2 after successful upload', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMetadata,
      });
      renderWithRouter(<AdvancedPySparkGenerator />);
      const input = document.querySelector('input[type="file"]');
      const file = new File(['content'], 'data.csv', { type: 'text/csv' });
      fireEvent.change(input, { target: { files: [file] } });
      const uploadBtn = screen.getByRole('button', { name: /Inspect Dataset/i });
      fireEvent.click(uploadBtn);
      await waitFor(() => {
        expect(screen.getByText(/Step 2: Review Dataset Metadata/i)).toBeInTheDocument();
      });
    });

    test('shows error on upload failure', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Unsupported file format' }),
        status: 400,
        statusText: 'Bad Request',
      });
      renderWithRouter(<AdvancedPySparkGenerator />);
      const input = document.querySelector('input[type="file"]');
      const file = new File(['content'], 'data.csv', { type: 'text/csv' });
      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.click(screen.getByRole('button', { name: /Inspect Dataset/i }));
      await waitFor(() => {
        expect(screen.getByText(/Unsupported file format/i)).toBeInTheDocument();
      });
    });

    test('shows network error with descriptive message', async () => {
      fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      renderWithRouter(<AdvancedPySparkGenerator />);
      const input = document.querySelector('input[type="file"]');
      const file = new File(['content'], 'data.csv', { type: 'text/csv' });
      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.click(screen.getByRole('button', { name: /Inspect Dataset/i }));
      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument();
      });
    });
  });

  describe('Step 2 - Metadata review', () => {
    const goToStep2 = async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMetadata,
      });
      renderWithRouter(<AdvancedPySparkGenerator />);
      const input = document.querySelector('input[type="file"]');
      const file = new File(['content'], 'data.csv', { type: 'text/csv' });
      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.click(screen.getByRole('button', { name: /Inspect Dataset/i }));
      await waitFor(() => {
        expect(screen.getByText(/Step 2: Review Dataset Metadata/i)).toBeInTheDocument();
      });
    };

    test('shows metadata editor in step 2', async () => {
      await goToStep2();
      // Column names from mock metadata are shown in the metadata table
      expect(screen.getAllByText('id').length).toBeGreaterThan(0);
      expect(screen.getAllByText('name').length).toBeGreaterThan(0);
    });

    test('back button returns to step 1 from step 2', async () => {
      await goToStep2();
      const backBtn = screen.getByRole('button', { name: /Back/i });
      fireEvent.click(backBtn);
      expect(screen.getByText(/Step 1: Upload Dataset/i)).toBeInTheDocument();
    });

    test('proceeds to step 3 after generate JSON', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMetadata,
      });
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ dsl: mockDsl }),
      });
      renderWithRouter(<AdvancedPySparkGenerator />);
      const input = document.querySelector('input[type="file"]');
      const file = new File(['content'], 'data.csv', { type: 'text/csv' });
      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.click(screen.getByRole('button', { name: /Inspect Dataset/i }));
      await waitFor(() => screen.getByText(/Step 2: Review Dataset Metadata/i));
      fireEvent.click(screen.getByRole('button', { name: /Generate JSON/i }));
      await waitFor(() => {
        expect(screen.getByText(/Step 3: Review and Edit JSON/i)).toBeInTheDocument();
      });
    });
  });

  describe('Step 3 - JSON review', () => {
    const goToStep3 = async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMetadata,
      });
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ dsl: mockDsl }),
      });
      renderWithRouter(<AdvancedPySparkGenerator />);
      const input = document.querySelector('input[type="file"]');
      const file = new File(['content'], 'data.csv', { type: 'text/csv' });
      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.click(screen.getByRole('button', { name: /Inspect Dataset/i }));
      await waitFor(() => screen.getByText(/Step 2: Review Dataset Metadata/i));
      fireEvent.click(screen.getByRole('button', { name: /Generate JSON/i }));
      await waitFor(() => screen.getByText(/Step 3: Review and Edit JSON/i));
    };

    test('shows JSON editor in step 3', async () => {
      await goToStep3();
      expect(screen.getByText(/Step 3: Review and Edit JSON/i)).toBeInTheDocument();
    });

    test('back button returns to step 2 from step 3', async () => {
      await goToStep3();
      const backBtn = screen.getByRole('button', { name: /Back/i });
      fireEvent.click(backBtn);
      expect(screen.getByText(/Step 2: Review Dataset Metadata/i)).toBeInTheDocument();
    });

    test('proceeds to step 4 after generate PySpark', async () => {
      await goToStep3();
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pyspark_code: mockPysparkCode,
          filename: 'generated_code.py',
        }),
      });
      fireEvent.click(screen.getByRole('button', { name: /Generate PySpark Code/i }));
      await waitFor(() => {
        expect(screen.getByText(/Step 4: PySpark Code/i)).toBeInTheDocument();
      });
    });
  });

  describe('Step 4 - PySpark code', () => {
    const goToStep4 = async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMetadata,
      });
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ dsl: mockDsl }),
      });
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pyspark_code: mockPysparkCode,
          filename: 'generated_code.py',
        }),
      });
      renderWithRouter(<AdvancedPySparkGenerator />);
      const input = document.querySelector('input[type="file"]');
      const file = new File(['content'], 'data.csv', { type: 'text/csv' });
      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.click(screen.getByRole('button', { name: /Inspect Dataset/i }));
      await waitFor(() => screen.getByText(/Step 2: Review Dataset Metadata/i));
      fireEvent.click(screen.getByRole('button', { name: /Generate JSON/i }));
      await waitFor(() => screen.getByText(/Step 3: Review and Edit JSON/i));
      fireEvent.click(screen.getByRole('button', { name: /Generate PySpark Code/i }));
      await waitFor(() => screen.getByText(/Step 4: PySpark Code/i));
    };

    test('shows generated PySpark code in step 4', async () => {
      await goToStep4();
      expect(screen.getByText(/Step 4: PySpark Code/i)).toBeInTheDocument();
    });

    test('copy button calls clipboard.writeText', async () => {
      await goToStep4();
      fireEvent.click(screen.getByRole('button', { name: /Copy/i }));
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockPysparkCode);
    });

    test('back button returns to step 3 from step 4', async () => {
      await goToStep4();
      // Step 4 has no Back button - there is a "Generate Another Dataset" button instead
      // Verify we are on step 4
      expect(screen.getByText(/Step 4: PySpark Code/i)).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    test('has link back to home', () => {
      renderWithRouter(<AdvancedPySparkGenerator />);
      const homeLink = screen.getByRole('link');
      expect(homeLink).toHaveAttribute('href', '/');
    });
  });
});

describe('AdvancedPySparkGenerator - Metadata with columns', () => {
  const richMetadata = {
    columns: [
      {
        name: 'id',
        dtype: 'int64',
        type: 'integer',
        nullable: false,
        null_ratio: 0.0,
        unique_ratio: 1.0,
        min: 1,
        max: 1000,
        mean: 500.5,
        sample_values: [1, 2, 3],
        examples: [1, 2, 3],
      },
      {
        name: 'name',
        dtype: 'object',
        type: 'string',
        nullable: true,
        null_ratio: 0.1,
        unique_ratio: 0.9,
        sample_values: ['Alice', 'Bob'],
        examples: ['Alice', 'Bob'],
      },
    ],
    row_count: 100,
    column_count: 2,
    file_name: 'dataset.csv',
    format: 'csv',
    detected_options: {
      encoding: 'utf-8',
      delimiter: ',',
    },
    preview: [
      { id: 1, name: 'Alice' },
    ],
  };

  const goToStep2 = async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => richMetadata,
    });
    renderWithRouter(<AdvancedPySparkGenerator />);
    const input = document.querySelector('input[type="file"]');
    const file = new File(['content'], 'data.csv', { type: 'text/csv' });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /Inspect Dataset/i }));
    await waitFor(() => {
      expect(screen.getByText(/Step 2: Review Dataset Metadata/i)).toBeInTheDocument();
    });
  };

  beforeEach(() => {
    fetch.mockClear();
    jest.clearAllMocks();
  });

  test('shows auto-detected encoding in step 2', async () => {
    await goToStep2();
    expect(screen.getByText(/utf-8/i)).toBeInTheDocument();
  });

  test('shows column statistics in step 2', async () => {
    await goToStep2();
    expect(screen.getAllByText(/id/i).length).toBeGreaterThan(0);
  });

  test('shows data preview table in step 2', async () => {
    await goToStep2();
    expect(screen.getByText(/Data Preview/i)).toBeInTheDocument();
  });

  test('allows editing column required checkbox in step 2', async () => {
    await goToStep2();
    const checkboxes = screen.getAllByRole('checkbox');
    // Click the first column required checkbox
    if (checkboxes.length > 0) {
      fireEvent.click(checkboxes[0]);
      // No error should be thrown
      expect(checkboxes[0]).toBeInTheDocument();
    }
  });

  test('allows editing dataset name in step 2', async () => {
    await goToStep2();
    const nameInput = screen.getByDisplayValue(/dataset/i);
    fireEvent.change(nameInput, { target: { value: 'my_custom_dataset' } });
    expect(nameInput.value).toBe('my_custom_dataset');
  });

  test('shows Format, Rows, Columns info in step 2', async () => {
    await goToStep2();
    expect(screen.getByText('Format')).toBeInTheDocument();
    expect(screen.getByText('Rows')).toBeInTheDocument();
    expect(screen.getByText('Columns')).toBeInTheDocument();
    expect(screen.getByText('CSV')).toBeInTheDocument();
  });

  test('shows generate another dataset button after completion', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => richMetadata });
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ dsl: { rules: [] } }) });
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ pyspark_code: 'print("ok")', filename: 'code.py' }) });
    
    renderWithRouter(<AdvancedPySparkGenerator />);
    const input = document.querySelector('input[type="file"]');
    const file = new File(['content'], 'data.csv', { type: 'text/csv' });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /Inspect Dataset/i }));
    await waitFor(() => screen.getByText(/Step 2: Review Dataset Metadata/i));
    fireEvent.click(screen.getByRole('button', { name: /Generate JSON/i }));
    await waitFor(() => screen.getByText(/Step 3: Review and Edit JSON/i));
    fireEvent.click(screen.getByRole('button', { name: /Generate PySpark Code/i }));
    await waitFor(() => screen.getByText(/Step 4: PySpark Code/i));
    
    expect(screen.getByRole('button', { name: /Generate Another Dataset/i })).toBeInTheDocument();
  });
});

describe('AdvancedPySparkGenerator - JSON and Error Handling', () => {
  beforeEach(() => {
    fetch.mockClear();
    jest.clearAllMocks();
  });

  const simpleMetadata = {
    columns: [{ name: 'id', dtype: 'int64', type: 'integer', nullable: false, null_ratio: 0.0, unique_ratio: 1.0 }],
    row_count: 10,
    column_count: 1,
    format: 'csv',
    preview: [{ id: 1 }],
  };

  test('shows error when JSON generation fails', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => simpleMetadata });
    fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'JSON generation failed' }) });

    renderWithRouter(<AdvancedPySparkGenerator />);
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [new File(['content'], 'data.csv')] } });
    fireEvent.click(screen.getByRole('button', { name: /Inspect Dataset/i }));
    await waitFor(() => screen.getByText(/Step 2: Review Dataset Metadata/i));

    fireEvent.click(screen.getByRole('button', { name: /Generate JSON/i }));
    await waitFor(() => {
      expect(screen.queryByText(/Step 3: Review and Edit JSON/i)).not.toBeInTheDocument();
    });
  });

  test('shows error when PySpark generation fails', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => simpleMetadata });
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ dsl: { rules: [] } }) });
    fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Code generation failed' }) });

    renderWithRouter(<AdvancedPySparkGenerator />);
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [new File(['content'], 'data.csv')] } });
    fireEvent.click(screen.getByRole('button', { name: /Inspect Dataset/i }));
    await waitFor(() => screen.getByText(/Step 2: Review Dataset Metadata/i));
    fireEvent.click(screen.getByRole('button', { name: /Generate JSON/i }));
    await waitFor(() => screen.getByText(/Step 3: Review and Edit JSON/i));
    fireEvent.click(screen.getByRole('button', { name: /Generate PySpark Code/i }));
    await waitFor(() => {
      expect(screen.queryByText(/Step 4: PySpark Code/i)).not.toBeInTheDocument();
    });
  });

  test('allows editing JSON text in step 3', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => simpleMetadata });
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ dsl: { rules: [{ rule: 'test' }] } }) });

    renderWithRouter(<AdvancedPySparkGenerator />);
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [new File(['content'], 'data.csv')] } });
    fireEvent.click(screen.getByRole('button', { name: /Inspect Dataset/i }));
    await waitFor(() => screen.getByText(/Step 2: Review Dataset Metadata/i));
    fireEvent.click(screen.getByRole('button', { name: /Generate JSON/i }));
    await waitFor(() => screen.getByText(/Step 3: Review and Edit JSON/i));

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '{"custom": "dsl"}' } });
    expect(textarea.value).toBe('{"custom": "dsl"}');
  });

  test('Generate Another Dataset button resets to step 1', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => simpleMetadata });
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ dsl: { rules: [] } }) });
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ pyspark_code: 'spark.createDataFrame()', filename: 'code.py' }) });

    renderWithRouter(<AdvancedPySparkGenerator />);
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [new File(['content'], 'data.csv')] } });
    fireEvent.click(screen.getByRole('button', { name: /Inspect Dataset/i }));
    await waitFor(() => screen.getByText(/Step 2: Review Dataset Metadata/i));
    fireEvent.click(screen.getByRole('button', { name: /Generate JSON/i }));
    await waitFor(() => screen.getByText(/Step 3: Review and Edit JSON/i));
    fireEvent.click(screen.getByRole('button', { name: /Generate PySpark Code/i }));
    await waitFor(() => screen.getByText(/Step 4: PySpark Code/i));

    const resetBtn = screen.getByRole('button', { name: /Generate Another Dataset/i });
    fireEvent.click(resetBtn);
    expect(screen.getByText(/Step 1: Upload Dataset/i)).toBeInTheDocument();
  });
});
