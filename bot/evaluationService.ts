import { supabase } from './supabaseClient.js';
import { fetchCandlestickData } from './derivativesDataService.js';
import { TradingRecommendation } from './types.js';
import { SignalAnalysisResult, SignalUsageStats, analyzeReasoningForSignals } from './utils/signalAnalysis.js';
import { 
  logDatabaseOperation, 
  logDatabaseError, 
  logFunctionEntry, 
  logFunctionExit, 
  startPerformanceTimer, 
  endPerformanceTimer,
  log
} from './utils/logger.js';

export interface StoredTradeRecommendation extends TradingRecommendation {
  id: string;
  entry_price?: number;
  status: 'pending' | 'accurate' | 'inaccurate' | 'expired' | 'no_entry_hit';
  evaluation_timestamp?: string;
  created_at: string;
}

// Function to store a trade recommendation in Supabase
export async function storeTradeRecommendation(
  recommendation: TradingRecommendation,
  entryPrice: number,
  geminiModelUsed: string
): Promise<boolean> {
  const timerId = startPerformanceTimer('storeTradeRecommendation');
  logFunctionEntry('storeTradeRecommendation', { 
    crypto: recommendation.crypto, 
    action: recommendation.action,
    entryPrice,
    geminiModelUsed
  });
  
  try {
    log('INFO', `Storing trade recommendation for ${recommendation.crypto} (model: ${geminiModelUsed})...`);
    
    // Set initial status to pending for new recommendations
    const initialStatus = 'pending';
    log('INFO', `${recommendation.crypto}: Setting initial status to 'pending'`);
    
    // Analyze reasoning for signal activation
    const signalAnalysis: SignalAnalysisResult = analyzeReasoningForSignals(recommendation.reasoning);
    
    log('INFO', `Signal analysis for ${recommendation.crypto}:`, {
      confluenceScore: signalAnalysis.confluence_score,
      activatedSignals: Object.entries(signalAnalysis)
        .filter(([key, value]) => key !== 'confluence_score' && value === true)
        .map(([key]) => key)
    });
    
    const insertData = {
      symbol: recommendation.crypto,
      action: recommendation.action,
      confidence: recommendation.confidence,
      target_price: recommendation.targetPrice,
      stop_loss: recommendation.stopLoss,
      reasoning: recommendation.reasoning,
      timeframe: recommendation.timeframe,
      risk_level: recommendation.riskLevel,
      entry_price: entryPrice,
      status: initialStatus,
      gemini_model_used: geminiModelUsed,
      // Add signal tracking columns
      signal_mt_trend_aligned: signalAnalysis.signal_mt_trend_aligned,
      signal_volume_confirmed: signalAnalysis.signal_volume_confirmed,
      signal_market_regime_consistent: signalAnalysis.signal_market_regime_consistent,
      signal_fibonacci_confluence: signalAnalysis.signal_fibonacci_confluence,
      signal_sr_reaction: signalAnalysis.signal_sr_reaction,
      signal_momentum_alignment: signalAnalysis.signal_momentum_alignment,
      signal_bollinger_position: signalAnalysis.signal_bollinger_position,
      signal_ema_alignment: signalAnalysis.signal_ema_alignment,
      signal_candlestick_patterns: signalAnalysis.signal_candlestick_patterns,
      confluence_score: signalAnalysis.confluence_score
    };
    
    logDatabaseOperation({
      operation: 'INSERT',
      table: 'trade_recommendations',
      params: insertData
    });
    
    const { data, error } = await supabase
      .from('trade_recommendations')
      .insert(insertData);

    if (error) {
      logDatabaseError('INSERT', 'trade_recommendations', error);
      logFunctionExit('storeTradeRecommendation', false);
      endPerformanceTimer(timerId);
      return false;
    }

    logDatabaseOperation({
      operation: 'INSERT',
      table: 'trade_recommendations',
      affectedRows: 1
    });
    
    log('INFO', `Successfully stored trade recommendation for ${recommendation.crypto} with initial status: ${initialStatus} (model: ${geminiModelUsed})`);
    logFunctionExit('storeTradeRecommendation', true);
    endPerformanceTimer(timerId);
    return true;
  } catch (error) {
    log('ERROR', 'Error storing trade recommendation', error);
    logFunctionExit('storeTradeRecommendation', false);
    endPerformanceTimer(timerId);
    return false;
  }
}

