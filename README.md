# Dev Pilot for VS Code

AI engineering team dashboard — orchestrate [Dev Pilot](https://github.com/anthropics/dev-pilot) workflows with worktree isolation from VS Code.

## Features

- **Dashboard panel** — manage Dev Pilot tasks from the VS Code sidebar
- **Worktree isolation** — each task runs in its own git worktree, no branch conflicts
- **Issue → PR pipeline** — paste an issue URL, get a PR back automatically
- **PR monitoring** — watch your open PRs for CI failures and review comments
- **Live output** — stream Claude Code output directly in the dashboard

## Prerequisites

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated
- [Dev Pilot](https://github.com/anthropics/dev-pilot) framework installed (`node init.js`)
- `~/.claude/pilot.yaml` configured with your repos

## Installation

```bash
# From source
cd dev-pilot-vscode
npm install
npm run compile

# Launch in development
# Press F5 in VS Code with this folder open
```

## Usage

1. Open the **Dev Pilot** panel in the Activity Bar (left sidebar)
2. Paste an issue URL and click **Go** — Dev Pilot will:
   - Create a worktree for the task
   - Run Claude Code with `/pilot-dev-issue --auto`
   - Stream output in the dashboard
3. Click **Open Worktree** to inspect the code in a new VS Code window
4. Use **Watch PRs** to monitor your open pull requests

## Architecture

```
Extension
├── Dashboard (Webview)     ← UI: task list, issue input, output viewer
├── TaskRunner              ← Orchestrates worktree + Claude CLI per task
├── WorktreeManager         ← git worktree create/list/remove
├── ClaudeCli               ← Spawns `claude --print` processes
└── PilotConfig             ← Reads ~/.claude/pilot.yaml
```

The extension acts as a thin UI layer. All intelligence lives in the Dev Pilot framework (commands, agents, skills) executed by Claude Code CLI.

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `devPilot.claudeCodePath` | `claude` | Path to Claude Code CLI |
| `devPilot.pilotYamlPath` | `~/.claude/pilot.yaml` | Path to pilot.yaml config |

## Development

```bash
npm run watch    # Rebuild on changes
npm test         # Run tests
npm run package  # Build .vsix
```

## License

MIT
