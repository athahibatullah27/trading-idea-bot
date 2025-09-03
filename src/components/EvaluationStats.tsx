import React from 'react';
import { BarChart3, Target, XCircle, Clock, Archive, TrendingUp, Ban } from 'lucide-react';

interface EvaluationStatsProps {
  stats: {
    total: number;
    pending: number;
    accurate: number;
    inaccurate: number;
    expired: number;
    noEntryHit: number;
    accuracyRate: number;
  };
}

export function EvaluationStats({ stats }: EvaluationStatsProps) {
  const getAccuracyColor = () => {
    if (stats.accuracyRate >= 70) return 'text-green-400';
    if (stats.accuracyRate >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getAccuracyBgColor = () => {
    if (stats.accuracyRate >= 70) return 'bg-green-400/10';
    if (stats.accuracyRate >= 50) return 'bg-yellow-400/10';
    return 'bg-red-400/10';
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <div className="flex items-center space-x-2 mb-6">
        <BarChart3 className="w-5 h-5 text-blue-400" />
        <h3 className="text-white font-semibold">Recommendation Performance</h3>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900/50 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Target className="w-4 h-4 text-green-400" />
            <span className="text-gray-400 text-sm">Accurate</span>
          </div>
          <p className="text-green-400 font-bold text-xl">{stats.accurate}</p>
        </div>

        <div className="bg-gray-900/50 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-gray-400 text-sm">Inaccurate</span>
          </div>
          <p className="text-red-400 font-bold text-xl">{stats.inaccurate}</p>
        </div>

        <div className="bg-gray-900/50 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Clock className="w-4 h-4 text-yellow-400" />
            <span className="text-gray-400 text-sm">Pending</span>
          </div>
          <p className="text-yellow-400 font-bold text-xl">{stats.pending}</p>
        </div>

        <div className="bg-gray-900/50 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Ban className="w-4 h-4 text-orange-400" />
            <span className="text-gray-400 text-sm">No Entry Hit</span>
          </div>
          <p className="text-orange-400 font-bold text-xl">{stats.noEntryHit}</p>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Archive className="w-4 h-4 text-gray-400" />
            <span className="text-gray-400 text-sm">Expired</span>
          </div>
          <p className="text-gray-400 font-bold text-xl">{stats.expired}</p>
        </div>

        <div className="bg-gray-900/50 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            <span className="text-gray-400 text-sm">Total</span>
          </div>
          <p className="text-blue-400 font-bold text-xl">{stats.total}</p>
        </div>

        <div className={`rounded-lg p-4 ${getAccuracyBgColor()}`}>
          <div className="flex items-center space-x-2 mb-2">
            <TrendingUp className={`w-4 h-4 ${getAccuracyColor()}`} />
            <span className="text-gray-400 text-sm">Accuracy Rate</span>
          </div>
          <p className={`font-bold text-xl ${getAccuracyColor()}`}>
            {stats.accuracyRate.toFixed(1)}%
          </p>
        </div>
      </div>

      {stats.total > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-400">
            <span>Performance Breakdown</span>
            <span>{stats.accurate + stats.inaccurate} evaluated</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div className="flex h-2 rounded-full overflow-hidden">
              {stats.accurate > 0 && (
                <div 
                  className="bg-green-400" 
                  style={{ width: `${(stats.accurate / stats.total) * 100}%` }}
                ></div>
              )}
              {stats.inaccurate > 0 && (
                <div 
                  className="bg-red-400" 
                  style={{ width: `${(stats.inaccurate / stats.total) * 100}%` }}
                ></div>
              )}
              {stats.pending > 0 && (
                <div 
                  className="bg-yellow-400" 
                  style={{ width: `${(stats.pending / stats.total) * 100}%` }}
                ></div>
              )}
              {stats.noEntryHit > 0 && (
                <div 
                  className="bg-orange-400" 
                  style={{ width: `${(stats.noEntryHit / stats.total) * 100}%` }}
                ></div>
              )}
              {stats.expired > 0 && (
                <div 
                  className="bg-gray-400" 
                  style={{ width: `${(stats.expired / stats.total) * 100}%` }}
                ></div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}