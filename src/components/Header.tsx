import React from 'react';
import { TrendingUp, Bot, Activity } from 'lucide-react';

export function Header() {
  return (
    <header className="bg-gray-900 border-b border-gray-700 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">CryptoTrader Bot</h1>
            <p className="text-sm text-gray-400">AI-Powered Trading Analysis</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-green-400" />
            <span className="text-sm text-green-400 font-medium">Live Analysis</span>
          </div>
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-gray-300">Last updated: 2 min ago</span>
          </div>
        </div>
      </div>
    </header>
  );
}