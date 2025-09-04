import { TradingRecommendation } from '../types/trading';

// API proxy base URL - use environment variable with production default
const API_PROXY_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

console.log('🌐 Frontend: Using API base URL:', API_PROXY_BASE);

// Interface for signal usage statistics
export interface SignalUsageStats {
  // Primary Signals
  multiTimeframeTrendAlignment: number;
  volumeConfirmation: number;
  marketRegimeConsistency: number;
  
  // Secondary Signals
  fibonacciConfluence: number;
  supportResistanceReaction: number;
  momentumAlignment: number;
  
  // Tertiary Signals
  bollingerBandPosition: number;
  emaAlignment: number;
  candlestickPatterns: number;
  
  // Metadata
  totalRecommendations: number;
  averageConfluenceScore: number;
}

// Core functions for trade recommendation evaluation system

// Function to get evaluated recommendations from API
export async function getEvaluatedRecommendationsFromAPI(): Promise<TradingRecommendation[]> {
  try {
    console.log('📊 Frontend: Requesting evaluated recommendations via proxy...');
    console.log(`🌐 Frontend: Connecting to ${API_PROXY_BASE}/evaluated-recommendations`);
    
    // For self-signed certificates, we need to handle the request differently
    const response = await fetch(`${API_PROXY_BASE}/evaluated-recommendations`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(15000), // 15 second timeout
      mode: 'cors', // Enable CORS
      credentials: 'omit' // Don't send credentials
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.log(`❌ Frontend: Evaluated recommendations API returned ${response.status} ${response.statusText}`);
      throw new Error(errorData.error || `HTTP ${response.status} ${response.statusText}`);
    }
    
    const rawRecommendations = await response.json();
    
    // Transform the data to match our frontend interface
    const recommendations = rawRecommendations.map((rec: any) => ({
      ...rec,
      geminiModelUsed: rec.gemini_model_used || rec.geminiModelUsed || null // Convert snake_case to camelCase
    }));
    
    console.log(`✅ Frontend: Successfully received ${recommendations.length} evaluated recommendations`);
    
    // Debug: Check if gemini_model_used is in the API response
    console.log(`🔍 Frontend: API Response Debug:`, {
      firstRecordKeys: Object.keys(rawRecommendations[0] || {}),
      hasGeminiModelUsed: 'gemini_model_used' in (rawRecommendations[0] || {}),
      firstThreeModelValues: rawRecommendations.slice(0, 3).map((r: any) => ({
        id: r.id?.substring(0, 8),
        gemini_model_used: r.gemini_model_used,
        symbol: r.symbol
      }))
    });
    
    // Check if the backend is missing the gemini_model_used field
    if (rawRecommendations.length > 0 && !('gemini_model_used' in rawRecommendations[0])) {
      console.warn('⚠️ Frontend: Backend API is not returning gemini_model_used field!');
      console.warn('🔧 Frontend: Check that the backend SELECT query includes gemini_model_used column');
    }
    
    console.log(`📊 Frontend: Recommendation statuses:`, {
      pending: recommendations.filter((r: TradingRecommendation) => r.status === 'pending').length,
      accurate: recommendations.filter((r: TradingRecommendation) => r.status === 'accurate').length,
      inaccurate: recommendations.filter((r: TradingRecommendation) => r.status === 'inaccurate').length,
      expired: recommendations.filter((r: TradingRecommendation) => r.status === 'expired').length
    });
    
    return recommendations;

  } catch (error) {
    console.error('❌ Frontend: Error fetching evaluated recommendations via proxy:', (error as Error).message);
    console.error('🔍 Frontend: Evaluated recommendations error details:', {
      errorType: (error as Error).constructor.name,
      message: (error as Error).message,
      proxyUrl: `${API_PROXY_BASE}/evaluated-recommendations`
    });
    
    // Return empty array - the UI will handle showing error state
    return [];
  }
}

