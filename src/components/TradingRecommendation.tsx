import React from 'react';
import { TrendingUp, TrendingDown, Minus, Target, Shield, Clock, AlertTriangle, CheckCircle, XCircle, Timer, Archive, Ban, Info } from 'lucide-react';
import { TradingRecommendation as TradingRecommendationType } from '../types/trading';

interface TradingRecommendationProps {
  recommendation: TradingRecommendationType;
}

// Signal keywords mapping - matches the bot's signal analysis
const SIGNAL_HIGHLIGHT_KEYWORDS = {
  signal_mt_trend_aligned: [
    'multi-timeframe trend alignment',
    'multi-timeframe alignment',
    'timeframe alignment',
    'aligned trends',
    'higher timeframe confirmation',
    'trend alignment across timeframes',
    'all timeframes align',
    'timeframes support',
    'multi-tf alignment',
    'cross-timeframe trend'
  ],
  signal_volume_confirmed: [
    'volume confirms',
    'volume confirmation',
    'above-average volume',
    'volume supporting',
    'volume analysis shows',
    'strong volume',
    'volume trend',
    'institutional volume',
    'volume validates',
    'volume backing'
  ],
  signal_market_regime_consistent: [
    'market regime consistency',
    'consistent market regime',
    'regime alignment',
    'market regime shows',
    'regime analysis',
    'trending regime',
    'ranging regime',
    'regime classification',
    'market structure',
    'regime confirms'
  ],
  signal_fibonacci_confluence: [
    'fibonacci confluence',
    'fib levels',
    'fibonacci retracement',
    'fibonacci extension',
    'fib support',
    'fib resistance',
    'key fibonacci',
    'fibonacci zone',
    'fib cluster',
    'fibonacci analysis'
  ],
  signal_sr_reaction: [
    'support/resistance',
    'support and resistance',
    's/r levels',
    'key levels',
    'price respecting',
    'resistance level',
    'support level',
    'key support',
    'key resistance',
    'horizontal levels'
  ],
  signal_momentum_alignment: [
    'momentum alignment',
    'rsi and macd trends',
    'momentum indicators',
    'momentum confirms',
    'rsi trend',
    'macd trend',
    'momentum analysis',
    'oscillator alignment',
    'momentum supporting',
    'momentum divergence'
  ],
  signal_bollinger_position: [
    'bollinger band position',
    'bollinger bands',
    'bb bands',
    'price relative to bb',
    'bollinger analysis',
    'band position',
    'bb upper',
    'bb lower',
    'bb middle',
    'band squeeze'
  ],
  signal_ema_alignment: [
    'ema alignment',
    'ema crossover',
    'price relative to emas',
    'ema analysis',
    'moving average',
    'ema support',
    'ema resistance',
    'ema trend',
    'exponential moving average',
    'ma alignment'
  ],
  signal_candlestick_patterns: [
    'candlestick patterns',
    'reversal patterns',
    'continuation patterns',
    'candle analysis',
    'price action',
    'candlestick formation',
    'pattern recognition',
    'candle pattern',
    'price pattern',
    'chart pattern'
  ]
};

