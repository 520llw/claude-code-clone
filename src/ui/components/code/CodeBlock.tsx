/**
 * Code Block Component for Claude Code Clone
 * Displays syntax highlighted code blocks
 * @module components/code/CodeBlock
 */

import React, { Component, type ReactNode, type ErrorInfo, useState, useMemo } from 'react';
import { Box, Text } from 'ink';
import PropTypes from 'prop-types';
import { useCurrentTheme } from '../../hooks/useTheme.js';
import { useTerminalSize } from '../../hooks/useTerminal.js';

/**
 * Supported programming languages
 */
export type CodeLanguage =
  | 'javascript' | 'typescript' | 'jsx' | 'tsx' | 'python' | 'java' | 'go' | 'rust'
  | 'c' | 'cpp' | 'csharp' | 'ruby' | 'php' | 'swift' | 'kotlin' | 'scala'
  | 'html' | 'css' | 'scss' | 'sass' | 'json' | 'yaml' | 'xml' | 'toml'
  | 'markdown' | 'mdx' | 'sql' | 'graphql' | 'regex'
  | 'shell' | 'bash' | 'zsh' | 'powershell' | 'vim'
  | 'dockerfile' | 'nginx' | 'apache'
  | 'plaintext' | 'text' | 'auto';

/**
 * Props for CodeBlock component
 */
export interface CodeBlockProps {
  /** Code content */
  code: string;
  /** Programming language */
  language?: CodeLanguage;
  /** File path (for language detection) */
  filePath?: string;
  /** Show line numbers */
  showLineNumbers?: boolean;
  /** Starting line number */
  startLine?: number;
  /** Maximum height */
  maxHeight?: number;
  /** Highlight specific lines */
  highlightLines?: number[];
  /** Wrap long lines */
  wrapLines?: boolean;
  /** Show copy button */
  showCopyButton?: boolean;
  /** Show language badge */
  showLanguageBadge?: boolean;
  /** Custom header */
  header?: ReactNode;
  /** Border style */
  borderStyle?: 'single' | 'double' | 'round' | 'bold' | 'none';
  /** Callback when code is copied */
  onCopy?: (code: string) => void;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * Token types for syntax highlighting
 */
export type TokenType =
  | 'keyword' | 'string' | 'number' | 'comment' | 'function'
  | 'variable' | 'type' | 'operator' | 'punctuation' | 'tag'
  | 'attribute' | 'plain';

/**
 * Syntax token
 */
export interface SyntaxToken {
  type: TokenType;
  value: string;
}

/**
 * Error boundary for CodeBlock
 */
interface CodeBlockErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class CodeBlockErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  CodeBlockErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): CodeBlockErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('CodeBlock Error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Box borderStyle="single" borderColor="red">
          <Text color="red">Error rendering code block</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}

/**
 * Detect language from file extension or content
 */
function detectLanguage(filePath?: string, code?: string): CodeLanguage {
  if (filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const extMap: Record<string, CodeLanguage> = {
      js: 'javascript', mjs: 'javascript', cjs: 'javascript',
      ts: 'typescript', mts: 'typescript', cts: 'typescript',
      jsx: 'jsx', tsx: 'tsx',
      py: 'python', pyw: 'python', pyi: 'python',
      java: 'java',
      go: 'go',
      rs: 'rust',
      c: 'c', h: 'c',
      cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp',
      cs: 'csharp',
      rb: 'ruby',
      php: 'php',
      swift: 'swift',
      kt: 'kotlin', kts: 'kotlin',
      scala: 'scala',
      html: 'html', htm: 'html',
      css: 'css',
      scss: 'scss', sass: 'sass',
      json: 'json',
      yaml: 'yaml', yml: 'yaml',
      xml: 'xml',
      toml: 'toml',
      md: 'markdown', mdx: 'mdx',
      sql: 'sql',
      gql: 'graphql', graphql: 'graphql',
      sh: 'shell', bash: 'bash', zsh: 'zsh',
      ps1: 'powershell', ps: 'powershell',
      vim: 'vim', vimrc: 'vim',
      dockerfile: 'dockerfile',
      conf: 'nginx',
      htaccess: 'apache',
      txt: 'plaintext', text: 'plaintext',
    };
    if (extMap[ext]) return extMap[ext];
  }
  
  // Try to detect from content
  if (code) {
    if (code.includes('interface ') || code.includes('type ')) return 'typescript';
    if (code.includes('def ') || code.includes('import ') && code.includes(' as ')) return 'python';
    if (code.includes('func ') && code.includes('package ')) return 'go';
    if (code.includes('fn ') && code.includes('let ')) return 'rust';
  }
  
  return 'plaintext';
}

