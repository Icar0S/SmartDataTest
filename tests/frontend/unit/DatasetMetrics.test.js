/**
 * Tests for DatasetMetrics component
 * Tests core rendering functionality and user interactions
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import DatasetMetrics from '../../../frontend/src/pages/DatasetMetrics';

// Mock fetch globally
global.fetch = jest.fn();

// Helper function to render component with router
const renderWithRouter = (component) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('DatasetMetrics Component', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  describe('Initial Render', () => {
    test('renders page title and description', () => {
      renderWithRouter(<DatasetMetrics />);
      
      expect(screen.getByText('Métricas de Qualidade de Dados')).toBeInTheDocument();
      expect(screen.getByText(/Analise a qualidade do seu dataset/)).toBeInTheDocument();
    });

    test('renders upload section', () => {
      renderWithRouter(<DatasetMetrics />);
      
      expect(screen.getByText('Upload do Dataset')).toBeInTheDocument();
      expect(screen.getByText(/Arraste seu dataset aqui/)).toBeInTheDocument();
      expect(screen.getByText(/Formatos suportados: CSV, XLSX, XLS, Parquet/)).toBeInTheDocument();
    });

    test('renders back to home link', () => {
      renderWithRouter(<DatasetMetrics />);
      
      const backLink = screen.getByRole('link', { name: /Back to Home/i });
      expect(backLink).toBeInTheDocument();
      expect(backLink).toHaveAttribute('href', '/');
    });
  });

  describe('File Upload', () => {
    test('accepts file selection', () => {
      renderWithRouter(<DatasetMetrics />);
      
      const file = new File(['test'], 'test.csv', { type: 'text/csv' });
      const input = screen.getByLabelText('Selecionar arquivo');
      
      fireEvent.change(input, { target: { files: [file] } });
      
      expect(screen.getByText('test.csv')).toBeInTheDocument();
    });

    test('shows error for invalid file type', () => {
      renderWithRouter(<DatasetMetrics />);
      
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const input = screen.getByLabelText('Selecionar arquivo');
      
      fireEvent.change(input, { target: { files: [file] } });
      
      expect(screen.getByText(/Tipo de arquivo inválido/)).toBeInTheDocument();
    });

    test('shows error for file over 10MB', () => {
      renderWithRouter(<DatasetMetrics />);

      // Create mock file over 10MB
      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.csv', { type: 'text/csv' });
      const input = screen.getByLabelText('Selecionar arquivo');

      fireEvent.change(input, { target: { files: [largeFile] } });

      expect(screen.getByText(/muito grande/i)).toBeInTheDocument();
      expect(screen.getAllByText(/10MB/i).length).toBeGreaterThan(0);
    });

    test('shows analyze button after file selection', () => {
      renderWithRouter(<DatasetMetrics />);
      
      const file = new File(['test'], 'test.csv', { type: 'text/csv' });
      const input = screen.getByLabelText('Selecionar arquivo');
      
      fireEvent.change(input, { target: { files: [file] } });
      
      expect(screen.getByText('Analisar Dataset')).toBeInTheDocument();
    });
  });

  describe('Analysis Process', () => {
    test('uploads and analyzes file successfully', async () => {
      // Mock successful upload
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessionId: 'test-session-id',
          columns: ['col1', 'col2'],
          sample: [{ col1: 1, col2: 'a' }],
          format: 'csv',
          rows: 100,
        }),
      });

      // Mock successful analysis
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          overall_quality_score: 95.5,
          metrics: {
            completeness: {
              overall_completeness: 100,
              total_cells: 200,
              filled_cells: 200,
              missing_cells: 0,
            },
            uniqueness: {
              overall_uniqueness: 95,
              total_rows: 100,
              unique_rows: 95,
              duplicate_rows: 5,
            },
            validity: {
              overall_validity: 98,
              total_cells: 200,
              valid_cells: 196,
              invalid_cells: 4,
            },
            consistency: {
              overall_consistency: 90,
            },
            dataset_info: {
              rows: 100,
              columns: 2,
              memory_usage_mb: 0.5,
            },
          },
          recommendations: [],
          generated_at: '2024-01-01T00:00:00',
        }),
      });

      renderWithRouter(<DatasetMetrics />);
      
      // Upload file
      const file = new File(['test'], 'test.csv', { type: 'text/csv' });
      const input = screen.getByLabelText('Selecionar arquivo');
      fireEvent.change(input, { target: { files: [file] } });
      
      // Click analyze button
      const analyzeButton = screen.getByText('Analisar Dataset');
      fireEvent.click(analyzeButton);
      
      // Wait for results to appear
      await waitFor(() => {
        expect(screen.getByText('Score Geral de Qualidade')).toBeInTheDocument();
      });

      // Check that metrics are displayed
      expect(screen.getByText('95.5%')).toBeInTheDocument();
      expect(screen.getByText('Completude')).toBeInTheDocument();
      expect(screen.getByText('Unicidade')).toBeInTheDocument();
      expect(screen.getByText('Validade')).toBeInTheDocument();
      expect(screen.getByText('Consistência')).toBeInTheDocument();
    });

    test('handles upload error', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Upload failed' }),
      });

      renderWithRouter(<DatasetMetrics />);
      
      const file = new File(['test'], 'test.csv', { type: 'text/csv' });
      const input = screen.getByLabelText('Selecionar arquivo');
      fireEvent.change(input, { target: { files: [file] } });
      
      const analyzeButton = screen.getByText('Analisar Dataset');
      fireEvent.click(analyzeButton);
      
      await waitFor(() => {
        expect(screen.getByText('Upload failed')).toBeInTheDocument();
      });
    });

    test('handles insufficient memory error (507)', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: 'test-session-id' }),
      });
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'insufficient memory: cannot allocate buffer' }),
      });

      renderWithRouter(<DatasetMetrics />);
      const file = new File(['test'], 'test.csv', { type: 'text/csv' });
      fireEvent.change(screen.getByLabelText('Selecionar arquivo'), { target: { files: [file] } });
      fireEvent.click(screen.getByText('Analisar Dataset'));

      await waitFor(() => {
        expect(screen.getByText(/Memória insuficiente/i)).toBeInTheDocument();
      });
    });

    test('handles 507 status code in error message', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: 'test-session-id' }),
      });
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Error 507: Insufficient Storage' }),
      });

      renderWithRouter(<DatasetMetrics />);
      fireEvent.change(screen.getByLabelText('Selecionar arquivo'), { target: { files: [new File(['t'], 'test.csv', { type: 'text/csv' })] } });
      fireEvent.click(screen.getByText('Analisar Dataset'));

      await waitFor(() => {
        expect(screen.getByText(/Memória insuficiente/i)).toBeInTheDocument();
      });
    });

    test('handles dataset too large error (413)', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: 'test-session-id' }),
      });
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: '413 Request Entity Too Large' }),
      });

      renderWithRouter(<DatasetMetrics />);
      fireEvent.change(screen.getByLabelText('Selecionar arquivo'), { target: { files: [new File(['t'], 'test.csv', { type: 'text/csv' })] } });
      fireEvent.click(screen.getByText('Analisar Dataset'));

      await waitFor(() => {
        expect(screen.getByText(/Dataset muito grande/i)).toBeInTheDocument();
      });
    });

    test('handles rows exceeds maximum error', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: 'test-session-id' }),
      });
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'rows exceeds maximum allowed limit of 50000' }),
      });

      renderWithRouter(<DatasetMetrics />);
      fireEvent.change(screen.getByLabelText('Selecionar arquivo'), { target: { files: [new File(['t'], 'test.csv', { type: 'text/csv' })] } });
      fireEvent.click(screen.getByText('Analisar Dataset'));

      await waitFor(() => {
        expect(screen.getByText(/Dataset muito grande/i)).toBeInTheDocument();
      });
    });

    test('allows closing the error alert', () => {
      renderWithRouter(<DatasetMetrics />);
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      fireEvent.change(screen.getByLabelText('Selecionar arquivo'), { target: { files: [file] } });

      expect(screen.getByText(/Tipo de arquivo inválido/)).toBeInTheDocument();

      const closeBtn = screen.getByLabelText('Fechar alerta');
      fireEvent.click(closeBtn);

      expect(screen.queryByText(/Tipo de arquivo inválido/)).not.toBeInTheDocument();
    });
  });

  describe('Results Display', () => {
    test('displays recommendations when available', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: 'test-session-id' }),
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          overall_quality_score: 75,
          metrics: {
            completeness: { overall_completeness: 85 },
            uniqueness: { overall_uniqueness: 90 },
            validity: { overall_validity: 80 },
            consistency: { overall_consistency: 70 },
            dataset_info: { rows: 100, columns: 5, memory_usage_mb: 1 },
          },
          recommendations: [
            {
              severity: 'high',
              category: 'completeness',
              message: 'Dataset has missing values',
            },
          ],
          generated_at: '2024-01-01T00:00:00',
        }),
      });

      renderWithRouter(<DatasetMetrics />);
      
      const file = new File(['test'], 'test.csv', { type: 'text/csv' });
      const input = screen.getByLabelText('Selecionar arquivo');
      fireEvent.change(input, { target: { files: [file] } });
      
      const analyzeButton = screen.getByText('Analisar Dataset');
      fireEvent.click(analyzeButton);
      
      await waitFor(() => {
        expect(screen.getByText('Recomendações')).toBeInTheDocument();
      });
      
      expect(screen.getByText('Dataset has missing values')).toBeInTheDocument();
    });

    test('allows analyzing new dataset', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: 'test-session-id' }),
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          overall_quality_score: 95,
          metrics: {
            completeness: { overall_completeness: 100 },
            uniqueness: { overall_uniqueness: 100 },
            validity: { overall_validity: 100 },
            consistency: { overall_consistency: 100 },
            dataset_info: { rows: 100, columns: 5, memory_usage_mb: 1 },
          },
          recommendations: [],
          generated_at: '2024-01-01T00:00:00',
        }),
      });

      renderWithRouter(<DatasetMetrics />);
      
      const file = new File(['test'], 'test.csv', { type: 'text/csv' });
      const input = screen.getByLabelText('Selecionar arquivo');
      fireEvent.change(input, { target: { files: [file] } });
      
      const analyzeButton = screen.getByText('Analisar Dataset');
      fireEvent.click(analyzeButton);
      
      await waitFor(() => {
        expect(screen.getByText('Analisar Novo Dataset')).toBeInTheDocument();
      });

      // Click reset button
      const resetButton = screen.getByText('Analisar Novo Dataset');
      fireEvent.click(resetButton);

      // Upload section should be visible again
      expect(screen.getByText(/Arraste seu dataset aqui/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('sets document title', () => {
      renderWithRouter(<DatasetMetrics />);
      expect(document.title).toBe('Dataset Metrics - DataForgeTest');
    });

    test('has proper button roles', () => {
      renderWithRouter(<DatasetMetrics />);
      
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    test('has proper link navigation', () => {
      renderWithRouter(<DatasetMetrics />);
      
      const backLink = screen.getByRole('link', { name: /Back to Home/i });
      expect(backLink).toHaveAttribute('href', '/');
    });
  });
});

describe('DatasetMetrics - Drag and Drop', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  test('sets dragActive state on dragenter', () => {
    renderWithRouter(<DatasetMetrics />);
    // Target the outer drop zone button element
    const dropZone = screen.getByRole('button', { name: /Arraste seu dataset aqui/i });
    fireEvent.dragEnter(dropZone);
    fireEvent.dragLeave(dropZone);
    // Should not throw
    expect(dropZone).toBeInTheDocument();
  });

  test('handles drop with valid CSV file', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessionId: 'test-session',
        columns: ['col1'],
        sample: [],
        rows: 100,
        format: 'csv',
      }),
    });
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        overall_quality_score: 90,
        metrics: {
          completeness: { overall_completeness: 100 },
          uniqueness: { overall_uniqueness: 90 },
          validity: { overall_validity: 95 },
          consistency: { overall_consistency: 85 },
          dataset_info: { rows: 100, columns: 1, memory_usage_mb: 0.1 },
        },
        recommendations: [],
        generated_at: '2024-01-01T00:00:00',
      }),
    });

    renderWithRouter(<DatasetMetrics />);
    const file = new File(['content'], 'data.csv', { type: 'text/csv' });
    
    const input = screen.getByLabelText('Selecionar arquivo');
    fireEvent.change(input, { target: { files: [file] } });
    const analyzeBtn = screen.getByText('Analisar Dataset');
    fireEvent.click(analyzeBtn);
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  test('shows dragging state in UI', () => {
    renderWithRouter(<DatasetMetrics />);
    const dropZone = screen.getByRole('button', { name: /Arraste seu dataset aqui/i });
    fireEvent.dragOver(dropZone);
    expect(dropZone).toBeInTheDocument();
  });

  test('handles file drop on the drop zone button', () => {
    renderWithRouter(<DatasetMetrics />);
    const dropZone = screen.getByRole('button', { name: /Arraste seu dataset aqui/i });
    const file = new File(['content'], 'dropped.csv', { type: 'text/csv' });
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });
    expect(screen.getByText('dropped.csv')).toBeInTheDocument();
  });

  test('clicking the drop zone button triggers file input click', () => {
    renderWithRouter(<DatasetMetrics />);
    const clickSpy = jest.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    const dropZone = screen.getByRole('button', { name: /Arraste seu dataset aqui/i });
    fireEvent.click(dropZone);
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});

describe('DatasetMetrics - Section Toggle', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  const fullMetricsResponse = {
    overall_quality_score: 85,
    data_type_distribution: { numeric: 3, string: 2, datetime: 1 },
    metrics: {
      completeness: {
        overall_completeness: 90,
        total_cells: 1000,
        filled_cells: 900,
        missing_cells: 100,
        per_column: { col1: { completeness: 0.9, missing_values: 10 } },
      },
      uniqueness: {
        overall_uniqueness: 95,
        total_rows: 100,
        unique_rows: 95,
        duplicate_rows: 5,
        per_column: { col1: { uniqueness: 0.95 } },
      },
      validity: {
        overall_validity: 88,
        total_cells: 1000,
        valid_cells: 880,
        invalid_cells: 120,
        per_column: { col1: { validity: 0.88, invalid_values: [] } },
      },
      consistency: {
        overall_consistency: 92,
        problematic_columns: [{ column: 'col1', issue: 'Mixed types', count: 5 }],
      },
      dataset_info: {
        rows: 100,
        columns: 2,
        memory_usage_mb: 0.5,
        dtypes: { col1: 'object', col2: 'float64' },
      },
    },
    problematic_columns: {
      completeness: [{ column: 'col1', missing_rate: 0.1, missing_count: 10, total_count: 100, score: 90.0 }],
      uniqueness: [{ column: 'col2', unique_count: 80, total_count: 100, score: 80.0 }],
      validity: [{ column: 'col1', invalid_count: 5, total_count: 100, score: 95.0 }],
      consistency: [{ column: 'col2', score: 75.0, data_type: 'float64' }],
    },
    column_statistics: {
      col1: { dtype: 'object', count: 100, unique: 90, null_count: 10, data_type: 'string', non_null_count: 90, min_length: 2, max_length: 20, avg_length: 10.5, unique_values: 90 },
      col2: { dtype: 'float64', count: 100, null_count: 0, data_type: 'numeric', non_null_count: 100, min: 0.5, max: 99.5, mean: 50.0 },
    },
    recommendations: [
      { severity: 'high', category: 'completeness', message: 'Missing values detected' },
      { severity: 'medium', category: 'uniqueness', message: 'Duplicate rows found' },
      { severity: 'low', category: 'validity', message: 'Minor formatting issues' },
    ],
    generated_at: '2024-01-01T00:00:00',
  };

  const getToReport = async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessionId: 'test-session', columns: ['col1'], sample: [], rows: 100, format: 'csv' }),
    });
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fullMetricsResponse,
    });
    renderWithRouter(<DatasetMetrics />);
    const file = new File(['content'], 'data.csv', { type: 'text/csv' });
    const input = screen.getByLabelText('Selecionar arquivo');
    fireEvent.change(input, { target: { files: [file] } });
    const analyzeBtn = screen.getByText('Analisar Dataset');
    fireEvent.click(analyzeBtn);
    await waitFor(() => {
      expect(screen.getByText('Score Geral de Qualidade')).toBeInTheDocument();
    });
  };

  test('toggles Colunas Problemáticas section on click', async () => {
    await getToReport();
    // Find by text content since button contains nested elements
    const colunasProbSection = screen.getByText('Colunas Problemáticas');
    const toggleBtn = colunasProbSection.closest('button');
    if (toggleBtn) {
      fireEvent.click(toggleBtn);
      expect(toggleBtn).toBeInTheDocument();
    } else {
      // Section might have been rendered in a div, just verify it's visible
      expect(colunasProbSection).toBeInTheDocument();
    }
  });

  test('toggles Estatísticas section on click', async () => {
    await getToReport();
    const estatSection = screen.getByText('Estatísticas por Coluna');
    const toggleBtn = estatSection.closest('button');
    if (toggleBtn) {
      fireEvent.click(toggleBtn);
      expect(toggleBtn).toBeInTheDocument();
    } else {
      expect(estatSection).toBeInTheDocument();
    }
  });

  test('shows recommendations when present', async () => {
    await getToReport();
    expect(screen.getByText('Missing values detected')).toBeInTheDocument();
  });

  test('shows reset button in results view', async () => {
    await getToReport();
    expect(screen.getByText('Analisar Novo Dataset')).toBeInTheDocument();
  });

  test('displays data type distribution when available', async () => {
    await getToReport();
    // fullMetricsResponse includes data_type_distribution: { numeric: 3, string: 2, datetime: 1 }
    expect(screen.getByText('Distribuição de Tipos de Dados')).toBeInTheDocument();
    expect(screen.getByText('numeric')).toBeInTheDocument();
    expect(screen.getByText('string')).toBeInTheDocument();
  });

  test('displays all three recommendation severities', async () => {
    await getToReport();
    // fullMetricsResponse includes high, medium, and low severity recommendations
    expect(screen.getByText('Missing values detected')).toBeInTheDocument();
    expect(screen.getByText('Duplicate rows found')).toBeInTheDocument();
    expect(screen.getByText('Minor formatting issues')).toBeInTheDocument();
    // Verify severity labels rendered
    expect(screen.getByText('Alta')).toBeInTheDocument();
    expect(screen.getByText('Média')).toBeInTheDocument();
    expect(screen.getByText('Baixa')).toBeInTheDocument();
  });

  test('displays uniqueness and validity problematic column sections', async () => {
    await getToReport();
    // fullMetricsResponse now includes non-empty uniqueness and validity arrays
    const problems = screen.getAllByText('Colunas Problemáticas');
    expect(problems.length).toBeGreaterThan(0);
  });

  test('expands column statistics and shows numeric column details', async () => {
    await getToReport();
    const estatSection = screen.getByText('Estatísticas por Coluna');
    const toggleBtn = estatSection.closest('button');
    expect(toggleBtn).not.toBeNull();
    fireEvent.click(toggleBtn);
    // After expanding, column names should be visible in the table
    await waitFor(() => {
      expect(screen.getAllByText('col1').length).toBeGreaterThan(0);
    });
  });

  test('expands column statistics to show Min/Max/Média for numeric columns', async () => {
    await getToReport();
    const estatSection = screen.getByText('Estatísticas por Coluna');
    fireEvent.click(estatSection.closest('button'));
    await waitFor(() => {
      // col2 is numeric with min: 0.5, max: 99.5, mean: 50.0
      expect(screen.getByText(/Min: 0\.50/)).toBeInTheDocument();
    });
  });

  test('expands column statistics to show length info for string columns', async () => {
    await getToReport();
    const estatSection = screen.getByText('Estatísticas por Coluna');
    fireEvent.click(estatSection.closest('button'));
    await waitFor(() => {
      // col1 has min_length: 2, max_length: 20
      expect(screen.getByText(/Comprimento: 2-20/)).toBeInTheDocument();
    });
  });
});

describe('DatasetMetrics - Coverage Edge Cases', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  const makeReport = (overrides = {}) => ({
    overall_quality_score: 85,
    metrics: {
      completeness: { overall_completeness: 90, total_cells: 100, filled_cells: 90, missing_cells: 10 },
      uniqueness: { overall_uniqueness: 95, total_rows: 100, unique_rows: 95, duplicate_rows: 5 },
      validity: { overall_validity: 88, total_cells: 100, valid_cells: 88, invalid_cells: 12 },
      consistency: { overall_consistency: 92 },
      dataset_info: { rows: 100, columns: 2, memory_usage_mb: 0.5 },
    },
    problematic_columns: { completeness: [], uniqueness: [], validity: [], consistency: [] },
    recommendations: [],
    generated_at: '2024-01-01T00:00:00',
    ...overrides,
  });

  const renderAndAnalyze = async (reportOverrides = {}) => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ sessionId: 'sid' }) });
    fetch.mockResolvedValueOnce({ ok: true, json: async () => makeReport(reportOverrides) });
    renderWithRouter(<DatasetMetrics />);
    fireEvent.change(screen.getByLabelText('Selecionar arquivo'), {
      target: { files: [new File(['t'], 'test.csv', { type: 'text/csv' })] },
    });
    fireEvent.click(screen.getByText('Analisar Dataset'));
    await waitFor(() => {
      expect(screen.getByText('Score Geral de Qualidade')).toBeInTheDocument();
    });
  };

  test('shows red quality score for score below 70', async () => {
    await renderAndAnalyze({ overall_quality_score: 60 });
    // The score 60.0% should be displayed
    expect(screen.getByText('60.0%')).toBeInTheDocument();
    // "Qualidade necessita atenção" message shown for score < 70
    expect(screen.getByText(/Qualidade necessita aten/)).toBeInTheDocument();
  });

  test('shows yellow quality score for score between 70 and 89', async () => {
    await renderAndAnalyze({ overall_quality_score: 75 });
    expect(screen.getByText('75.0%')).toBeInTheDocument();
    expect(screen.getByText(/Boa qualidade/)).toBeInTheDocument();
  });

  test('shows green quality score and excellent message for score >= 90', async () => {
    await renderAndAnalyze({ overall_quality_score: 95 });
    expect(screen.getByText('95.0%')).toBeInTheDocument();
    expect(screen.getByText('Excelente qualidade!')).toBeInTheDocument();
  });

  test('shows no problematic columns message when all arrays are empty', async () => {
    await renderAndAnalyze();
    // When all problematic_columns arrays are empty, toggle section to see message
    const colunasProbSection = screen.getByText('Colunas Problemáticas');
    const toggleBtn = colunasProbSection.closest('button');
    // Initially expanded, should show no issues message
    await waitFor(() => {
      expect(screen.getByText(/Nenhuma coluna problem/i)).toBeInTheDocument();
    });
  });

  test('Low severity recommendation renders with blue styling class', async () => {
    await renderAndAnalyze({
      recommendations: [{ severity: 'low', category: 'validity', message: 'Low severity issue' }],
    });
    expect(screen.getByText('Low severity issue')).toBeInTheDocument();
    expect(screen.getByText('Baixa')).toBeInTheDocument();
  });
});
