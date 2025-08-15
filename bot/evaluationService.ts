import { supabase } from './supabaseClient.js';
import { getRealTimeCryptoData } from './tradingview.js';
import { TradingRecommendation } from '../src/types/trading.js';

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
  try {
    console.log(`💾 Storing trade recommendation for ${recommendation.crypto}...`);
    
    const { data, error } = await supabase
      .from('trade_recommendations')
      .insert({
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
      });

    if (error) {
      console.error('❌ Error storing trade recommendation:', error.message);
      return false;
    }

    console.log(`✅ Successfully stored trade recommendation for ${recommendation.crypto}`);
    return true;
  } catch (error) {
    console.error('❌ Error storing trade recommendation:', error);
    return false;
  }
}

// Function to evaluate pending trade recommendations
export async function evaluatePendingRecommendations(): Promise<void> {
  try {
    console.log('🔍 Evaluating pending trade recommendations...');
    
    // Fetch all pending recommendations
    const { data: pendingRecommendations, error } = await supabase
      .from('trade_recommendations')
      .select('*')
      .eq('status', 'pending');

    if (error) {
      console.error('❌ Error fetching pending recommendations:', error.message);
      return;
    }

    if (!pendingRecommendations || pendingRecommendations.length === 0) {
      console.log('📝 No pending recommendations to evaluate');
      return;
    }

    console.log(`📊 Found ${pendingRecommendations.length} pending recommendations to evaluate`);

    // Evaluate each recommendation
    for (const recommendation of pendingRecommendations) {
      await evaluateSingleRecommendation(recommendation);
      
      // Add delay between evaluations to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('✅ Completed evaluation of all pending recommendations');
  } catch (error) {
    console.error('❌ Error during recommendation evaluation:', error);
  }
}

// Function to evaluate a single recommendation
async function evaluateSingleRecommendation(recommendation: any): Promise<void> {
  try {
    console.log(`🎯 Evaluating ${recommendation.symbol} ${recommendation.action} recommendation...`);
    
    // Get current price
    const currentData = await getRealTimeCryptoData(recommendation.symbol);
    if (!currentData || currentData.price <= 0) {
      console.log(`⚠️ Could not fetch current price for ${recommendation.symbol}, skipping evaluation`);
      return;
    }

    const currentPrice = currentData.price;
    const targetPrice = parseFloat(recommendation.target_price);
    const stopLoss = parseFloat(recommendation.stop_loss);
    const entryPrice = parseFloat(recommendation.entry_price || recommendation.target_price);

    console.log(`📊 ${recommendation.symbol}: Current $${currentPrice.toLocaleString()}, Target $${targetPrice.toLocaleString()}, Stop $${stopLoss.toLocaleString()}`);

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
      const { error: updateError } = await supabase
        .from('trade_recommendations')
        .update({
          status: newStatus,
          evaluation_timestamp: new Date().toISOString()
        })
        .eq('id', recommendation.id);

      if (updateError) {
        console.error(`❌ Error updating recommendation ${recommendation.id}:`, updateError.message);
      } else {
        console.log(`✅ ${recommendation.symbol} recommendation marked as ${newStatus}: ${evaluationReason}`);
      }
    } else {
      console.log(`⏳ ${recommendation.symbol} recommendation still pending evaluation`);
    }

  } catch (error) {
    console.error(`❌ Error evaluating recommendation for ${recommendation.symbol}:`, error);
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
  try {
    const { data, error } = await supabase
      .from('trade_recommendations')
      .select('status');

    if (error) {
      console.error('❌ Error fetching evaluation stats:', error.message);
      return { total: 0, pending: 0, accurate: 0, inaccurate: 0, expired: 0, accuracyRate: 0 };
    }

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

    return stats;
  } catch (error) {
    console.error('❌ Error calculating evaluation stats:', error);
    return { total: 0, pending: 0, accurate: 0, inaccurate: 0, expired: 0, accuracyRate: 0 };
  }
}