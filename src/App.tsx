import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { TradingRecommendation } from './components/TradingRecommendation';
import { EvaluationStats } from './components/EvaluationStats';
import { useRealTimeData } from './hooks/useRealTimeData';
import { RefreshCw, Target, Filter } from 'lucide-react';

function App() {
  const {
    recommendations,
    evaluationStats,
    isLoading,
    lastUpdate,
    refreshData
  } = useRealTimeData();
  
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accurate' | 'inaccurate' | 'expired' | 'no_entry_hit'>('all');
  
  const filteredRecommendations = recommendations.filter(rec => {
    if (statusFilter === 'all') return true;
    return rec.status === statusFilter;
  });

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Trade Recommendation Evaluator</h2>
            <p className="text-gray-400">Track and evaluate AI-powered trading recommendations performance</p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button 
              onClick={refreshData}
              disabled={isLoading}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Performance Statistics */}
        <div className="mb-8">
          <EvaluationStats stats={evaluationStats} />
        </div>

        {/* Filter and Recommendations Section */}
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Target className="w-5 h-5 text-blue-400" />
              <h3 className="text-xl font-semibold text-white">Trade Recommendations</h3>
              <span className="text-gray-400 text-sm">({filteredRecommendations.length} of {recommendations.length})</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-1 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="accurate">Accurate</option>
                <option value="inaccurate">Inaccurate</option>
                <option value="expired">Expired</option>
                <option value="no_entry_hit">No Entry Hit</option>
              </select>
            </div>
          </div>
          
          {/* Recommendations Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredRecommendations.length > 0 ? filteredRecommendations.map((recommendation, index) => (
              <TradingRecommendation key={recommendation.id || index} recommendation={recommendation} />
            )) : (
              <div className="col-span-full bg-gray-800 rounded-lg p-8 border border-gray-700 text-center">
                {isLoading ? (
                  <div className="text-gray-400">
                    <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
                    <p className="text-gray-300">Loading trade recommendations...</p>
                    <p className="text-gray-500 text-sm mt-1">Fetching evaluation data from database</p>
                  </div>
                ) : (
                  <div className="text-gray-400">
                    <Target className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                    <p className="text-gray-300 font-medium mb-2">
                      {statusFilter === 'all' ? 'No recommendations found' : `No ${statusFilter} recommendations`}
                    </p>
                    <p className="text-gray-500 text-sm">
                      {recommendations.length === 0 
                        ? 'Generate new recommendations using Discord commands to see them here'
                        : 'Try changing the filter to see other recommendations'
                      }
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Status Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Last updated: {lastUpdate.toLocaleTimeString()} • Evaluations run every 4 hours</p>
          <p className="mt-1">Use Discord commands to generate new recommendations</p>
        </div>
      </main>
    </div>
  );
}

export default App;