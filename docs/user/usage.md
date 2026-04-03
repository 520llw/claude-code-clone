# Usage Guide

Complete guide to using Claude Code Clone effectively in your development workflow.

## Table of Contents

1. [Starting a Session](#starting-a-session)
2. [Basic Interaction](#basic-interaction)
3. [Working with Code](#working-with-code)
4. [File Operations](#file-operations)
5. [Running Commands](#running-commands)
6. [Search and Analysis](#search-and-analysis)
7. [Code Generation](#code-generation)
8. [Refactoring](#refactoring)
9. [Debugging](#debugging)
10. [Testing](#testing)
11. [Git Integration](#git-integration)
12. [Advanced Patterns](#advanced-patterns)
13. [Best Practices](#best-practices)

## Starting a Session

### Interactive Mode

The primary way to use Claude Code Clone is in interactive mode:

```bash
# Start in current directory
claude-code-clone

# Start in specific directory
claude-code-clone /path/to/project

# Start with specific configuration
claude-code-clone --config ~/.claude-code-clone/alternate-config.json
```

### Command Mode

Execute a single command and exit:

```bash
# Execute a single query
claude-code-clone --command "explain src/main.js"

# Execute with file context
claude-code-clone --command "review this code" --file src/main.js

# Execute with multiple files
claude-code-clone --command "compare these files" --file file1.js --file file2.js
```

### Batch Mode

Process multiple operations from a file:

```bash
claude-code-clone --batch operations.json
```

Example `operations.json`:
```json
{
  "operations": [
    {
      "type": "query",
      "content": "Explain the project structure"
    },
    {
      "type": "command",
      "content": "run npm test"
    },
    {
      "type": "edit",
      "file": "src/utils.js",
      "description": "Add error handling"
    }
  ]
}
```

### Daemon Mode

Run as a background service:

```bash
# Start daemon
claude-code-clone --daemon start

# Check status
claude-code-clone --daemon status

# Stop daemon
claude-code-clone --daemon stop
```

## Basic Interaction

### The Prompt

When you start Claude Code Clone, you'll see:

```
Welcome to Claude Code Clone v1.0.0
Project: my-project (Node.js)
Type 'help' for available commands or start chatting!

> 
```

The `>` is your prompt. Type your requests here.

### Types of Input

#### Natural Language Queries

Ask questions in plain English:

```
> What does this project do?
> Explain the authentication flow
> How do I add a new API endpoint?
```

#### Commands

Use slash commands for specific actions:

```
> /help              # Show help
> /clear             # Clear history
> /save my-session   # Save session
> /load my-session   # Load session
> /config            # Show configuration
> /exit              # Exit
```

#### File References

Reference files using special syntax:

```
> Explain @src/main.js
> Review @src/utils.js and @src/helpers.js
> Compare @file1.js with @file2.js
> Fix the bug in @src/auth.js line 45
```

#### Code Blocks

Share code directly:

```
> What do you think of this code?
> ```javascript
> function add(a, b) {
>   return a + b;
> }
> ```
```

### Getting Help

```
> help                    # General help
> /help commands          # Command reference
> /help tools             # Tool reference
> /help shortcuts         # Keyboard shortcuts
> /help examples          # Usage examples
```

## Working with Code

### Understanding Code

#### Code Explanation

```
> Explain the function in src/utils.js
> What does the AuthMiddleware class do?
> Explain how the database connection works
```

The AI will:
1. Read the relevant files
2. Analyze the code structure
3. Provide a detailed explanation
4. Highlight key concepts

#### Architecture Overview

```
> Give me an overview of this project's architecture
> What are the main components?
> Show me the data flow
```

#### Code Review

```
> Review src/auth.js for security issues
> Check src/api.js for best practices
> Review this code for performance
```

### Navigating Code

#### Finding Code

```
> Find all functions that use the database
> Where is the User model defined?
> Show me all API endpoints
> Find files that import axios
```

#### Understanding Relationships

```
> What files import UserService?
> Show me the call hierarchy for login()
> What depends on the config module?
```

## File Operations

### Reading Files

```
> Show me src/config.js
> Read the README.md file
> Display package.json
```

### Creating Files

```
> Create a new file src/utils/validator.js
> Generate a React component in components/Button.jsx
> Create a test file for src/auth.js
```

You can also provide specifications:

```
> Create a utility function in src/utils/date.js that:
> - Formats dates in ISO 8601
> - Handles timezone conversion
> - Includes unit tests
```

### Editing Files

#### Simple Edits

```
> Add a comment explaining this function
> Fix the typo in line 23
> Update the error message in src/errors.js
```

#### Complex Edits

```
> Refactor src/auth.js to use async/await
> Add input validation to all API endpoints
> Convert callbacks to promises in src/db.js
```

#### Multi-file Edits

```
> Rename User class to Customer across the project
> Update all imports when moving utils.js to helpers/
> Add logging to all error handlers
```

### File Management

```
> List all JavaScript files in src/
> Show me files modified in the last week
> Find files larger than 100KB
> Show me the project structure
```

## Running Commands

### Shell Commands

Execute shell commands directly:

```
> Run npm install
> Execute python manage.py migrate
> Run git status
> Execute make build
```

### npm/yarn Commands

```
> Run npm test
> Execute npm run build
> Run yarn lint
> Execute npm outdated
```

### Git Commands

```
> Run git log --oneline -10
> Execute git diff
> Run git branch -a
> Show me the last commit message
```

### Test Commands

```
> Run the tests
> Execute npm test -- --coverage
> Run pytest with verbose output
> Execute jest --watch
```

### Custom Commands

```
> Run my-custom-script.sh
> Execute docker-compose up -d
> Run kubectl get pods
```

### Command Output

Command output is displayed in the chat:

```
> Run npm test

Running: npm test

> my-project@1.0.0 test
> jest

 PASS  src/utils.test.js
 PASS  src/auth.test.js

Test Suites: 2 passed, 2 total
Tests:       15 passed, 15 total
```

## Search and Analysis

### Code Search

#### Text Search

```
> Search for "TODO" in the codebase
> Find all occurrences of "deprecated"
> Search for console.log statements
```

#### Pattern Search

```
> Find all async functions
> Search for functions that return promises
> Find all React components
> Search for class definitions
```

#### Regex Search

```
> Search for /function\s+\w+\s*\(/ pattern
> Find all imports from 'react'
> Search for variable declarations with const
```

### Code Analysis

#### Complexity Analysis

```
> Analyze the complexity of src/utils.js
> Find the most complex functions
> Show me code that needs refactoring
```

#### Dependency Analysis

```
> What are the project dependencies?
> Show me unused dependencies
> Find circular dependencies
> Analyze import patterns
```

#### Security Analysis

```
> Check for security vulnerabilities
> Find potential SQL injection points
> Analyze authentication code
> Check for hardcoded secrets
```

## Code Generation

### Function Generation

```
> Create a function to validate email addresses
> Generate a password hashing function
> Write a function to parse CSV data
```

### Class Generation

```
> Create a User class with authentication methods
> Generate a Database connection class
> Write an EventEmitter class
```

### Component Generation

```
> Create a React login form component
> Generate a Vue navbar component
> Write an Angular service for API calls
```

### Test Generation

```
> Generate unit tests for src/utils.js
> Create integration tests for the API
> Write tests for the auth middleware
```

### Documentation Generation

```
> Generate JSDoc comments for src/api.js
> Create API documentation
> Write a README for this module
```

### Boilerplate Generation

```
> Generate a new Express route file
> Create a React component boilerplate
> Generate a Python Flask endpoint
```

## Refactoring

### Code Restructuring

```
> Extract this logic into a separate function
> Move these utilities to a shared module
> Split this large file into smaller modules
```

### Modernization

```
> Convert callbacks to async/await
> Replace var with const/let
> Update to modern JavaScript syntax
> Convert to TypeScript
```

### Optimization

```
> Optimize this function for performance
> Reduce the complexity of this code
> Improve the memory usage
> Make this code more efficient
```

### Cleanup

```
> Remove unused imports
> Delete dead code
> Fix code style issues
> Organize imports
```

### Renaming

```
> Rename variable 'x' to 'userCount'
> Rename function 'doStuff' to 'processUserData'
> Rename class 'OldName' to 'NewName' everywhere
```

## Debugging

### Error Analysis

```
> I got this error: [paste error]
> Why is this test failing?
> Analyze this stack trace
```

### Log Analysis

```
> Analyze these logs for errors
> Find patterns in the log file
> Explain this warning message
```

### Debugging Strategies

```
> Help me debug this issue
> Suggest ways to troubleshoot this problem
> What could cause this error?
```

### Adding Debug Code

```
> Add logging to trace this issue
> Insert console.log statements for debugging
> Add error handling with detailed messages
```

## Testing

### Running Tests

```
> Run all tests
> Run tests for src/utils.js only
> Execute tests with coverage
> Run tests in watch mode
```

### Test Analysis

```
> Why is this test failing?
> Analyze test coverage
> Find untested code
> Suggest tests to add
```

### Test Creation

```
> Create a test for this function
> Generate test cases for edge cases
> Write integration tests
> Add performance tests
```

### Mocking

```
> Create mocks for external dependencies
> Mock the database for testing
> Set up test fixtures
```

## Git Integration

### Repository Information

```
> Show me the git status
> What branch am I on?
> Show recent commits
> Who last modified this file?
```

### Committing Changes

```
> Commit these changes with message "Add user authentication"
> Stage all changes and commit
> Create a commit with a detailed message
```

### Branching

```
> Create a new branch for this feature
> Switch to the develop branch
> Merge main into this branch
```

### Diff and Review

```
> Show me what changed
> Review the diff before committing
> Compare this file with main
```

## Advanced Patterns

### Multi-step Operations

Chain multiple operations together:

```
> 1. Find all files that import axios
> 2. Add error handling to each
> 3. Run the tests to verify
```

### Conditional Operations

```
> If the tests pass, commit the changes
> Check if there are any linting errors before committing
```

### Template Operations

Create reusable patterns:

```
> Create a new API endpoint following the existing pattern
> Generate a component following the project conventions
> Add a new route following the current structure
```

### Context-Aware Operations

```
> Based on the project structure, suggest improvements
> Considering this is a React project, generate appropriate code
> Following the existing patterns, add a new feature
```

### Iterative Refinement

```
> Generate initial implementation
> Review and suggest improvements
> Apply the improvements
> Add tests
> Final review
```

## Best Practices

### Effective Communication

#### Be Specific

```
# Good
> Add input validation to the login function in src/auth.js

# Vague
> Fix the login
```

#### Provide Context

```
# Good
> I'm getting this error when running npm test: [error]
> The error occurs in src/utils.js line 45

# Vague
> Tests are failing
```

#### Reference Files

```
# Good
> Review @src/auth.js for security issues

# Less effective
> Review the auth file
```

### Workflow Patterns

#### Feature Development Workflow

```
1. Describe the feature requirements
2. Ask for implementation suggestions
3. Generate code incrementally
4. Review and refine
5. Add tests
6. Final verification
```

#### Bug Fix Workflow

```
1. Describe the bug with error messages
2. Share relevant code
3. Ask for root cause analysis
4. Implement the fix
5. Verify the fix
6. Add regression test
```

#### Code Review Workflow

```
1. Share the code to review
2. Ask for specific feedback (security, performance, style)
3. Discuss findings
4. Create action items
5. Implement changes
6. Re-review
```

### Safety Practices

#### Review Before Applying

Always review AI-generated changes:

```
> Show me the changes before applying
> Let me review the diff first
> Explain what changes will be made
```

#### Save Sessions

Save important work:

```
> /save before-refactoring
> /save after-feature-implementation
```

#### Test After Changes

```
> Run tests after applying changes
> Verify the changes work correctly
> Check for any regressions
```

### Performance Tips

#### Use Context Efficiently

```
# Good - specific context
> Explain the function in src/utils.js

# Less efficient - too broad
> Explain everything
```

#### Batch Related Operations

```
# Good - single comprehensive request
> Review src/auth.js, src/user.js, and src/session.js for security issues

# Less efficient - multiple separate requests
> Review src/auth.js
> Review src/user.js
> Review src/session.js
```

#### Leverage Previous Context

```
# Context from previous messages is maintained
> Now add error handling to that function
> Also update the tests
```

### Common Patterns

#### Pattern 1: Code Exploration

```
> What files are in this project?
> Explain the main entry point
> Show me the project structure
> Find the authentication code
```

#### Pattern 2: Feature Implementation

```
> I need to add user registration
> What files need to be modified?
> Generate the registration endpoint
> Add validation
> Create tests
> Run the tests
```

#### Pattern 3: Refactoring

```
> This code needs refactoring
> Analyze the current implementation
> Suggest improvements
> Apply the refactoring
> Verify nothing broke
```

#### Pattern 4: Debugging

```
> I'm seeing this error: [error]
> Show me the relevant code
> Analyze the issue
> Suggest a fix
> Apply the fix
> Verify it works
```

### Tips for Success

1. **Start Simple**: Begin with straightforward requests
2. **Build Up**: Gradually increase complexity
3. **Iterate**: Refine requests based on results
4. **Be Patient**: Complex operations take time
5. **Save Often**: Save sessions at important points
6. **Test Always**: Verify changes work correctly
7. **Review Everything**: Check AI-generated code
8. **Learn Patterns**: Notice what works well
9. **Provide Feedback**: Help the AI learn your preferences
10. **Stay Organized**: Keep related work in sessions

---

**Usage Quick Reference**

```
Start:              claude-code-clone
Single command:     claude-code-clone -c "query"
Batch mode:         claude-code-clone --batch ops.json

File reference:     @path/to/file.js
Multiple files:     @file1.js @file2.js
Line reference:     @file.js:45

Commands:
/help               Show help
/clear              Clear history
/save <name>        Save session
/load <name>        Load session
/config             Show config
/exit               Exit
```
