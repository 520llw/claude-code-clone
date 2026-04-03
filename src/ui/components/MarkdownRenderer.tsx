/**
 * Markdown Renderer Component
 *
 * Renders Markdown content in the terminal using Ink components.
 * Supports: headers, code blocks, inline code, bold, italic,
 * lists (ordered/unordered), links, blockquotes, horizontal rules.
 */

import { Box, Text } from 'ink';

// ============================================================================
// Types
// ============================================================================

interface MarkdownRendererProps {
  content: string;
}

type BlockNode =
  | { type: 'heading'; level: number; text: string }
  | { type: 'code_block'; language: string; code: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'blockquote'; text: string }
  | { type: 'hr' }
  | { type: 'blank' };

// ============================================================================
// Parser
// ============================================================================

function parseMarkdown(content: string): BlockNode[] {
  const lines = content.split('\n');
  const blocks: BlockNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] || '';

    // Blank line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|_{3,}|\*{3,})\s*$/.test(line || '')) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: (headingMatch[1] || '').length,
        text: headingMatch[2] || '',
      });
      i++;
      continue;
    }

    // Code block
    if (line.startsWith('```')) {
      const language = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] || '').startsWith('```')) {
        codeLines.push(lines[i] || '');
        i++;
      }
      blocks.push({
        type: 'code_block',
        language,
        code: codeLines.join('\n'),
      });
      i++; // skip closing ```
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i] || '').startsWith('> ')) {
        quoteLines.push((lines[i] || '').slice(2));
        i++;
      }
      blocks.push({
        type: 'blockquote',
        text: quoteLines.join('\n'),
      });
      continue;
    }

    // Unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i] || '')) {
        items.push((lines[i] || '').replace(/^\s*[-*+]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'list', ordered: false, items });
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i] || '')) {
        items.push((lines[i] || '').replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'list', ordered: true, items });
      continue;
    }

    // Paragraph (collect consecutive non-empty lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      (lines[i] || '').trim() !== '' &&
      !(lines[i] || '').startsWith('#') &&
      !(lines[i] || '').startsWith('```') &&
      !(lines[i] || '').startsWith('> ') &&
      !/^(-{3,}|_{3,}|\*{3,})\s*$/.test(lines[i] || '') &&
      !/^\s*[-*+]\s+/.test(lines[i] || '') &&
      !/^\s*\d+\.\s+/.test(lines[i] || '')
    ) {
      paraLines.push(lines[i] || '');
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: 'paragraph', text: paraLines.join(' ') });
    }
  }

  return blocks;
}

// ============================================================================
// Inline Rendering
// ============================================================================

interface InlineSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  link?: string;
  strikethrough?: boolean;
}

function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  // Pattern order matters: code first (prevents inner parsing), then bold, italic, links, strikethrough
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(_[^_]+_)|(~~[^~]+~~)|(\[([^\]]+)\]\(([^)]+)\))/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index) });
    }

    if (match[1]) {
      // Inline code
      segments.push({ text: match[1].slice(1, -1), code: true });
    } else if (match[2]) {
      // Bold
      segments.push({ text: match[2].slice(2, -2), bold: true });
    } else if (match[3]) {
      // Italic *text*
      segments.push({ text: match[3].slice(1, -1), italic: true });
    } else if (match[4]) {
      // Italic _text_
      segments.push({ text: match[4].slice(1, -1), italic: true });
    } else if (match[5]) {
      // Strikethrough
      segments.push({ text: match[5].slice(2, -2), strikethrough: true });
    } else if (match[6]) {
      // Link
      segments.push({ text: match[7] || '', link: match[8] || '' });
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }

  if (segments.length === 0) {
    segments.push({ text });
  }

  return segments;
}

function InlineText({ text }: { text: string }): JSX.Element {
  const segments = parseInline(text);

  return (
    <Text>
      {segments.map((seg, i) => {
        if (seg.code) {
          return <Text key={i} color="cyan">`{seg.text}`</Text>;
        }
        if (seg.bold) {
          return <Text key={i} bold>{seg.text}</Text>;
        }
        if (seg.italic) {
          return <Text key={i} italic>{seg.text}</Text>;
        }
        if (seg.strikethrough) {
          return <Text key={i} dimColor strikethrough>{seg.text}</Text>;
        }
        if (seg.link) {
          return (
            <Text key={i}>
              <Text color="blue" underline>{seg.text}</Text>
              <Text dimColor> ({seg.link})</Text>
            </Text>
          );
        }
        return <Text key={i}>{seg.text}</Text>;
      })}
    </Text>
  );
}

// ============================================================================
// Block Rendering
// ============================================================================

function HeadingBlock({ level, text }: { level: number; text: string }): JSX.Element {
  const colors: Record<number, string> = {
    1: 'cyan',
    2: 'green',
    3: 'yellow',
    4: 'blue',
    5: 'magenta',
    6: 'white',
  };
  const prefixes: Record<number, string> = {
    1: '# ',
    2: '## ',
    3: '### ',
    4: '#### ',
    5: '##### ',
    6: '###### ',
  };

  return (
    <Box marginY={level <= 2 ? 1 : 0}>
      <Text color={colors[level] || 'white'} bold>
        {prefixes[level] || ''}{text}
      </Text>
    </Box>
  );
}

function CodeBlock({ language, code }: { language: string; code: string }): JSX.Element {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} marginY={0}>
      {language && (
        <Text color="cyan" dimColor>{language}</Text>
      )}
      <Text color="white">{code}</Text>
    </Box>
  );
}

function ListBlock({ ordered, items }: { ordered: boolean; items: string[] }): JSX.Element {
  return (
    <Box flexDirection="column" marginLeft={2}>
      {items.map((item, i) => (
        <Box key={i}>
          <Text color="cyan">
            {ordered ? `${i + 1}. ` : '  - '}
          </Text>
          <InlineText text={item} />
        </Box>
      ))}
    </Box>
  );
}

function BlockquoteBlock({ text }: { text: string }): JSX.Element {
  const lines = text.split('\n');
  return (
    <Box flexDirection="column" marginLeft={1} borderStyle="bold" borderColor="gray" borderLeft borderRight={false} borderTop={false} borderBottom={false} paddingLeft={1}>
      {lines.map((line, i) => (
        <Text key={i} dimColor italic>{line}</Text>
      ))}
    </Box>
  );
}

function HorizontalRule(): JSX.Element {
  return (
    <Box marginY={0}>
      <Text dimColor>{'─'.repeat(60)}</Text>
    </Box>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function MarkdownRenderer({ content }: MarkdownRendererProps): JSX.Element {
  if (!content) return <Text></Text>;

  const blocks = parseMarkdown(content);

  return (
    <Box flexDirection="column">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'heading':
            return <HeadingBlock key={i} level={block.level} text={block.text} />;
          case 'code_block':
            return <CodeBlock key={i} language={block.language} code={block.code} />;
          case 'paragraph':
            return (
              <Box key={i}>
                <InlineText text={block.text} />
              </Box>
            );
          case 'list':
            return <ListBlock key={i} ordered={block.ordered} items={block.items} />;
          case 'blockquote':
            return <BlockquoteBlock key={i} text={block.text} />;
          case 'hr':
            return <HorizontalRule key={i} />;
          default:
            return null;
        }
      })}
    </Box>
  );
}

export default MarkdownRenderer;
