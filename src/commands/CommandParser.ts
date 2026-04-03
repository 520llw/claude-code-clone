/**
 * @fileoverview Command Parser for Claude Code Clone
 * @module commands/CommandParser
 * @description Parses slash command input into structured arguments and options.
 * Supports various argument types, quoting, escaping, and complex option formats.
 * @version 1.0.0
 * @author Claude Code Clone
 * @license MIT
 */

import { ParsedArguments, CommandArgument, CommandOption } from './Command';

/**
 * Token types for lexical analysis
 * @enum TokenType
 */
enum TokenType {
  COMMAND = 'COMMAND',
  ARGUMENT = 'ARGUMENT',
  SHORT_OPTION = 'SHORT_OPTION',
  LONG_OPTION = 'LONG_OPTION',
  OPTION_VALUE = 'OPTION_VALUE',
  FLAG = 'FLAG',
  QUOTED_STRING = 'QUOTED_STRING',
  EOF = 'EOF'
}

/**
 * Token structure
 * @interface Token
 */
interface Token {
  type: TokenType;
  value: string;
  raw: string;
  position: number;
}

/**
 * Parse result
 * @interface ParseResult
 */
interface ParseResult {
  /** Whether parsing succeeded */
  success: boolean;
  /** Parsed arguments if successful */
  args?: ParsedArguments;
  /** Error message if failed */
  error?: string;
  /** Suggestions for fixing the error */
  suggestions?: string[];
}

/**
 * Parser options
 * @interface ParserOptions
 */
interface ParserOptions {
  /** Allow unknown options */
  allowUnknownOptions?: boolean;
  /** Allow extra positional arguments */
  allowExtraArgs?: boolean;
  /** Strict mode - fail on any error */
  strict?: boolean;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Command parser for parsing slash command input
 * @class CommandParser
 * @description Parses command strings into structured arguments and options.
 * Handles various formats including quoted strings, escaped characters,
 * and complex option structures.
 * 
 * @example
 * ```typescript
 * const parser = new CommandParser();
 * const result = parser.parse('/git-commit -m "Initial commit" --amend');
 * // result.args = { command: 'git-commit', options: { m: 'Initial commit', amend: true } }
 * ```
 */
export class CommandParser {
  /** Input string being parsed */
  private input: string = '';
  
  /** Current position in input */
  private position: number = 0;
  
  /** Current character */
  private currentChar: string = '';
  
  /** Parser options */
  private options: ParserOptions;

  /**
   * Creates a new command parser
   * @param options - Parser options
   */
  constructor(options: ParserOptions = {}) {
    this.options = {
      allowUnknownOptions: false,
      allowExtraArgs: false,
      strict: true,
      debug: false,
      ...options
    };
  }

  /**
   * Parse a command string
   * @param input - Command string to parse
   * @param argDefs - Argument definitions for validation
   * @param optDefs - Option definitions for validation
   * @returns Parse result
   */
  public parse(
    input: string,
    argDefs: CommandArgument[] = [],
    optDefs: CommandOption[] = []
  ): ParseResult {
    try {
      this.input = input.trim();
      this.position = 0;
      this.currentChar = this.input[0] || '';

      if (this.options.debug) {
        console.log('Parsing:', input);
      }

      // Tokenize
      const tokens = this.tokenize();
      
      if (this.options.debug) {
        console.log('Tokens:', tokens);
      }

      // Parse tokens into arguments
      const parsed = this.parseTokens(tokens, argDefs, optDefs);
      
      if (!parsed.success) {
        return parsed;
      }

      // Validate against definitions
      const validation = this.validate(parsed.args!, argDefs, optDefs);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          suggestions: validation.suggestions
        };
      }

