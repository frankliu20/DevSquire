English | [中文](README.zh-CN.md)

# Dev Pilot for VS Code

AI engineering team dashboard — orchestrate [Dev Pilot](https://github.com/anthropics/dev-pilot) workflows with GitHub Copilot CLI, worktree isolation, all from VS Code.

## Features

- **Auto-activate** — detects GitHub repos and activates automatically, zero setup
- **Dashboard panel** — sidebar UI to manage tasks, trigger workflows, monitor progress
- **Worktree isolation** — each issue gets its own git worktree, no branch conflicts
- **Copilot CLI integration** — runs commands in VS Code terminal via `gh copilot`
- **Framework sync** — automatically installs Dev Pilot commands/agents to `~/.copilot/` or `.github/copilot/`
- **Workspace logs** — all task logs stored in `.dev-pilot/` (auto-gitignored)

## Prerequisites

- [GitHub CLI](https://cli.github.com/) (`gh`) installed and authenticated
- [GitHub Copilot CLI](https://docs.github.com/en/copilot/github-copilot-in-the-cli) extension installed (`gh extension install github/gh-copilot`)

## Installation

```bash
# From source
cd dev-pilot-vscode
npm install
npm run compile

# Launch in development — press F5 in VS Code
```

## Usage

1. Open any GitHub repo in VS Code — Dev Pilot activates automatically
2. Open the **Dev Pilot** panel in the Activity Bar (left sidebar)
3. Enter an issue number (`#123`) or URL and click **Go**
   - Creates a worktree for the issue
   - Opens a VS Code terminal running the Copilot CLI workflow
4. Use **Watch PRs** to monitor your open pull requests
5. Click **Open Worktree** to inspect code in a new VS Code window
6. Click **Terminal** to jump to the running Copilot CLI session

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `devPilot.frameworkLocation` | `home` | Where to install commands/agents: `home` (~/.copilot/) or `project` (.github/copilot/) |
| `devPilot.autoSyncFramework` | `true` | Auto-sync commands/agents on activation |

## Architecture

```
Extension
├── extension.ts          ← Entry: auto-detect GitHub repo, activate
├── github-detector.ts    ← Parse .git/config for github.com remote
├── dev-pilot-dir.ts      ← Manage .dev-pilot/ workspace directory
├── framework-sync.ts     ← Sync commands/agents to ~/.copilot/ or .github/copilot/
├── task-runner.ts         ← Orchestrate worktree + terminal per task
├── worktree.ts           ← git worktree create/list/remove
├── dashboard-provider.ts ← Webview sidebar UI
└── framework/            ← Bundled command/agent markdown files
    ├── commands/
    └── agents/
```

## License

MIT