// Function to evaluate pending trade recommendations
export async function evaluatePendingRecommendations(): Promise<void> {
  const timerId = startPerformanceTimer('evaluatePendingRecommendations');
  logFunctionEntry('evaluatePendingRecommendations');
  
  try {
    log('INFO', 'Evaluating pending trade recommendations...');
    
    logDatabaseOperation({
      operation: 'SELECT',
      table: 'trade_recommendations',
      query: "SELECT * FROM trade_recommendations WHERE status = 'pending'"
    });
    
    // Fetch all pending recommendations
    const { data: pendingRecommendations, error } = await supabase
      .from('trade_recommendations')
      .select('*')
      .eq('status', 'pending');

    if (error) {
      logDatabaseError('SELECT', 'trade_recommendations', error);
      logFunctionExit('evaluatePendingRecommendations');
      endPerformanceTimer(timerId);
      return;
    }

    if (!pendingRecommendations || pendingRecommendations.length === 0) {
      log('INFO', 'No pending recommendations to evaluate');
      logFunctionExit('evaluatePendingRecommendations', { count: 0 });
      endPerformanceTimer(timerId);
      return;
    }

    logDatabaseOperation({
      operation: 'SELECT',
      table: 'trade_recommendations',
      resultCount: pendingRecommendations.length
    });
    
    log('INFO', `Found ${pendingRecommendations.length} pending recommendations to evaluate`);

    // Evaluate each recommendation
    for (const recommendation of pendingRecommendations) {
      await evaluateSingleRecommendation(recommendation);
      
      // Add delay between evaluations to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    log('INFO', 'Completed evaluation of all pending recommendations');
    logFunctionExit('evaluatePendingRecommendations', { count: pendingRecommendations.length });
    endPerformanceTimer(timerId);
  } catch (error) {
    log('ERROR', 'Error during recommendation evaluation', error);
    logFunctionExit('evaluatePendingRecommendations');
    endPerformanceTimer(timerId);
  }
}

// Function to evaluate a single recommendation
async function evaluateSingleRecommendation(recommendation: any): Promise<void> {
  const timerId = startPerformanceTimer('evaluateSingleRecommendation');
  logFunctionEntry('evaluateSingleRecommendation', { 
    symbol: recommendation.symbol, 
    action: recommendation.action 
  });
  
  try {
    log('INFO', `Evaluating ${recommendation.symbol} ${recommendation.action} recommendation...`);
    
    // Get latest 4-hour OHLCV candle
    const candlesticks = await fetchCandlestickData(recommendation.symbol, '4h', 1, 'evaluation');
    if (!candlesticks || candlesticks.length === 0) {
      log('WARN', `Could not fetch 4-hour candle data for ${recommendation.symbol}, skipping evaluation`);
      logFunctionExit('evaluateSingleRecommendation');
      endPerformanceTimer(timerId);
      return;
    }

    const latestCandle = candlesticks[0];
    const { open, high, low, close } = latestCandle;
    const targetPrice = parseFloat(recommendation.target_price);
    const stopLoss = parseFloat(recommendation.stop_loss);
    const entryPrice = parseFloat(recommendation.entry_price || recommendation.target_price);

    log('INFO', `${recommendation.symbol}: 4h Candle OHLC $${open.toFixed(2)}/$${high.toFixed(2)}/$${low.toFixed(2)}/$${close.toFixed(2)}, Entry $${entryPrice.toLocaleString()}, Target $${targetPrice.toLocaleString()}, Stop $${stopLoss.toLocaleString()}`);

    let newStatus: 'accurate' | 'inaccurate' | 'expired' | null = null;
    let currentEvaluationStatus = recommendation.status;
    let evaluationReason = '';

    // Check if recommendation has expired (older than 30 days)
    const createdAt = new Date(recommendation.created_at);
    const daysSinceCreated = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceCreated > 30) {
      newStatus = 'expired';
      evaluationReason = 'Recommendation expired after 30 days';
      log('INFO', `${recommendation.symbol} recommendation expired after ${daysSinceCreated.toFixed(1)} days`);
    } else {
      // Step 1: Handle 'no_entry_hit' status - check if entry condition is now met
      if (currentEvaluationStatus === 'no_entry_hit') {
        // Check if entry price is within the 4-hour candle range
        const entryInRange = entryPrice >= low && entryPrice <= high;
        
        if (!entryInRange) {
          // Entry price still not reached, status remains 'no_entry_hit'
          log('INFO', `${recommendation.symbol}: Entry still not hit - entry price $${entryPrice.toLocaleString()} not in 4h range $${low.toFixed(2)} - $${high.toFixed(2)}`);
          logFunctionExit('evaluateSingleRecommendation');
          endPerformanceTimer(timerId);
          return;
        } else {
          // Entry price is within range, transition to 'pending' and continue evaluation
          currentEvaluationStatus = 'pending';
          log('INFO', `${recommendation.symbol}: Entry price reached, transitioning from 'no_entry_hit' to 'pending'`);
        }
      }
      
      // Step 2: Handle 'pending' status - evaluate target/stop loss
      if (currentEvaluationStatus === 'pending') {
        let targetHit = false;
        let stopLossHit = false;
        
        switch (recommendation.action.toLowerCase()) {
          case 'buy':
            // For buy: target hit if high >= target, stop loss hit if low <= stop
            targetHit = high >= targetPrice;
            stopLossHit = low <= stopLoss;
            break;
            
          case 'sell':
            // For sell: target hit if low <= target, stop loss hit if high >= stop
            targetHit = low <= targetPrice;
            stopLossHit = high >= stopLoss;
            break;
            
          case 'hold':
            // For hold recommendations, use existing logic with current close price
            const priceChangePercent = ((close - entryPrice) / entryPrice) * 100;
            if (Math.abs(priceChangePercent) <= 10) {
              // Price stayed within 10% range - consider accurate for hold
              if (daysSinceCreated >= 7) { // Only evaluate hold after at least a week
                targetHit = true;
                evaluationReason = `Hold recommendation successful: price stayed within 10% range (${priceChangePercent.toFixed(2)}%)`;
              }
            } else if (low <= stopLoss) {
              stopLossHit = true;
            }
            break;
        }
        
        // Determine final status based on hits
        if (targetHit) {
          newStatus = 'accurate';
          if (!evaluationReason) {
            evaluationReason = recommendation.action === 'buy' 
              ? `Target hit: 4h high $${high.toFixed(2)} >= target $${targetPrice.toLocaleString()}`
              : `Target hit: 4h low $${low.toFixed(2)} <= target $${targetPrice.toLocaleString()}`;
          }
          log('INFO', `${recommendation.symbol}: Target achieved - ${evaluationReason}`);
        } else if (stopLossHit) {
          newStatus = 'inaccurate';
          evaluationReason = recommendation.action === 'buy'
            ? `Stop loss hit: 4h low $${low.toFixed(2)} <= stop $${stopLoss.toLocaleString()}`
            : `Stop loss hit: 4h high $${high.toFixed(2)} >= stop $${stopLoss.toLocaleString()}`;
          log('INFO', `${recommendation.symbol}: Stop loss triggered - ${evaluationReason}`);
        } else {
          // Neither target nor stop loss hit
          if (recommendation.status === 'no_entry_hit') {
            // Need to update status from 'no_entry_hit' to 'pending'
            newStatus = 'pending' as any;
            evaluationReason = `Entry confirmed at $${entryPrice.toLocaleString()}, awaiting target/stop loss`;
            log('INFO', `${recommendation.symbol}: Entry confirmed, now pending target/stop evaluation`);
          } else {
            // Already pending, no status change needed
            log('INFO', `${recommendation.symbol}: Still pending - neither target nor stop loss hit in this 4h candle`);
            logFunctionExit('evaluateSingleRecommendation');
            endPerformanceTimer(timerId);
            return;
          }
        }
      } else {
        // Status is already 'accurate', 'inaccurate', or 'expired', skip evaluation
        log('INFO', `${recommendation.symbol}: Skipping evaluation - status is already ${currentEvaluationStatus}`);
        logFunctionExit('evaluateSingleRecommendation');
        endPerformanceTimer(timerId);
        return;
      }
    }

    // Update recommendation status if evaluation criteria met
    if (newStatus) {
      const updateData = {
        status: newStatus,
        evaluation_timestamp: new Date().toISOString()
      };
      
      logDatabaseOperation({
        operation: 'UPDATE',
        table: 'trade_recommendations',
        params: updateData,
        query: `UPDATE trade_recommendations SET status = '${newStatus}', evaluation_timestamp = '${updateData.evaluation_timestamp}' WHERE id = '${recommendation.id}'`
      });
      
      const { error: updateError } = await supabase
        .from('trade_recommendations')
        .update(updateData)
        .eq('id', recommendation.id);

      if (updateError) {
        logDatabaseError('UPDATE', 'trade_recommendations', updateError);
      } else {
        logDatabaseOperation({
          operation: 'UPDATE',
          table: 'trade_recommendations',
          affectedRows: 1
        });
        log('INFO', `${recommendation.symbol} recommendation marked as ${newStatus}: ${evaluationReason}`);
      }
    }

    logFunctionExit('evaluateSingleRecommendation', { status: newStatus || 'pending' });
    endPerformanceTimer(timerId);
  } catch (error) {
    log('ERROR', `Error evaluating recommendation for ${recommendation.symbol}`, error);
    logFunctionExit('evaluateSingleRecommendation');
    endPerformanceTimer(timerId);
  }
}

