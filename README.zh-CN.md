<p align="center">
  <img src="resources/logo.jpg" width="200" alt="DevSquire Logo" />
</p>

<h1 align="center">DevSquire — 智能工程助手</h1>

<p align="center">
  <strong>一个开发者 + DevSquire = 一整个工程团队。</strong><br/>
  自主开发 Issue、审查 PR、监控 CI —— 尽在 VS Code。
</p>

<p align="center">
  <a href="./README.md">English</a> | 中文
</p>

---

> **告别上下文切换，专注交付。** DevSquire 是一个 AI 驱动的工程仪表盘，能将 GitHub Issue 自动转化为 Pull Request、用可配置策略审查代码、监控 CI 流水线 —— 让你专注于真正重要的事。

## 为什么选择 DevSquire？

| | 传统 AI 工具 | DevSquire |
|---|---|---|
| **工作流** | 在聊天窗口和 IDE 之间来回复制 | 端到端自主流水线 |
| **Issue → PR** | 手动：读 issue、规划、编码、测试、推送 | 一键：分析 → 规划 → 实现 → 测试 → 创建 PR |
| **代码审查** | 通用建议 | 按严重级别结构化审查，支持自动发布 |
| **CI 监控** | 手动检查和修复 | 自动检测失败、自动修复、自动推送 |
| **可见性** | 黑盒 | 实时仪表盘 + 流水线进度 |

## 核心功能

🚀 **自主开发 Issue** — 指定一个 GitHub Issue，坐下来看就好。DevSquire 会分析问题、探索代码库、制定方案、实现功能、运行测试，最后创建 PR —— 全程自主完成。

🔍 **审查 PR** — 结构化代码审查，三种策略：`normal`（交互式）、`auto`（自动发布）、`quick-approve`（无问题就批准）。可配置严重级别过滤（高 / 中 / 低）。

👁️ **监控 PR** — 持续监控你的 PR。自动检测 CI 失败和审查评论，可选自动修复并推送 —— 让你的 PR 保持绿色。

📊 **仪表盘** — 每个任务的实时流水线可视化。六个标签页：Issues、PRs、Tasks、Actions、Skills、Report。一切操作一键完成。

📋 **每日报告** — 一键生成 Scrum 风格的日报摘要：已关闭 Issue、已合并 PR、进行中的工作。非常适合站会汇报。

## 截图

### 仪表盘 — Issue 管理
直接在仪表盘中浏览和开发 GitHub Issue。

![Dashboard Issues](docs/screenshots/dashboard-issues.png)

### 任务流水线 — 实时进度
每个任务都有实时进度流水线。开发 Issue 经过 7 个阶段；PR 审查经过 3 个阶段。

![Tasks Pipeline](docs/screenshots/tasks-pipeline.png)

### Agent 工作中 — 终端集成
任务在 VS Code 终端中运行。点击 **Terminal** 实时查看 AI Agent 的工作过程。

![Tasks Terminal](docs/screenshots/tasks-terminal.png)

### 每日报告
一键生成每日 Scrum 摘要。

![Report](docs/screenshots/report.png)

## 快速开始

### 安装

在 VS Code 扩展市场搜索 **DevSquire**，或者：

```bash
code --install-extension frankliu20.devsquire-vscode
```

### 前置要求

- [GitHub CLI](https://cli.github.com/) (`gh`) 已安装并完成认证
- 以下 AI 平台任选其一：
  - [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI — `claude` 命令
  - [GitHub Copilot CLI](https://docs.github.com/en/copilot/github-copilot-in-the-cli) — `gh copilot` 命令

> DevSquire 同时支持两种平台，随时通过 `devSquire.aiPlatform` 设置切换。

## 工作原理

```
GitHub Issue ──► DevSquire 仪表盘 ──► AI Agent（终端）
                      │                      │
                      │  实时进度追踪          │  自主流水线
                      │  流水线可视化          │  分析 → 规划 → 编码 → 测试
                      │                      │
                      ▼                      ▼
               Tasks 标签页（实时）       Pull Request 已创建
```

**任务流水线：**

| 任务类型 | 流水线 |
|---------|--------|
| 开发 Issue | `分析 → 探索 → 规划 → 实现 → 测试 → 创建 PR` |
| 审查 PR | `审查中 → 完成 → 已发布` |
| 监控 PR | `监控 ↔ 修复 CI ↔ 修复评论`（循环） |

## 设置

| 设置项 | 默认值 | 说明 |
|--------|--------|------|
| `devSquire.aiPlatform` | `claude-code` | AI 平台（`claude-code` 或 `copilot-cli`） |
| `devSquire.agentConfigLocation` | `home` | Agent 安装位置：`home`（~/.claude/）或 `project` |
| `devSquire.autoSyncAgentConfig` | `true` | 激活时自动同步 Agent 配置 |
| `devSquire.devIssue.mode` | `auto` | `normal`（暂停审批）或 `auto`（全自主） |
| `devSquire.reviewPR.mode` | `normal` | `normal`、`auto` 或 `quick-approve` |
| `devSquire.reviewPR.level` | `medium` | 审查详细程度：`high`、`medium` 或 `low` |
| `devSquire.watchPR.autoFixCI` | `true` | 自动修复 CI 失败 |
| `devSquire.watchPR.autoFixComments` | `false` | 自动修复审查评论 |

## 许可证

[MIT](LICENSE) — 用它来构建伟大的东西吧。
