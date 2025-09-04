import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/Header';
import { DashboardPage } from './pages/DashboardPage';
import { PromptEvaluatorPage } from './pages/PromptEvaluatorPage';
import { ModelPerformancePage } from './pages/ModelPerformancePage';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-900">
        <Header />
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/prompt-evaluator" element={<PromptEvaluatorPage />} />
          <Route path="/model-performance" element={<ModelPerformancePage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;