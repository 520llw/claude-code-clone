# Claude Code Clone RPM Spec File
# 
# Build:
#   rpmbuild -ba claude-code-clone.spec
#
# Install:
#   sudo dnf install claude-code-clone-1.0.0-1.x86_64.rpm

Name:           claude-code-clone
Version:        1.0.0
Release:        1%{?dist}
Summary:        AI-powered terminal coding assistant

License:        MIT
URL:            https://github.com/yourorg/claude-code-clone
Source0:        https://github.com/yourorg/claude-code-clone/releases/download/v%{version}/claude-code-clone-v%{version}-linux-x64.tar.gz
Source1:        https://github.com/yourorg/claude-code-clone/releases/download/v%{version}/claude-code-clone-v%{version}-linux-arm64.tar.gz

BuildArch:      x86_64 aarch64

Requires:       glibc >= 2.28
Recommends:     git
Suggests:       nodejs >= 18

Conflicts:      claude-code
Provides:       claude-code-clone = %{version}-%{release}
Provides:       ccode = %{version}-%{release}

%description
Claude Code Clone is a full-featured AI-powered terminal coding assistant
that helps developers write, edit, and understand code more efficiently.

Features:
- Interactive AI-powered coding sessions
- Natural language code editing
- File and project exploration
- Git integration
- Multi-language support
- Extensible plugin system

%prep
%autosetup -c -n %{name}-%{version}

%build
# Binary is pre-built, no build step needed
echo "Using pre-built binary"

%install
# Install binary
install -D -m 0755 %{name} %{buildroot}%{_bindir}/%{name}

# Create symlink for 'ccode'
ln -sf %{name} %{buildroot}%{_bindir}/ccode

# Install shell completions
install -D -m 0644 completions/%{name}.bash %{buildroot}%{_datadir}/bash-completion/completions/%{name}
install -D -m 0644 completions/_%{name} %{buildroot}%{_datadir}/zsh/site-functions/_%{name}
install -D -m 0644 completions/%{name}.fish %{buildroot}%{_datadir}/fish/vendor_completions.d/%{name}.fish

# Install man page
install -D -m 0644 man/%{name}.1 %{buildroot}%{_mandir}/man1/%{name}.1

# Install documentation
install -D -m 0644 README.md %{buildroot}%{_docdir}/%{name}/README.md
install -D -m 0644 CHANGELOG.md %{buildroot}%{_docdir}/%{name}/CHANGELOG.md
install -D -m 0644 LICENSE %{buildroot}%{_docdir}/%{name}/LICENSE

# Install icons (if available)
for size in 16 32 48 64 128 256; do
    if [ -f icons/%{name}-${size}.png ]; then
        install -D -m 0644 icons/%{name}-${size}.png \
            %{buildroot}%{_datadir}/icons/hicolor/${size}x${size}/apps/%{name}.png
    fi
done

%check
# Run basic tests
./%{name} --version

%files
%license LICENSE
%doc README.md CHANGELOG.md
%{_bindir}/%{name}
%{_bindir}/ccode
%{_datadir}/bash-completion/completions/%{name}
%{_datadir}/zsh/site-functions/_%{name}
%{_datadir}/fish/vendor_completions.d/%{name}.fish
%{_mandir}/man1/%{name}.1*

%changelog
* Mon Jan 01 2024 Your Name <your.email@example.com> - 1.0.0-1
- Initial release
- AI-powered terminal coding assistant
- Interactive coding sessions
- Natural language code editing
- Git integration
- Multi-platform support

%post
echo "Claude Code Clone %{version} has been installed!"
echo ""
echo "Quick start:"
echo "  claude-code --help       Show help"
echo "  claude-code --version    Show version"
echo "  claude-code              Start interactive session"
echo ""
echo "Documentation: https://github.com/yourorg/claude-code-clone#readme"

%postun
if [ $1 -eq 0 ]; then
    echo "Claude Code Clone has been uninstalled."
    echo "Configuration files in ~/.config/claude-code-clone were not removed."
fi
