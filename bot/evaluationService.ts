import { supabase } from './supabaseClient.js';
import { fetchCandlestickData } from './derivativesDataService.js';
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
  status: 'pending' | 'accurate' | 'inaccurate' | 'expired' | 'no_entry_hit';
  evaluation_timestamp?: string;
  created_at: string;
}

// Function to store a trade recommendation in Supabase
export async function storeTradeRecommendation(
  recommendation: TradingRecommendation,
  entryPrice: number,
  currentPrice: number
): Promise<boolean> {
  const timerId = startPerformanceTimer('storeTradeRecommendation');
  logFunctionEntry('storeTradeRecommendation', { 
    crypto: recommendation.crypto, 
    action: recommendation.action,
    entryPrice,
    currentPrice
  });
  
  try {
    log('INFO', `Storing trade recommendation for ${recommendation.crypto}...`);
    
    // Determine initial status based on entry price vs current price
    let initialStatus: 'pending' | 'no_entry_hit';
    if (Math.abs(entryPrice - currentPrice) < 0.01) { // Allow small floating point differences
      initialStatus = 'pending';
      log('INFO', `${recommendation.crypto}: Entry price ${entryPrice} matches current price ${currentPrice}, setting status to 'pending'`);
    } else {
      initialStatus = 'no_entry_hit';
      log('INFO', `${recommendation.crypto}: Entry price ${entryPrice} differs from current price ${currentPrice}, setting status to 'no_entry_hit'`);
    }
    
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
      status: initialStatus
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
    
    log('INFO', `Successfully stored trade recommendation for ${recommendation.crypto} with initial status: ${initialStatus}`);
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