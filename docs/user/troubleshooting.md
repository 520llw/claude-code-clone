# Troubleshooting Guide

Common issues and solutions for Claude Code Clone.

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [Configuration Issues](#configuration-issues)
3. [API Connection Issues](#api-connection-issues)
4. [Performance Issues](#performance-issues)
5. [Tool Issues](#tool-issues)
6. [Session Issues](#session-issues)
7. [Display Issues](#display-issues)
8. [Error Messages](#error-messages)
9. [Diagnostic Commands](#diagnostic-commands)
10. [Getting Help](#getting-help)

## Installation Issues

### npm install fails

**Symptom:**
```
npm ERR! code EACCES
npm ERR! syscall mkdir
```

**Solutions:**

1. **Fix npm permissions:**
   ```bash
   sudo chown -R $(whoami) $(npm config get prefix)/{lib/node_modules,bin,share}
   ```

2. **Use npx instead:**
   ```bash
   npx claude-code-clone
   ```

3. **Change npm prefix:**
   ```bash
   mkdir ~/.npm-global
   npm config set prefix '~/.npm-global'
   echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
   source ~/.bashrc
   npm install -g claude-code-clone
   ```

### Command not found

**Symptom:**
```
claude-code-clone: command not found
```

**Solutions:**

1. **Check PATH:**
   ```bash
   echo $PATH
   which node
   npm bin -g
   ```

2. **Add to PATH:**
   ```bash
   export PATH="$(npm bin -g):$PATH"
   ```

3. **Reinstall:**
   ```bash
   npm uninstall -g claude-code-clone
   npm install -g claude-code-clone
   ```

### Node.js version too old

**Symptom:**
```
Error: Claude Code Clone requires Node.js 18.0 or higher
```

**Solutions:**

1. **Check version:**
   ```bash
   node --version
   ```

2. **Update Node.js:**
   ```bash
   # Using nvm
   nvm install 18
   nvm use 18
   
   # Using Homebrew (macOS)
   brew upgrade node
   
   # Using apt (Ubuntu)
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

### Permission denied on macOS

**Symptom:**
```
EACCES: permission denied
```

**Solutions:**

1. **Fix permissions:**
   ```bash
   sudo chown -R $(whoami) /usr/local/lib/node_modules
   ```

2. **Remove quarantine:**
   ```bash
   xattr -dr com.apple.quarantine $(which claude-code-clone)
   ```

## Configuration Issues

### API key not configured

**Symptom:**
```
Error: API key not configured
```

**Solutions:**

1. **Set API key:**
   ```bash
   claude-code-clone config set api.key YOUR_API_KEY
   ```

2. **Use environment variable:**
   ```bash
   export ANTHROPIC_API_KEY="YOUR_API_KEY"
   ```

3. **Verify configuration:**
   ```bash
   claude-code-clone config get api.key
   ```

### Configuration file not found

**Symptom:**
```
Error: Configuration file not found
```

**Solutions:**

1. **Initialize configuration:**
   ```bash
   claude-code-clone config --init
   ```

2. **Create manually:**
   ```bash
   mkdir -p ~/.claude-code-clone
   echo '{"api":{"key":"YOUR_KEY"}}' > ~/.claude-code-clone/config.json
   ```

### Invalid configuration

**Symptom:**
```
Error: Invalid configuration: api.model is required
```

**Solutions:**

1. **Validate configuration:**
   ```bash
   claude-code-clone config --validate
   ```

2. **Reset to defaults:**
   ```bash
   claude-code-clone config --reset
   ```

3. **Fix specific issue:**
   ```bash
   claude-code-clone config set api.model claude-3-opus
   ```

## API Connection Issues

### Unable to connect to API

**Symptom:**
```
Error: Unable to connect to API
Error: Network timeout
```

**Solutions:**

1. **Check internet connection:**
   ```bash
   ping api.anthropic.com
   ```

2. **Check API status:**
   Visit https://status.anthropic.com/

3. **Verify API key:**
   ```bash
   claude-code-clone test-api
   ```

4. **Check proxy settings:**
   ```bash
   export HTTP_PROXY="http://proxy.company.com:8080"
   export HTTPS_PROXY="http://proxy.company.com:8080"
   ```

### API rate limit exceeded

**Symptom:**
```
Error: Rate limit exceeded
Error: 429 Too Many Requests
```

**Solutions:**

1. **Wait and retry:**
   Rate limits reset after a period of time.

2. **Check rate limit status:**
   ```bash
   claude-code-clone api-status
   ```

3. **Reduce request frequency:**
   - Batch operations when possible
   - Use smaller context windows
   - Enable response caching

4. **Upgrade plan:**
   Consider upgrading your API plan for higher limits.

### Invalid API key

**Symptom:**
```
Error: Invalid API key
Error: 401 Unauthorized
```

**Solutions:**

1. **Verify API key:**
   ```bash
   claude-code-clone config get api.key
   ```

2. **Regenerate API key:**
   - Visit https://console.anthropic.com/
   - Generate a new API key
   - Update configuration

3. **Check key format:**
   Anthropic keys start with `sk-ant-`

### API timeout

**Symptom:**
```
Error: Request timeout
Error: ETIMEDOUT
```

**Solutions:**

1. **Increase timeout:**
   ```bash
   claude-code-clone config set api.timeout 120000
   ```

2. **Use faster model:**
   ```bash
   claude-code-clone config set api.model claude-3-haiku
   ```

3. **Reduce context size:**
   ```bash
   claude-code-clone config set api.context.max_files 20
   ```

## Performance Issues

### Slow response times

**Symptom:**
AI responses take a long time.

**Solutions:**

1. **Use faster model:**
   ```bash
   claude-code-clone config set api.model claude-3-haiku
   ```

2. **Reduce context:**
   ```bash
   claude-code-clone config set api.context.max_files 20
   claude-code-clone config set api.context.max_tokens 50000
   ```

3. **Enable caching:**
   ```bash
   claude-code-clone config set performance.cache_enabled true
   ```

4. **Check network:**
   ```bash
   ping api.anthropic.com
   ```

### High memory usage

**Symptom:**
System running out of memory.

**Solutions:**

1. **Clear cache:**
   ```bash
   claude-code-clone cache clear
   ```

2. **Reduce cache size:**
   ```bash
   claude-code-clone config set performance.cache_size 50mb
   ```

3. **Close unused sessions:**
   ```bash
   claude-code-clone sessions list
   claude-code-clone sessions close <id>
   ```

4. **Limit context history:**
   ```bash
   claude-code-clone config set ui.history_size 500
   ```

### Slow startup

**Symptom:**
Application takes a long time to start.

**Solutions:**

1. **Disable unnecessary tools:**
   ```bash
   claude-code-clone tools disable browser
   ```

2. **Clear logs:**
   ```bash
   rm -rf ~/.claude-code-clone/logs/*
   ```

3. **Check disk space:**
   ```bash
   df -h
   ```

## Tool Issues

### File tool errors

**Symptom:**
```
Error: File not found
Error: Permission denied
Error: File too large
```

**Solutions:**

1. **Check file path:**
   ```bash
   ls -la /path/to/file
   ```

2. **Check permissions:**
   ```bash
   chmod 644 /path/to/file
   ```

3. **Increase file size limit:**
   ```bash
   claude-code-clone config set tools.file.max_size 2097152
   ```

4. **Check excluded paths:**
   ```bash
   claude-code-clone config get tools.file.exclude_patterns
   ```

### Shell tool blocked

**Symptom:**
```
Error: Command not allowed
Error: Shell tool is disabled
```

**Solutions:**

1. **Enable shell tool:**
   ```bash
   claude-code-clone tools enable shell
   ```

2. **Add allowed command:**
   ```bash
   claude-code-clone config set tools.shell.allowed_commands ["npm","git","your-command"]
   ```

3. **Disable confirmation:**
   ```bash
   claude-code-clone config set tools.shell.require_confirmation false
   ```

### Search tool not finding results

**Symptom:**
Search returns no results when results are expected.

**Solutions:**

1. **Check search path:**
   Ensure you're searching in the correct directory.

2. **Adjust exclude patterns:**
   ```bash
   claude-code-clone config set tools.search.exclude_patterns []
   ```

3. **Use regex:**
   Enable regex for more flexible searching.

4. **Check case sensitivity:**
   ```bash
   claude-code-clone config set tools.search.case_sensitive false
   ```

### Browser tool errors

**Symptom:**
```
Error: Browser not available
Error: Failed to launch browser
```

**Solutions:**

1. **Install browser dependencies:**
   ```bash
   # Ubuntu/Debian
   sudo apt-get install -y libgbm-dev
   
   # macOS
   brew install chromium
   ```

2. **Enable browser tool:**
   ```bash
   claude-code-clone tools enable browser
   ```

3. **Use headless mode:**
   ```bash
   claude-code-clone config set tools.browser.headless true
   ```

## Session Issues

### Session not saving

**Symptom:**
```
Error: Failed to save session
```

**Solutions:**

1. **Check disk space:**
   ```bash
   df -h ~/.claude-code-clone
   ```

2. **Check permissions:**
   ```bash
   ls -la ~/.claude-code-clone/sessions
   chmod 755 ~/.claude-code-clone/sessions
   ```

3. **Save to different location:**
   ```bash
   /save my-session --path /custom/path
   ```

### Session not loading

**Symptom:**
```
Error: Session not found
Error: Failed to load session
```

**Solutions:**

1. **List available sessions:**
   ```bash
   /list
   ```

2. **Check session file:**
   ```bash
   ls -la ~/.claude-code-clone/sessions/
   ```

3. **Load with force:**
   ```bash
   /load my-session --force
   ```

### Session corruption

**Symptom:**
```
Error: Session file corrupted
```

**Solutions:**

1. **Restore from backup:**
   ```bash
   cp ~/.claude-code-clone/sessions/my-session.json.bak \
      ~/.claude-code-clone/sessions/my-session.json
   ```

2. **Start new session:**
   ```bash
   /start --force
   ```

3. **Clear session cache:**
   ```bash
   rm -rf ~/.claude-code-clone/cache/sessions/*
   ```

## Display Issues

### Garbled text

**Symptom:**
Text appears corrupted or with wrong characters.

**Solutions:**

1. **Check terminal encoding:**
   ```bash
   echo $LANG
   export LANG=en_US.UTF-8
   ```

2. **Use compatible terminal:**
   - iTerm2 (macOS)
   - Windows Terminal (Windows)
   - GNOME Terminal (Linux)

3. **Disable special characters:**
   ```bash
   claude-code-clone config set ui.ascii_only true
   ```

### Colors not displaying

**Symptom:**
No colors or wrong colors in output.

**Solutions:**

1. **Enable colors:**
   ```bash
   claude-code-clone config set ui.colors true
   ```

2. **Check terminal support:**
   ```bash
   echo $TERM
   export TERM=xterm-256color
   ```

3. **Force color output:**
   ```bash
   claude-code-clone --color always
   ```

### Line wrapping issues

**Symptom:**
Text doesn't wrap correctly.

**Solutions:**

1. **Set terminal width:**
   ```bash
   stty cols 120
   ```

2. **Enable wrapping:**
   ```bash
   claude-code-clone config set ui.wrap_lines true
   ```

3. **Resize terminal:**
   Make your terminal window wider.

## Error Messages

### Common Error Codes

| Error Code | Description | Solution |
|------------|-------------|----------|
| EACCES | Permission denied | Check file permissions |
| ENOENT | File not found | Check file path |
| ECONNREFUSED | Connection refused | Check network/API status |
| ETIMEDOUT | Timeout | Increase timeout or check network |
| EPIPE | Broken pipe | Restart application |
| ENOSPC | No space left | Free disk space |
| EMFILE | Too many open files | Close other applications |

### Error: Context window exceeded

**Symptom:**
```
Error: Context window exceeded
```

**Solutions:**

1. **Reduce context:**
   ```bash
   claude-code-clone config set api.context.max_files 10
   ```

2. **Clear conversation:**
   ```bash
   /clear
   ```

3. **Start new session:**
   ```bash
   /start
   ```

### Error: Tool execution failed

**Symptom:**
```
Error: Tool execution failed: [tool_name]
```

**Solutions:**

1. **Check tool status:**
   ```bash
   /tools info [tool_name]
   ```

2. **Re-enable tool:**
   ```bash
   /tools enable [tool_name]
   ```

3. **Check tool configuration:**
   ```bash
   claude-code-clone config get tools.[tool_name]
   ```

## Diagnostic Commands

### Built-in Diagnostics

```bash
# Run full diagnostics
claude-code-clone doctor

# Check specific areas
claude-code-clone doctor --check api
claude-code-clone doctor --check config
claude-code-clone doctor --check tools

# Fix issues automatically
claude-code-clone doctor --fix
```

### Debug Information

```bash
# Show debug info
/debug

# Show context
/debug context

# Show tool status
/debug tools

# Show token usage
/debug tokens

# Show memory usage
/debug memory
```

### System Information

```bash
# Show system info
/info system

# Show configuration
/info config

# Show project info
/info project

# Show version
claude-code-clone --version
```

### Log Analysis

```bash
# View logs
/logs

# View error logs only
/logs --level error

# Follow logs
/logs --follow

# View last 100 lines
/logs --lines 100
```

## Getting Help

### Documentation

- **Getting Started**: [Getting Started Guide](getting-started.md)
- **Installation**: [Installation Guide](installation.md)
- **Configuration**: [Configuration Guide](configuration.md)
- **Usage**: [Usage Guide](usage.md)

### Community Support

- **GitHub Issues**: https://github.com/claude-code-clone/issues
- **Discord**: https://discord.gg/claude-code-clone
- **Forum**: https://forum.claude-code-clone.com

### Contact Support

- **Email**: support@claude-code-clone.com
- **Twitter**: @ClaudeCodeClone

### Reporting Bugs

When reporting bugs, include:

1. **Version information:**
   ```bash
   claude-code-clone --version
   ```

2. **System information:**
   ```bash
   claude-code-clone --info
   ```

3. **Error messages:**
   Copy the full error message and stack trace.

4. **Steps to reproduce:**
   Detailed steps to reproduce the issue.

5. **Configuration:**
   ```bash
   claude-code-clone config --list
   ```

### Debug Mode

Enable debug mode for detailed logging:

```bash
# Enable debug logging
export CLAUDE_CODE_LOG_LEVEL=debug

# Run with debug output
claude-code-clone --debug

# Save debug logs
claude-code-clone --debug --log-file debug.log
```

---

**Troubleshooting Quick Reference**

```
Common Issues:
  Install:     npm permissions, Node version
  Config:      API key, config file
  API:         Connection, rate limits, timeouts
  Performance: Slow responses, memory usage
  Tools:       File access, shell blocked
  Sessions:    Save/load issues
  Display:     Encoding, colors, wrapping

Diagnostic Commands:
  claude-code-clone doctor
  /debug
  /info
  /logs
  /help
```
