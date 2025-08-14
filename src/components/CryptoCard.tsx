import React from 'react';
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { CryptoData } from '../types/trading';

interface CryptoCardProps {
  crypto: CryptoData;
}

export function CryptoCard({ crypto }: CryptoCardProps) {
  const isPositive = crypto.change24h > 0;
  
  const getRSIColor = (rsi: number) => {
    if (rsi >= 70) return 'text-red-400';
    if (rsi <= 30) return 'text-green-400';
    return 'text-yellow-400';
  };

  const getRSILabel = (rsi: number) => {
    if (rsi >= 70) return 'Overbought';
    if (rsi <= 30) return 'Oversold';
    return 'Neutral';
  };

  return (
    <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 hover:border-blue-500/50 transition-all duration-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-yellow-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
            {crypto.symbol}
          </div>
          <div>
            <h3 className="text-white font-semibold">{crypto.name}</h3>
            <p className="text-gray-400 text-sm">{crypto.symbol}</p>
          </div>
        </div>
        <BarChart3 className="w-5 h-5 text-gray-400" />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm">Price</span>
          <span className="text-white font-semibold">
            ${crypto.price.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm">24h Change</span>
          <div className="flex items-center space-x-1">
            {isPositive ? (
              <TrendingUp className="w-4 h-4 text-green-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-400" />
            )}
            <span className={`font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {crypto.change24h > 0 ? '+' : ''}{crypto.change24h.toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm">RSI (14)</span>
          <div className="text-right">
            <span className={`font-medium ${getRSIColor(crypto.rsi)}`}>
              {crypto.rsi.toFixed(1)}
            </span>
            <p className={`text-xs ${getRSIColor(crypto.rsi)}`}>
              {getRSILabel(crypto.rsi)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-sm">Volume (24h)</span>
          <span className="text-white font-medium">
            ${(crypto.volume / 1e9).toFixed(1)}B
          </span>
        </div>

        <div className="pt-2 border-t border-gray-700">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">MACD</span>
            <span className={crypto.macd > 0 ? 'text-green-400' : 'text-red-400'}>
              {crypto.macd > 0 ? '+' : ''}{crypto.macd.toFixed(1)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}