import { 
  logFunctionEntry, 
  logFunctionExit, 
  log 
} from './logger.js';

// Interface for signal analysis results
export interface SignalAnalysisResult {
  // Primary Signals (25 points each)
  signal_mt_trend_aligned: boolean;
  signal_volume_confirmed: boolean;
  signal_market_regime_consistent: boolean;
  
  // Secondary Signals (15 points each)
  signal_fibonacci_confluence: boolean;
  signal_sr_reaction: boolean;
  signal_momentum_alignment: boolean;
  
  // Tertiary Signals (10 points each)
  signal_bollinger_position: boolean;
  signal_ema_alignment: boolean;
  signal_candlestick_patterns: boolean;
  
  // Calculated confluence score
  confluence_score: number;
}

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

// Keywords for each signal component
const SIGNAL_KEYWORDS = {
  // Primary Signals (25 points each)
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
  
  // Secondary Signals (15 points each)
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
  
  // Tertiary Signals (10 points each)
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

// Signal point values
const SIGNAL_POINTS = {
  // Primary Signals
  signal_mt_trend_aligned: 25,
  signal_volume_confirmed: 25,
  signal_market_regime_consistent: 25,
  
  // Secondary Signals
  signal_fibonacci_confluence: 15,
  signal_sr_reaction: 15,
  signal_momentum_alignment: 15,
  
  // Tertiary Signals
  signal_bollinger_position: 10,
  signal_ema_alignment: 10,
  signal_candlestick_patterns: 10
};

/**
 * Analyzes the reasoning array from a trade recommendation to identify activated signals
 * @param reasoning Array of reasoning strings from the trade recommendation
 * @returns SignalAnalysisResult with boolean flags for each signal and calculated confluence score
 */
export function analyzeReasoningForSignals(reasoning: string[]): SignalAnalysisResult {
  logFunctionEntry('analyzeReasoningForSignals', { reasoningCount: reasoning.length });
  
  try {
    // Join all reasoning strings into a single text for analysis
    const fullReasoningText = reasoning.join(' ').toLowerCase();
    
    log('INFO', 'Analyzing reasoning for signal activation', {
      textLength: fullReasoningText.length,
      reasoningItems: reasoning.length
    });
    
    // Initialize result object
    const result: SignalAnalysisResult = {
      signal_mt_trend_aligned: false,
      signal_volume_confirmed: false,
      signal_market_regime_consistent: false,
      signal_fibonacci_confluence: false,
      signal_sr_reaction: false,
      signal_momentum_alignment: false,
      signal_bollinger_position: false,
      signal_ema_alignment: false,
      signal_candlestick_patterns: false,
      confluence_score: 0
    };
    
    // Check each signal for keyword matches
    for (const [signalKey, keywords] of Object.entries(SIGNAL_KEYWORDS)) {
      const signalFound = keywords.some(keyword => fullReasoningText.includes(keyword));
      
      if (signalFound) {
        result[signalKey as keyof SignalAnalysisResult] = true;
        result.confluence_score += SIGNAL_POINTS[signalKey as keyof typeof SIGNAL_POINTS];
        
        log('INFO', `Signal activated: ${signalKey} (+${SIGNAL_POINTS[signalKey as keyof typeof SIGNAL_POINTS]} points)`);
      }
    }
    
    log('INFO', 'Signal analysis completed', {
      activatedSignals: Object.entries(result).filter(([key, value]) => key !== 'confluence_score' && value === true).length,
      confluenceScore: result.confluence_score
    });
    
    logFunctionExit('analyzeReasoningForSignals', { 
      confluenceScore: result.confluence_score,
      activatedCount: Object.values(result).filter((v, i) => i < 9 && v === true).length
    });
    
    return result;
    
  } catch (error) {
    log('ERROR', 'Error analyzing reasoning for signals', error.message);
    logFunctionExit('analyzeReasoningForSignals', null);
    
    // Return default result on error
    return {
      signal_mt_trend_aligned: false,
      signal_volume_confirmed: false,
      signal_market_regime_consistent: false,
      signal_fibonacci_confluence: false,
      signal_sr_reaction: false,
      signal_momentum_alignment: false,
      signal_bollinger_position: false,
      signal_ema_alignment: false,
      signal_candlestick_patterns: false,
      confluence_score: 0
    };
  }
}

/**
 * Parses activated signals from Gemini's JSON response
 * @param activatedSignals Array of signal names from Gemini response
 * @returns SignalAnalysisResult with boolean flags and calculated confluence score
 */
export function parseActivatedSignalsFromGemini(activatedSignals: string[]): SignalAnalysisResult {
  logFunctionEntry('parseActivatedSignalsFromGemini', { signalCount: activatedSignals.length });
  
  try {
    const result: SignalAnalysisResult = {
      signal_mt_trend_aligned: false,
      signal_volume_confirmed: false,
      signal_market_regime_consistent: false,
      signal_fibonacci_confluence: false,
      signal_sr_reaction: false,
      signal_momentum_alignment: false,
      signal_bollinger_position: false,
      signal_ema_alignment: false,
      signal_candlestick_patterns: false,
      confluence_score: 0
    };
    
    // Map Gemini signal names to our database column names
    const signalMapping: { [key: string]: keyof SignalAnalysisResult } = {
      'multi_timeframe_trend_alignment': 'signal_mt_trend_aligned',
      'volume_confirmation': 'signal_volume_confirmed',
      'market_regime_consistency': 'signal_market_regime_consistent',
      'fibonacci_confluence': 'signal_fibonacci_confluence',
      'support_resistance_reaction': 'signal_sr_reaction',
      'momentum_alignment': 'signal_momentum_alignment',
      'bollinger_band_position': 'signal_bollinger_position',
      'ema_alignment': 'signal_ema_alignment',
      'candlestick_patterns': 'signal_candlestick_patterns'
    };
    
    // Process each activated signal
    for (const signalName of activatedSignals) {
      const normalizedSignalName = signalName.toLowerCase().replace(/[^a-z_]/g, '_');
      const dbColumnName = signalMapping[normalizedSignalName];
      
      if (dbColumnName && dbColumnName !== 'confluence_score') {
        result[dbColumnName] = true;
        result.confluence_score += SIGNAL_POINTS[dbColumnName as keyof typeof SIGNAL_POINTS];
        
        log('INFO', `Gemini signal activated: ${signalName} -> ${dbColumnName} (+${SIGNAL_POINTS[dbColumnName as keyof typeof SIGNAL_POINTS]} points)`);
      } else {
        log('WARN', `Unknown signal from Gemini: ${signalName}`);
      }
    }
    
    log('INFO', 'Gemini signal parsing completed', {
      activatedSignals: activatedSignals.length,
      confluenceScore: result.confluence_score
    });
    
    logFunctionExit('parseActivatedSignalsFromGemini', { 
      confluenceScore: result.confluence_score,
      activatedCount: Object.values(result).filter((v, i) => i < 9 && v === true).length
    });
    
    return result;
    
  } catch (error) {
    log('ERROR', 'Error parsing activated signals from Gemini', error.message);
    logFunctionExit('parseActivatedSignalsFromGemini', null);
    
    // Return default result on error
    return {
      signal_mt_trend_aligned: false,
      signal_volume_confirmed: false,
      signal_market_regime_consistent: false,
      signal_fibonacci_confluence: false,
      signal_sr_reaction: false,
      signal_momentum_alignment: false,
      signal_bollinger_position: false,
      signal_ema_alignment: false,
      signal_candlestick_patterns: false,
      confluence_score: 0
    };
  }
}