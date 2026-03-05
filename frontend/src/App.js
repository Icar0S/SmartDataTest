import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
// Importar o CSS do Tailwind primeiro
import './index.css';
// Depois importar os estilos específicos da aplicação
import './App.css';
import HomePage from './components/HomePage';
import SupportPage from './pages/SupportPage';
import DataAccuracy from './pages/DataAccuracy';
import TestDatasetGold from './pages/TestDatasetGold';
import DatasetMetrics from './pages/DatasetMetrics';
import QaChecklist from './pages/QaChecklist';
import ChecklistPage from './pages/ChecklistPage';
import GenerateDataset from './pages/GenerateDataset';
import AdvancedPySparkGenerator from './pages/AdvancedPySparkGenerator';
import MethodologyPage from './pages/MethodologyPage';
import LoginPage from './pages/LoginPage';
import SupportButton from './components/SupportButton';
import ProtectedRoute from './components/ProtectedRoute';

function AppContent() {
  const location = useLocation();
  const hideSupportButton =
    location.pathname === '/support-rag' || location.pathname === '/login';

  return (
    <div className="App">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/support-rag" element={<ProtectedRoute><SupportPage /></ProtectedRoute>} />
        <Route path="/data-accuracy" element={<ProtectedRoute><DataAccuracy /></ProtectedRoute>} />
        <Route path="/data-accuracy/test-gold" element={<ProtectedRoute><TestDatasetGold /></ProtectedRoute>} />
        <Route path="/data-accuracy/metrics" element={<ProtectedRoute><DatasetMetrics /></ProtectedRoute>} />
        <Route path="/qa-checklist" element={<ProtectedRoute><QaChecklist /></ProtectedRoute>} />
        <Route path="/checklist" element={<ProtectedRoute><ChecklistPage /></ProtectedRoute>} />
        <Route path="/generate-dataset" element={<ProtectedRoute><GenerateDataset /></ProtectedRoute>} />
        <Route path="/pyspark/advanced" element={<ProtectedRoute><AdvancedPySparkGenerator /></ProtectedRoute>} />
        <Route path="/methodology" element={<ProtectedRoute><MethodologyPage /></ProtectedRoute>} />
        <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
      </Routes>
      {!hideSupportButton && <SupportButton />}
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;