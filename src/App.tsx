import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { MarketOverview } from './components/MarketOverview';
import { CryptoCard } from './components/CryptoCard';
import { TradingRecommendation } from './components/TradingRecommendation';
import { NewsItem } from './components/NewsItem';
import { GeopoliticalFactors } from './components/GeopoliticalFactors';
import { 
  mockCryptoData, 
  mockNews, 
  mockRecommendations, 
  mockMarketConditions,
  mockGeopoliticalFactors 
} from './data/mockData';
import { RefreshCw, MessageCircle, Zap } from 'lucide-react';

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const handleRefresh = () => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setLastUpdate(new Date());
    }, 2000);
  };

  useEffect(() => {
    // Auto-refresh every 5 minutes
    const interval = setInterval(() => {
      setLastUpdate(new Date());
    }, 300000);

    return () => clearInterval(interval);
  }, []);

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
              onClick={handleRefresh}
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
        <MarketOverview conditions={mockMarketConditions} />

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
                {mockCryptoData.map((crypto) => (
                  <CryptoCard key={crypto.symbol} crypto={crypto} />
                ))}
              </div>
            </section>

            {/* Recent News */}
            <section>
              <h3 className="text-xl font-semibold text-white mb-4">Market News & Sentiment</h3>
              <div className="space-y-3">
                {mockNews.map((news, index) => (
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
                {mockRecommendations.map((recommendation, index) => (
                  <TradingRecommendation key={index} recommendation={recommendation} />
                ))}
              </div>
            </section>

            {/* Geopolitical Factors */}
            <GeopoliticalFactors factors={mockGeopoliticalFactors} />
          </div>
        </div>

        {/* Bot Status Bar */}
        <div className="mt-8 bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-white font-medium">Bot Status: Active</span>
              <span className="text-gray-400 text-sm">
                Last analysis: {lastUpdate.toLocaleTimeString()}
              </span>
            </div>
            <div className="text-sm text-gray-400">
              Next update in: 4m 23s
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;