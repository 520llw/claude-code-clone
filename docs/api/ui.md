# UI API Documentation

API reference for Claude Code Clone user interfaces.

## Table of Contents

1. [UI Overview](#ui-overview)
2. [Terminal UI](#terminal-ui)
3. [Components](#components)
4. [Styling](#styling)
5. [Input Handling](#input-handling)
6. [Output Formatting](#output-formatting)
7. [Event Handling](#event-handling)
8. [Custom Components](#custom-components)
9. [Theming](#theming)
10. [Accessibility](#accessibility)

## UI Overview

### UI Architecture

```
UI Layer
  ├── Terminal UI (Primary)
  │   ├── Input Handler
  │   ├── Output Renderer
  │   ├── Component System
  │   └── Event System
  │
  ├── Web UI (Future)
  └── API Interface
```

### UI Interface

```typescript
interface UI {
  // Lifecycle
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  
  // Input
  readInput(): Promise<string>;
  setPrompt(prompt: string): void;
  
  // Output
  write(text: string, options?: OutputOptions): void;
  writeln(text: string, options?: OutputOptions): void;
  clear(): void;
  
  // Components
  render(component: Component): void;
  update(componentId: string, data: object): void;
  
  // Events
  on(event: string, handler: EventHandler): void;
  off(event: string, handler: EventHandler): void;
  
  // Theming
  setTheme(theme: Theme): void;
  getTheme(): Theme;
}
```

## Terminal UI

### TerminalUI Class

```typescript
class TerminalUI implements UI {
  constructor(options?: TerminalUIOptions);
  
  // Lifecycle
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  
  // Input methods
  readLine(options?: ReadLineOptions): Promise<string>;
  readPassword(prompt: string): Promise<string>;
  confirm(message: string): Promise<boolean>;
  select(options: string[]): Promise<number>;
  
  // Output methods
  write(text: string, options?: OutputOptions): void;
  writeln(text?: string, options?: OutputOptions): void;
  clear(): void;
  
  // Formatting
  code(content: string, language?: string): void;
  table(data: TableData): void;
  tree(data: TreeNode): void;
  progress(value: number, total: number): void;
  
  // Components
  spinner(text: string): Spinner;
  status(message: string, type: StatusType): void;
  
  // Theming
  setTheme(theme: Theme): void;
  enableColors(enabled: boolean): void;
}
```

### Terminal Options

```typescript
interface TerminalUIOptions {
  // Display
  stdout?: NodeJS.WriteStream;
  stdin?: NodeJS.ReadStream;
  
  // Configuration
  prompt?: string;
  historySize?: number;
  
  // Features
  colors?: boolean;
  unicode?: boolean;
  interactive?: boolean;
  
  // Dimensions
  width?: number;
  height?: number;
}

interface ReadLineOptions {
  prompt?: string;
  history?: string[];
  completer?: (line: string) => [string[], string];
}

interface OutputOptions {
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  newline?: boolean;
}
```

### Terminal Usage

```typescript
import { TerminalUI } from 'claude-code-clone';

const ui = new TerminalUI({
  prompt: '> ',
  colors: true,
  historySize: 1000
});

await ui.initialize();

// Write output
ui.writeln('Welcome to Claude Code Clone!');

// Read input
const input = await ui.readLine();

// Format output
ui.code('console.log("Hello");', 'javascript');

// Show table
ui.table({
  headers: ['Name', 'Type', 'Size'],
  rows: [
    ['file1.js', 'file', '1.2 KB'],
    ['src', 'directory', '-']
  ]
});

// Show spinner
const spinner = ui.spinner('Processing...');
// ... do work
spinner.succeed('Done!');
```

## Components

### Component Interface

```typescript
interface Component {
  id: string;
  type: string;
  render(): string;
  update?(data: object): void;
}

abstract class BaseComponent implements Component {
  id: string;
  type: string;
  protected state: object;
  
  constructor(id: string, type: string) {
    this.id = id;
    this.type = type;
    this.state = {};
  }
  
  abstract render(): string;
  
  update(data: object): void {
    this.state = { ...this.state, ...data };
  }
}
```

### Built-in Components

#### Message Component

```typescript
interface MessageComponent extends Component {
  type: 'message';
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

class MessageComponent extends BaseComponent {
  render(): string {
    const prefix = this.state.role === 'user' ? 'You:' : 'AI:';
    const color = this.state.role === 'user' ? 'blue' : 'green';
    
    return `${chalk[color](prefix)} ${this.state.content}`;
  }
}
```

#### Code Block Component

```typescript
interface CodeBlockComponent extends Component {
  type: 'code';
  language: string;
  content: string;
  filename?: string;
  lineNumbers?: boolean;
}

class CodeBlockComponent extends BaseComponent {
  render(): string {
    const { language, content, filename, lineNumbers } = this.state;
    
    let output = '';
    
    // Header
    if (filename) {
      output += chalk.gray(`// ${filename}\n`);
    }
    
    // Content with syntax highlighting
    const highlighted = highlight(content, language);
    
    // Line numbers
    if (lineNumbers) {
      const lines = highlighted.split('\n');
      output += lines.map((line, i) => 
        `${chalk.gray(String(i + 1).padStart(3))} ${line}`
      ).join('\n');
    } else {
      output += highlighted;
    }
    
    return output;
  }
}
```

#### Diff Component

```typescript
interface DiffComponent extends Component {
  type: 'diff';
  oldContent: string;
  newContent: string;
  filename?: string;
}

class DiffComponent extends BaseComponent {
  render(): string {
    const { oldContent, newContent, filename } = this.state;
    
    const diff = createDiff(oldContent, newContent);
    
    let output = '';
    if (filename) {
      output += chalk.bold(`Diff: ${filename}\n\n`);
    }
    
    output += diff.map(line => {
      if (line.startsWith('+')) {
        return chalk.green(line);
      } else if (line.startsWith('-')) {
        return chalk.red(line);
      } else {
        return chalk.gray(line);
      }
    }).join('\n');
    
    return output;
  }
}
```

#### Progress Component

```typescript
interface ProgressComponent extends Component {
  type: 'progress';
  value: number;
  total: number;
  label?: string;
}

class ProgressComponent extends BaseComponent {
  render(): string {
    const { value, total, label } = this.state;
    const percentage = Math.round((value / total) * 100);
    const width = 40;
    const filled = Math.round((value / total) * width);
    
    const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
    
    let output = `${bar} ${percentage}%`;
    if (label) {
      output = `${label}\n${output}`;
    }
    
    return output;
  }
}
```

#### Tree Component

```typescript
interface TreeNode {
  name: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
}

interface TreeComponent extends Component {
  type: 'tree';
  root: TreeNode;
}

class TreeComponent extends BaseComponent {
  render(): string {
    return this.renderNode(this.state.root, '');
  }
  
  private renderNode(node: TreeNode, prefix: string): string {
    const icon = node.type === 'directory' ? '📁' : '📄';
    let output = `${prefix}${icon} ${node.name}\n`;
    
    if (node.children) {
      node.children.forEach((child, index) => {
        const isLast = index === node.children!.length - 1;
        const childPrefix = prefix + (isLast ? '  ' : '│ ');
        output += this.renderNode(child, childPrefix);
      });
    }
    
    return output;
  }
}
```

## Styling

### Chalk Integration

```typescript
import chalk from 'chalk';

// Basic colors
ui.write('Error', { color: 'red' });
ui.write('Success', { color: 'green' });
ui.write('Warning', { color: 'yellow' });
ui.write('Info', { color: 'blue' });

// Styles
ui.write('Bold text', { bold: true });
ui.write('Italic text', { italic: true });
ui.write('Underlined', { underline: true });

// Combined
ui.write('Important!', { color: 'red', bold: true });
```

### Style Utilities

```typescript
class Style {
  static success(text: string): string {
    return chalk.green('✓') + ' ' + text;
  }
  
  static error(text: string): string {
    return chalk.red('✗') + ' ' + text;
  }
  
  static warning(text: string): string {
    return chalk.yellow('⚠') + ' ' + text;
  }
  
  static info(text: string): string {
    return chalk.blue('ℹ') + ' ' + text;
  }
  
  static code(text: string, language?: string): string {
    return syntaxHighlight(text, language);
  }
  
  static dim(text: string): string {
    return chalk.gray(text);
  }
  
  static highlight(text: string, search: string): string {
    return text.replace(
      new RegExp(search, 'gi'),
      match => chalk.yellow.bold(match)
    );
  }
}
```

## Input Handling

### Read Line

```typescript
// Basic input
const name = await ui.readLine('Enter your name: ');

// With history
const command = await ui.readLine({
  prompt: '> ',
  history: ['help', 'exit', 'clear']
});

// With autocomplete
const file = await ui.readLine({
  prompt: 'File: ',
  completer: (line) => {
    const files = fs.readdirSync('.');
    const matches = files.filter(f => f.startsWith(line));
    return [matches, line];
  }
});
```

### Special Input

```typescript
// Password (hidden)
const password = await ui.readPassword('Password: ');

// Confirmation
const confirmed = await ui.confirm('Continue?');

// Selection
const choice = await ui.select([
  'Option 1',
  'Option 2',
  'Option 3'
]);

// Multi-select
const choices = await ui.multiSelect([
  { name: 'Option 1', checked: true },
  { name: 'Option 2', checked: false },
  { name: 'Option 3', checked: false }
]);
```

### Input Validation

```typescript
const email = await ui.readLine({
  prompt: 'Email: ',
  validate: (input) => {
    if (!input.includes('@')) {
      return 'Invalid email address';
    }
    return true;
  }
});
```

## Output Formatting

### Text Formatting

```typescript
// Headers
ui.header('Section Title');
ui.subheader('Subsection');

// Lists
ui.list(['Item 1', 'Item 2', 'Item 3']);
ui.orderedList(['First', 'Second', 'Third']);

// Paragraphs
ui.paragraph('This is a paragraph of text...');

// Quotes
ui.quote('This is a quoted text');

// Code
ui.code('const x = 1;', 'javascript');

// Inline code
ui.write('Use the ${ui.inlineCode('console.log')} function');
```

### Tables

```typescript
ui.table({
  headers: ['Name', 'Type', 'Description'],
  rows: [
    ['read_file', 'Tool', 'Read file contents'],
    ['write_file', 'Tool', 'Write to file'],
    ['shell', 'Tool', 'Execute commands']
  ],
  align: ['left', 'center', 'left']
});
```

### JSON Output

```typescript
const data = {
  name: 'example',
  version: '1.0.0',
  dependencies: {}
};

ui.json(data, { colors: true });
```

## Event Handling

### UI Events

```typescript
interface UIEventMap {
  'input': (input: string) => void;
  'output': (output: string) => void;
  'error': (error: Error) => void;
  'resize': (size: { width: number; height: number }) => void;
  'key': (key: KeyEvent) => void;
  'interrupt': () => void;
}

interface KeyEvent {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}
```

### Event Usage

```typescript
// Listen for input
ui.on('input', (input) => {
  console.log('User input:', input);
});

// Listen for errors
ui.on('error', (error) => {
  console.error('UI error:', error);
});

// Listen for resize
ui.on('resize', ({ width, height }) => {
  console.log(`Terminal resized: ${width}x${height}`);
});

// Listen for keypress
ui.on('key', (event) => {
  if (event.key === 'c' && event.ctrl) {
    console.log('Ctrl+C pressed');
  }
});

// Remove listener
const handler = (input: string) => console.log(input);
ui.on('input', handler);
ui.off('input', handler);
```

## Custom Components

### Creating Components

```typescript
import { BaseComponent } from 'claude-code-clone';

interface ChartData {
  labels: string[];
  values: number[];
}

class BarChartComponent extends BaseComponent {
  type = 'bar-chart';
  
  render(): string {
    const { labels, values } = this.state as ChartData;
    const max = Math.max(...values);
    const width = 40;
    
    let output = '';
    
    labels.forEach((label, i) => {
      const value = values[i];
      const barLength = Math.round((value / max) * width);
      const bar = '█'.repeat(barLength);
      
      output += `${label.padEnd(10)} ${bar} ${value}\n`;
    });
    
    return output;
  }
}

// Register and use
const chart = new BarChartComponent('chart-1');
chart.update({
  labels: ['A', 'B', 'C'],
  values: [30, 50, 20]
});

ui.render(chart);
```

### Component with State

```typescript
class CounterComponent extends BaseComponent {
  type = 'counter';
  
  constructor(id: string) {
    super(id, 'counter');
    this.state = { count: 0 };
  }
  
  increment(): void {
    this.update({ count: this.state.count + 1 });
  }
  
  decrement(): void {
    this.update({ count: this.state.count - 1 });
  }
  
  render(): string {
    return `Count: ${chalk.bold(this.state.count)}`;
  }
}
```

## Theming

### Theme Interface

```typescript
interface Theme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    success: string;
    error: string;
    warning: string;
    info: string;
    muted: string;
    background: string;
    foreground: string;
  };
  styles: {
    header: StyleDefinition;
    code: StyleDefinition;
    quote: StyleDefinition;
    link: StyleDefinition;
  };
}

interface StyleDefinition {
  color?: string;
  background?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}
```

### Built-in Themes

```typescript
const themes = {
  dark: {
    name: 'dark',
    colors: {
      primary: '#61afef',
      secondary: '#c678dd',
      success: '#98c379',
      error: '#e06c75',
      warning: '#e5c07b',
      info: '#56b6c2',
      muted: '#5c6370',
      background: '#282c34',
      foreground: '#abb2bf'
    },
    styles: {
      header: { color: '#61afef', bold: true },
      code: { background: '#3e4451' },
      quote: { color: '#5c6370', italic: true },
      link: { color: '#61afef', underline: true }
    }
  },
  
  light: {
    name: 'light',
    colors: {
      primary: '#4078f2',
      secondary: '#a626a4',
      success: '#50a14f',
      error: '#e45649',
      warning: '#986801',
      info: '#0184bc',
      muted: '#a0a1a7',
      background: '#fafafa',
      foreground: '#383a42'
    },
    styles: {
      header: { color: '#4078f2', bold: true },
      code: { background: '#f0f0f0' },
      quote: { color: '#a0a1a7', italic: true },
      link: { color: '#4078f2', underline: true }
    }
  }
};
```

### Custom Theme

```typescript
const myTheme: Theme = {
  name: 'my-theme',
  colors: {
    primary: '#ff6b6b',
    secondary: '#4ecdc4',
    success: '#95e1d3',
    error: '#f38181',
    warning: '#f8b500',
    info: '#3498db',
    muted: '#95a5a6',
    background: '#2c3e50',
    foreground: '#ecf0f1'
  },
  styles: {
    header: { color: '#ff6b6b', bold: true },
    code: { background: '#34495e' },
    quote: { color: '#95a5a6', italic: true },
    link: { color: '#4ecdc4', underline: true }
  }
};

ui.setTheme(myTheme);
```

## Accessibility

### Screen Reader Support

```typescript
class AccessibleUI extends TerminalUI {
  announce(message: string, priority?: 'polite' | 'assertive'): void {
    // Send to screen reader
    this.write(`\u001b[5i${message}\u001b[4i`);
  }
  
  describe(element: Component): string {
    // Generate accessible description
    return `${element.type}: ${element.description}`;
  }
}
```

### High Contrast Mode

```typescript
const highContrastTheme: Theme = {
  name: 'high-contrast',
  colors: {
    primary: '#ffffff',
    secondary: '#ffff00',
    success: '#00ff00',
    error: '#ff0000',
    warning: '#ffaa00',
    info: '#00ffff',
    muted: '#808080',
    background: '#000000',
    foreground: '#ffffff'
  },
  styles: {
    header: { color: '#ffffff', bold: true },
    code: { background: '#000000', color: '#ffffff' },
    quote: { color: '#ffff00' },
    link: { color: '#00ffff', underline: true }
  }
};
```

### Keyboard Navigation

```typescript
ui.on('key', (event) => {
  switch (event.key) {
    case 'tab':
      // Navigate to next element
      break;
    case 'escape':
      // Close modal/menu
      break;
    case 'f1':
      // Show help
      break;
  }
});
```

---

**UI API Quick Reference**

```
TerminalUI:
  initialize()
  write(text, options?)
  writeln(text?, options?)
  readLine(options?)
  clear()
  
Components:
  MessageComponent
  CodeBlockComponent
  DiffComponent
  ProgressComponent
  TreeComponent
  
Styling:
  chalk colors
  bold, italic, underline
  Style utilities
  
Input:
  readLine()
  readPassword()
  confirm()
  select()
  
Output:
  header()
  code()
  table()
  tree()
  json()
  
Theming:
  setTheme(theme)
  Built-in: dark, light
```
