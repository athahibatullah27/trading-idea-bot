import { supabase } from './supabaseClient.js';
import { getRealTimeCryptoData } from './tradingview.js';
import { TradingRecommendation } from './types.js';
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
  status: 'pending' | 'accurate' | 'inaccurate' | 'expired';
  evaluation_timestamp?: string;
  created_at: string;
}

// Function to store a trade recommendation in Supabase
export async function storeTradeRecommendation(
  recommendation: TradingRecommendation,
  entryPrice: number
): Promise<boolean> {
  const timerId = startPerformanceTimer('storeTradeRecommendation');
  logFunctionEntry('storeTradeRecommendation', { 
    crypto: recommendation.crypto, 
    action: recommendation.action,
    entryPrice 
  });
  
  try {
    log('INFO', `Storing trade recommendation for ${recommendation.crypto}...`);
    
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
      status: 'pending'
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
    
    log('INFO', `Successfully stored trade recommendation for ${recommendation.crypto}`);
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
    
    // Get current price
    const currentData = await getRealTimeCryptoData(recommendation.symbol);
    if (!currentData || currentData.price <= 0) {
      log('WARN', `Could not fetch current price for ${recommendation.symbol}, skipping evaluation`);
      logFunctionExit('evaluateSingleRecommendation');
      endPerformanceTimer(timerId);
      return;
    }

    const currentPrice = currentData.price;
    const targetPrice = parseFloat(recommendation.target_price);
    const stopLoss = parseFloat(recommendation.stop_loss);
    const entryPrice = parseFloat(recommendation.entry_price || recommendation.target_price);

    log('INFO', `${recommendation.symbol}: Current $${currentPrice.toLocaleString()}, Target $${targetPrice.toLocaleString()}, Stop $${stopLoss.toLocaleString()}`);

    let newStatus: 'accurate' | 'inaccurate' | 'expired' | null = null;
    let evaluationReason = '';

    // Check if recommendation has expired (older than 30 days)
    const createdAt = new Date(recommendation.created_at);
    const daysSinceCreated = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceCreated > 30) {
      newStatus = 'expired';
      evaluationReason = 'Recommendation expired after 30 days';
    } else {
      // Evaluate based on action type
      switch (recommendation.action.toLowerCase()) {
        case 'buy':
          if (currentPrice >= targetPrice) {
            newStatus = 'accurate';
            evaluationReason = `Target price reached: $${currentPrice.toLocaleString()} >= $${targetPrice.toLocaleString()}`;
          } else if (currentPrice <= stopLoss) {
            newStatus = 'inaccurate';
            evaluationReason = `Stop loss hit: $${currentPrice.toLocaleString()} <= $${stopLoss.toLocaleString()}`;
          }
          break;

        case 'sell':
          if (currentPrice <= targetPrice) {
            newStatus = 'accurate';
            evaluationReason = `Target price reached: $${currentPrice.toLocaleString()} <= $${targetPrice.toLocaleString()}`;
          } else if (currentPrice >= stopLoss) {
            newStatus = 'inaccurate';
            evaluationReason = `Stop loss hit: $${currentPrice.toLocaleString()} >= $${stopLoss.toLocaleString()}`;
          }
          break;

        case 'hold':
          // For hold recommendations, we'll consider them accurate if price stays within a reasonable range
          const priceChangePercent = ((currentPrice - entryPrice) / entryPrice) * 100;
          if (Math.abs(priceChangePercent) <= 10) {
            // Price stayed within 10% range - consider accurate for hold
            if (daysSinceCreated >= 7) { // Only evaluate hold after at least a week
              newStatus = 'accurate';
              evaluationReason = `Hold recommendation successful: price stayed within 10% range (${priceChangePercent.toFixed(2)}%)`;
            }
          } else if (currentPrice <= stopLoss) {
            newStatus = 'inaccurate';
            evaluationReason = `Stop loss hit: $${currentPrice.toLocaleString()} <= $${stopLoss.toLocaleString()}`;
          }
          break;
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
    } else {
      log('INFO', `${recommendation.symbol} recommendation still pending evaluation`);
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
      logFunctionExit('getEvaluationStats', { total: 0, pending: 0, accurate: 0, inaccurate: 0, expired: 0, accuracyRate: 0 });
      endPerformanceTimer(timerId);
      return { total: 0, pending: 0, accurate: 0, inaccurate: 0, expired: 0, accuracyRate: 0 };
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
    logFunctionExit('getEvaluationStats', { total: 0, pending: 0, accurate: 0, inaccurate: 0, expired: 0, accuracyRate: 0 });
    endPerformanceTimer(timerId);
    return { total: 0, pending: 0, accurate: 0, inaccurate: 0, expired: 0, accuracyRate: 0 };
  }
}