/**
 * Get language display name
 */
function getLanguageName(language: CodeLanguage): string {
  const nameMap: Record<CodeLanguage, string> = {
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    jsx: 'JSX',
    tsx: 'TSX',
    python: 'Python',
    java: 'Java',
    go: 'Go',
    rust: 'Rust',
    c: 'C',
    cpp: 'C++',
    csharp: 'C#',
    ruby: 'Ruby',
    php: 'PHP',
    swift: 'Swift',
    kotlin: 'Kotlin',
    scala: 'Scala',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    sass: 'Sass',
    json: 'JSON',
    yaml: 'YAML',
    xml: 'XML',
    toml: 'TOML',
    markdown: 'Markdown',
    mdx: 'MDX',
    sql: 'SQL',
    graphql: 'GraphQL',
    regex: 'Regex',
    shell: 'Shell',
    bash: 'Bash',
    zsh: 'Zsh',
    powershell: 'PowerShell',
    vim: 'Vim',
    dockerfile: 'Dockerfile',
    nginx: 'Nginx',
    apache: 'Apache',
    plaintext: 'Plain Text',
    text: 'Text',
    auto: 'Auto',
  };
  return nameMap[language] || language;
}

/**
 * Simple tokenizer for syntax highlighting
 */
function tokenize(code: string, language: CodeLanguage): SyntaxToken[] {
  const tokens: SyntaxToken[] = [];
  
  // Language-specific patterns
  const patterns: Record<string, Array<{ type: TokenType; regex: RegExp }>> = {
    javascript: [
      { type: 'comment', regex: /\/\/.*$|\/\*[\s\S]*?\*\//m },
      { type: 'string', regex: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/ },
      { type: 'number', regex: /\b\d+\.?\d*\b/ },
      { type: 'keyword', regex: /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|try|catch|throw|new|this|typeof|instanceof|void|delete|in|of)\b/ },
      { type: 'function', regex: /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/ },
      { type: 'type', regex: /\b(Array|String|Number|Object|Boolean|Date|RegExp|Error|Promise|Map|Set)\b/ },
      { type: 'operator', regex: /[+=\-*/<>!&|]+/ },
      { type: 'punctuation', regex: /[{}[\]();,.]/ },
    ],
    typescript: [
      { type: 'comment', regex: /\/\/.*$|\/\*[\s\S]*?\*\//m },
      { type: 'string', regex: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/ },
      { type: 'number', regex: /\b\d+\.?\d*\b/ },
      { type: 'keyword', regex: /\b(const|let|var|function|return|if|else|for|while|class|interface|type|import|export|from|async|await|try|catch|throw|new|this|typeof|instanceof|void|delete|in|of|extends|implements|readonly|private|protected|public|static|abstract|namespace|module|declare|enum)\b/ },
      { type: 'type', regex: /\b(string|number|boolean|any|unknown|never|void|null|undefined|Array|Record|Partial|Required|Pick|Omit|Exclude|Extract|ReturnType|Parameters)\b/ },
      { type: 'function', regex: /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/ },
      { type: 'operator', regex: /[+=\-*/<>!&|]+/ },
      { type: 'punctuation', regex: /[{}[\]();,.]/ },
    ],
    python: [
      { type: 'comment', regex: /#.*$/m },
      { type: 'string', regex: /"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/ },
      { type: 'number', regex: /\b\d+\.?\d*\b/ },
      { type: 'keyword', regex: /\b(def|class|return|if|elif|else|for|while|try|except|finally|with|as|import|from|raise|pass|break|continue|lambda|yield|async|await|global|nonlocal|assert|del)\b/ },
      { type: 'function', regex: /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/ },
      { type: 'operator', regex: /[+=\-*/<>!&|]+/ },
      { type: 'punctuation', regex: /[{}[\]();,.:]/ },
    ],
    bash: [
      { type: 'comment', regex: /#.*$/m },
      { type: 'string', regex: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/ },
      { type: 'keyword', regex: /\b(if|then|else|elif|fi|for|while|do|done|case|esac|in|function|return|exit|export|source|alias)\b/ },
      { type: 'variable', regex: /\$[a-zA-Z_][a-zA-Z0-9_]*|\$\{[^}]*\}/ },
      { type: 'operator', regex: /[+=\-*/<>!&|]+/ },
      { type: 'punctuation', regex: /[{}[\]();,.]/ },
    ],
  };
  
  const langPatterns = patterns[language] || patterns.javascript;
  let remaining = code;
  
  while (remaining.length > 0) {
    let matched = false;
    
    for (const pattern of langPatterns) {
      const match = remaining.match(pattern.regex);
      if (match && match.index === 0) {
        tokens.push({ type: pattern.type, value: match[0] });
        remaining = remaining.slice(match[0].length);
        matched = true;
        break;
      }
    }
    
    if (!matched) {
      // Take one character as plain text
      tokens.push({ type: 'plain', value: remaining[0] });
      remaining = remaining.slice(1);
    }
  }
  
  // Merge consecutive plain tokens
  const merged: SyntaxToken[] = [];
  for (const token of tokens) {
    if (merged.length > 0 && merged[merged.length - 1].type === 'plain' && token.type === 'plain') {
      merged[merged.length - 1].value += token.value;
    } else {
      merged.push(token);
    }
  }
  
  return merged;
}

/**
 * Get color for token type
 */
function getTokenColor(type: TokenType, colors: ReturnType<typeof useCurrentTheme>['colors']): string {
  const colorMap: Record<TokenType, string> = {
    keyword: colors.syntax.keyword,
    string: colors.syntax.string,
    number: colors.syntax.number,
    comment: colors.syntax.comment,
    function: colors.syntax.function,
    variable: colors.syntax.variable,
    type: colors.syntax.type,
    operator: colors.syntax.operator,
    punctuation: colors.syntax.punctuation,
    tag: colors.syntax.keyword,
    attribute: colors.syntax.function,
    plain: colors.syntax.variable,
  };
  return colorMap[type] || colors.text;
}

/**
 * CodeBlock component - Displays syntax highlighted code
 * 
 * @example
 * ```tsx
 * <CodeBlock 
 *   code="const x = 1;"
 *   language="typescript"
 *   showLineNumbers
 * />
 * ```
 */
function CodeBlockComponent({
  code,
  language = 'auto',
  filePath,
  showLineNumbers = true,
  startLine = 1,
  maxHeight = 30,
  highlightLines = [],
  wrapLines = false,
  showCopyButton = false,
  showLanguageBadge = true,
  header,
  borderStyle = 'single',
  onCopy,
  'data-testid': testId = 'code-block',
}: CodeBlockProps): ReactNode {
  const theme = useCurrentTheme();
  const { columns } = useTerminalSize();
  const [copied, setCopied] = useState(false);
  
  const detectedLanguage = language === 'auto' 
    ? detectLanguage(filePath, code) 
    : language;
  
  const lines = code.split('\n');
  const displayLines = lines.slice(0, maxHeight);
  const hasMore = lines.length > maxHeight;
  const lineNumberWidth = String(startLine + lines.length - 1).length + 1;
  const contentWidth = columns - (showLineNumbers ? lineNumberWidth + 6 : 6);
  
  const handleCopy = () => {
    onCopy?.(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box
      flexDirection="column"
      borderStyle={borderStyle === 'none' ? undefined : borderStyle}
      borderColor={theme.colors.border}
      paddingX={1}
      paddingY={1}
      data-testid={testId}
    >
      {/* Header */}
      {(header || showLanguageBadge || showCopyButton) && (
        <Box flexDirection="row" marginBottom={1}>
          {header}
          {showLanguageBadge && (
            <Box 
              paddingX={1} 
              backgroundColor={theme.colors.surface}
            >
              <Text color={theme.colors.textMuted}>
                {getLanguageName(detectedLanguage)}
              </Text>
            </Box>
          )}
          {showCopyButton && (
            <Box onPress={handleCopy} marginLeft={1}>
              <Text color={copied ? theme.colors.status.success : theme.colors.primary}>
                {copied ? '✓ Copied' : 'Copy'}
              </Text>
            </Box>
          )}
        </Box>
      )}
      
      {/* Code content */}
      <Box 
        flexDirection="column"
        backgroundColor={theme.colors.syntax.background}
      >
        {displayLines.map((line, index) => {
          const lineNumber = startLine + index;
          const isHighlighted = highlightLines.includes(lineNumber);
          const tokens = tokenize(line, detectedLanguage);
          
          return (
            <Box 
              key={index}
              flexDirection="row"
              backgroundColor={isHighlighted ? theme.colors.selection : undefined}
            >
              {showLineNumbers && (
                <Box width={lineNumberWidth}>
                  <Text color={theme.colors.diff.lineNumber} dimColor>
                    {lineNumber}
                  </Text>
                </Box>
              )}
              <Box width={contentWidth}>
                {tokens.length > 0 ? (
                  <>
                    {tokens.map((token, ti) => (
                      <Text 
                        key={ti} 
                        color={getTokenColor(token.type, theme.colors)}
                      >
                        {token.value.slice(0, contentWidth)}
                      </Text>
                    ))}
                  </>
                ) : (
                  <Text> </Text>
                )}
              </Box>
            </Box>
          );
        })}
        
        {hasMore && (
          <Box flexDirection="row">
            {showLineNumbers && (
              <Box width={lineNumberWidth}>
                <Text color={theme.colors.textMuted} dimColor>...</Text>
              </Box>
            )}
            <Text color={theme.colors.textMuted} dimColor>
              ... {lines.length - maxHeight} more lines ...
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}

/**
 * PropTypes validation for CodeBlock
 */
CodeBlockComponent.propTypes = {
  code: PropTypes.string.isRequired,
  language: PropTypes.oneOf([
    'javascript', 'typescript', 'jsx', 'tsx', 'python', 'java', 'go', 'rust',
    'c', 'cpp', 'csharp', 'ruby', 'php', 'swift', 'kotlin', 'scala',
    'html', 'css', 'scss', 'sass', 'json', 'yaml', 'xml', 'toml',
    'markdown', 'mdx', 'sql', 'graphql', 'regex',
    'shell', 'bash', 'zsh', 'powershell', 'vim',
    'dockerfile', 'nginx', 'apache',
    'plaintext', 'text', 'auto',
  ] as const),
  filePath: PropTypes.string,
  showLineNumbers: PropTypes.bool,
  startLine: PropTypes.number,
  maxHeight: PropTypes.number,
  highlightLines: PropTypes.arrayOf(PropTypes.number),
  wrapLines: PropTypes.bool,
  showCopyButton: PropTypes.bool,
  showLanguageBadge: PropTypes.bool,
  header: PropTypes.node,
  borderStyle: PropTypes.oneOf(['single', 'double', 'round', 'bold', 'none'] as const),
  onCopy: PropTypes.func,
  'data-testid': PropTypes.string,
};

/**
 * Wrapped CodeBlock with error boundary
 */
export function CodeBlock(props: CodeBlockProps): ReactNode {
  return (
    <CodeBlockErrorBoundary>
      <CodeBlockComponent {...props} />
    </CodeBlockErrorBoundary>
  );
}

/**
 * Inline code component
 */
export function InlineCode({ 
  children,
  color,
}: { 
  children: string;
  color?: string;
}): ReactNode {
  const theme = useCurrentTheme();
  
  return (
    <Text 
      backgroundColor={theme.colors.surface}
      color={color || theme.colors.text}
    >
      {children}
    </Text>
  );
}

InlineCode.propTypes = {
  children: PropTypes.string.isRequired,
  color: PropTypes.string,
};

export default CodeBlock;