// Function to get evaluation statistics
export async function getEvaluationStats(): Promise<{
  total: number;
  pending: number;
  accurate: number;
  inaccurate: number;
  expired: number;
  noEntryHit: number;
  accuracyRate: number;
}> {
  const timerId = startPerformanceTimer('getEvaluationStats');
  logFunctionEntry('getEvaluationStats');
  
  try {
    logDatabaseOperation({
      operation: 'SELECT',
      table: 'trade_recommendations',
      query: 'SELECT status FROM trade_recommendations'
    });
    
    const { data, error } = await supabase
      .from('trade_recommendations')
      .select('status');

    if (error) {
      logDatabaseError('SELECT', 'trade_recommendations', error);
      logFunctionExit('getEvaluationStats', { total: 0, pending: 0, accurate: 0, inaccurate: 0, expired: 0, noEntryHit: 0, accuracyRate: 0 });
      endPerformanceTimer(timerId);
      return { total: 0, pending: 0, accurate: 0, inaccurate: 0, expired: 0, noEntryHit: 0, accuracyRate: 0 };
    }

    logDatabaseOperation({
      operation: 'SELECT',
      table: 'trade_recommendations',
      resultCount: data.length
    });

    const stats = {
      total: data.length,
      pending: data.filter(r => r.status === 'pending').length,
      accurate: data.filter(r => r.status === 'accurate').length,
      inaccurate: data.filter(r => r.status === 'inaccurate').length,
      expired: data.filter(r => r.status === 'expired').length,
      noEntryHit: data.filter(r => r.status === 'no_entry_hit').length,
      accuracyRate: 0
    };

    const evaluated = stats.accurate + stats.inaccurate;
    if (evaluated > 0) {
      stats.accuracyRate = (stats.accurate / evaluated) * 100;
    }

    log('INFO', 'Evaluation stats calculated', stats);
    logFunctionExit('getEvaluationStats', stats);
    endPerformanceTimer(timerId);
    return stats;
  } catch (error) {
    log('ERROR', 'Error calculating evaluation stats', error);
    logFunctionExit('getEvaluationStats', { total: 0, pending: 0, accurate: 0, inaccurate: 0, expired: 0, noEntryHit: 0, accuracyRate: 0 });
    endPerformanceTimer(timerId);
    return { total: 0, pending: 0, accurate: 0, inaccurate: 0, expired: 0, noEntryHit: 0, accuracyRate: 0 };
  }
}

