import * as vscode from 'vscode';
import { TaskRunner } from './task-runner';
import { GitHubRepoInfo } from './github-detector';
import { DevPilotDir } from './dev-pilot-dir';

export class DashboardViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly taskRunner: TaskRunner,
    private readonly repoInfo: GitHubRepoInfo,
    private readonly devPilotDir: DevPilotDir,
  ) {
    this.taskRunner.onTasksChanged(() => {
      this.updateWebview();
    });
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtml();

    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.type) {
        case 'devIssue':
          this.taskRunner.runDevIssue(message.issueUrl);
          break;
        case 'watchPRs':
          this.taskRunner.runWatchPRs();
          break;
        case 'killTask':
          this.taskRunner.killTask(message.taskId);
          break;
        case 'cleanupTask':
          this.taskRunner.cleanupTask(message.taskId);
          break;
        case 'openWorktree':
          this.taskRunner.openWorktree(message.taskId);
          break;
        case 'focusTerminal':
          this.taskRunner.focusTerminal(message.taskId);
          break;
        case 'refresh':
          this.updateWebview();
          break;
      }
    });
  }

  private updateWebview(): void {
    if (!this._view) return;

    const tasks = this.taskRunner.getAllTasks();
    this._view.webview.postMessage({
      type: 'tasksUpdated',
      tasks: tasks.map((t) => ({
        id: t.id,
        type: t.type,
        label: t.label,
        status: t.status,
        issueUrl: t.issueUrl,
        worktreeDir: t.worktreeDir,
        hasTerminal: !!t.terminal,
        createdAt: t.createdAt,
      })),
    });
  }

  private getHtml(): string {
    const { owner, repo } = this.repoInfo;
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dev Pilot</title>
<style>
  :root {
    --bg: var(--vscode-editor-background);
    --fg: var(--vscode-editor-foreground);
    --border: var(--vscode-panel-border);
    --btn-bg: var(--vscode-button-background);
    --btn-fg: var(--vscode-button-foreground);
    --btn-hover: var(--vscode-button-hoverBackground);
    --input-bg: var(--vscode-input-background);
    --input-fg: var(--vscode-input-foreground);
    --input-border: var(--vscode-input-border);
    --badge-running: var(--vscode-terminal-ansiYellow);
    --badge-completed: var(--vscode-terminal-ansiGreen);
    --badge-failed: var(--vscode-terminal-ansiRed);
    --badge-pending: var(--vscode-descriptionForeground);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: var(--vscode-font-family); color: var(--fg); background: var(--bg); padding: 12px; font-size: 13px; }
  h2 { font-size: 14px; margin-bottom: 8px; font-weight: 600; }
  .section { margin-bottom: 16px; }
  .config-info { font-size: 12px; color: var(--vscode-descriptionForeground); margin-bottom: 12px; }
  .config-info code { background: var(--input-bg); padding: 1px 4px; border-radius: 3px; }
  .input-group { display: flex; gap: 6px; margin-bottom: 8px; }
  .input-group input {
    flex: 1; padding: 5px 8px;
    background: var(--input-bg); color: var(--input-fg);
    border: 1px solid var(--input-border); border-radius: 3px; font-size: 12px;
  }
  .input-group input:focus { outline: 1px solid var(--btn-bg); }
  button {
    padding: 5px 12px; border: none; border-radius: 3px; cursor: pointer;
    background: var(--btn-bg); color: var(--btn-fg); font-size: 12px;
  }
  button:hover { background: var(--btn-hover); }
  button.secondary { background: transparent; color: var(--fg); border: 1px solid var(--border); }
  button.secondary:hover { background: var(--input-bg); }
  button.small { padding: 2px 8px; font-size: 11px; }
  button.danger { background: var(--badge-failed); }
  .task-list { display: flex; flex-direction: column; gap: 8px; }
  .task-card { border: 1px solid var(--border); border-radius: 4px; padding: 8px 10px; background: var(--input-bg); }
  .task-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
  .task-label { font-weight: 600; font-size: 13px; }
  .task-badge { font-size: 10px; padding: 1px 6px; border-radius: 8px; text-transform: uppercase; font-weight: 600; }
  .task-badge.running { background: var(--badge-running); color: #000; }
  .task-badge.completed { background: var(--badge-completed); color: #000; }
  .task-badge.failed { background: var(--badge-failed); color: #fff; }
  .task-badge.pending { background: var(--badge-pending); color: var(--fg); }
  .task-meta { font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 6px; }
  .task-actions { display: flex; gap: 4px; flex-wrap: wrap; }
  .empty { color: var(--vscode-descriptionForeground); font-style: italic; padding: 12px 0; text-align: center; }
</style>
</head>
<body>
<div class="section">
  <h2>Dev Pilot</h2>
  <div class="config-info">
    <code>${owner}/${repo}</code> &nbsp;|&nbsp; GitHub
  </div>
</div>
<div class="section">
  <h2>Develop Issue</h2>
  <div class="input-group">
    <input type="text" id="issueUrl" placeholder="#123 or issue URL..." />
    <button onclick="submitIssue()">Go</button>
  </div>
</div>
<div class="section">
  <div style="display: flex; gap: 6px; flex-wrap: wrap;">
    <button class="secondary" onclick="watchPRs()">Watch PRs</button>
    <button class="secondary" onclick="refresh()">Refresh</button>
  </div>
</div>
<div class="section">
  <h2>Tasks</h2>
  <div id="taskList" class="task-list">
    <div class="empty">No active tasks</div>
  </div>
</div>
<script>
const vscode = acquireVsCodeApi();
function submitIssue() {
  const input = document.getElementById('issueUrl');
  const url = input.value.trim();
  if (!url) return;
  vscode.postMessage({ type: 'devIssue', issueUrl: url });
  input.value = '';
}
document.getElementById('issueUrl').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitIssue();
});
function watchPRs() { vscode.postMessage({ type: 'watchPRs' }); }
function refresh() { vscode.postMessage({ type: 'refresh' }); }
function killTask(id) { vscode.postMessage({ type: 'killTask', taskId: id }); }
function cleanupTask(id) { vscode.postMessage({ type: 'cleanupTask', taskId: id }); }
function openWorktree(id) { vscode.postMessage({ type: 'openWorktree', taskId: id }); }
function focusTerminal(id) { vscode.postMessage({ type: 'focusTerminal', taskId: id }); }
function formatTime(ts) { return new Date(ts).toLocaleTimeString(); }
window.addEventListener('message', (event) => {
  if (event.data.type === 'tasksUpdated') renderTasks(event.data.tasks);
});
function renderTasks(tasks) {
  const c = document.getElementById('taskList');
  if (!tasks.length) { c.innerHTML = '<div class="empty">No active tasks</div>'; return; }
  c.innerHTML = tasks.map(t => \`
    <div class="task-card">
      <div class="task-header">
        <span class="task-label">\${esc(t.label)}</span>
        <span class="task-badge \${t.status}">\${t.status}</span>
      </div>
      <div class="task-meta">
        \${t.type} &nbsp;|&nbsp; \${formatTime(t.createdAt)}
        \${t.worktreeDir ? ' &nbsp;|&nbsp; worktree' : ''}
      </div>
      <div class="task-actions">
        \${t.hasTerminal ? '<button class="small secondary" onclick="focusTerminal(\\'' + t.id + '\\')">Terminal</button>' : ''}
        \${t.worktreeDir ? '<button class="small secondary" onclick="openWorktree(\\'' + t.id + '\\')">Open Worktree</button>' : ''}
        \${t.status === 'running' ? '<button class="small danger" onclick="killTask(\\'' + t.id + '\\')">Stop</button>' : ''}
        \${t.status !== 'running' ? '<button class="small secondary" onclick="cleanupTask(\\'' + t.id + '\\')">Clean up</button>' : ''}
      </div>
    </div>\`).join('');
}
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
</script>
</body>
</html>`;
  }
}
