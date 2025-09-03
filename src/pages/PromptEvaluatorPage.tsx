import React, { useState, useEffect } from 'react';
import { getSignalUsageStatsFromAPI, SignalUsageStats } from '../services/tradingService';
import { RefreshCw, BarChart3, Target, TrendingUp, Activity, Layers } from 'lucide-react';

export function PromptEvaluatorPage() {
  const [signalStats, setSignalStats] = useState<SignalUsageStats>({
    multiTimeframeTrendAlignment: 0,
    volumeConfirmation: 0,
    marketRegimeConsistency: 0,
    fibonacciConfluence: 0,
    supportResistanceReaction: 0,
    momentumAlignment: 0,
    bollingerBandPosition: 0,
    emaAlignment: 0,
    candlestickPatterns: 0,
    totalRecommendations: 0,
    averageConfluenceScore: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const refreshData = async () => {
    setIsLoading(true);
    try {
      console.log('🔄 Refreshing signal usage statistics...');
      const newStats = await getSignalUsageStatsFromAPI();
      setSignalStats(newStats);
      setLastUpdate(new Date());
      console.log('✅ Signal usage statistics refreshed');
    } catch (error) {
      console.error('❌ Error refreshing signal usage data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Signal definitions with their categories and point values
  const signalDefinitions = [
    // Primary Signals (25 points each)
    {
      category: 'Primary',
      points: 25,
      color: 'text-green-400',
      bgColor: 'bg-green-400/10',
      borderColor: 'border-green-400/20',
      signals: [
        { key: 'multiTimeframeTrendAlignment', name: 'Multi-Timeframe Trend Alignment', description: 'Daily, 4h, and 1h trends aligned in same direction' },
        { key: 'volumeConfirmation', name: 'Volume Confirmation', description: 'Above-average volume supporting price direction' },
        { key: 'marketRegimeConsistency', name: 'Market Regime Consistency', description: 'All timeframes show consistent market regime' }
      ]
    },
    // Secondary Signals (15 points each)
    {
      category: 'Secondary',
      points: 15,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-400/10',
      borderColor: 'border-yellow-400/20',
      signals: [
        { key: 'fibonacciConfluence', name: 'Fibonacci Confluence', description: 'Price at key Fibonacci retracement levels' },
        { key: 'supportResistanceReaction', name: 'Support/Resistance Reaction', description: 'Price respecting key S/R levels' },
        { key: 'momentumAlignment', name: 'Momentum Alignment', description: 'RSI and MACD trends supporting direction' }
      ]
    },
    // Tertiary Signals (10 points each)
    {
      category: 'Tertiary',
      points: 10,
      color: 'text-blue-400',
      bgColor: 'bg-blue-400/10',
      borderColor: 'border-blue-400/20',
      signals: [
        { key: 'bollingerBandPosition', name: 'Bollinger Band Position', description: 'Price position relative to BB bands' },
        { key: 'emaAlignment', name: 'EMA Alignment', description: 'Price position relative to EMAs' },
        { key: 'candlestickPatterns', name: 'Candlestick Patterns', description: 'Reversal/continuation patterns at key levels' }
      ]
    }
  ];

  // Calculate usage percentages
  const getUsagePercentage = (count: number) => {
    if (signalStats.totalRecommendations === 0) return 0;
    return (count / signalStats.totalRecommendations) * 100;
  };

  // Get the maximum count for scaling the visual bars
  const maxCount = Math.max(
    signalStats.multiTimeframeTrendAlignment,
    signalStats.volumeConfirmation,
    signalStats.marketRegimeConsistency,
    signalStats.fibonacciConfluence,
    signalStats.supportResistanceReaction,
    signalStats.momentumAlignment,
    signalStats.bollingerBandPosition,
    signalStats.emaAlignment,
    signalStats.candlestickPatterns
  );

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Prompt Quality Evaluator</h1>
              <p className="text-sm text-gray-400">FinCoT-TA Signal Usage Analysis</p>
            </div>
          </div>
          
          <button 
            onClick={refreshData}
            disabled={isLoading}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center space-x-2 mb-2">
              <Target className="w-5 h-5 text-blue-400" />
              <span className="text-gray-400">Total Recommendations</span>
            </div>
            <p className="text-2xl font-bold text-white">{signalStats.totalRecommendations}</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <span className="text-gray-400">Avg Confluence Score</span>
            </div>
            <p className="text-2xl font-bold text-white">{signalStats.averageConfluenceScore.toFixed(1)}</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center space-x-2 mb-2">
              <Activity className="w-5 h-5 text-purple-400" />
              <span className="text-gray-400">Most Used Signal</span>
            </div>
            <p className="text-lg font-bold text-white">
              {maxCount > 0 ? 
                Object.entries(signalStats)
                  .filter(([key]) => key !== 'totalRecommendations' && key !== 'averageConfluenceScore')
                  .reduce((max, [key, value]) => value > signalStats[max as keyof SignalUsageStats] ? key : max, 'multiTimeframeTrendAlignment')
                  .replace(/([A-Z])/g, ' $1')
                  .replace(/^./, str => str.toUpperCase())
                : 'None'
              }
            </p>
          </div>
        </div>

        {/* Signal Categories */}
        <div className="space-y-8">
          {signalDefinitions.map((category) => (
            <div key={category.category} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center space-x-3 mb-6">
                <Layers className={`w-5 h-5 ${category.color}`} />
                <h2 className="text-xl font-semibold text-white">
                  {category.category} Signals
                </h2>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${category.bgColor} ${category.color} border ${category.borderColor}`}>
                  {category.points} points each
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {category.signals.map((signal) => {
                  const count = signalStats[signal.key as keyof SignalUsageStats] as number;
                  const percentage = getUsagePercentage(count);
                  const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;

                  return (
                    <div key={signal.key} className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-white font-medium text-sm">{signal.name}</h3>
                        <div className="text-right">
                          <span className={`text-lg font-bold ${category.color}`}>{count}</span>
                          <span className="text-gray-400 text-xs ml-1">
                            ({percentage.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                      
                      <p className="text-gray-400 text-xs mb-3">{signal.description}</p>
                      
                      {/* Usage bar */}
                      <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${category.color.replace('text-', 'bg-')}`}
                          style={{ width: `${barWidth}%` }}
                        ></div>
                      </div>
                      
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Usage Frequency</span>
                        <span>{count}/{signalStats.totalRecommendations}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Signal Usage Summary Chart */}
        {signalStats.totalRecommendations > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mt-8">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              <span>Signal Usage Overview</span>
            </h2>
            
            <div className="space-y-3">
              {signalDefinitions.flatMap(category => 
                category.signals.map(signal => {
                  const count = signalStats[signal.key as keyof SignalUsageStats] as number;
                  const percentage = getUsagePercentage(count);
                  const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;
                  
                  return (
                    <div key={signal.key} className="flex items-center space-x-4">
                      <div className="w-48 text-right">
                        <span className="text-white text-sm font-medium">{signal.name}</span>
                        <span className={`ml-2 px-2 py-1 rounded text-xs ${category.bgColor} ${category.color}`}>
                          {category.points}pt
                        </span>
                      </div>
                      
                      <div className="flex-1 flex items-center space-x-3">
                        <div className="flex-1 bg-gray-700 rounded-full h-3">
                          <div 
                            className={`h-3 rounded-full transition-all duration-500 ${category.color.replace('text-', 'bg-')}`}
                            style={{ width: `${barWidth}%` }}
                          ></div>
                        </div>
                        
                        <div className="w-20 text-right">
                          <span className={`text-sm font-bold ${category.color}`}>{count}</span>
                          <span className="text-gray-400 text-xs ml-1">({percentage.toFixed(1)}%)</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Insights and Recommendations */}
        {signalStats.totalRecommendations > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mt-8">
            <h2 className="text-xl font-semibold text-white mb-4">Prompt Quality Insights</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-white font-medium mb-3">Most Frequently Used Signals</h3>
                <div className="space-y-2">
                  {Object.entries(signalStats)
                    .filter(([key]) => key !== 'totalRecommendations' && key !== 'averageConfluenceScore')
                    .sort(([,a], [,b]) => (b as number) - (a as number))
                    .slice(0, 3)
                    .map(([key, count]) => (
                      <div key={key} className="flex justify-between items-center text-sm">
                        <span className="text-gray-300">
                          {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </span>
                        <span className="text-green-400 font-medium">{count} times</span>
                      </div>
                    ))}
                </div>
              </div>
              
              <div>
                <h3 className="text-white font-medium mb-3">Least Used Signals</h3>
                <div className="space-y-2">
                  {Object.entries(signalStats)
                    .filter(([key]) => key !== 'totalRecommendations' && key !== 'averageConfluenceScore')
                    .sort(([,a], [,b]) => (a as number) - (b as number))
                    .slice(0, 3)
                    .map(([key, count]) => (
                      <div key={key} className="flex justify-between items-center text-sm">
                        <span className="text-gray-300">
                          {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </span>
                        <span className="text-red-400 font-medium">{count} times</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Status Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Last updated: {lastUpdate.toLocaleTimeString()} • Signal tracking across all trade recommendations</p>
          <p className="mt-1">Use this data to optimize prompt engineering and signal relevance</p>
        </div>
      </main>
    </div>
  );
}