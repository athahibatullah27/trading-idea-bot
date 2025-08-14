import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { MarketOverview } from './components/MarketOverview';
import { CryptoCard } from './components/CryptoCard';
import { TradingRecommendation } from './components/TradingRecommendation';
import { NewsItem } from './components/NewsItem';
import { GeopoliticalFactors } from './components/GeopoliticalFactors';
import { ConnectionStatus } from './components/ConnectionStatus';
import { useRealTimeData } from './hooks/useRealTimeData';
import { RefreshCw, MessageCircle, Zap } from 'lucide-react';

function App() {
  const {
    cryptoData,
    news,
    recommendations,
    marketConditions,
    geopoliticalFactors,
    isLoading,
    isApiConnected,
    lastUpdate,
    refreshData,
    testConnection
  } = useRealTimeData();

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Quick Actions Bar */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Trading Dashboard</h2>
            <p className="text-gray-400">AI-powered crypto market analysis and recommendations</p>
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
            
            <button className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
              <MessageCircle className="w-4 h-4" />
              <span>Ask Bot</span>
            </button>
          </div>
        </div>

        {/* Market Overview */}
        <MarketOverview conditions={marketConditions} />

        {/* Connection Status */}
        <ConnectionStatus 
          isConnected={isApiConnected}
          isLoading={isLoading}
          lastUpdate={lastUpdate}
          onRefresh={refreshData}
          onTest={testConnection}
        />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Crypto Cards & News */}
          <div className="lg:col-span-2 space-y-8">
            {/* Top Cryptos */}
            <section>
              <div className="flex items-center space-x-2 mb-4">
                <Zap className="w-5 h-5 text-yellow-400" />
                <h3 className="text-xl font-semibold text-white">Market Analysis</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cryptoData.length > 0 ? cryptoData.map((crypto) => (
                  <CryptoCard key={crypto.symbol} crypto={crypto} />
                )) : (
                  <div className="col-span-2 bg-gray-800 rounded-lg p-8 border border-gray-700 text-center">
                    <div className="text-gray-400 mb-2">
                      <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
                    </div>
                    <p className="text-gray-300">Loading real-time crypto data...</p>
                    <p className="text-gray-500 text-sm mt-1">This may take a few moments</p>
                  </div>
                )}
              </div>
            </section>

            {/* Recent News */}
            <section>
              <h3 className="text-xl font-semibold text-white mb-4">Market News & Sentiment</h3>
              <div className="space-y-3">
                {news.map((news, index) => (
                  <NewsItem key={index} news={news} />
                ))}
              </div>
            </section>
          </div>

          {/* Right Column - Recommendations & Geopolitical */}
          <div className="space-y-8">
            {/* Trading Recommendations */}
            <section>
              <h3 className="text-xl font-semibold text-white mb-4">AI Recommendations</h3>
              <div className="space-y-4">
                {recommendations.length > 0 ? recommendations.map((recommendation, index) => (
                  <TradingRecommendation key={index} recommendation={recommendation} />
                )) : (
                  <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
                    {isLoading ? (
                      <div className="text-gray-400 mb-2">
                        <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
                        <p className="text-gray-300">Generating AI recommendations...</p>
                        <p className="text-gray-500 text-sm mt-1">Based on real-time market data</p>
                      </div>
                    ) : (
                      <div className="text-yellow-400 mb-2">
                        <div className="w-12 h-12 mx-auto mb-3 bg-yellow-400/10 rounded-full flex items-center justify-center">
                          <span className="text-2xl">⚠️</span>
                        </div>
                        <p className="text-white font-medium mb-2">AI Analysis Unavailable</p>
                        <p className="text-gray-300 text-sm mb-3">
                          Our AI trading analysis is currently unavailable. This could be due to:
                        </p>
                        <ul className="text-gray-400 text-sm text-left max-w-md mx-auto space-y-1">
                          <li>• High demand on AI services</li>
                          <li>• Temporary maintenance</li>
                          <li>• Market data connectivity issues</li>
                        </ul>
                        <p className="text-blue-400 text-sm mt-3">
                          Please try refreshing in a few minutes
                        </p>
                      </div>
                    )}
                    </div>
                )}
              </div>
            </section>

            {/* Geopolitical Factors */}
            <GeopoliticalFactors factors={geopoliticalFactors} />
          </div>
        </div>

        {/* Real-time Status */}
        <div className="mt-8">
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${isApiConnected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`}></div>
                <span className="text-white font-medium">
                  System Status: {isApiConnected ? 'Live Data Active' : 'Cached Data Mode'}
                </span>
                <span className="text-gray-400 text-sm">
                  Last update: {lastUpdate.toLocaleTimeString()}
                </span>
              </div>
              <div className="text-sm text-gray-400">
                {isApiConnected ? 'Real-time analysis running' : 'Limited functionality'}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;