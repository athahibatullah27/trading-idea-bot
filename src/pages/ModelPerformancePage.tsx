import React, { useState, useEffect } from 'react';
import { 
  getEvaluationStatsByModelFromAPI,
  getConfidenceDistributionByModelFromAPI,
  getRiskLevelDistributionByModelFromAPI
} from '../services/tradingService';
import { RefreshCw, BarChart3, Target, TrendingUp, Activity, Cpu, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface ModelStats {
  total: number;
  pending: number;
  accurate: number;
  inaccurate: number;
  expired: number;
  noEntryHit: number;
  accuracyRate: number;
}

interface ConfidenceDistribution {
  '0-20': number;
  '21-40': number;
  '41-60': number;
  '61-80': number;
  '81-100': number;
}

interface RiskDistribution {
  low: number;
  medium: number;
  high: number;
}

export function ModelPerformancePage() {
  const [modelStats, setModelStats] = useState<{ [modelName: string]: ModelStats }>({});
  const [confidenceDistribution, setConfidenceDistribution] = useState<{ [modelName: string]: ConfidenceDistribution }>({});
  const [riskDistribution, setRiskDistribution] = useState<{ [modelName: string]: RiskDistribution }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const refreshData = async () => {
    setIsLoading(true);
    try {
      console.log('🔄 Refreshing model performance data...');
      
      const [newModelStats, newConfidenceDistribution, newRiskDistribution] = await Promise.all([
        getEvaluationStatsByModelFromAPI(),
        getConfidenceDistributionByModelFromAPI(),
        getRiskLevelDistributionByModelFromAPI()
      ]);
      
      setModelStats(newModelStats);
      setConfidenceDistribution(newConfidenceDistribution);
      setRiskDistribution(newRiskDistribution);
      setLastUpdate(new Date());
      
      console.log('✅ Model performance data refreshed');
    } catch (error) {
      console.error('❌ Error refreshing model performance data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const getAccuracyColor = (accuracyRate: number) => {
    if (accuracyRate >= 70) return 'text-green-400';
    if (accuracyRate >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getAccuracyBgColor = (accuracyRate: number) => {
    if (accuracyRate >= 70) return 'bg-green-400/10';
    if (accuracyRate >= 50) return 'bg-yellow-400/10';
    return 'bg-red-400/10';
  };

  const modelNames = Object.keys(modelStats);
  const hasData = modelNames.length > 0;

  // Calculate overall stats across all models
  const overallStats = modelNames.reduce((acc, modelName) => {
    const stats = modelStats[modelName];
    acc.total += stats.total;
    acc.accurate += stats.accurate;
    acc.inaccurate += stats.inaccurate;
    acc.pending += stats.pending;
    acc.expired += stats.expired;
    acc.noEntryHit += stats.noEntryHit;
    return acc;
  }, { total: 0, accurate: 0, inaccurate: 0, pending: 0, expired: 0, noEntryHit: 0 });

  const overallAccuracy = overallStats.accurate + overallStats.inaccurate > 0 
    ? (overallStats.accurate / (overallStats.accurate + overallStats.inaccurate)) * 100 
    : 0;

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg">
              <Cpu className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white">Model Performance Analysis</h1>
              <p className="text-sm text-gray-400">Compare accuracy across different Gemini models</p>
            </div>
          </div>
          
          <button 
            onClick={refreshData}
            disabled={isLoading}
            className="flex items-center space-x-2 px-3 sm:px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition-colors text-sm sm:text-base"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Overall Performance Summary */}
        {hasData && (
          <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700 mb-8">
            <div className="flex items-center space-x-2 mb-6">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              <h3 className="text-white font-semibold text-base sm:text-lg">Overall Performance Summary</h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
              <div className="bg-gray-900/50 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Target className="w-4 h-4 text-blue-400" />
                  <span className="text-gray-400 text-xs sm:text-sm">Total</span>
                </div>
                <p className="text-blue-400 font-bold text-lg sm:text-xl">{overallStats.total}</p>
              </div>

              <div className="bg-gray-900/50 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-gray-400 text-xs sm:text-sm">Accurate</span>
                </div>
                <p className="text-green-400 font-bold text-lg sm:text-xl">{overallStats.accurate}</p>
              </div>

              <div className="bg-gray-900/50 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <XCircle className="w-4 h-4 text-red-400" />
                  <span className="text-gray-400 text-xs sm:text-sm">Inaccurate</span>
                </div>
                <p className="text-red-400 font-bold text-lg sm:text-xl">{overallStats.inaccurate}</p>
              </div>

              <div className={`rounded-lg p-4 ${getAccuracyBgColor(overallAccuracy)}`}>
                <div className="flex items-center space-x-2 mb-2">
                  <TrendingUp className={`w-4 h-4 ${getAccuracyColor(overallAccuracy)}`} />
                  <span className="text-gray-400 text-xs sm:text-sm">Accuracy</span>
                </div>
                <p className={`font-bold text-lg sm:text-xl ${getAccuracyColor(overallAccuracy)}`}>
                  {overallAccuracy.toFixed(1)}%
                </p>
              </div>

              <div className="bg-gray-900/50 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Cpu className="w-4 h-4 text-purple-400" />
                  <span className="text-gray-400 text-xs sm:text-sm">Models</span>
                </div>
                <p className="text-purple-400 font-bold text-lg sm:text-xl">{modelNames.length}</p>
              </div>

              <div className="bg-gray-900/50 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Activity className="w-4 h-4 text-yellow-400" />
                  <span className="text-gray-400 text-xs sm:text-sm">Pending</span>
                </div>
                <p className="text-yellow-400 font-bold text-lg sm:text-xl">{overallStats.pending}</p>
              </div>
            </div>
          </div>
        )}

        {/* Model Comparison Cards */}
        {hasData ? (
          <div className="space-y-8">
            <div className="flex items-center space-x-2 mb-6">
              <Cpu className="w-5 h-5 text-green-400" />
              <h2 className="text-lg sm:text-xl font-semibold text-white">Model Performance Comparison</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {modelNames.map((modelName) => {
                const stats = modelStats[modelName];
                const confidence = confidenceDistribution[modelName] || {};
                const risk = riskDistribution[modelName] || {};

                return (
                  <div key={modelName} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    {/* Model Header */}
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                          <Cpu className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="text-white font-semibold text-lg">{modelName}</h3>
                          <p className="text-gray-400 text-sm">{stats.total} recommendations</p>
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full ${getAccuracyBgColor(stats.accuracyRate)}`}>
                        <span className={`font-bold ${getAccuracyColor(stats.accuracyRate)}`}>
                          {stats.accuracyRate.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Performance Metrics */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                        <CheckCircle className="w-5 h-5 text-green-400 mx-auto mb-1" />
                        <p className="text-green-400 font-bold text-lg">{stats.accurate}</p>
                        <p className="text-gray-400 text-xs">Accurate</p>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                        <XCircle className="w-5 h-5 text-red-400 mx-auto mb-1" />
                        <p className="text-red-400 font-bold text-lg">{stats.inaccurate}</p>
                        <p className="text-gray-400 text-xs">Inaccurate</p>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                        <Activity className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
                        <p className="text-yellow-400 font-bold text-lg">{stats.pending}</p>
                        <p className="text-gray-400 text-xs">Pending</p>
                      </div>
                    </div>

                    {/* Confidence Distribution */}
                    <div className="mb-6">
                      <h4 className="text-white font-medium mb-3 text-sm">Confidence Distribution</h4>
                      <div className="space-y-2">
                        {Object.entries(confidence).map(([range, count]) => {
                          const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
                          const maxCount = Math.max(...Object.values(confidence));
                          const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;
                          
                          return (
                            <div key={range} className="flex items-center space-x-3">
                              <div className="w-12 text-xs text-gray-400">{range}%</div>
                              <div className="flex-1 bg-gray-700 rounded-full h-2">
                                <div 
                                  className="bg-blue-400 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${barWidth}%` }}
                                ></div>
                              </div>
                              <div className="w-16 text-right text-xs">
                                <span className="text-blue-400 font-medium">{count}</span>
                                <span className="text-gray-400 ml-1">({percentage.toFixed(0)}%)</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Risk Distribution */}
                    <div>
                      <h4 className="text-white font-medium mb-3 text-sm">Risk Level Distribution</h4>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                          <div className="w-3 h-3 bg-green-400 rounded-full mx-auto mb-1"></div>
                          <p className="text-green-400 font-bold text-sm">{risk.low || 0}</p>
                          <p className="text-gray-400 text-xs">Low</p>
                        </div>
                        <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                          <div className="w-3 h-3 bg-yellow-400 rounded-full mx-auto mb-1"></div>
                          <p className="text-yellow-400 font-bold text-sm">{risk.medium || 0}</p>
                          <p className="text-gray-400 text-xs">Medium</p>
                        </div>
                        <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                          <div className="w-3 h-3 bg-red-400 rounded-full mx-auto mb-1"></div>
                          <p className="text-red-400 font-bold text-sm">{risk.high || 0}</p>
                          <p className="text-gray-400 text-xs">High</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Model Comparison Table */}
            {modelNames.length > 1 && (
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h2 className="text-lg sm:text-xl font-semibold text-white mb-6 flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5 text-green-400" />
                  <span>Model Comparison</span>
                </h2>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left text-gray-400 pb-3">Model</th>
                        <th className="text-center text-gray-400 pb-3">Total</th>
                        <th className="text-center text-gray-400 pb-3">Accurate</th>
                        <th className="text-center text-gray-400 pb-3">Inaccurate</th>
                        <th className="text-center text-gray-400 pb-3">Accuracy Rate</th>
                        <th className="text-center text-gray-400 pb-3">Avg Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modelNames.map((modelName) => {
                        const stats = modelStats[modelName];
                        const confidence = confidenceDistribution[modelName] || {};
                        
                        // Calculate average confidence
                        const totalConfidencePoints = Object.entries(confidence).reduce((sum, [range, count]) => {
                          const midpoint = range === '0-20' ? 10 : 
                                         range === '21-40' ? 30 :
                                         range === '41-60' ? 50 :
                                         range === '61-80' ? 70 : 90;
                          return sum + (midpoint * count);
                        }, 0);
                        const avgConfidence = stats.total > 0 ? totalConfidencePoints / stats.total : 0;
                        
                        return (
                          <tr key={modelName} className="border-b border-gray-700/50">
                            <td className="py-3 text-white font-medium">{modelName}</td>
                            <td className="py-3 text-center text-blue-400">{stats.total}</td>
                            <td className="py-3 text-center text-green-400">{stats.accurate}</td>
                            <td className="py-3 text-center text-red-400">{stats.inaccurate}</td>
                            <td className={`py-3 text-center font-bold ${getAccuracyColor(stats.accuracyRate)}`}>
                              {stats.accuracyRate.toFixed(1)}%
                            </td>
                            <td className="py-3 text-center text-gray-300">{avgConfidence.toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Best Performing Model Highlight */}
            {modelNames.length > 1 && (
              <div className="bg-gradient-to-r from-green-900/20 to-blue-900/20 rounded-lg p-6 border border-green-500/20">
                <div className="flex items-center space-x-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  <h3 className="text-white font-semibold">Best Performing Model</h3>
                </div>
                
                {(() => {
                  const bestModel = modelNames.reduce((best, current) => {
                    const currentStats = modelStats[current];
                    const bestStats = modelStats[best];
                    
                    // Only consider models with at least 3 evaluated recommendations
                    const currentEvaluated = currentStats.accurate + currentStats.inaccurate;
                    const bestEvaluated = bestStats.accurate + bestStats.inaccurate;
                    
                    if (currentEvaluated < 3) return best;
                    if (bestEvaluated < 3) return current;
                    
                    return currentStats.accuracyRate > bestStats.accuracyRate ? current : best;
                  });
                  
                  const bestStats = modelStats[bestModel];
                  const evaluatedCount = bestStats.accurate + bestStats.inaccurate;
                  
                  return (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <p className="text-green-400 font-bold text-lg">{bestModel}</p>
                        <p className="text-gray-300 text-sm">
                          {bestStats.accuracyRate.toFixed(1)}% accuracy rate ({bestStats.accurate}/{evaluatedCount} correct)
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-400 text-sm">Total Recommendations</p>
                        <p className="text-white font-bold">{bestStats.total}</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg p-8 border border-gray-700 text-center">
            {isLoading ? (
              <div className="text-gray-400">
                <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
                <p className="text-gray-300">Loading model performance data...</p>
                <p className="text-gray-500 text-sm mt-1">Analyzing recommendations by Gemini model</p>
              </div>
            ) : (
              <div className="text-gray-400">
                <Cpu className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                <p className="text-gray-300 font-medium mb-2">No Model Performance Data</p>
                <p className="text-gray-500 text-sm">
                  Generate recommendations using different Gemini models to see performance comparison
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  Configure different models in your .env.backend file and restart the bot
                </p>
              </div>
            )}
          </div>
        )}

        {/* Status Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Last updated: {lastUpdate.toLocaleTimeString()} • Model performance tracked per recommendation</p>
          <p className="mt-1">Switch models in .env.backend to compare performance across different Gemini variants</p>
        </div>
      </main>
    </div>
  );
}