import React from 'react';
import { Globe, AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { GeopoliticalFactor } from '../types/trading';

interface GeopoliticalFactorsProps {
  factors: GeopoliticalFactor[];
}

export function GeopoliticalFactors({ factors }: GeopoliticalFactorsProps) {
  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'positive':
        return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'negative':
        return <TrendingDown className="w-4 h-4 text-red-400" />;
      default:
        return <Minus className="w-4 h-4 text-yellow-400" />;
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'positive':
        return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'negative':
        return 'text-red-400 bg-red-400/10 border-red-400/20';
      default:
        return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
    }
  };

  const getSeverityColor = (severity: number) => {
    if (severity >= 8) return 'text-red-400';
    if (severity >= 5) return 'text-yellow-400';
    return 'text-green-400';
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <div className="flex items-center space-x-2 mb-4">
        <Globe className="w-5 h-5 text-blue-400" />
        <h3 className="text-white font-semibold">Geopolitical Factors</h3>
      </div>

      <div className="space-y-4">
        {factors.map((factor, index) => (
          <div key={index} className="bg-gray-900/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-white font-medium">{factor.event}</h4>
              <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full border text-xs ${getImpactColor(factor.impact)}`}>
                {getImpactIcon(factor.impact)}
                <span className="capitalize">{factor.impact}</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Severity Level</span>
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-gray-400" />
                <span className={`font-semibold ${getSeverityColor(factor.severity)}`}>
                  {factor.severity}/10
                </span>
              </div>
            </div>
            
            <div>
              <span className="text-gray-400 text-sm">Affected Regions: </span>
              <span className="text-gray-300 text-sm">
                {factor.affectedRegions.join(', ')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}