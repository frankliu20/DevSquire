# DevSquire VS Code Extension

## Project Rules

- GitHub only — no GitLab/Azure DevOps support
- Copilot CLI only — runs in VS Code terminal, not Claude Code
- Worktrees under `<repo>/.worktrees/` (gitignored)
- Logs/state under `<repo>/.devsquire/` (gitignored)
- Agent files synced to `~/.copilot/agents/` (default) or `.github/copilot/agents/` (configurable)
- Copilot CLI uses agents (not commands) — all squire-* files are agents
- Webview UI uses VS Code design tokens (no custom color values)
- Auto-activates on GitHub repos, no manual init needed
