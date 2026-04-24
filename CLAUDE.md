# Dev Pilot VS Code Extension

## Project Rules

- GitHub only — no GitLab/Azure DevOps support
- Copilot CLI only — runs in VS Code terminal, not Claude Code
- Worktrees under `<repo>/.worktrees/` (gitignored)
- Logs/state under `<repo>/.dev-pilot/` (gitignored)
- Framework files synced to `~/.copilot/` (default) or `.github/copilot/` (configurable)
- Webview UI uses VS Code design tokens (no custom color values)
- Auto-activates on GitHub repos, no manual init needed
