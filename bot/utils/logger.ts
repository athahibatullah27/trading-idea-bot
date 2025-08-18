// Comprehensive logging utility for the crypto trading bot

export interface ApiCallDetails {
  endpoint: string;
  method: string;
  headers?: Record<string, any>;
  body?: any;
  params?: Record<string, any>;
}

export interface ApiResponseDetails {
  status: number;
  statusText?: string;
  data?: any;
  headers?: Record<string, any>;
  error?: any;
}

export interface DatabaseOperation {
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT';
  table: string;
  query?: string;
  params?: any;
  resultCount?: number;
  affectedRows?: number;
}

export interface PerformanceMetric {
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

// Format timestamp as DD:MM:YY HH:MM:SS
export function formatTimestamp(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${day}:${month}:${year} ${hours}:${minutes}:${seconds}`;
}

// Log API request
export function logApiRequest(details: ApiCallDetails): void {
  const timestamp = formatTimestamp();
  console.log(`[${timestamp}] 🌐 API REQUEST`);
  console.log(`  📍 Endpoint: ${details.endpoint}`);
  console.log(`  🔧 Method: ${details.method}`);
  
  if (details.headers && Object.keys(details.headers).length > 0) {
    console.log(`  📋 Headers:`, sanitizeHeaders(details.headers));
  }
  
  if (details.params && Object.keys(details.params).length > 0) {
    console.log(`  🔍 Params:`, details.params);
  }
  
  if (details.body) {
    console.log(`  📦 Body:`, typeof details.body === 'string' ? details.body.substring(0, 500) + '...' : details.body);
  }
}

// Log API response
export function logApiResponse(endpoint: string, details: ApiResponseDetails): void {
  const timestamp = formatTimestamp();
  const statusEmoji = details.status >= 200 && details.status < 300 ? '✅' : 
                     details.status >= 400 && details.status < 500 ? '⚠️' : '❌';
  
  console.log(`[${timestamp}] ${statusEmoji} API RESPONSE`);
  console.log(`  📍 Endpoint: ${endpoint}`);
  console.log(`  📊 Status: ${details.status} ${details.statusText || ''}`);
  
  if (details.headers && Object.keys(details.headers).length > 0) {
    console.log(`  📋 Response Headers:`, sanitizeHeaders(details.headers));
  }
  
  if (details.data) {
    const dataStr = typeof details.data === 'string' ? details.data : JSON.stringify(details.data);
    console.log(`  📦 Response Data (${dataStr.length} chars):`, dataStr.substring(0, 500) + (dataStr.length > 500 ? '...' : ''));
  }
  
  if (details.error) {
    console.log(`  ❌ Error:`, details.error);
  }
}

// Log database operations
export function logDatabaseOperation(details: DatabaseOperation): void {
  const timestamp = formatTimestamp();
  console.log(`[${timestamp}] 🗄️ DATABASE OPERATION`);
  console.log(`  🔧 Operation: ${details.operation}`);
  console.log(`  📋 Table: ${details.table}`);
  
  if (details.query) {
    console.log(`  📝 Query: ${details.query}`);
  }
  
  if (details.params) {
    console.log(`  🔍 Params:`, details.params);
  }
  
  if (details.resultCount !== undefined) {
    console.log(`  📊 Results: ${details.resultCount} records`);
  }
  
  if (details.affectedRows !== undefined) {
    console.log(`  📊 Affected: ${details.affectedRows} rows`);
  }
}

// Log database errors
export function logDatabaseError(operation: string, table: string, error: any): void {
  const timestamp = formatTimestamp();
  console.log(`[${timestamp}] ❌ DATABASE ERROR`);
  console.log(`  🔧 Operation: ${operation}`);
  console.log(`  📋 Table: ${table}`);
  console.log(`  ❌ Error:`, error);
}

// Log Discord interactions
export function logDiscordInteraction(type: 'COMMAND_RECEIVED' | 'DEFER_REPLY' | 'EDIT_REPLY' | 'FOLLOW_UP' | 'ERROR', details: {
  commandName?: string;
  userId?: string;
  username?: string;
  guildId?: string;
  channelId?: string;
  message?: string;
  error?: any;
}): void {
  const timestamp = formatTimestamp();
  const emoji = type === 'COMMAND_RECEIVED' ? '🎯' :
                type === 'DEFER_REPLY' ? '⏳' :
                type === 'EDIT_REPLY' ? '✏️' :
                type === 'FOLLOW_UP' ? '📤' : '❌';
  
  console.log(`[${timestamp}] ${emoji} DISCORD ${type.replace('_', ' ')}`);
  
  if (details.commandName) {
    console.log(`  🎮 Command: /${details.commandName}`);
  }
  
  if (details.userId && details.username) {
    console.log(`  👤 User: ${details.username} (${details.userId})`);
  }
  
  if (details.guildId) {
    console.log(`  🏠 Guild: ${details.guildId}`);
  }
  
  if (details.channelId) {
    console.log(`  💬 Channel: ${details.channelId}`);
  }
  
  if (details.message) {
    console.log(`  💭 Message: ${details.message.substring(0, 200)}${details.message.length > 200 ? '...' : ''}`);
  }
  
  if (details.error) {
    console.log(`  ❌ Error:`, details.error);
  }
}

// Performance tracking
const performanceMetrics = new Map<string, PerformanceMetric>();

export function startPerformanceTimer(operation: string): string {
  const id = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const metric: PerformanceMetric = {
    operation,
    startTime: Date.now()
  };
  performanceMetrics.set(id, metric);
  
  const timestamp = formatTimestamp();
  console.log(`[${timestamp}] ⏱️ PERFORMANCE START: ${operation}`);
  
  return id;
}

export function endPerformanceTimer(id: string): void {
  const metric = performanceMetrics.get(id);
  if (!metric) {
    console.log(`[${formatTimestamp()}] ⚠️ PERFORMANCE: Timer ${id} not found`);
    return;
  }
  
  metric.endTime = Date.now();
  metric.duration = metric.endTime - metric.startTime;
  
  const timestamp = formatTimestamp();
  const durationStr = metric.duration < 1000 ? `${metric.duration}ms` : `${(metric.duration / 1000).toFixed(2)}s`;
  
  console.log(`[${timestamp}] ⏱️ PERFORMANCE END: ${metric.operation} - Duration: ${durationStr}`);
  
  // Clean up
  performanceMetrics.delete(id);
}

// Application state logging
export function logAppState(type: 'STARTUP' | 'SHUTDOWN' | 'CONFIG' | 'ERROR', details: {
  message: string;
  data?: any;
  error?: any;
}): void {
  const timestamp = formatTimestamp();
  const emoji = type === 'STARTUP' ? '🚀' :
                type === 'SHUTDOWN' ? '🛑' :
                type === 'CONFIG' ? '⚙️' : '❌';
  
  console.log(`[${timestamp}] ${emoji} APP ${type}: ${details.message}`);
  
  if (details.data) {
    console.log(`  📊 Data:`, details.data);
  }
  
  if (details.error) {
    console.log(`  ❌ Error:`, details.error);
  }
}

// Function execution flow logging
export function logFunctionEntry(functionName: string, params?: any): void {
  const timestamp = formatTimestamp();
  console.log(`[${timestamp}] 🔵 ENTER: ${functionName}`);
  
  if (params) {
    console.log(`  🔍 Params:`, params);
  }
}

export function logFunctionExit(functionName: string, result?: any): void {
  const timestamp = formatTimestamp();
  console.log(`[${timestamp}] 🔴 EXIT: ${functionName}`);
  
  if (result !== undefined) {
    const resultStr = typeof result === 'object' ? JSON.stringify(result).substring(0, 200) + '...' : String(result);
    console.log(`  📤 Result: ${resultStr}`);
  }
}

// Utility function to sanitize headers (remove sensitive information)
function sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
  const sanitized = { ...headers };
  const sensitiveKeys = ['authorization', 'x-api-key', 'cookie', 'set-cookie'];
  
  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

// General purpose logging
export function log(level: 'INFO' | 'WARN' | 'ERROR', message: string, data?: any): void {
  const timestamp = formatTimestamp();
  const emoji = level === 'INFO' ? 'ℹ️' : level === 'WARN' ? '⚠️' : '❌';
  
  console.log(`[${timestamp}] ${emoji} ${level}: ${message}`);
  
  if (data) {
    console.log(`  📊 Data:`, data);
  }
}