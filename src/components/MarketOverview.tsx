import React from 'react';
import { TrendingUp, TrendingDown, Activity, AlertTriangle } from 'lucide-react';
import { MarketConditions } from '../types/trading';

interface MarketOverviewProps {
  conditions: MarketConditions;
}

export function MarketOverview({ conditions }: MarketOverviewProps) {
  const getMarketIcon = () => {
    switch (conditions.overall) {
      case 'bullish':
        return <TrendingUp className="w-5 h-5 text-green-400" />;
      case 'bearish':
        return <TrendingDown className="w-5 h-5 text-red-400" />;
      default:
        return <Activity className="w-5 h-5 text-yellow-400" />;
    }
  };

  const getMarketColor = () => {
    switch (conditions.overall) {
      case 'bullish':
        return 'text-green-400';
      case 'bearish':
        return 'text-red-400';
      default:
        return 'text-yellow-400';
    }
  };

  const getVolatilityColor = () => {
    switch (conditions.volatility) {
      case 'low':
        return 'text-green-400';
      case 'high':
        return 'text-red-400';
      default:
        return 'text-yellow-400';
    }
  };

  const getFearGreedColor = () => {
    if (conditions.fearGreedIndex >= 70) return 'text-red-400';
    if (conditions.fearGreedIndex >= 30) return 'text-yellow-400';
    return 'text-green-400';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-sm">Market Sentiment</span>
          {getMarketIcon()}
        </div>
        <p className={`text-lg font-semibold capitalize ${getMarketColor()}`}>
          {conditions.overall}
        </p>
      </div>

      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-sm">Volatility</span>
          <AlertTriangle className="w-5 h-5 text-gray-400" />
        </div>
        <p className={`text-lg font-semibold capitalize ${getVolatilityColor()}`}>
          {conditions.volatility}
        </p>
      </div>

      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-sm">Fear & Greed Index</span>
          <span className="text-xs text-gray-500">0-100</span>
        </div>
        <p className={`text-lg font-semibold ${getFearGreedColor()}`}>
          {conditions.fearGreedIndex}
        </p>
      </div>

      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-sm">BTC Dominance</span>
          <span className="text-xs text-gray-500">Market Share</span>
        </div>
        <p className="text-lg font-semibold text-white">
          {conditions.dominance.btc}%
        </p>
      </div>
    </div>
  );
}