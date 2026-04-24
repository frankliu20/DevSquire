import * as vscode from 'vscode';
import { TaskRunner } from './task-runner';
import { GitHubRepoInfo } from './github-detector';
import { DevPilotDir } from './dev-pilot-dir';
import { GitHubIssues } from './github-issues';

export class DashboardViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly taskRunner: TaskRunner,
    private readonly repoInfo: GitHubRepoInfo,
    private readonly devPilotDir: DevPilotDir,
    private readonly ghIssues: GitHubIssues,
  ) {
    this.taskRunner.onTasksChanged(() => {
      this.updateTasks();
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
        case 'refreshIssues':
          this.fetchAndSendIssues(message.filter || 'all');
          break;
        case 'refresh':
          this.updateTasks();
          break;
      }
    });

    // Fetch issues on first load
    this.fetchAndSendIssues('all');
  }

  private fetchAndSendIssues(filter: string): void {
    if (!this._view) return;

    const { owner, repo } = this.repoInfo;
    const issues = filter === 'mine'
      ? this.ghIssues.listMyIssues(owner, repo)
      : this.ghIssues.list(owner, repo);

    this._view.webview.postMessage({
      type: 'issuesUpdated',
      issues: issues.map((i) => ({
        number: i.number,
        title: i.title,
        author: i.author,
        labels: i.labels,
        url: i.url,
      })),
    });
  }

  private updateTasks(): void {
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
    --link: var(--vscode-textLink-foreground);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: var(--vscode-font-family); color: var(--fg); background: var(--bg); padding: 12px; font-size: 13px; }
  h2 { font-size: 14px; margin-bottom: 8px; font-weight: 600; }
  .section { margin-bottom: 16px; }
  .config-info { font-size: 12px; color: var(--vscode-descriptionForeground); margin-bottom: 12px; }
  .config-info code { background: var(--input-bg); padding: 1px 4px; border-radius: 3px; }

  /* Tabs */
  .tabs { display: flex; gap: 0; margin-bottom: 8px; border-bottom: 1px solid var(--border); }
  .tab {
    padding: 4px 12px; font-size: 12px; cursor: pointer; border: none; background: none;
    color: var(--vscode-descriptionForeground); border-bottom: 2px solid transparent;
  }
  .tab:hover { color: var(--fg); }
  .tab.active { color: var(--fg); border-bottom-color: var(--btn-bg); }

  /* Input */
  .input-group { display: flex; gap: 6px; margin-bottom: 8px; }
  .input-group input {
    flex: 1; padding: 5px 8px;
    background: var(--input-bg); color: var(--input-fg);
    border: 1px solid var(--input-border); border-radius: 3px; font-size: 12px;
  }
  .input-group input:focus { outline: 1px solid var(--btn-bg); }

  /* Buttons */
  button {
    padding: 5px 12px; border: none; border-radius: 3px; cursor: pointer;
    background: var(--btn-bg); color: var(--btn-fg); font-size: 12px;
  }
  button:hover { background: var(--btn-hover); }
  button.secondary { background: transparent; color: var(--fg); border: 1px solid var(--border); }
  button.secondary:hover { background: var(--input-bg); }
  button.small { padding: 2px 8px; font-size: 11px; }
  button.danger { background: var(--badge-failed); }

  /* Issue list */
  .issue-list { display: flex; flex-direction: column; gap: 2px; }
  .issue-row {
    display: flex; align-items: center; gap: 8px; padding: 5px 8px;
    border-radius: 3px; cursor: pointer;
  }
  .issue-row:hover { background: var(--input-bg); }
  .issue-num { color: var(--vscode-descriptionForeground); font-size: 12px; min-width: 40px; }
  .issue-title { flex: 1; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .issue-label {
    font-size: 10px; padding: 1px 5px; border-radius: 8px;
    background: var(--input-bg); color: var(--vscode-descriptionForeground);
  }
  .issue-go { visibility: hidden; }
  .issue-row:hover .issue-go { visibility: visible; }

  /* Task list */
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

  .empty { color: var(--vscode-descriptionForeground); font-style: italic; padding: 12px 0; text-align: center; font-size: 12px; }
  .loading { color: var(--vscode-descriptionForeground); padding: 8px 0; text-align: center; font-size: 12px; }
</style>
</head>
<body>
<div class="section">
  <h2>Dev Pilot</h2>
  <div class="config-info"><code>${owner}/${repo}</code></div>
</div>

<!-- Issues Section -->
<div class="section">
  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
    <h2>Issues</h2>
    <button class="small secondary" onclick="refreshIssues()">Refresh</button>
  </div>
  <div class="tabs">
    <button class="tab active" id="tabAll" onclick="switchTab('all')">All Open</button>
    <button class="tab" id="tabMine" onclick="switchTab('mine')">Assigned to Me</button>
  </div>
  <div id="issueList" class="issue-list">
    <div class="loading">Loading issues...</div>
  </div>
</div>

<!-- Manual input -->
<div class="section">
  <div class="input-group">
    <input type="text" id="issueUrl" placeholder="#123 or issue URL..." />
    <button onclick="submitIssue()">Go</button>
  </div>
</div>

<!-- Quick Actions -->
<div class="section">
  <div style="display: flex; gap: 6px; flex-wrap: wrap;">
    <button class="secondary" onclick="watchPRs()">Watch PRs</button>
  </div>
</div>

<!-- Tasks Section -->
<div class="section">
  <h2>Tasks</h2>
  <div id="taskList" class="task-list">
    <div class="empty">No active tasks</div>
  </div>
</div>

<script>
const vscode = acquireVsCodeApi();
let currentFilter = 'all';

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

function startIssue(num) {
  vscode.postMessage({ type: 'devIssue', issueUrl: '#' + num });
}

function watchPRs() { vscode.postMessage({ type: 'watchPRs' }); }
function killTask(id) { vscode.postMessage({ type: 'killTask', taskId: id }); }
function cleanupTask(id) { vscode.postMessage({ type: 'cleanupTask', taskId: id }); }
function openWorktree(id) { vscode.postMessage({ type: 'openWorktree', taskId: id }); }
function focusTerminal(id) { vscode.postMessage({ type: 'focusTerminal', taskId: id }); }

function switchTab(filter) {
  currentFilter = filter;
  document.getElementById('tabAll').className = filter === 'all' ? 'tab active' : 'tab';
  document.getElementById('tabMine').className = filter === 'mine' ? 'tab active' : 'tab';
  document.getElementById('issueList').innerHTML = '<div class="loading">Loading...</div>';
  vscode.postMessage({ type: 'refreshIssues', filter });
}

function refreshIssues() {
  document.getElementById('issueList').innerHTML = '<div class="loading">Loading...</div>';
  vscode.postMessage({ type: 'refreshIssues', filter: currentFilter });
}

function formatTime(ts) { return new Date(ts).toLocaleTimeString(); }

window.addEventListener('message', (event) => {
  const msg = event.data;
  if (msg.type === 'issuesUpdated') renderIssues(msg.issues);
  if (msg.type === 'tasksUpdated') renderTasks(msg.tasks);
});

function renderIssues(issues) {
  const c = document.getElementById('issueList');
  if (!issues.length) {
    c.innerHTML = '<div class="empty">No open issues</div>';
    return;
  }
  c.innerHTML = issues.map(i => \`
    <div class="issue-row" onclick="startIssue(\${i.number})" title="\${esc(i.title)}">
      <span class="issue-num">#\${i.number}</span>
      <span class="issue-title">\${esc(i.title)}</span>
      \${i.labels.slice(0, 2).map(l => '<span class="issue-label">' + esc(l) + '</span>').join('')}
      <button class="small issue-go">Go</button>
    </div>\`).join('');
}

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
        \${t.type} | \${formatTime(t.createdAt)}
        \${t.worktreeDir ? ' | worktree' : ''}
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