// Function to get evaluation statistics grouped by Gemini model
export async function getEvaluationStatsByModel(): Promise<{
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
  const timerId = startPerformanceTimer('getEvaluationStatsByModel');
  logFunctionEntry('getEvaluationStatsByModel');
  
  try {
    logDatabaseOperation({
      operation: 'SELECT',
      table: 'trade_recommendations',
      query: 'SELECT status, gemini_model_used FROM trade_recommendations'
    });
    
    const { data, error } = await supabase
      .from('trade_recommendations')
      .select('status, gemini_model_used');

    if (error) {
      logDatabaseError('SELECT', 'trade_recommendations', error);
      logFunctionExit('getEvaluationStatsByModel', {});
      endPerformanceTimer(timerId);
      return {};
    }

    logDatabaseOperation({
      operation: 'SELECT',
      table: 'trade_recommendations',
      resultCount: data.length
    });

    // Group data by model
    const modelStats: { [modelName: string]: any } = {};
    
    data.forEach(record => {
      const modelName = record.gemini_model_used || 'unknown';
      
      if (!modelStats[modelName]) {
        modelStats[modelName] = {
          total: 0,
          pending: 0,
          accurate: 0,
          inaccurate: 0,
          expired: 0,
          noEntryHit: 0,
          accuracyRate: 0
        };
      }
      
      modelStats[modelName].total++;
      
      switch (record.status) {
        case 'pending':
          modelStats[modelName].pending++;
          break;
        case 'accurate':
          modelStats[modelName].accurate++;
          break;
        case 'inaccurate':
          modelStats[modelName].inaccurate++;
          break;
        case 'expired':
          modelStats[modelName].expired++;
          break;
        case 'no_entry_hit':
          modelStats[modelName].noEntryHit++;
          break;
      }
    });

    // Calculate accuracy rates
    Object.keys(modelStats).forEach(modelName => {
      const stats = modelStats[modelName];
      const evaluated = stats.accurate + stats.inaccurate;
      if (evaluated > 0) {
        stats.accuracyRate = (stats.accurate / evaluated) * 100;
      }
    });

    log('INFO', 'Model evaluation stats calculated', {
      models: Object.keys(modelStats),
      totalRecords: data.length
    });
    
    logFunctionExit('getEvaluationStatsByModel', { modelCount: Object.keys(modelStats).length });
    endPerformanceTimer(timerId);
    return modelStats;
  } catch (error) {
    log('ERROR', 'Error calculating model evaluation stats', error);
    logFunctionExit('getEvaluationStatsByModel', {});
    endPerformanceTimer(timerId);
    return {};
  }
}

