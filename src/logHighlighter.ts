/**
 * Log syntax highlighter using ANSI color codes
 * Provides terminal-like syntax highlighting for log output
 */

export interface HighlightOptions {
  enabled: boolean;
  colorizeLogLevels: boolean;
  colorizeTimestamps: boolean;
  colorizeNumbers: boolean;
  colorizeUrls: boolean;
  colorizeIpAddresses: boolean;
  colorizeFilePaths: boolean;
}

// ANSI color codes
export const Colors = {
  reset: '\x1b[0m',
  
  // Log levels
  error: '\x1b[31m',      // Red
  warn: '\x1b[33m',       // Yellow
  info: '\x1b[34m',       // Blue
  success: '\x1b[32m',    // Green
  debug: '\x1b[35m',      // Magenta
  
  // Elements
  timestamp: '\x1b[90m',  // Gray
  number: '\x1b[36m',     // Cyan
  url: '\x1b[4;34m',      // Blue underline
  ip: '\x1b[36m',         // Cyan
  path: '\x1b[33m',       // Yellow
  
  // Styles
  bold: '\x1b[1m',
  dim: '\x1b[2m',
} as const;

// Regex patterns for different log elements
const patterns = {
  // Log levels (case insensitive, word boundary)
  error: /\b(ERROR|FATAL|CRITICAL|CRIT|ERR)\b/gi,
  warn: /\b(WARN|WARNING|WRN)\b/gi,
  info: /\b(INFO|INF)\b/gi,
  success: /\b(SUCCESS|OK|PASS|PASSED)\b/gi,
  debug: /\b(DEBUG|DBG|TRACE|TRC)\b/gi,
  
  // ISO 8601 timestamps and common log timestamp formats
  timestamp: /\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{3,6})?(?:Z|[+-]\d{2}:?\d{2})?\b|\b\d{2}:\d{2}:\d{2}\b|\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/g,
  
  // Numbers (integers, floats, hex, percentages)
  number: /\b\d+\.?\d*%?\b|0x[0-9a-fA-F]+\b/g,
  
  // URLs (http, https, ftp, ws, wss)
  url: /\b(?:https?|ftp|wss?):\/\/[^\s<>"{}|\\^`\[\]]+/g,
  
  // IP addresses (IPv4)
  ip: /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g,
  
  // File paths (Unix and Windows)
  path: /\b(?:\/[\w.-]+)+\/?|\b[A-Z]:\\(?:[\w.-]+\\)*[\w.-]+/g,
};

export class LogHighlighter {
  private options: HighlightOptions;
  
  constructor(options?: Partial<HighlightOptions>) {
    this.options = {
      enabled: true,
      colorizeLogLevels: true,
      colorizeTimestamps: true,
      colorizeNumbers: true,
      colorizeUrls: true,
      colorizeIpAddresses: true,
      colorizeFilePaths: true,
      ...options,
    };
  }
  
  /**
   * Update highlighter options
   */
  public setOptions(options: Partial<HighlightOptions>): void {
    this.options = { ...this.options, ...options };
  }
  
  /**
   * Get current options
   */
  public getOptions(): Readonly<HighlightOptions> {
    return { ...this.options };
  }
  
  /**
   * Apply syntax highlighting to a log line
   */
  public highlight(text: string): string {
    if (!this.options.enabled || !text) {
      return text;
    }
    
    let highlighted = text;
    
    // Apply highlights in order of priority
    // Log levels first (most important)
    if (this.options.colorizeLogLevels) {
      highlighted = this.highlightLogLevels(highlighted);
    }
    
    // Then URLs (before numbers to avoid highlighting numbers in URLs)
    if (this.options.colorizeUrls) {
      highlighted = this.highlightUrls(highlighted);
    }
    
    // IP addresses
    if (this.options.colorizeIpAddresses) {
      highlighted = this.highlightIpAddresses(highlighted);
    }
    
    // File paths
    if (this.options.colorizeFilePaths) {
      highlighted = this.highlightFilePaths(highlighted);
    }
    
    // Timestamps
    if (this.options.colorizeTimestamps) {
      highlighted = this.highlightTimestamps(highlighted);
    }
    
    // Numbers (last to avoid conflicts)
    if (this.options.colorizeNumbers) {
      highlighted = this.highlightNumbers(highlighted);
    }
    
    return highlighted;
  }
  
  private highlightLogLevels(text: string): string {
    let result = text;
    
    // ERROR/FATAL/CRITICAL
    result = result.replace(patterns.error, (match) => {
      return `${Colors.bold}${Colors.error}${match}${Colors.reset}`;
    });
    
    // WARN/WARNING
    result = result.replace(patterns.warn, (match) => {
      return `${Colors.bold}${Colors.warn}${match}${Colors.reset}`;
    });
    
    // INFO
    result = result.replace(patterns.info, (match) => {
      return `${Colors.info}${match}${Colors.reset}`;
    });
    
    // SUCCESS/OK
    result = result.replace(patterns.success, (match) => {
      return `${Colors.bold}${Colors.success}${match}${Colors.reset}`;
    });
    
    // DEBUG/TRACE
    result = result.replace(patterns.debug, (match) => {
      return `${Colors.debug}${match}${Colors.reset}`;
    });
    
    return result;
  }
  
  private highlightTimestamps(text: string): string {
    return text.replace(patterns.timestamp, (match) => {
      return `${Colors.timestamp}${match}${Colors.reset}`;
    });
  }
  
  private highlightNumbers(text: string): string {
    // Skip if already colored (has ANSI codes)
    if (text.includes('\x1b[')) {
      // More sophisticated: only color numbers not already in ANSI sequences
      return text.replace(patterns.number, (match, offset) => {
        // Check if this number is inside an ANSI sequence
        const before = text.substring(0, offset);
        const lastAnsi = before.lastIndexOf('\x1b[');
        const lastReset = before.lastIndexOf('\x1b[0m');
        
        // If we're inside an ANSI sequence, don't colorize
        if (lastAnsi > lastReset) {
          return match;
        }
        
        return `${Colors.number}${match}${Colors.reset}`;
      });
    }
    
    return text.replace(patterns.number, (match) => {
      return `${Colors.number}${match}${Colors.reset}`;
    });
  }
  
  private highlightUrls(text: string): string {
    return text.replace(patterns.url, (match) => {
      return `${Colors.url}${match}${Colors.reset}`;
    });
  }
  
  private highlightIpAddresses(text: string): string {
    // Skip URLs to avoid highlighting IPs in URLs
    if (text.match(patterns.url)) {
      return text;
    }
    
    return text.replace(patterns.ip, (match) => {
      return `${Colors.ip}${match}${Colors.reset}`;
    });
  }
  
  private highlightFilePaths(text: string): string {
    return text.replace(patterns.path, (match) => {
      return `${Colors.path}${match}${Colors.reset}`;
    });
  }
  
  /**
   * Remove all ANSI color codes from text
   */
  public static stripColors(text: string): string {
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  }
  
  /**
   * Create a default highlighter instance
   */
  public static createDefault(): LogHighlighter {
    return new LogHighlighter();
  }
}
