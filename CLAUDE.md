# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Install dependencies (Bun preferred)
bun install

# Build
bun run build                    # Development build (esbuild)
npm run build:prod               # Production build (minified, NODE_ENV=production)

# Type check / Lint
npm run typecheck                # tsc --noEmit
npm run lint                     # ESLint on src/
npm run lint:fix                 # ESLint with auto-fix

# Run
bun run dev                      # Development mode with hot reload
bun run start                    # Run the CLI
```

## Test Commands

```bash
npm run test                     # All tests with coverage (Jest)
npx jest path/to/file.test.ts    # Single test file
npx jest --watch                 # Watch mode
npm run test:e2e                 # E2E tests (tests/e2e/)
npm run test:integration         # Integration tests (tests/integration/)
npm run test:perf                # Performance tests (tests/performance/)
```

Coverage thresholds: 70% lines/functions/statements, 60% branches.

## Architecture

TypeScript CLI app using React + Ink for terminal UI, Anthropic SDK for LLM calls, esbuild for bundling. Entry point: `src/cli.tsx`.

### Layer Structure

- **CLI Layer**: Terminal UI (`src/ui/`), command parsing (`src/commands/`), config loading (`src/config/`)
- **Application Layer**: SessionManager (`src/core/SessionManager.ts`), AgentLoop (`src/core/AgentLoop.ts`) - orchestrates parent/sub-agents
- **Core Services**: QueryEngine (`src/core/QueryEngine.ts`), ToolRegistry (`src/tools/`), ContextManager (`src/core/ContextManager.ts`), PermissionManager (`src/core/PermissionManager.ts`), PluginManager (`src/plugins/`), SkillManager (`src/skills/`)
- **Infrastructure**: Anthropic SDK wrapper (`src/lib/anthropic.ts`), telemetry (`src/telemetry/`), MCP client (`src/mcp/`)

### Key Subsystems

**Tool System**: Tools live in `src/tools/implementations/<category>/` (file, search, execution, agent, code-intelligence, web, memory, ide, lsp). Each extends `BaseTool` from `src/core/base-classes.ts`, implements `ITool` from `src/core/interfaces.ts`, and uses Zod for parameter validation. Register new tools in `src/tools/implementations/index.ts`.

**Agent System**: Multi-agent orchestration with parent agent delegating to specialized sub-agents. Agent strategies in `src/agent/strategies/` (planning, execution, delegation).

**Context Compression**: Three-layer system in `src/context/compression/` - MicroCompact (lightweight), AutoCompact (balanced), FullCompact (aggressive). Triggered when context approaches token limits.

**Plugin System**: Plugins extend `BasePlugin`, declare a manifest with hooks/tools/commands. Hook points: `before:tool:execute`, `after:tool:execute`, `before:message:send`, `after:message:receive`, `on:session:start`, `on:session:end`.

**Commands**: Slash commands in `src/commands/<category>/` extend `BaseCommand`. Register in `src/commands/index.ts`.

## Code Conventions

- **Strict TypeScript**: All strict options enabled, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`
- **Naming**: PascalCase files for classes, camelCase for utilities. Interfaces prefixed with `I` (e.g., `IAgent`, `ITool`). Private members prefixed with underscore.
- **Formatting**: Prettier - single quotes, trailing commas (es5), 100 char width, 2-space indent
- **ESLint**: No floating promises (`@typescript-eslint/no-floating-promises: error`). Unused vars must start with `_`. No explicit `any` (warn level).
- **Validation**: All external inputs use Zod schemas
- **Import order**: Node builtins > external deps > internal aliases (`@types/`, `@core/`, `@utils/`) > relative imports

## Test Conventions

- Jest with `@jest/globals` imports. Test setup in `tests/setup.ts`.
- Mocks: `global.mockFS` for filesystem, `MockLLM` for LLM client, `MockTools` for tools.
- Tests mirror source structure under `tests/unit/`, `tests/integration/`, `tests/e2e/`.

## Configuration Hierarchy (highest to lowest)

CLI args > env vars > project config (`.claude-code/config.yaml`) > global config (`~/.config/claude-code/config.yaml`) > defaults.

Key env vars: `CLAUDE_API_KEY`, `CLAUDE_MODEL`, `CLAUDE_MAX_TOKENS`, `CLAUDE_TEMPERATURE`.

## Debugging

Enable with `claude-code --debug` or `DEBUG=1`. Logs at `~/.claude-code/logs/`. Debug commands: `/debug:log`, `/debug:context`, `/debug:tokens`, `/debug:tools`.
