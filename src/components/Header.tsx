import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bot, Target } from 'lucide-react';

export function Header() {
  const location = useLocation();
  
  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <header className="bg-gray-900 border-b border-gray-700 px-4 sm:px-6 py-4">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white">Trade Recommendation Evaluator</h1>
            <p className="text-sm text-gray-400">Track AI Trading Performance</p>
          </div>
        </div>
        
        <nav className="flex items-center space-x-3 sm:space-x-6">
          <Link
            to="/dashboard"
            className={`flex items-center space-x-2 px-2 sm:px-3 py-2 rounded-lg transition-colors ${
              isActive('/dashboard') 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-300 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Target className="w-4 h-4" />
            <span className="text-xs sm:text-sm">Dashboard</span>
          </Link>
          
          <Link
            to="/prompt-evaluator"
            className={`flex items-center space-x-2 px-2 sm:px-3 py-2 rounded-lg transition-colors ${
              isActive('/prompt-evaluator') 
                ? 'bg-purple-600 text-white' 
                : 'text-gray-300 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Target className="w-4 h-4" />
            <span className="text-xs sm:text-sm">Prompt Evaluator</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}