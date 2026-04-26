[English](README.md) | 中文

# Dev Pilot for VS Code

AI 工程团队仪表盘 — 在 VS Code 中使用 GitHub Copilot CLI 编排 [Dev Pilot](https://github.com/anthropics/dev-pilot) 工作流，支持 worktree 隔离。

## 功能特性

- **自动激活** — 检测到 GitHub 仓库后自动激活，无需配置
- **仪表盘面板** — 侧边栏 UI 管理任务、触发工作流、监控进度
- **Worktree 隔离** — 每个 issue 拥有独立的 git worktree，避免分支冲突
- **Copilot CLI 集成** — 通过 `gh copilot` 在 VS Code 终端中运行命令
- **框架同步** — 自动将 Dev Pilot 命令/代理安装到 `~/.copilot/` 或 `.github/copilot/`
- **工作区日志** — 所有任务日志存储在 `.dev-pilot/` 目录中（自动加入 gitignore）

## 前置条件

- 已安装并认证 [GitHub CLI](https://cli.github.com/)（`gh`）
- 已安装 [GitHub Copilot CLI](https://docs.github.com/en/copilot/github-copilot-in-the-cli) 扩展（`gh extension install github/gh-copilot`）

## 安装

```bash
# 从源码安装
cd dev-pilot-vscode
npm install
npm run compile

# 开发模式启动 — 在 VS Code 中按 F5
```

## 使用方法

1. 在 VS Code 中打开任意 GitHub 仓库 — Dev Pilot 自动激活
2. 在活动栏（左侧边栏）打开 **Dev Pilot** 面板
3. 输入 issue 编号（`#123`）或 URL，点击 **Go**
   - 为该 issue 创建 worktree
   - 打开 VS Code 终端运行 Copilot CLI 工作流
4. 使用 **Watch PRs** 监控你的 Pull Request
5. 点击 **Open Worktree** 在新窗口中查看代码
6. 点击 **Terminal** 跳转到正在运行的 Copilot CLI 会话

## 设置

| 设置项 | 默认值 | 说明 |
|--------|--------|------|
| `devPilot.frameworkLocation` | `home` | 命令/代理安装位置：`home`（~/.copilot/）或 `project`（.github/copilot/） |
| `devPilot.autoSyncFramework` | `true` | 激活时自动同步命令/代理 |

## 架构

```
Extension
├── extension.ts          ← 入口：自动检测 GitHub 仓库并激活
├── github-detector.ts    ← 解析 .git/config 中的 github.com 远程仓库
├── dev-pilot-dir.ts      ← 管理 .dev-pilot/ 工作区目录
├── framework-sync.ts     ← 同步命令/代理到 ~/.copilot/ 或 .github/copilot/
├── task-runner.ts         ← 编排每个任务的 worktree + 终端
├── worktree.ts           ← git worktree 的创建/列表/删除
├── dashboard-provider.ts ← Webview 侧边栏 UI
└── framework/            ← 内置的命令/代理 Markdown 文件
    ├── commands/
    └── agents/
```

## 许可证

MIT
