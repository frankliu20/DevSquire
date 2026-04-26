<p align="center">
  <img src="resources/logo.jpg" width="200" alt="DevSquire Logo" />
</p>

<h1 align="center">DevSquire — Agentic Engineer</h1>

<p align="center">
  <strong>One developer + DevSquire = a full engineering team.</strong><br/>
  Automate your GitHub workflow — from issue to merged PR — without leaving VS Code.
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=frankliu20.devsquire-vscode"><img src="https://img.shields.io/visual-studio-marketplace/v/frankliu20.devsquire-vscode?label=Marketplace" alt="Marketplace"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=frankliu20.devsquire-vscode"><img src="https://img.shields.io/visual-studio-marketplace/i/frankliu20.devsquire-vscode?label=Installs" alt="Installs"></a>
  <a href="https://github.com/frankliu20/DevSquire/actions/workflows/ci.yml"><img src="https://github.com/frankliu20/DevSquire/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/frankliu20/DevSquire/blob/main/LICENSE"><img src="https://img.shields.io/github/license/frankliu20/DevSquire" alt="License"></a>
  <a href="https://github.com/frankliu20/DevSquire/releases"><img src="https://img.shields.io/github/v/release/frankliu20/DevSquire" alt="Release"></a>
</p>

<p align="center">
  English | <a href="./README.zh-CN.md">中文</a>
</p>

---

## The Problem

Developers spend **~40% of their time** on repetitive workflow tasks: triaging issues, switching between browser and IDE, manually reviewing PRs, checking CI, and writing standup reports.

DevSquire eliminates that overhead. Point it at an issue, and it delivers a tested PR — autonomously.

## Why DevSquire?

| | Traditional AI Tools | DevSquire |
|---|---|---|
| **Workflow** | Copy-paste between chat and IDE | End-to-end autonomous pipeline |
| **Issue → PR** | Manual: read, plan, code, test, push | One click: analyze → implement → test → PR |
| **Code Review** | Generic suggestions | Structured review with severity levels |
| **CI Monitoring** | Manual checks and fixes | Auto-detect, auto-fix, auto-push |
| **Visibility** | Black box | Real-time dashboard with live progress |

## Core Features

### 🚀 Develop Issues

Issue in, PR out. Analyze → explore → plan → implement → test → create PR — fully autonomous.

### 🔍 Review PRs

Structured review with three modes: `normal` (interactive), `auto` (publish immediately), `quick-approve` (approve or block). Severity filtering: `high` / `medium` / `low`.

### 👁️ Watch PRs

Monitor open PRs continuously. Auto-detect CI failures and review comments, auto-fix and push — PRs stay green.

### 📊 Dashboard

Six tabs — Issues, PRs, Tasks, Actions, Skills, Report. Live pipeline progress, one-click actions.

### 📋 End-of-Day Report

One-click scrum summary: issues closed, PRs merged, open work.

## Screenshots

<details>
<summary><strong>Dashboard — Issue Management</strong></summary>
<br/>
Browse and develop GitHub issues directly from the dashboard.

<img src="docs/screenshots/dashboard-issues.png" width="100%" />
</details>

<details>
<summary><strong>Task Pipeline — Real-Time Progress</strong></summary>
<br/>
Every task shows a live progress pipeline. Dev issues go through 7 stages; PR reviews through 3.

<img src="docs/screenshots/tasks-pipeline.png" width="100%" />
</details>

<details>
<summary><strong>Agent at Work — Terminal Integration</strong></summary>
<br/>
Tasks run in VS Code terminals. Click <strong>Terminal</strong> to see the AI agent working in real time.

<img src="docs/screenshots/tasks-terminal.png" width="100%" />
</details>

<details>
<summary><strong>End-of-Day Report</strong></summary>
<br/>
Generate a daily scrum summary with one click.

<img src="docs/screenshots/report.png" width="100%" />
</details>

## Quick Start

### 1. Install

Search **DevSquire** in the VS Code Extensions Marketplace, or:

```bash
code --install-extension frankliu20.devsquire-vscode
```

### 2. Prerequisites

- [GitHub CLI](https://cli.github.com/) (`gh`) — installed and authenticated
- One AI backend:
  - [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — `claude` command
  - [GitHub Copilot CLI](https://docs.github.com/en/copilot/github-copilot-in-the-cli) — `gh copilot` command

### 3. First Run

1. Open a GitHub-connected project in VS Code
2. Click the **DevSquire** icon in the sidebar to open the dashboard
3. Go to the **Issues** tab → pick an issue → click **Develop**
4. Watch the pipeline progress in the **Tasks** tab

> Switch AI backends anytime via `devSquire.aiPlatform` setting.

## How It Works

```
GitHub Issue ──► DevSquire Dashboard ──► AI Agent in Terminal
                        │                        │
                   real-time progress       autonomous pipeline
                   pipeline tracking        analyze → plan → code → test
                        │                        │
                        ▼                        ▼
                 Tasks Tab (live)          Pull Request Created
```

| Task Type | Pipeline |
|-----------|----------|
| Dev Issue | `Analyzing → Exploring → Planning → Implementing → Testing → Creating PR` |
| Review PR | `Reviewing → Done → Published` |
| Watch PR | `Monitoring ↔ Fixing CI ↔ Fixing Comments` (cyclic) |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `devSquire.aiPlatform` | `claude-code` | AI backend: `claude-code` or `copilot-cli` |
| `devSquire.agentConfigLocation` | `home` | Agent config location: `home` or `project` |
| `devSquire.autoSyncAgentConfig` | `true` | Auto-sync agents on activation |
| `devSquire.devIssue.mode` | `auto` | `normal` (pause for approval) or `auto` (autonomous) |
| `devSquire.reviewPR.mode` | `normal` | `normal`, `auto`, or `quick-approve` |
| `devSquire.reviewPR.level` | `medium` | Review detail: `high`, `medium`, or `low` |
| `devSquire.watchPR.autoFixCI` | `true` | Auto-fix CI failures |
| `devSquire.watchPR.autoFixComments` | `false` | Auto-fix review comments |

## License

[MIT](LICENSE) — build something great with it.