// Function to get evaluation statistics from API
export async function getEvaluationStatsFromAPI(): Promise<{
  total: number;
  pending: number;
  accurate: number;
  inaccurate: number;
  expired: number;
  noEntryHit: number;
  accuracyRate: number;
}> {
  try {
    console.log('📈 Frontend: Requesting evaluation statistics via proxy...');
    
    const response = await fetch(`${API_PROXY_BASE}/evaluation-stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
      mode: 'cors', // Enable CORS
      credentials: 'omit' // Don't send credentials
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    
    const stats = await response.json();
    console.log(`✅ Frontend: Successfully received evaluation statistics:`, stats);
    
    return stats;

  } catch (error) {
    console.error('❌ Frontend: Error fetching evaluation statistics:', (error as Error).message);
    return { total: 0, pending: 0, accurate: 0, inaccurate: 0, expired: 0, noEntryHit: 0, accuracyRate: 0 };
  }
}

// Function to get evaluation statistics grouped by model from API
export async function getEvaluationStatsByModelFromAPI(): Promise<{
  [modelName: string]: {
    total: number;
    pending: number;
    accurate: number;
    inaccurate: number;
    expired: number;
    noEntryHit: number;
    accuracyRate: number;
  }
}> {
  try {
    console.log('📈 Frontend: Requesting evaluation statistics by model via proxy...');
    
    const response = await fetch(`${API_PROXY_BASE}/evaluation-stats-by-model`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
      mode: 'cors', // Enable CORS
      credentials: 'omit' // Don't send credentials
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    
    const stats = await response.json();
    console.log(`✅ Frontend: Successfully received evaluation statistics by model:`, stats);
    
    return stats;

  } catch (error) {
    console.error('❌ Frontend: Error fetching evaluation statistics by model:', (error as Error).message);
    return {};
  }
}

// Function to get confidence distribution by model from API
export async function getConfidenceDistributionByModelFromAPI(): Promise<{
  [modelName: string]: {
    '0-20': number;
    '21-40': number;
    '41-60': number;
    '61-80': number;
    '81-100': number;
  }
}> {
  try {
    console.log('📊 Frontend: Requesting confidence distribution by model via proxy...');
    
    const response = await fetch(`${API_PROXY_BASE}/confidence-distribution-by-model`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
      mode: 'cors', // Enable CORS
      credentials: 'omit' // Don't send credentials
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    
    const distribution = await response.json();
    console.log(`✅ Frontend: Successfully received confidence distribution by model:`, distribution);
    
    return distribution;

  } catch (error) {
    console.error('❌ Frontend: Error fetching confidence distribution by model:', (error as Error).message);
    return {};
  }
}

// Function to get risk level distribution by model from API
export async function getRiskLevelDistributionByModelFromAPI(): Promise<{
  [modelName: string]: {
    low: number;
    medium: number;
    high: number;
  }
}> {
  try {
    console.log('📊 Frontend: Requesting risk level distribution by model via proxy...');
    
    const response = await fetch(`${API_PROXY_BASE}/risk-distribution-by-model`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
      mode: 'cors', // Enable CORS
      credentials: 'omit' // Don't send credentials
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    
    const distribution = await response.json();
    console.log(`✅ Frontend: Successfully received risk level distribution by model:`, distribution);
    
    return distribution;

  } catch (error) {
    console.error('❌ Frontend: Error fetching risk level distribution by model:', (error as Error).message);
    return {};
  }
}

// Function to get signal usage statistics from API
export async function getSignalUsageStatsFromAPI(): Promise<SignalUsageStats> {
  try {
    console.log('📊 Frontend: Requesting signal usage statistics via proxy...');
    
    const response = await fetch(`${API_PROXY_BASE}/signal-usage`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
      mode: 'cors', // Enable CORS
      credentials: 'omit' // Don't send credentials
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    
    const stats = await response.json();
    console.log(`✅ Frontend: Successfully received signal usage statistics:`, stats);
    
    return stats;

  } catch (error) {
    console.error('❌ Frontend: Error fetching signal usage statistics:', (error as Error).message);
    return {
      multiTimeframeTrendAlignment: 0,
      volumeConfirmation: 0,
      marketRegimeConsistency: 0,
      fibonacciConfluence: 0,
      supportResistanceReaction: 0,
      momentumAlignment: 0,
      bollingerBandPosition: 0,
      emaAlignment: 0,
      candlestickPatterns: 0,
      totalRecommendations: 0,
      averageConfluenceScore: 0
    };
  }
}