// Function to get confidence distribution by model
export async function getConfidenceDistributionByModel(): Promise<{
  [modelName: string]: {
    '0-20': number;
    '21-40': number;
    '41-60': number;
    '61-80': number;
    '81-100': number;
  }
}> {
  const timerId = startPerformanceTimer('getConfidenceDistributionByModel');
  logFunctionEntry('getConfidenceDistributionByModel');
  
  try {
    logDatabaseOperation({
      operation: 'SELECT',
      table: 'trade_recommendations',
      query: 'SELECT confidence, gemini_model_used FROM trade_recommendations'
    });
    
    const { data, error } = await supabase
      .from('trade_recommendations')
      .select('confidence, gemini_model_used');

    if (error) {
      logDatabaseError('SELECT', 'trade_recommendations', error);
      logFunctionExit('getConfidenceDistributionByModel', {});
      endPerformanceTimer(timerId);
      return {};
    }

    logDatabaseOperation({
      operation: 'SELECT',
      table: 'trade_recommendations',
      resultCount: data.length
    });

    // Group confidence scores by model
    const modelDistribution: { [modelName: string]: any } = {};
    
    data.forEach(record => {
      const modelName = record.gemini_model_used || 'unknown';
      const confidence = record.confidence;
      
      if (!modelDistribution[modelName]) {
        modelDistribution[modelName] = {
          '0-20': 0,
          '21-40': 0,
          '41-60': 0,
          '61-80': 0,
          '81-100': 0
        };
      }
      
      if (confidence <= 20) modelDistribution[modelName]['0-20']++;
      else if (confidence <= 40) modelDistribution[modelName]['21-40']++;
      else if (confidence <= 60) modelDistribution[modelName]['41-60']++;
      else if (confidence <= 80) modelDistribution[modelName]['61-80']++;
      else modelDistribution[modelName]['81-100']++;
    });

    log('INFO', 'Confidence distribution by model calculated', {
      models: Object.keys(modelDistribution),
      totalRecords: data.length
    });
    
    logFunctionExit('getConfidenceDistributionByModel', { modelCount: Object.keys(modelDistribution).length });
    endPerformanceTimer(timerId);
    return modelDistribution;
  } catch (error) {
    log('ERROR', 'Error calculating confidence distribution by model', error);
    logFunctionExit('getConfidenceDistributionByModel', {});
    endPerformanceTimer(timerId);
    return {};
  }
}

