# typed: false
# frozen_string_literal: true

# Claude Code Clone Homebrew Formula
# 
# Installation:
#   brew tap yourorg/tap
#   brew install claude-code-clone
#
# Or install directly:
#   brew install --cask yourorg/tap/claude-code-clone

class ClaudeCodeClone < Formula
  desc "AI-powered terminal coding assistant"
  homepage "https://github.com/yourorg/claude-code-clone"
  version "1.0.0"
  license "MIT"

  # macOS ARM64 (Apple Silicon)
  if Hardware::CPU.arm?
    url "https://github.com/yourorg/claude-code-clone/releases/download/v1.0.0/claude-code-clone-v1.0.0-macos-arm64.tar.gz"
    sha256 "PLACEHOLDER_SHA256_ARM64"
  else
    # macOS x64 (Intel)
    url "https://github.com/yourorg/claude-code-clone/releases/download/v1.0.0/claude-code-clone-v1.0.0-macos-x64.tar.gz"
    sha256 "PLACEHOLDER_SHA256_X64"
  end

  # Dependencies
  depends_on "node@18" => :optional

  # Conflicts
  conflicts_with "claude-code", because: "both install `claude-code` binary"

  def install
    # Install main binary
    bin.install "claude-code-clone"
    
    # Create symlink for 'ccode' shorthand
    bin.install_symlink "claude-code-clone" => "ccode"
    
    # Install shell completions
    bash_completion.install "completions/claude-code-clone.bash" => "claude-code-clone"
    zsh_completion.install "completions/_claude-code-clone" => "_claude-code-clone"
    fish_completion.install "completions/claude-code-clone.fish"
    
    # Install man page
    man1.install "man/claude-code-clone.1"
  end

  def caveats
    <<~EOS
      Claude Code Clone has been installed!
      
      Quick start:
        claude-code --help       Show help
        claude-code --version    Show version
        claude-code              Start interactive session
      
      Configuration:
        ~/.config/claude-code-clone/config.json
      
      Documentation:
        https://github.com/yourorg/claude-code-clone#readme
      
      To get started, set your Anthropic API key:
        export ANTHROPIC_API_KEY="your-api-key"
    EOS
  end

  test do
    # Test version command
    assert_match version.to_s, shell_output("#{bin}/claude-code-clone --version")
    
    # Test help command
    assert_match "AI-powered terminal coding assistant", 
                 shell_output("#{bin}/claude-code-clone --help")
    
    # Test config directory creation
    system "#{bin}/claude-code-clone", "config", "--init"
    assert_predicate testpath/".config/claude-code-clone", :exist?
  end
end