      return {
        success: true,
        args: parsed.args
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        suggestions: ['Check command syntax and try again']
      };
    }
  }

  /**
   * Tokenize the input string
   * @private
   * @returns Array of tokens
   */
  private tokenize(): Token[] {
    const tokens: Token[] = [];

    // Skip leading slash if present
    if (this.currentChar === '/') {
      this.advance();
    }

    // Parse command name
    const commandName = this.parseCommandName();
    if (commandName) {
      tokens.push({
        type: TokenType.COMMAND,
        value: commandName,
        raw: commandName,
        position: 0
      });
    }

    // Parse remaining tokens
    while (this.position < this.input.length) {
      this.skipWhitespace();
      
      if (this.position >= this.input.length) {
        break;
      }

      const startPos = this.position;
      const token = this.parseToken();
      
      if (token) {
        token.position = startPos;
        tokens.push(token);
      }
    }

    tokens.push({
      type: TokenType.EOF,
      value: '',
      raw: '',
      position: this.position
    });

    return tokens;
  }

  /**
   * Parse command name
   * @private
   * @returns Command name
   */
  private parseCommandName(): string {
    let name = '';
    
    while (this.position < this.input.length && 
           !this.isWhitespace(this.currentChar) && 
           this.currentChar !== '-') {
      name += this.currentChar;
      this.advance();
    }
    
    return name;
  }

  /**
   * Parse a single token
   * @private
   * @returns Token or null
   */
  private parseToken(): Token | null {
    // Quoted string
    if (this.currentChar === '"' || this.currentChar === "'") {
      return this.parseQuotedString();
    }

    // Long option (--option)
    if (this.currentChar === '-' && this.peek() === '-') {
      return this.parseLongOption();
    }

    // Short option (-o)
    if (this.currentChar === '-') {
      return this.parseShortOption();
    }

    // Regular argument
    return this.parseArgument();
  }

  /**
   * Parse a quoted string
   * @private
   * @returns Quoted string token
   */
  private parseQuotedString(): Token {
    const quote = this.currentChar;
    const startPos = this.position;
    let value = '';
    
    this.advance(); // Skip opening quote
    
    while (this.position < this.input.length && this.currentChar !== quote) {
      // Handle escape sequences
      if (this.currentChar === '\\' && this.peek() === quote) {
        this.advance();
        value += this.currentChar;
      } else if (this.currentChar === '\\' && this.peek() === 'n') {
        this.advance();
        value += '\n';
      } else if (this.currentChar === '\\' && this.peek() === 't') {
        this.advance();
        value += '\t';
      } else {
        value += this.currentChar;
      }
      this.advance();
    }
    
    this.advance(); // Skip closing quote
    
    return {
      type: TokenType.QUOTED_STRING,
      value,
      raw: this.input.substring(startPos, this.position),
      position: startPos
    };
  }

  /**
   * Parse a long option (--option or --option=value)
   * @private
   * @returns Long option token
   */
  private parseLongOption(): Token {
    const startPos = this.position;
    let name = '';
    
    this.advance(); // Skip first -
    this.advance(); // Skip second -
    
    // Parse option name
    while (this.position < this.input.length && 
           !this.isWhitespace(this.currentChar) && 
           this.currentChar !== '=') {
      name += this.currentChar;
      this.advance();
    }

    // Check for =value
    let value: string | undefined;
    if (this.currentChar === '=') {
      this.advance(); // Skip =
      
      if (this.currentChar === '"' || this.currentChar === "'") {
        const quoted = this.parseQuotedString();
        value = quoted.value;
      } else {
        value = '';
        while (this.position < this.input.length && 
               !this.isWhitespace(this.currentChar)) {
          value += this.currentChar;
          this.advance();
        }
      }
    }

    return {
      type: TokenType.LONG_OPTION,
      value: name,
      raw: this.input.substring(startPos, this.position),
      position: startPos
    };
  }

  /**
   * Parse a short option (-o or -ovalue or -o value)
   * @private
   * @returns Short option token(s)
   */
  private parseShortOption(): Token {
    const startPos = this.position;
    
    this.advance(); // Skip -
    
    const flag = this.currentChar;
    this.advance();

    // Check for combined value (-ovalue)
    let value: string | undefined;
    if (this.position < this.input.length && 
        !this.isWhitespace(this.currentChar) && 
        this.currentChar !== '-') {
      if (this.currentChar === '"' || this.currentChar === "'") {
        const quoted = this.parseQuotedString();
        value = quoted.value;
      } else {
        value = '';
        while (this.position < this.input.length && 
               !this.isWhitespace(this.currentChar) && 
               this.currentChar !== '-') {
          value += this.currentChar;
          this.advance();
        }
      }
    }

    return {
      type: TokenType.SHORT_OPTION,
      value: flag,
      raw: this.input.substring(startPos, this.position),
      position: startPos
    };
  }

  /**
   * Parse a regular argument
   * @private
   * @returns Argument token
   */
  private parseArgument(): Token {
    const startPos = this.position;
    let value = '';
    
    while (this.position < this.input.length && 
           !this.isWhitespace(this.currentChar) && 
           this.currentChar !== '-') {
      // Handle escape sequences
      if (this.currentChar === '\\') {
        this.advance();
        value += this.currentChar;
      } else {
        value += this.currentChar;
      }
      this.advance();
    }

    return {
      type: TokenType.ARGUMENT,
      value,
      raw: this.input.substring(startPos, this.position),
      position: startPos
    };
  }

  /**
   * Parse tokens into structured arguments
   * @private
   * @param tokens - Array of tokens
   * @param argDefs - Argument definitions
   * @param optDefs - Option definitions
   * @returns Parse result
   */
  private parseTokens(
    tokens: Token[],
    argDefs: CommandArgument[],
    optDefs: CommandOption[]
  ): ParseResult {
    const args: Record<string, unknown> = {};
    const options: Record<string, unknown> = {};
    
    let tokenIndex = 0;
    let argIndex = 0;

    // First token should be command
    if (tokens[tokenIndex]?.type === TokenType.COMMAND) {
      tokenIndex++;
    }

    // Build option lookup maps
    const shortToLong = new Map<string, string>();
    const longToOpt = new Map<string, CommandOption>();
    
    for (const opt of optDefs) {
      longToOpt.set(opt.long, opt);
      if (opt.short) {
        shortToLong.set(opt.short, opt.long);
      }
    }

    // Process remaining tokens
    while (tokenIndex < tokens.length && tokens[tokenIndex].type !== TokenType.EOF) {
      const token = tokens[tokenIndex];

      if (token.type === TokenType.LONG_OPTION) {
        const optName = token.value;
        const optDef = longToOpt.get(optName);
        
        if (!optDef && this.options.strict && !this.options.allowUnknownOptions) {
          return {
            success: false,
            error: `Unknown option: --${optName}`,
            suggestions: this.getOptionSuggestions(optName, optDefs)
          };
        }

        // Check for value in next token
        let value: unknown = true; // Default to boolean true for flags
        
        if (optDef?.type !== 'boolean') {
          const nextToken = tokens[tokenIndex + 1];
          if (nextToken && 
              (nextToken.type === TokenType.ARGUMENT || 
               nextToken.type === TokenType.QUOTED_STRING)) {
            value = this.convertValue(nextToken.value, optDef?.type || 'string');
            tokenIndex++;
          } else if (optDef?.required) {
            return {
              success: false,
              error: `Option --${optName} requires a value`,
              suggestions: [`Use: --${optName} <value>`]
            };
          } else if (optDef?.default !== undefined) {
            value = optDef.default;
          }
        }

        options[optName] = value;

      } else if (token.type === TokenType.SHORT_OPTION) {
        const shortName = token.value;
        const longName = shortToLong.get(shortName);
        
        if (!longName && this.options.strict && !this.options.allowUnknownOptions) {
          return {
            success: false,
            error: `Unknown option: -${shortName}`,
            suggestions: this.getShortOptionSuggestions(shortName, optDefs)
          };
        }

        const optDef = longName ? longToOpt.get(longName) : undefined;
        const optKey = longName || shortName;

        // Check for value in next token
        let value: unknown = true;
        
        if (optDef?.type !== 'boolean') {
          const nextToken = tokens[tokenIndex + 1];
          if (nextToken && 
              (nextToken.type === TokenType.ARGUMENT || 
               nextToken.type === TokenType.QUOTED_STRING)) {
            value = this.convertValue(nextToken.value, optDef?.type || 'string');
            tokenIndex++;
          } else if (optDef?.required) {
            return {
              success: false,
              error: `Option -${shortName} requires a value`,
              suggestions: [`Use: -${shortName} <value>`]
            };
          } else if (optDef?.default !== undefined) {
            value = optDef.default;
          }
        }

        options[optKey] = value;

      } else if (token.type === TokenType.ARGUMENT || token.type === TokenType.QUOTED_STRING) {
        // Assign to positional argument
        if (argIndex < argDefs.length) {
          const argDef = argDefs[argIndex];
          args[argDef.name] = this.convertValue(token.value, argDef.type);
          argIndex++;
        } else if (!this.options.allowExtraArgs && this.options.strict) {
          return {
            success: false,
            error: `Unexpected argument: ${token.value}`,
            suggestions: ['Check the number of arguments provided']
          };
        }
      }

      tokenIndex++;
    }

    // Apply default values for missing options
    for (const opt of optDefs) {
      if (options[opt.long] === undefined && opt.default !== undefined) {
        options[opt.long] = opt.default;
      }
    }

    // Apply default values for missing arguments
    for (let i = argIndex; i < argDefs.length; i++) {
      const argDef = argDefs[i];
      if (argDef.default !== undefined) {
        args[argDef.name] = argDef.default;
      }
    }

    return {
      success: true,
      args: {
        command: tokens[0]?.value || '',
        args,
        options,
        raw: this.input
      }
    };
  }

  /**
   * Convert string value to target type
   * @private
   * @param value - String value
   * @param type - Target type
   * @returns Converted value
   */
  private convertValue(value: string, type: string): unknown {
    switch (type) {
      case 'number':
        const num = Number(value);
        if (isNaN(num)) {
          throw new Error(`Cannot convert "${value}" to number`);
        }
        return num;
      
      case 'boolean':
        return value.toLowerCase() === 'true' || value === '1';
      
      case 'array':
        return value.split(',').map(s => s.trim());
      
      case 'object':
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      
      case 'string':
      default:
        return value;
    }
  }

  /**
   * Validate parsed arguments against definitions
   * @private
   * @param parsed - Parsed arguments
   * @param argDefs - Argument definitions
   * @param optDefs - Option definitions
   * @returns Validation result
   */
  private validate(
    parsed: ParsedArguments,
    argDefs: CommandArgument[],
    optDefs: CommandOption[]
  ): { valid: boolean; error?: string; suggestions?: string[] } {
    // Check required arguments
    for (const argDef of argDefs) {
      if (argDef.required && !(argDef.name in parsed.args)) {
        return {
          valid: false,
          error: `Missing required argument: ${argDef.name}`,
          suggestions: [`Provide ${argDef.name}: <value>`]
        };
      }

      // Validate choices
      if (argDef.choices && argDef.name in parsed.args) {
        const value = String(parsed.args[argDef.name]);
        if (!argDef.choices.includes(value)) {
          return {
            valid: false,
            error: `Invalid value for ${argDef.name}: "${value}"`,
            suggestions: [`Valid choices: ${argDef.choices.join(', ')}`]
          };
        }
      }
    }

    // Check required options
    for (const optDef of optDefs) {
      if (optDef.required && !(optDef.long in parsed.options)) {
        return {
          valid: false,
          error: `Missing required option: --${optDef.long}`,
          suggestions: [`Use: --${optDef.long} <value>`]
        };
      }

      // Validate choices
      if (optDef.choices && optDef.long in parsed.options) {
        const value = String(parsed.options[optDef.long]);
        if (!optDef.choices.includes(value)) {
          return {
            valid: false,
            error: `Invalid value for --${optDef.long}: "${value}"`,
            suggestions: [`Valid choices: ${optDef.choices.join(', ')}`]
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Get suggestions for unknown option
   * @private
   * @param optionName - Unknown option name
   * @param optDefs - Available option definitions
   * @returns Array of suggestions
   */
  private getOptionSuggestions(optionName: string, optDefs: CommandOption[]): string[] {
    const suggestions: string[] = [];
    
    for (const opt of optDefs) {
      if (opt.long.includes(optionName) || 
          this.levenshteinDistance(opt.long, optionName) <= 2) {
        suggestions.push(`--${opt.long}`);
      }
    }

    return suggestions.slice(0, 3);
  }

  /**
   * Get suggestions for unknown short option
   * @private
   * @param shortName - Unknown short option
   * @param optDefs - Available option definitions
   * @returns Array of suggestions
   */
  private getShortOptionSuggestions(shortName: string, optDefs: CommandOption[]): string[] {
    const suggestions: string[] = [];
    
    for (const opt of optDefs) {
      if (opt.short && (opt.short === shortName || opt.short.includes(shortName))) {
        suggestions.push(`-${opt.short} (--${opt.long})`);
      }
    }

    return suggestions.slice(0, 3);
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @private
   * @param a - First string
   * @param b - Second string
   * @returns Distance value
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Advance to next character
   * @private
   */
  private advance(): void {
    this.position++;
    this.currentChar = this.input[this.position] || '';
  }

  /**
   * Peek at next character without advancing
   * @private
   * @returns Next character or empty string
   */
  private peek(): string {
    return this.input[this.position + 1] || '';
  }

  /**
   * Skip whitespace characters
   * @private
   */
  private skipWhitespace(): void {
    while (this.position < this.input.length && 
           this.isWhitespace(this.currentChar)) {
      this.advance();
    }
  }

  /**
   * Check if character is whitespace
   * @private
   * @param char - Character to check
   * @returns Whether character is whitespace
   */
  private isWhitespace(char: string): boolean {
    return char === ' ' || char === '\t' || char === '\n' || char === '\r';
  }

  /**
   * Parse a simple command string (without validation)
   * @param input - Command string
   * @returns Simple parsed result
   */
  public parseSimple(input: string): { command: string; args: string[] } {
    const trimmed = input.trim();
    
    // Remove leading slash
    const withoutSlash = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
    
    // Split by whitespace, respecting quotes
    const parts: string[] = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';

    for (let i = 0; i < withoutSlash.length; i++) {
      const char = withoutSlash[i];

      if ((char === '"' || char === "'") && !inQuote) {
        inQuote = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuote) {
        inQuote = false;
        quoteChar = '';
      } else if (this.isWhitespace(char) && !inQuote) {
        if (current) {
          parts.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) {
      parts.push(current);
    }

    return {
      command: parts[0] || '',
      args: parts.slice(1)
    };
  }

  /**
   * Escape a string for use in command
   * @param value - Value to escape
   * @returns Escaped string
   */
  public static escape(value: string): string {
    if (value.includes(' ') || value.includes('"') || value.includes("'")) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
  }

  /**
   * Build command string from parts
   * @param command - Command name
   * @param args - Positional arguments
   * @param options - Named options
   * @returns Built command string
   */
  public static build(
    command: string,
    args: Record<string, unknown> = {},
    options: Record<string, unknown> = {}
  ): string {
    let result = `/${command}`;

    // Add options
    for (const [key, value] of Object.entries(options)) {
      if (value === true) {
        result += ` --${key}`;
      } else if (value !== false && value !== undefined) {
        result += ` --${key} ${CommandParser.escape(String(value))}`;
      }
    }

    // Add arguments
    for (const value of Object.values(args)) {
      if (value !== undefined) {
        result += ` ${CommandParser.escape(String(value))}`;
      }
    }

    return result;
  }
}

export default CommandParser;