// Function to get risk level distribution by model
export async function getRiskLevelDistributionByModel(): Promise<{
  [modelName: string]: {
    low: number;
    medium: number;
    high: number;
  }
}> {
  const timerId = startPerformanceTimer('getRiskLevelDistributionByModel');
  logFunctionEntry('getRiskLevelDistributionByModel');
  
  try {
    logDatabaseOperation({
      operation: 'SELECT',
      table: 'trade_recommendations',
      query: 'SELECT risk_level, gemini_model_used FROM trade_recommendations'
    });
    
    const { data, error } = await supabase
      .from('trade_recommendations')
      .select('risk_level, gemini_model_used');

    if (error) {
      logDatabaseError('SELECT', 'trade_recommendations', error);
      logFunctionExit('getRiskLevelDistributionByModel', {});
      endPerformanceTimer(timerId);
      return {};
    }

    logDatabaseOperation({
      operation: 'SELECT',
      table: 'trade_recommendations',
      resultCount: data.length
    });

    // Group risk levels by model
    const modelDistribution: { [modelName: string]: any } = {};
    
    data.forEach(record => {
      const modelName = record.gemini_model_used || 'unknown';
      const riskLevel = record.risk_level;
      
      if (!modelDistribution[modelName]) {
        modelDistribution[modelName] = {
          low: 0,
          medium: 0,
          high: 0
        };
      }
      
      modelDistribution[modelName][riskLevel]++;
    });

    log('INFO', 'Risk level distribution by model calculated', {
      models: Object.keys(modelDistribution),
      totalRecords: data.length
    });
    
    logFunctionExit('getRiskLevelDistributionByModel', { modelCount: Object.keys(modelDistribution).length });
    endPerformanceTimer(timerId);
    return modelDistribution;
  } catch (error) {
    log('ERROR', 'Error calculating risk level distribution by model', error);
    logFunctionExit('getRiskLevelDistributionByModel', {});
    endPerformanceTimer(timerId);
    return {};
  }
}

// Function to get signal usage statistics
export async function getSignalUsageStats(): Promise<SignalUsageStats> {
  const timerId = startPerformanceTimer('getSignalUsageStats');
  logFunctionEntry('getSignalUsageStats');
  
  try {
    logDatabaseOperation({
      operation: 'SELECT',
      table: 'trade_recommendations',
      query: 'SELECT signal columns and confluence_score FROM trade_recommendations'
    });
    
    const { data, error } = await supabase
      .from('trade_recommendations')
      .select(`
        signal_mt_trend_aligned,
        signal_volume_confirmed,
        signal_market_regime_consistent,
        signal_fibonacci_confluence,
        signal_sr_reaction,
        signal_momentum_alignment,
        signal_bollinger_position,
        signal_ema_alignment,
        signal_candlestick_patterns,
        confluence_score
      `);

    if (error) {
      logDatabaseError('SELECT', 'trade_recommendations', error);
      logFunctionExit('getSignalUsageStats', null);
      endPerformanceTimer(timerId);
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

    logDatabaseOperation({
      operation: 'SELECT',
      table: 'trade_recommendations',
      resultCount: data.length
    });

    // Count signal usage
    const stats: SignalUsageStats = {
      multiTimeframeTrendAlignment: data.filter(r => r.signal_mt_trend_aligned).length,
      volumeConfirmation: data.filter(r => r.signal_volume_confirmed).length,
      marketRegimeConsistency: data.filter(r => r.signal_market_regime_consistent).length,
      fibonacciConfluence: data.filter(r => r.signal_fibonacci_confluence).length,
      supportResistanceReaction: data.filter(r => r.signal_sr_reaction).length,
      momentumAlignment: data.filter(r => r.signal_momentum_alignment).length,
      bollingerBandPosition: data.filter(r => r.signal_bollinger_position).length,
      emaAlignment: data.filter(r => r.signal_ema_alignment).length,
      candlestickPatterns: data.filter(r => r.signal_candlestick_patterns).length,
      totalRecommendations: data.length,
      averageConfluenceScore: data.length > 0 
        ? data.reduce((sum, r) => sum + (r.confluence_score || 0), 0) / data.length 
        : 0
    };

    log('INFO', 'Signal usage stats calculated', stats);
    logFunctionExit('getSignalUsageStats', stats);
    endPerformanceTimer(timerId);
    return stats;
  } catch (error) {
    log('ERROR', 'Error calculating signal usage stats', error);
    logFunctionExit('getSignalUsageStats', null);
    endPerformanceTimer(timerId);
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