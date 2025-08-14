import React from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface ConnectionStatusProps {
  isConnected: boolean;
  isLoading: boolean;
  lastUpdate: Date;
  onRefresh: () => void;
  onTest: () => Promise<boolean>;
}

export function ConnectionStatus({ 
  isConnected, 
  isLoading, 
  lastUpdate, 
  onRefresh, 
  onTest 
}: ConnectionStatusProps) {
  const [testing, setTesting] = React.useState(false);

  const handleTest = async () => {
    setTesting(true);
    try {
      await onTest();
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <Wifi className="w-4 h-4 text-green-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-400" />
            )}
            <span className="text-white font-medium">
              API Status: {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <span className="text-gray-400 text-sm">
            Last update: {lastUpdate.toLocaleTimeString()}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={handleTest}
            disabled={testing}
            className="flex items-center space-x-1 px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded text-sm transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${testing ? 'animate-spin' : ''}`} />
            <span>Test</span>
          </button>
          
          <button 
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center space-x-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>
      
      {!isConnected && (
        <div className="mt-2 text-sm text-yellow-400">
          ⚠️ Using cached data. Real-time features may be limited.
        </div>
      )}
    </div>
  );
}