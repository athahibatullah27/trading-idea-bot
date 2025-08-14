import React from 'react';
import { TrendingUp, TrendingDown, Minus, ExternalLink } from 'lucide-react';
import { NewsItem as NewsItemType } from '../types/trading';

interface NewsItemProps {
  news: NewsItemType;
}

export function NewsItem({ news }: NewsItemProps) {
  const getSentimentIcon = () => {
    switch (news.sentiment) {
      case 'bullish':
        return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'bearish':
        return <TrendingDown className="w-4 h-4 text-red-400" />;
      default:
        return <Minus className="w-4 h-4 text-yellow-400" />;
    }
  };

  const getSentimentColor = () => {
    switch (news.sentiment) {
      case 'bullish':
        return 'text-green-400 bg-green-400/10';
      case 'bearish':
        return 'text-red-400 bg-red-400/10';
      default:
        return 'text-yellow-400 bg-yellow-400/10';
    }
  };

  const getImpactColor = () => {
    switch (news.impact) {
      case 'high':
        return 'text-red-400';
      case 'medium':
        return 'text-yellow-400';
      default:
        return 'text-green-400';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-blue-500/50 transition-all duration-200">
      <div className="flex items-start space-x-3">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${getSentimentColor()}`}>
          {getSentimentIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="text-white font-medium text-sm leading-5 mb-2 line-clamp-2">
            {news.title}
          </h4>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 text-xs text-gray-400">
              <span>{news.source}</span>
              <span>•</span>
              <span>{news.timestamp}</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className={`text-xs font-medium capitalize ${getImpactColor()}`}>
                {news.impact} impact
              </span>
              <ExternalLink className="w-3 h-3 text-gray-500 hover:text-white cursor-pointer transition-colors" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}