export function TradingRecommendation({ recommendation }: TradingRecommendationProps) {
  // Function to check if a reasoning point should be highlighted based on activated signals
  const isReasonActivated = (reasonText: string): boolean => {
    const lowerReasonText = reasonText.toLowerCase();
    
    // Check each signal type
    for (const [signalKey, keywords] of Object.entries(SIGNAL_HIGHLIGHT_KEYWORDS)) {
      // Check if this signal is activated in the recommendation
      const signalActivated = (recommendation as any)[signalKey] === true;
      
      if (signalActivated) {
        // Check if any keywords for this signal appear in the reasoning text
        const keywordFound = keywords.some(keyword => lowerReasonText.includes(keyword));
        if (keywordFound) {
          return true;
        }
      }
    }
    
    return false;
  };

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

  const getStatusIcon = () => {
    switch (recommendation.status) {
      case 'accurate':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'inaccurate':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'expired':
        return <Archive className="w-5 h-5 text-gray-400" />;
      case 'no_entry_hit':
        return <Ban className="w-5 h-5 text-orange-400" />;
      default:
        return <Timer className="w-5 h-5 text-yellow-400" />;
    }
  };

  const getStatusColor = () => {
    switch (recommendation.status) {
      case 'accurate':
        return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'inaccurate':
        return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'expired':
        return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
      case 'no_entry_hit':
        return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      default:
        return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
    }
  };

  const getStatusText = () => {
    switch (recommendation.status) {
      case 'accurate':
        return 'Target Hit';
      case 'inaccurate':
        return 'Stop Loss Hit';
      case 'expired':
        return 'Expired';
      case 'no_entry_hit':
        return 'No Entry Hit';
      default:
        return 'Pending';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={`bg-gray-800 rounded-lg p-4 sm:p-6 border transition-all duration-200 relative ${
      recommendation.status === 'accurate' ? 'border-green-500/50 hover:border-green-500' :
      recommendation.status === 'inaccurate' ? 'border-red-500/50 hover:border-red-500' :
      recommendation.status === 'expired' ? 'border-gray-500/50 hover:border-gray-500' :
      recommendation.status === 'no_entry_hit' ? 'border-orange-500/50 hover:border-orange-500' :
      'border-gray-700 hover:border-blue-500/50'
    }`}>
      {/* Model Info Icon - Always visible in top-right corner */}
      <div className="absolute top-3 right-3 group z-10">
        <div className="w-6 h-6 bg-blue-600 hover:bg-blue-500 rounded-full flex items-center justify-center cursor-help transition-colors shadow-lg">
          <Info className="w-3 h-3 text-white" />
        </div>
        {/* Tooltip */}
        <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap border border-gray-600 z-50">
          <div className="text-gray-300 text-xs">Model:</div>
          <div className="font-medium text-white">
            {(() => {
              const modelName = recommendation.geminiModelUsed || (recommendation as any).gemini_model_used;
              
              if (!modelName || modelName === null || modelName === undefined) {
                return 'Missing from API';
              }
              return modelName;
            })()}
          </div>
          {/* Tooltip arrow */}
          <div className="absolute top-full right-3 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-600"></div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center text-white font-bold text-xs sm:text-sm flex-shrink-0">
            {recommendation.crypto}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-white font-semibold text-base sm:text-lg truncate">{recommendation.crypto}</h3>
            <div className="flex items-center space-x-1 sm:space-x-2 flex-wrap gap-1">
              <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full border text-xs sm:text-sm font-medium ${getActionColor()}`}>
                {getActionIcon()}
                <span className="uppercase">{recommendation.action}</span>
              </div>
              <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full border text-xs font-medium ${getStatusColor()}`}>
                {getStatusIcon()}
                <span className="hidden sm:inline">{getStatusText()}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="text-right flex-shrink-0">
          <p className="text-gray-400 text-sm">Confidence</p>
          <p className={`text-base sm:text-lg font-bold ${getConfidenceColor()}`}>
            {recommendation.confidence}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
        <div className="bg-gray-900/50 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <Target className="w-4 h-4 text-green-400" />
            <span className="text-gray-400 text-sm">Target</span>
          </div>
          <p className="text-green-400 font-semibold text-sm sm:text-base">
            ${recommendation.targetPrice.toFixed(6)}
          </p>
        </div>

        <div className="bg-gray-900/50 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <Shield className="w-4 h-4 text-red-400" />
            <span className="text-gray-400 text-sm">Stop Loss</span>
          </div>
          <p className="text-red-400 font-semibold text-sm sm:text-base">
            ${recommendation.stopLoss.toFixed(6)}
          </p>
        </div>
      </div>

      {recommendation.entryPrice && (
        <div className="bg-gray-900/50 rounded-lg p-3 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-gray-400 text-sm">Entry Price</span>
              <p className="text-white font-semibold text-sm sm:text-base">${recommendation.entryPrice.toFixed(6)}</p>
            </div>
            <div className="text-right">
              <span className="text-gray-400 text-sm">Created</span>
              <p className="text-gray-300 text-sm">{formatDate(recommendation.createdAt)}</p>
            </div>
          </div>
          {recommendation.evaluationTimestamp && (
            <div className="mt-2 pt-2 border-t border-gray-700">
              <span className="text-gray-400 text-xs">Evaluated: {formatDate(recommendation.evaluationTimestamp)}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-4 text-sm">
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
        <ul className="space-y-1 sm:space-y-2">
          {recommendation.reasoning.map((reason, index) => (
            <li key={index} className={`text-xs sm:text-sm flex items-start leading-relaxed ${
              isReasonActivated(reason) ? 'text-green-400' : 'text-gray-300'
            }`}>
              <span className="text-blue-400 mr-2">•</span>
              {reason}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}