# Command Reference

Complete reference for all commands available in Claude Code Clone.

## Table of Contents

1. [Command Overview](#command-overview)
2. [Session Commands](#session-commands)
3. [Configuration Commands](#configuration-commands)
4. [File Commands](#file-commands)
5. [Code Commands](#code-commands)
6. [Tool Commands](#tool-commands)
7. [Git Commands](#git-commands)
8. [Utility Commands](#utility-commands)
9. [Debug Commands](#debug-commands)
10. [Command Aliases](#command-aliases)

## Command Overview

Commands in Claude Code Clone are prefixed with `/` and provide quick access to common operations.

### Command Syntax

```
/<command> [subcommand] [arguments] [options]
```

### Getting Help

```
> /help           # Show all commands
> /help <command> # Show help for specific command
> /help examples  # Show usage examples
```

## Session Commands

### /start

Start a new session.

```
Usage: /start [options]

Options:
  --name, -n <name>     Session name
  --project, -p <path>  Project directory
  --config, -c <path>   Config file path

Examples:
  > /start
  > /start --name feature-x
  > /start --project /path/to/project
```

### /save

Save the current session.

```
Usage: /save <name> [options]

Options:
  --description, -d <desc>  Session description
  --tags, -t <tags>         Comma-separated tags

Examples:
  > /save my-session
  > /save before-refactor --description "Before major refactoring"
  > /save feature-x --tags "feature,auth"
```

### /load

Load a saved session.

```
Usage: /load <name> [options]

Options:
  --merge, -m          Merge with current session

Examples:
  > /load my-session
  > /load feature-x --merge
```

### /list

List saved sessions.

```
Usage: /list [options]

Options:
  --all, -a            Show all sessions
  --tags, -t <tags>    Filter by tags
  --search, -s <query> Search sessions

Examples:
  > /list
  > /list --all
  > /list --tags "feature"
  > /list --search "auth"
```

### /delete

Delete a saved session.

```
Usage: /delete <name> [options]

Options:
  --force, -f          Skip confirmation

Examples:
  > /delete old-session
  > /delete temp-session --force
```

### /clear

Clear the conversation history.

```
Usage: /clear [options]

Options:
  --all, -a            Clear everything including context

Examples:
  > /clear
  > /clear --all
```

### /history

Show conversation history.

```
Usage: /history [options]

Options:
  --limit, -l <n>      Show last n messages
  --search, -s <query> Search history

Examples:
  > /history
  > /history --limit 10
  > /history --search "function"
```

### /undo

Undo the last operation.

```
Usage: /undo [options]

Options:
  --steps, -s <n>      Undo n steps (default: 1)
  --all, -a            Undo all changes in session

Examples:
  > /undo
  > /undo --steps 3
  > /undo --all
```

### /redo

Redo a previously undone operation.

```
Usage: /redo [options]

Options:
  --steps, -s <n>      Redo n steps (default: 1)

Examples:
  > /redo
  > /redo --steps 2
```

### /exit

Exit the session.

```
Usage: /exit [options]

Options:
  --save, -s <name>    Save before exiting

Examples:
  > /exit
  > /exit --save current-work
```

## Configuration Commands

### /config

Manage configuration settings.

```
Usage: /config [command] [options]

Commands:
  get <key>            Get configuration value
  set <key> <value>    Set configuration value
  delete <key>         Delete configuration value
  list                 List all configuration
  init                 Initialize configuration
  validate             Validate configuration
  reset                Reset to defaults

Options:
  --global, -g         Use global configuration
  --local, -l          Use local/project configuration
  --session, -s        Use session-only configuration

Examples:
  > /config get api.model
  > /config set ui.theme dark
  > /config set --session api.model claude-3-sonnet
  > /config list
  > /config validate
```

### /theme

Change the UI theme.

```
Usage: /theme [theme]

Themes:
  dark                 Dark theme (default)
  light                Light theme
  high-contrast        High contrast theme
  auto                 Follow system preference

Examples:
  > /theme
  > /theme light
  > /theme dark
```

### /model

Change the AI model.

```
Usage: /model [model]

Models:
  claude-3-opus        Claude 3 Opus (most capable)
  claude-3-sonnet      Claude 3 Sonnet (balanced)
  claude-3-haiku       Claude 3 Haiku (fastest)

Examples:
  > /model
  > /model claude-3-opus
```

## File Commands

### /open

Open a file in the editor.

```
Usage: /open <file> [options]

Options:
  --line, -l <n>       Open at specific line
  --editor, -e <name>  Use specific editor

Examples:
  > /open src/main.js
  > /open src/main.js --line 45
  > /open src/main.js --editor vim
```

### /read

Read a file's contents.

```
Usage: /read <file> [options]

Options:
  --lines, -l <range>  Read specific lines (e.g., 1-50)
  --offset, -o <n>     Start at line offset
  --limit, -n <n>      Maximum lines to read

Examples:
  > /read src/main.js
  > /read src/main.js --lines 1-50
  > /read src/main.js --offset 100 --limit 50
```

### /write

Write content to a file.

```
Usage: /write <file> [options]

Options:
  --append, -a         Append instead of overwrite
  --backup, -b         Create backup
  --force, -f          Skip confirmation

Examples:
  > /write config.json {"key": "value"}
  > /write log.txt "Message" --append
```

### /edit

Edit a file.

```
Usage: /edit <file> <instruction>

Options:
  --backup, -b         Create backup
  --preview, -p        Show preview before applying

Examples:
  > /edit src/main.js "Add error handling"
  > /edit src/utils.js "Refactor to use async/await" --preview
```

### /create

Create a new file.

```
Usage: /create <file> [options]

Options:
  --template, -t <name>  Use template
  --from, -f <file>      Copy from existing file

Examples:
  > /create src/new-module.js
  > /create src/component.jsx --template react-component
  > /create src/utils.js --from src/template.js
```

### /delete-file

Delete a file.

```
Usage: /delete-file <file> [options]

Options:
  --force, -f          Skip confirmation
  --backup, -b         Move to backup instead

Examples:
  > /delete-file old-file.js
  > /delete-file temp.js --force
```

### /rename

Rename a file.

```
Usage: /rename <old> <new> [options]

Options:
  --update-imports, -u  Update import statements

Examples:
  > /rename old.js new.js
  > /rename utils.js helpers.js --update-imports
```

### /find

Find files matching a pattern.

```
Usage: /find <pattern> [options]

Options:
  --type, -t <type>    File type (f=file, d=directory)
  --exclude, -e <pattern>  Exclude pattern
  --max-depth, -d <n>  Maximum depth

Examples:
  > /find "*.js"
  > /find "*.test.js" --exclude node_modules
  > /find "src" --type d
```

### /tree

Show directory tree.

```
Usage: /tree [path] [options]

Options:
  --depth, -d <n>      Maximum depth
  --exclude, -e <pattern>  Exclude pattern
  --files-only, -f     Show files only

Examples:
  > /tree
  > /tree src --depth 3
  > /tree --exclude node_modules
```

## Code Commands

### /explain

Explain code.

```
Usage: /explain [target] [options]

Options:
  --detail, -d <level> Detail level (brief/normal/detailed)
  --focus, -f <aspect> Focus aspect (logic/structure/performance)

Examples:
  > /explain
  > /explain src/main.js
  > /explain @function --detail detailed
```

### /review

Review code.

```
Usage: /review [target] [options]

Options:
  --type, -t <type>    Review type (security/performance/style/all)
  --strict, -s         Strict review

Examples:
  > /review src/auth.js
  > /review --type security
  > /review src/utils.js --strict
```

### /refactor

Refactor code.

```
Usage: /refactor [target] <instruction> [options]

Options:
  --preview, -p        Show preview
  --test, -t           Run tests after

Examples:
  > /refactor src/old.js "Convert to modern JS"
  > /refactor "Extract common logic" --preview
```

### /generate

Generate code.

```
Usage: /generate <description> [options]

Options:
  --output, -o <file>  Output file
  --template, -t <name>  Use template
  --test, -t           Generate tests too

Examples:
  > /generate "function to parse CSV"
  > /generate "React login component" --output components/Login.jsx
  > /generate "API endpoint for users" --test
```

### /test

Run tests.

```
Usage: /test [target] [options]

Options:
  --coverage, -c       Show coverage
  --watch, -w          Watch mode
  --pattern, -p <pattern>  Test pattern

Examples:
  > /test
  > /test src/utils.js
  > /test --coverage
  > /test --watch
```

### /lint

Run linter.

```
Usage: /lint [target] [options]

Options:
  --fix, -f            Auto-fix issues
  --format, -fmt <name>  Output format

Examples:
  > /lint
  > /lint src/
  > /lint --fix
```

### /format

Format code.

```
Usage: /format [target] [options]

Options:
  --check, -c          Check only (don't format)
  --write, -w          Write changes

Examples:
  > /format
  > /format src/main.js
  > /format --check
```

### /typecheck

Run type checker.

```
Usage: /typecheck [target] [options]

Options:
  --strict, -s         Strict mode
  --watch, -w          Watch mode

Examples:
  > /typecheck
  > /typecheck src/
  > /typecheck --strict
```

## Tool Commands

### /tools

Manage tools.

```
Usage: /tools [command] [options]

Commands:
  list                 List available tools
  enable <tool>        Enable a tool
  disable <tool>       Disable a tool
  info <tool>          Show tool information

Examples:
  > /tools list
  > /tools enable browser
  > /tools disable shell
  > /tools info file
```

### /run

Run a tool.

```
Usage: /run <tool> [arguments]

Examples:
  > /run shell "npm test"
  > /run search "TODO" --type regex
```

### /shell

Execute a shell command.

```
Usage: /shell <command> [options]

Options:
  --cwd <path>         Working directory
  --timeout <ms>       Timeout in milliseconds
  --env <vars>         Environment variables

Examples:
  > /shell "npm install"
  > /shell "ls -la" --cwd src/
  > /shell "NODE_ENV=test npm test"
```

### /search

Search in codebase.

```
Usage: /search <query> [options]

Options:
  --type, -t <type>    Search type (text/regex/ast)
  --files, -f <pattern>  File pattern
  --context, -c <n>    Lines of context

Examples:
  > /search "function"
  > /search "/TODO.*/" --type regex
  > /search "console.log" --files "*.js"
```

### /browser

Browser operations.

```
Usage: /browser <url> [command] [options]

Commands:
  visit                Visit URL
  screenshot           Take screenshot
  find                 Find element
  click                Click element

Options:
  --wait <ms>          Wait time
  --viewport <size>    Viewport size

Examples:
  > /browser https://example.com visit
  > /browser https://example.com screenshot
  > /browser https://example.com find "button"
```

## Git Commands

### /git

Git operations.

```
Usage: /git <command> [arguments] [options]

Commands:
  status               Show status
  log                  Show log
  diff                 Show diff
  add                  Stage files
  commit               Commit changes
  push                 Push to remote
  pull                 Pull from remote
  branch               Branch operations
  checkout             Checkout branch/file
  merge                Merge branch
  stash                Stash operations

Examples:
  > /git status
  > /git log --oneline -10
  > /git diff
  > /git add .
  > /git commit -m "Message"
```

### /status

Show git status.

```
Usage: /status [options]

Options:
  --short, -s          Short format

Examples:
  > /status
  > /status --short
```

### /commit

Commit changes.

```
Usage: /commit [message] [options]

Options:
  --all, -a            Stage all changes
  --amend              Amend last commit
  --no-verify          Skip hooks

Examples:
  > /commit "Add new feature"
  > /commit --all
  > /commit --amend
```

### /branch

Branch operations.

```
Usage: /branch [command] [name] [options]

Commands:
  list                 List branches
  create               Create branch
  delete               Delete branch
  switch               Switch branch

Options:
  --remote, -r         Include remote branches

Examples:
  > /branch list
  > /branch create feature-x
  > /branch delete old-branch
  > /branch switch main
```

## Utility Commands

### /help

Show help information.

```
Usage: /help [topic] [options]

Topics:
  commands             Command reference
  tools                Tool reference
  shortcuts            Keyboard shortcuts
  examples             Usage examples
  patterns             Common patterns

Options:
  --verbose, -v        Detailed help

Examples:
  > /help
  > /help commands
  > /help tools
  > /help shortcuts
```

### /info

Show system information.

```
Usage: /info [topic]

Topics:
  system               System information
  config               Configuration
  project              Project information
  version              Version information

Examples:
  > /info
  > /info system
  > /info config
```

### /stats

Show statistics.

```
Usage: /stats [topic] [options]

Topics:
  session              Session statistics
  project              Project statistics
  usage                Usage statistics

Options:
  --format, -f <format>  Output format

Examples:
  > /stats
  > /stats session
  > /stats project
```

### /export

Export data.

```
Usage: /export <target> [options]

Targets:
  session              Export session
  history              Export history
  config               Export configuration

Options:
  --format, -f <format>  Output format (json/md/txt)
  --output, -o <file>    Output file

Examples:
  > /export session
  > /export history --format json
  > /export config --output config-backup.json
```

### /import

Import data.

```
Usage: /import <source> [options]

Sources:
  session              Import session
  config               Import configuration

Options:
  --merge, -m          Merge with existing
  --force, -f          Overwrite existing

Examples:
  > /import session.json
  > /import config.json --merge
```

## Debug Commands

### /debug

Debug operations.

```
Usage: /debug [command] [options]

Commands:
  context              Show current context
  tools                Show tool status
  tokens               Show token usage
  memory               Show memory usage

Examples:
  > /debug context
  > /debug tools
  > /debug tokens
```

### /doctor

Run diagnostics.

```
Usage: /doctor [options]

Options:
  --fix, -f            Fix issues automatically

Examples:
  > /doctor
  > /doctor --fix
```

### /logs

View logs.

```
Usage: /logs [options]

Options:
  --level, -l <level>  Log level filter
  --lines, -n <n>      Number of lines
  --follow, -f         Follow log output

Examples:
  > /logs
  > /logs --level error
  > /logs --lines 100
  > /logs --follow
```

## Command Aliases

### Built-in Aliases

| Alias | Command | Description |
|-------|---------|-------------|
| `h` | `/help` | Show help |
| `q` | `/exit` | Exit |
| `c` | `/clear` | Clear history |
| `s` | `/save` | Save session |
| `l` | `/load` | Load session |
| `o` | `/open` | Open file |
| `r` | `/read` | Read file |
| `e` | `/edit` | Edit file |
| `g` | `/git` | Git command |
| `t` | `/test` | Run tests |

### Custom Aliases

Create your own aliases in configuration:

```json
{
  "aliases": {
    "deploy": "shell 'npm run deploy'",
    "lintfix": "lint --fix",
    "start": "shell 'npm start'"
  }
}
```

Usage:
```
> /deploy
> /lintfix
> /start
```

---

**Command Quick Reference**

```
Session:
/start, /save, /load, /list, /delete, /clear, /history, /undo, /redo, /exit

Config:
/config, /theme, /model

File:
/open, /read, /write, /edit, /create, /delete-file, /rename, /find, /tree

Code:
/explain, /review, /refactor, /generate, /test, /lint, /format, /typecheck

Tools:
/tools, /run, /shell, /search, /browser

Git:
/git, /status, /commit, /branch

Utility:
/help, /info, /stats, /export, /import

Debug:
/debug, /doctor, /logs
```
