import React from 'react';
import { TrendingUp, TrendingDown, Minus, Target, Shield, Clock, AlertTriangle } from 'lucide-react';
import { TradingRecommendation as TradingRecommendationType } from '../types/trading';

interface TradingRecommendationProps {
  recommendation: TradingRecommendationType;
}

export function TradingRecommendation({ recommendation }: TradingRecommendationProps) {
  const getActionIcon = () => {
    switch (recommendation.action) {
      case 'buy':
        return <TrendingUp className="w-5 h-5 text-green-400" />;
      case 'sell':
        return <TrendingDown className="w-5 h-5 text-red-400" />;
      default:
        return <Minus className="w-5 h-5 text-yellow-400" />;
    }
  };

  const getActionColor = () => {
    switch (recommendation.action) {
      case 'buy':
        return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'sell':
        return 'text-red-400 bg-red-400/10 border-red-400/20';
      default:
        return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
    }
  };

  const getRiskColor = () => {
    switch (recommendation.riskLevel) {
      case 'low':
        return 'text-green-400';
      case 'high':
        return 'text-red-400';
      default:
        return 'text-yellow-400';
    }
  };

  const getConfidenceColor = () => {
    if (recommendation.confidence >= 80) return 'text-green-400';
    if (recommendation.confidence >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-blue-500/50 transition-all duration-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center text-white font-bold">
            {recommendation.crypto}
          </div>
          <div>
            <h3 className="text-white font-semibold text-lg">{recommendation.crypto}</h3>
            <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full border text-sm font-medium ${getActionColor()}`}>
              {getActionIcon()}
              <span className="uppercase">{recommendation.action}</span>
            </div>
          </div>
        </div>
        
        <div className="text-right">
          <p className="text-gray-400 text-sm">Confidence</p>
          <p className={`text-lg font-bold ${getConfidenceColor()}`}>
            {recommendation.confidence}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-900/50 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <Target className="w-4 h-4 text-green-400" />
            <span className="text-gray-400 text-sm">Target</span>
          </div>
          <p className="text-green-400 font-semibold">
            ${recommendation.targetPrice.toLocaleString()}
          </p>
        </div>

        <div className="bg-gray-900/50 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <Shield className="w-4 h-4 text-red-400" />
            <span className="text-gray-400 text-sm">Stop Loss</span>
          </div>
          <p className="text-red-400 font-semibold">
            ${recommendation.stopLoss.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 text-sm">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="text-gray-400">Timeframe:</span>
          <span className="text-white">{recommendation.timeframe}</span>
        </div>
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-gray-400" />
          <span className="text-gray-400">Risk:</span>
          <span className={`capitalize font-medium ${getRiskColor()}`}>
            {recommendation.riskLevel}
          </span>
        </div>
      </div>

      <div>
        <h4 className="text-white font-medium mb-2">Analysis Summary</h4>
        <ul className="space-y-1">
          {recommendation.reasoning.map((reason, index) => (
            <li key={index} className="text-gray-300 text-sm flex items-start">
              <span className="text-blue-400 mr-2">•</span>
              {reason}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}