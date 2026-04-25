import { GitHubRepoInfo } from './github-detector';

/**
 * Generates the full 6-tab dashboard HTML for the webview.
 */
export function getDashboardHtml(repoInfo: GitHubRepoInfo): string {
  const { owner, repo } = repoInfo;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dev Pilot</title>
<style>
/* ===== Design Tokens (ported from dashboard tokens.css) ===== */
:root {
  /* VS Code theme integration */
  --bg: var(--vscode-editor-background);
  --bg-subtle: var(--vscode-sideBar-background, var(--bg));
  --bg-surface: var(--vscode-editorWidget-background, var(--bg));
  --fg: var(--vscode-editor-foreground);
  --fg-muted: var(--vscode-descriptionForeground);
  --border: var(--vscode-panel-border);
  --border-subtle: var(--vscode-widget-border, var(--border));
  --btn-bg: var(--vscode-button-background);
  --btn-fg: var(--vscode-button-foreground);
  --btn-hover: var(--vscode-button-hoverBackground);
  --btn-sec-bg: var(--vscode-button-secondaryBackground, transparent);
  --btn-sec-fg: var(--vscode-button-secondaryForeground, var(--fg));
  --btn-sec-hover: var(--vscode-button-secondaryHoverBackground, var(--bg-surface));
  --input-bg: var(--vscode-input-background);
  --input-fg: var(--vscode-input-foreground);
  --input-border: var(--vscode-input-border);
  --focus: var(--vscode-focusBorder);
  --link: var(--vscode-textLink-foreground);
  --badge-bg: var(--vscode-badge-background);
  --badge-fg: var(--vscode-badge-foreground);

  /* Status colors */
  --green: var(--vscode-terminal-ansiGreen);
  --yellow: var(--vscode-terminal-ansiYellow);
  --red: var(--vscode-terminal-ansiRed);
  --blue: var(--vscode-terminal-ansiBlue);
  --purple: var(--vscode-terminal-ansiMagenta);
  --cyan: var(--vscode-terminal-ansiCyan);

  /* Spacing scale */
  --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px; --sp-5: 20px; --sp-6: 24px;

  /* Radii */
  --r-sm: 3px; --r-md: 5px; --r-lg: 8px; --r-full: 9999px;

  /* Shadows — VS Code-aware */
  --shadow-sm: 0 1px 2px var(--vscode-widget-shadow, rgba(0,0,0,0.15));
  --shadow-md: 0 2px 8px var(--vscode-widget-shadow, rgba(0,0,0,0.2));

  /* Transitions */
  --t-fast: 100ms ease; --t-normal: 150ms ease;

  /* Typography */
  --font: var(--vscode-font-family);
  --font-mono: var(--vscode-editor-font-family);
  --text-xs: 11px; --text-sm: 12px; --text-base: 13px; --text-lg: 14px; --text-xl: 16px;
}

/* ===== Reset ===== */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: var(--font); color: var(--fg); background: var(--bg);
  font-size: var(--text-base); line-height: 1.5; overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
}
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-thumb { background: var(--vscode-scrollbarSlider-background); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--vscode-scrollbarSlider-hoverBackground); }
::selection { background: var(--focus); }

/* ===== Layout ===== */
.pad { padding: var(--sp-3); }

/* ===== Header ===== */
.header {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--sp-2) var(--sp-3); border-bottom: 1px solid var(--border);
  background: var(--bg-subtle);
}
.header-left { display: flex; align-items: center; gap: var(--sp-2); }
.header h2 { font-size: var(--text-lg); font-weight: 600; letter-spacing: -0.01em; }
.header code {
  font-size: var(--text-xs); color: var(--fg-muted); font-family: var(--font-mono);
  background: var(--input-bg); padding: 1px 6px; border-radius: var(--r-sm);
}
.account-select {
  font-size: var(--text-xs); background: var(--input-bg); color: var(--input-fg);
  border: 1px solid var(--input-border); border-radius: var(--r-sm); padding: 2px 6px;
}

/* ===== Summary bar ===== */
.summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-2); padding: var(--sp-2) var(--sp-3); }
.stat-card {
  text-align: center; padding: var(--sp-2) var(--sp-1);
  border: 1px solid var(--border-subtle); border-radius: var(--r-md);
  cursor: pointer; transition: all var(--t-normal);
  background: var(--bg-surface);
}
.stat-card:hover { background: var(--input-bg); border-color: var(--focus); transform: translateY(-1px); box-shadow: var(--shadow-sm); }
.stat-num { font-size: 20px; font-weight: 700; line-height: 1.2; }
.stat-label { font-size: var(--text-xs); color: var(--fg-muted); margin-top: 2px; }

/* ===== Tabs ===== */
.tabs {
  display: flex; border-bottom: 1px solid var(--border); overflow-x: auto;
  background: var(--bg-subtle); padding: 0 var(--sp-2);
}
.tab {
  padding: var(--sp-2) var(--sp-3); font-size: var(--text-sm); cursor: pointer;
  border: none; background: none; color: var(--fg-muted);
  border-bottom: 2px solid transparent; white-space: nowrap;
  transition: all var(--t-fast); position: relative;
}
.tab:hover { color: var(--fg); }
.tab.active { color: var(--fg); border-bottom-color: var(--btn-bg); font-weight: 500; }
.tab-badge {
  font-size: 9px; background: var(--badge-bg); color: var(--badge-fg);
  padding: 0 5px; border-radius: var(--r-full); margin-left: 4px;
  display: inline-block; min-width: 16px; text-align: center; line-height: 16px;
}
.tab-badge.pulse { animation: pulse 2s infinite; }

.tab-content { display: none; }
.tab-content.active { display: block; }

/* ===== Sub-tabs ===== */
.sub-tabs { display: flex; gap: 0; margin: var(--sp-2) 0 var(--sp-1); border-bottom: 1px solid var(--border-subtle); }
.sub-tab {
  padding: var(--sp-1) var(--sp-3); font-size: var(--text-xs); cursor: pointer;
  border: none; background: none; color: var(--fg-muted); border-bottom: 2px solid transparent;
  transition: all var(--t-fast);
}
.sub-tab:hover { color: var(--fg); }
.sub-tab.active { color: var(--fg); border-bottom-color: var(--btn-bg); }

/* ===== Buttons ===== */
button {
  padding: var(--sp-1) var(--sp-3); border: none; border-radius: var(--r-sm);
  cursor: pointer; background: var(--btn-bg); color: var(--btn-fg);
  font-size: var(--text-sm); font-family: var(--font); transition: all var(--t-fast);
  line-height: 1.4;
}
button:hover { background: var(--btn-hover); }
button:active { transform: scale(0.97); }
.btn-s { padding: 2px var(--sp-2); font-size: var(--text-xs); }
.btn-sec {
  background: var(--btn-sec-bg); color: var(--btn-sec-fg);
  border: 1px solid var(--border-subtle);
}
.btn-sec:hover { background: var(--btn-sec-hover); border-color: var(--fg-muted); }
.btn-danger { background: var(--red); color: #fff; }
.btn-danger:hover { opacity: 0.9; }
.btn-ghost { background: none; border: none; color: var(--link); padding: 0; cursor: pointer; font-size: var(--text-sm); }
.btn-ghost:hover { text-decoration: underline; }
.btn-icon { padding: var(--sp-1); background: none; border: none; color: var(--fg-muted); border-radius: var(--r-sm); }
.btn-icon:hover { background: var(--input-bg); color: var(--fg); }

/* ===== Inputs ===== */
select {
  font-size: var(--text-xs); background: var(--input-bg); color: var(--input-fg);
  border: 1px solid var(--input-border); border-radius: var(--r-sm); padding: 2px 6px;
  font-family: var(--font);
}
input[type=text], input[type=search] {
  width: 100%; padding: 5px var(--sp-2); background: var(--input-bg); color: var(--input-fg);
  border: 1px solid var(--input-border); border-radius: var(--r-sm); font-size: var(--text-sm);
  font-family: var(--font); transition: border var(--t-fast);
}
input:focus { outline: none; border-color: var(--focus); box-shadow: 0 0 0 1px var(--focus); }

/* ===== Utility ===== */
.row { display: flex; gap: var(--sp-2); align-items: center; }
.flex1 { flex: 1; }
.mb4 { margin-bottom: var(--sp-1); }
.mb8 { margin-bottom: var(--sp-2); }
.mt8 { margin-top: var(--sp-2); }
.empty { color: var(--fg-muted); font-style: italic; padding: var(--sp-5) 0; text-align: center; font-size: var(--text-sm); }
.loading { color: var(--fg-muted); padding: var(--sp-4) 0; text-align: center; font-size: var(--text-sm); }
.loading::after { content: ''; display: inline-block; width: 12px; height: 12px; border: 2px solid var(--fg-muted); border-top-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite; margin-left: 6px; vertical-align: middle; }

/* ===== Badge ===== */
.badge {
  display: inline-flex; align-items: center; font-size: 10px; padding: 1px 7px;
  border-radius: var(--r-full); font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em;
  line-height: 1.6;
}
.badge-green { background: color-mix(in srgb, var(--green) 18%, transparent); color: var(--green); }
.badge-yellow { background: color-mix(in srgb, var(--yellow) 18%, transparent); color: var(--yellow); }
.badge-red { background: color-mix(in srgb, var(--red) 18%, transparent); color: var(--red); }
.badge-blue { background: color-mix(in srgb, var(--blue) 18%, transparent); color: var(--blue); }
.badge-purple { background: color-mix(in srgb, var(--purple) 18%, transparent); color: var(--purple); }
.badge-neutral { background: var(--input-bg); color: var(--fg-muted); }
.badge-pulse { animation: pulse 2s infinite; }

/* ===== Issue list ===== */
.issue-row {
  display: flex; align-items: center; gap: var(--sp-2); padding: 5px var(--sp-2);
  border-radius: var(--r-sm); cursor: pointer; transition: background var(--t-fast);
  border-left: 2px solid transparent;
}
.issue-row:hover { background: var(--bg-surface); border-left-color: var(--btn-bg); }
.issue-num { color: var(--fg-muted); font-size: var(--text-sm); font-family: var(--font-mono); min-width: 38px; }
.issue-title { flex: 1; font-size: var(--text-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.issue-label {
  font-size: 10px; padding: 0 6px; border-radius: var(--r-full);
  background: var(--input-bg); color: var(--fg-muted); line-height: 1.6;
}
.issue-detail {
  padding: var(--sp-2) var(--sp-3); font-size: var(--text-sm); line-height: 1.6;
  background: var(--bg-surface); margin: 0 var(--sp-2) var(--sp-1);
  border-radius: 0 0 var(--r-md) var(--r-md); max-height: 200px; overflow-y: auto;
  border: 1px solid var(--border-subtle); border-top: none;
}
.issue-actions { display: flex; gap: var(--sp-1); margin-left: auto; }
.issue-actions button { opacity: 0; transition: opacity var(--t-fast); }
.issue-row:hover .issue-actions button { opacity: 1; }

/* ===== PR card ===== */
.pr-card {
  border: 1px solid var(--border-subtle); border-radius: var(--r-md);
  padding: var(--sp-2) var(--sp-3); background: var(--bg-surface);
  margin-bottom: var(--sp-2); transition: border-color var(--t-fast);
}
.pr-card:hover { border-color: var(--fg-muted); }
.pr-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--sp-1); gap: var(--sp-2); }
.pr-title { font-weight: 600; font-size: var(--text-sm); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pr-meta { font-size: var(--text-xs); color: var(--fg-muted); margin-bottom: var(--sp-1); }
.pr-actions { display: flex; gap: var(--sp-1); flex-wrap: wrap; }

/* ===== Task card ===== */
.task-card {
  border: 1px solid var(--border-subtle); border-radius: var(--r-md);
  padding: var(--sp-2) var(--sp-3); margin-bottom: var(--sp-2);
  position: relative; background: var(--bg-surface);
  transition: border-color var(--t-fast), box-shadow var(--t-fast);
}
.task-card:hover { box-shadow: var(--shadow-sm); }
.task-card.running { border-left: 3px solid var(--yellow); }
.task-card.done { border-left: 3px solid var(--green); }
.task-card.failed { border-left: 3px solid var(--red); }
.task-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--sp-1); }
.task-label { font-weight: 600; font-size: var(--text-base); }
.task-meta { font-size: var(--text-xs); color: var(--fg-muted); margin-bottom: var(--sp-1); font-family: var(--font-mono); }
.task-actions { display: flex; gap: var(--sp-1); flex-wrap: wrap; }

/* Progress pipeline */
.pipeline { display: flex; gap: 2px; margin: var(--sp-2) 0; }
.pipeline-step { flex: 1; height: 3px; border-radius: 2px; background: var(--input-bg); transition: background var(--t-normal); }
.pipeline-step.done { background: var(--green); }
.pipeline-step.active { background: var(--yellow); animation: pulse 1.5s infinite; }

/* ===== Event log ===== */
.event-log {
  font-size: var(--text-xs); max-height: 120px; overflow-y: auto;
  margin-top: var(--sp-1); border-top: 1px solid var(--border-subtle); padding-top: var(--sp-1);
}
.event-item { display: flex; gap: var(--sp-2); padding: 1px 0; }
.event-time { color: var(--fg-muted); white-space: nowrap; min-width: 56px; font-family: var(--font-mono); }
.event-msg { color: var(--fg); }

/* ===== Action card ===== */
.action-card {
  border: 1px solid var(--border-subtle); border-radius: var(--r-md);
  padding: var(--sp-2) var(--sp-3); background: var(--bg-surface); margin-bottom: var(--sp-2);
}
.action-title { font-weight: 600; font-size: var(--text-sm); margin-bottom: var(--sp-1); }
.action-msg { font-size: var(--text-sm); color: var(--fg-muted); margin-bottom: var(--sp-2); line-height: 1.5; }
.action-btns { display: flex; gap: var(--sp-1); }

/* ===== Skill card ===== */
.skill-card {
  border: 1px solid var(--border-subtle); border-radius: var(--r-md);
  padding: var(--sp-2) var(--sp-3); margin-bottom: var(--sp-2);
  cursor: pointer; transition: all var(--t-fast);
}
.skill-card:hover { background: var(--bg-surface); border-color: var(--fg-muted); }
.skill-header { display: flex; align-items: center; justify-content: space-between; }
.skill-name { font-weight: 600; font-size: var(--text-sm); }
.skill-desc { font-size: var(--text-xs); color: var(--fg-muted); margin-top: 2px; line-height: 1.4; }
.skill-content {
  font-family: var(--font-mono); font-size: var(--text-xs); line-height: 1.5;
  margin-top: var(--sp-2); padding: var(--sp-2); background: var(--bg);
  border-radius: var(--r-sm); max-height: 200px; overflow-y: auto;
  white-space: pre-wrap; display: none; border: 1px solid var(--border-subtle);
}

/* ===== Report ===== */
.report-stat {
  display: inline-flex; flex-direction: column; align-items: center;
  padding: var(--sp-2) var(--sp-3); border: 1px solid var(--border-subtle);
  border-radius: var(--r-md); min-width: 64px; margin-right: var(--sp-2);
  margin-bottom: var(--sp-2); background: var(--bg-surface);
}
.report-stat-num { font-size: 22px; font-weight: 700; line-height: 1.2; }
.report-stat-label { font-size: 10px; color: var(--fg-muted); margin-top: 2px; }
.report-item { padding: var(--sp-1) 0; font-size: var(--text-sm); border-bottom: 1px solid var(--border-subtle); }
.report-section { margin-bottom: var(--sp-4); }
.report-section h3 { font-size: var(--text-sm); font-weight: 600; margin-bottom: var(--sp-1); }

/* ===== Confirm dialog ===== */
.dialog-backdrop {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5); display: none; align-items: center; justify-content: center; z-index: 100;
  animation: fadeIn 0.15s;
}
.dialog-backdrop.show { display: flex; }
.dialog {
  background: var(--bg); border: 1px solid var(--border);
  border-radius: var(--r-lg); padding: var(--sp-4); max-width: 280px; width: 90%;
  box-shadow: var(--shadow-md); animation: slideUp 0.15s;
}
.dialog h3 { font-size: var(--text-base); margin-bottom: var(--sp-2); }
.dialog p { font-size: var(--text-sm); color: var(--fg-muted); margin-bottom: var(--sp-3); line-height: 1.5; }
.dialog-btns { display: flex; gap: var(--sp-2); justify-content: flex-end; }

/* ===== Toast ===== */
.toast-container { position: fixed; bottom: var(--sp-3); right: var(--sp-3); z-index: 200; display: flex; flex-direction: column; gap: var(--sp-2); }
.toast {
  padding: var(--sp-2) var(--sp-3); border-radius: var(--r-md); font-size: var(--text-sm); min-width: 180px;
  background: var(--bg-surface); border: 1px solid var(--border); box-shadow: var(--shadow-md);
  animation: slideIn 0.2s;
}
.toast-success { border-left: 3px solid var(--green); }
.toast-danger { border-left: 3px solid var(--red); }
.toast-info { border-left: 3px solid var(--blue); }

/* ===== Animations ===== */
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { transform: translateY(8px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes slideIn { from { transform: translateX(16px); opacity: 0; } to { transform: none; opacity: 1; } }
</style>
</head>
<body>

<!-- Header -->
<div class="header">
  <div class="header-left">
    <h2>Dev Pilot</h2>
    <code>${owner}/${repo}</code>
  </div>
  <select id="accountSelect" class="account-select" onchange="switchAccount(this.value)" style="display:none"></select>
</div>

<!-- Summary bar -->
<div class="summary">
  <div class="stat-card" onclick="switchTab('issues')"><div class="stat-num" id="statIssues">-</div><div class="stat-label">Issues</div></div>
  <div class="stat-card" onclick="switchTab('prs')"><div class="stat-num" id="statPRs">-</div><div class="stat-label">PRs</div></div>
  <div class="stat-card" onclick="switchTab('tasks')"><div class="stat-num" id="statTasks">-</div><div class="stat-label">Tasks</div></div>
  <div class="stat-card" onclick="switchTab('actions')"><div class="stat-num" id="statActions">-</div><div class="stat-label">Actions</div></div>
</div>

<!-- Main tabs -->
<div class="tabs">
  <button class="tab active" data-tab="issues" onclick="switchTab('issues')">Issues</button>
  <button class="tab" data-tab="prs" onclick="switchTab('prs')">PRs</button>
  <button class="tab" data-tab="tasks" onclick="switchTab('tasks')">Tasks</button>
  <button class="tab" data-tab="actions" onclick="switchTab('actions')">Actions</button>
  <button class="tab" data-tab="skills" onclick="switchTab('skills')">Skills</button>
  <button class="tab" data-tab="report" onclick="switchTab('report')">Report</button>
</div>

<!-- ======== ISSUES TAB ======== -->
<div class="tab-content active" id="tc-issues">
  <div class="pad">
    <div class="row mb8">
      <input type="search" id="issueSearch" placeholder="Search issues..." oninput="filterIssues()" class="flex1" />
      <button class="btn-s btn-sec" onclick="refreshIssues()">↻</button>
    </div>
    <div id="issueList"><div class="loading">Loading issues</div></div>
    <div class="row mt8">
      <input type="text" id="issueUrl" placeholder="#123 or paste URL..." class="flex1" />
      <button onclick="submitManualIssue()">Go</button>
    </div>
  </div>
</div>

<!-- ======== PRS TAB ======== -->
<div class="tab-content" id="tc-prs">
  <div class="pad">
    <div class="sub-tabs">
      <button class="sub-tab active" id="prTabMine" onclick="switchPRFilter('mine')">My PRs</button>
      <button class="sub-tab" id="prTabReview" onclick="switchPRFilter('review')">Review Requested</button>
    </div>
    <div class="row mb8 mt8">
      <button class="btn-s btn-sec" onclick="refreshPRs()">↻ Refresh</button>
    </div>
    <div id="prList"><div class="loading">Loading PRs</div></div>
  </div>
</div>

<!-- ======== TASKS TAB ======== -->
<div class="tab-content" id="tc-tasks">
  <div class="pad">
    <div class="row mb8">
      <button class="btn-s btn-sec" onclick="refreshTasks()">↻ Refresh</button>
    </div>
    <div id="taskList"><div class="empty">No active tasks</div></div>
  </div>
</div>

<!-- ======== ACTIONS TAB ======== -->
<div class="tab-content" id="tc-actions">
  <div class="pad">
    <div id="actionList"><div class="empty">No pending actions</div></div>
  </div>
</div>

<!-- ======== SKILLS TAB ======== -->
<div class="tab-content" id="tc-skills">
  <div class="pad">
    <div class="row mb8">
      <button class="btn-s" id="skillFilterAll" onclick="filterSkills('all')">All</button>
      <button class="btn-s btn-sec" id="skillFilterCmd" onclick="filterSkills('command')">Commands</button>
      <button class="btn-s btn-sec" id="skillFilterAgent" onclick="filterSkills('agent')">Agents</button>
    </div>
    <div id="skillList"><div class="loading">Loading</div></div>
  </div>
</div>

<!-- ======== REPORT TAB ======== -->
<div class="tab-content" id="tc-report">
  <div class="pad">
    <div class="sub-tabs">
      <button class="sub-tab active" id="reportTabEOD" onclick="switchReportView('eod')">End of Day</button>
      <button class="sub-tab" id="reportTabScrum" onclick="switchReportView('scrum')">Scrum</button>
    </div>
    <div id="reportContent" class="mt8"><div class="loading">Loading report</div></div>
  </div>
</div>

<!-- Confirm dialog -->
<div class="dialog-backdrop" id="confirmDialog">
  <div class="dialog">
    <h3 id="confirmTitle">Confirm</h3>
    <p id="confirmMsg"></p>
    <div class="dialog-btns">
      <button class="btn-s btn-sec" onclick="closeConfirm()">Cancel</button>
      <button class="btn-s btn-danger" id="confirmBtn" onclick="doConfirm()">Confirm</button>
    </div>
  </div>
</div>

<!-- Toast container -->
<div class="toast-container" id="toasts"></div>

<script>
const vscode = acquireVsCodeApi();

// ===== State =====
let issues = [], prs = { mine: [], review: [] }, tasks = [], decisions = [], skills = [], accounts = [];
let currentTab = 'issues', prFilter = 'mine', reportView = 'eod', skillFilter = 'all';
let expandedIssue = null, expandedTask = null, expandedSkill = null;
let confirmCallback = null;
let issuesLoaded = false, prsLoaded = false;

// ===== Tab switching =====
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(tc => tc.classList.toggle('active', tc.id === 'tc-' + tab));
  // Lazy-load on first visit
  if (tab === 'issues' && !issuesLoaded) refreshIssues();
  if (tab === 'prs' && !prsLoaded) refreshPRs();
  if (tab === 'tasks') refreshTasks();
  if (tab === 'actions') vscode.postMessage({ type: 'getDecisions' });
  if (tab === 'skills') vscode.postMessage({ type: 'getSkills' });
  if (tab === 'report') refreshReport();
}

// ===== Issues (assigned to me only) =====
function refreshIssues() {
  document.getElementById('issueList').innerHTML = '<div class="loading">Loading issues</div>';
  vscode.postMessage({ type: 'getIssues', filter: 'mine' });
}
function filterIssues() {
  const q = document.getElementById('issueSearch').value.toLowerCase();
  renderIssues(issues.filter(i => (i.title + ' #' + i.number + ' ' + i.labels.join(' ')).toLowerCase().includes(q)));
}
function renderIssues(list) {
  const c = document.getElementById('issueList');
  if (!list.length) { c.innerHTML = '<div class="empty">No issues assigned to you</div>'; return; }
  c.innerHTML = list.map(i => \`
    <div class="issue-row" onclick="toggleIssueDetail(\${i.number})">
      <span class="issue-num">#\${i.number}</span>
      <span class="issue-title">\${esc(i.title)}</span>
      \${i.labels.slice(0,2).map(l => '<span class="issue-label">' + esc(l) + '</span>').join('')}
      <span class="issue-actions">
        <button class="btn-s" onclick="event.stopPropagation();startIssue(\${i.number},'auto')">Auto</button>
        <button class="btn-s btn-sec" onclick="event.stopPropagation();startIssue(\${i.number},'normal')">Normal</button>
      </span>
    </div>
    \${expandedIssue === i.number ? '<div class="issue-detail" id="issueDetail-'+i.number+'">' + (i._body || '<div class="loading">Loading</div>') + '</div>' : ''}
  \`).join('');
}
function toggleIssueDetail(num) {
  if (expandedIssue === num) { expandedIssue = null; renderIssues(issues); return; }
  expandedIssue = num;
  renderIssues(issues);
  vscode.postMessage({ type: 'getIssueBody', number: num });
}
function startIssue(num, mode) { vscode.postMessage({ type: 'devIssue', issueUrl: '#' + num, mode }); toast('Started issue #' + num, 'success'); }
function submitManualIssue() {
  const v = document.getElementById('issueUrl').value.trim();
  if (!v) return;
  vscode.postMessage({ type: 'devIssue', issueUrl: v, mode: 'auto' });
  document.getElementById('issueUrl').value = '';
  toast('Task started', 'success');
}
document.getElementById('issueUrl').addEventListener('keydown', e => { if (e.key === 'Enter') submitManualIssue(); });

// ===== PRs =====
function switchPRFilter(f) {
  prFilter = f;
  document.getElementById('prTabMine').className = f === 'mine' ? 'sub-tab active' : 'sub-tab';
  document.getElementById('prTabReview').className = f === 'review' ? 'sub-tab active' : 'sub-tab';
  renderPRs();
}
function refreshPRs() {
  document.getElementById('prList').innerHTML = '<div class="loading">Loading PRs</div>';
  vscode.postMessage({ type: 'getPRs' });
}
function renderPRs() {
  const list = prFilter === 'mine' ? prs.mine : prs.review;
  const c = document.getElementById('prList');
  if (!list.length) { c.innerHTML = '<div class="empty">No PRs</div>'; return; }
  c.innerHTML = list.map(pr => {
    const actionBadge = pr.action ? badgeFor(pr.action) : '';
    const isOwn = prFilter === 'mine';
    return \`
    <div class="pr-card">
      <div class="pr-header">
        <span class="pr-title">#\${pr.number} \${esc(pr.title)}</span>
        \${actionBadge}
      </div>
      <div class="pr-meta">
        \${pr.branch} → \${pr.baseBranch}
        \${pr.commentCount ? ' · ' + pr.commentCount + ' comments' : ''}
        \${pr.unresolvedCount ? ' · <b>' + pr.unresolvedCount + ' unresolved</b>' : ''}
      </div>
      <div class="pr-actions">
        \${isOwn ? '<button class="btn-s btn-sec" onclick="fixComments('+pr.number+')">Fix Comments</button>' : ''}
        <button class="btn-s btn-sec" onclick="reviewPR('+pr.number+')">Review</button>
        <button class="btn-s btn-ghost" onclick="openExternal(\\''+pr.url+'\\')">GitHub ↗</button>
        \${isOwn ? '' : \`
          <select class="btn-s" onchange="reviewPRWithConfig(\${pr.number}, this.value)">
            <option value="">Review...</option>
            <option value="normal">Normal</option>
            <option value="auto-publish">Auto-publish</option>
            <option value="quick-approve">Quick Approve</option>
          </select>\`}
      </div>
    </div>\`;
  }).join('');
}
function fixComments(num) { vscode.postMessage({ type: 'fixComments', prNumber: num }); toast('Fixing comments on PR #' + num, 'info'); }
function reviewPR(num) { vscode.postMessage({ type: 'reviewPR', prNumber: num, config: { strategy: 'normal', level: 'important' } }); }
function reviewPRWithConfig(num, strategy) {
  if (!strategy) return;
  vscode.postMessage({ type: 'reviewPR', prNumber: num, config: { strategy, level: 'important' } });
  toast('Reviewing PR #' + num + ' (' + strategy + ')', 'info');
}
function badgeFor(action) {
  const map = {
    ready_to_merge: ['Ready', 'badge-green'],
    ci_failing: ['CI Fail', 'badge-red badge-pulse'],
    review_pending: ['Review', 'badge-yellow'],
    changes_requested: ['Changes', 'badge-red'],
    has_unresolved_comments: ['Unresolved', 'badge-yellow'],
    draft: ['Draft', 'badge-neutral'],
    waiting: ['Waiting', 'badge-neutral'],
  };
  const [label, cls] = map[action] || ['', 'badge-neutral'];
  return '<span class="badge ' + cls + '">' + label + '</span>';
}

// ===== Tasks =====
function refreshTasks() { vscode.postMessage({ type: 'getTasks' }); }
const PHASES = ['analyzing','exploring','planning','implementing','testing','creating_pr','done','failed'];
function renderTasks(list) {
  const c = document.getElementById('taskList');
  if (!list.length) { c.innerHTML = '<div class="empty">No active tasks</div>'; return; }
  c.innerHTML = list.map(t => {
    const phaseIdx = PHASES.indexOf(t.phase || 'planned');
    const phaseClass = t.phase === 'done' ? 'done' : t.phase === 'failed' ? 'failed' : t.status === 'running' ? 'running' : '';
    const pipeline = PHASES.slice(0, 7).map((_, i) => {
      const cls = i < phaseIdx ? 'done' : i === phaseIdx && t.status === 'running' ? 'active' : '';
      return '<div class="pipeline-step ' + cls + '"></div>';
    }).join('');

    const eventsHtml = t.events && expandedTask === t.id
      ? '<div class="event-log">' + t.events.slice(-15).map(e =>
          '<div class="event-item"><span class="event-time">' + shortTime(e.timestamp) + '</span><span class="event-msg">' + esc(e.message || e.phase || '') + '</span></div>'
        ).join('') + '</div>'
      : '';

    return \`
    <div class="task-card \${phaseClass}" onclick="toggleTaskEvents('\${t.id}')">
      <div class="task-header">
        <span class="task-label">\${esc(t.label || 'Task ' + t.id)}</span>
        <span class="badge \${t.phase === 'done' ? 'badge-green' : t.phase === 'failed' ? 'badge-red' : 'badge-yellow'}">\${t.phase || t.status}</span>
      </div>
      <div class="pipeline">\${pipeline}</div>
      <div class="task-meta">
        \${t.branch ? t.branch + ' · ' : ''}\${t.prNumber ? 'PR #' + t.prNumber + ' · ' : ''}\${shortTime(t.startedAt)}
        \${t.status === 'running' ? ' · ' + duration(t.startedAt) : ''}
      </div>
      <div class="task-actions">
        \${t.hasTerminal ? '<button class="btn-s btn-sec" onclick="event.stopPropagation();focusTerminal(\\''+t.id+'\\')">Terminal</button>' : ''}
        \${t.worktreeDir ? '<button class="btn-s btn-sec" onclick="event.stopPropagation();openWorktree(\\''+t.id+'\\')">Worktree</button>' : ''}
        \${t.status === 'running' ? '<button class="btn-s btn-danger" onclick="event.stopPropagation();confirmAction(\\'Stop task?\\',\\'This will kill the terminal.\\',()=>killTask(\\''+t.id+'\\'))">Stop</button>' : ''}
        \${t.status !== 'running' ? '<button class="btn-s btn-sec" onclick="event.stopPropagation();confirmAction(\\'Clean up?\\',\\'Remove worktree and logs.\\',()=>cleanupTask(\\''+t.id+'\\'))">Clean</button>' : ''}
      </div>
      \${eventsHtml}
    </div>\`;
  }).join('');
}
function toggleTaskEvents(id) { expandedTask = expandedTask === id ? null : id; renderTasks(tasks); }
function killTask(id) { vscode.postMessage({ type: 'killTask', taskId: id }); }
function cleanupTask(id) { vscode.postMessage({ type: 'cleanupTask', taskId: id }); }
function openWorktree(id) { vscode.postMessage({ type: 'openWorktree', taskId: id }); }
function focusTerminal(id) { vscode.postMessage({ type: 'focusTerminal', taskId: id }); }

// ===== Actions (Decisions) =====
function renderDecisions(list) {
  const c = document.getElementById('actionList');
  if (!list.length) { c.innerHTML = '<div class="empty">No pending actions</div>'; return; }
  c.innerHTML = list.map(d => \`
    <div class="action-card">
      <div class="action-title">\${esc(d.title)}</div>
      <div class="action-msg">\${esc(d.message)}</div>
      <div class="action-btns">
        \${d.prUrl ? '<button class="btn-s btn-sec" onclick="openExternal(\\''+d.prUrl+'\\')">View PR</button>' : ''}
        \${d.prNumber ? '<button class="btn-s btn-sec" onclick="fixComments('+d.prNumber+')">Fix</button>' : ''}
        <button class="btn-s btn-sec" onclick="dismissDecision('\${d.id}')">Dismiss</button>
      </div>
    </div>\`).join('');
}
function dismissDecision(id) { vscode.postMessage({ type: 'dismissDecision', id }); }

// ===== Skills =====
function filterSkills(f) {
  skillFilter = f;
  document.getElementById('skillFilterAll').className = f === 'all' ? 'btn-s' : 'btn-s btn-sec';
  document.getElementById('skillFilterCmd').className = f === 'command' ? 'btn-s' : 'btn-s btn-sec';
  document.getElementById('skillFilterAgent').className = f === 'agent' ? 'btn-s' : 'btn-s btn-sec';
  renderSkills();
}
function renderSkills() {
  const list = skillFilter === 'all' ? skills : skills.filter(s => s.type === skillFilter);
  const c = document.getElementById('skillList');
  if (!list.length) { c.innerHTML = '<div class="empty">No skills found</div>'; return; }
  c.innerHTML = list.map(s => \`
    <div class="skill-card" onclick="toggleSkill('\${esc(s.name)}')">
      <div class="skill-header">
        <span class="skill-name">\${esc(s.name)}</span>
        <span class="row">
          <span class="badge badge-neutral">\${s.type}</span>
          \${s.isPersonal ? '<span class="badge badge-purple">personal</span>' : ''}
        </span>
      </div>
      <div class="skill-desc">\${esc(s.description)}</div>
      <div class="skill-content" id="skill-\${esc(s.name)}">\${esc(s.content)}</div>
      \${s.type === 'command' ? '<button class="btn-s mt8" onclick="event.stopPropagation();runSkill(\\''+esc(s.name)+'\\')">Run</button>' : ''}
    </div>\`).join('');
}
function toggleSkill(name) {
  expandedSkill = expandedSkill === name ? null : name;
  document.querySelectorAll('.skill-content').forEach(el => {
    el.style.display = el.id === 'skill-' + name && expandedSkill === name ? 'block' : 'none';
  });
}
function runSkill(name) { vscode.postMessage({ type: 'runCommand', command: '/' + name }); toast('Running /' + name, 'info'); }

// ===== Report =====
function switchReportView(v) {
  reportView = v;
  document.getElementById('reportTabEOD').className = v === 'eod' ? 'sub-tab active' : 'sub-tab';
  document.getElementById('reportTabScrum').className = v === 'scrum' ? 'sub-tab active' : 'sub-tab';
  refreshReport();
}
function refreshReport() {
  document.getElementById('reportContent').innerHTML = '<div class="loading">Loading report</div>';
  vscode.postMessage({ type: 'getReport', view: reportView });
}
function renderEOD(r) {
  const c = document.getElementById('reportContent');
  c.innerHTML = \`
    <div class="row mb8" style="flex-wrap:wrap">
      <div class="report-stat"><div class="report-stat-num">\${r.issuesClosed}</div><div class="report-stat-label">Closed</div></div>
      <div class="report-stat"><div class="report-stat-num">\${r.prsMerged}</div><div class="report-stat-label">Merged</div></div>
      <div class="report-stat"><div class="report-stat-num">\${r.prsOpen}</div><div class="report-stat-label">Open PRs</div></div>
      <div class="report-stat"><div class="report-stat-num">\${r.commitsToday}</div><div class="report-stat-label">Commits</div></div>
    </div>
    \${r.closedIssues.length ? '<div class="report-section"><h3>Closed Issues</h3>' + r.closedIssues.map(i => '<div class="report-item">#'+i.number+' '+esc(i.title)+'</div>').join('') + '</div>' : ''}
    \${r.mergedPRs.length ? '<div class="report-section"><h3>Merged PRs</h3>' + r.mergedPRs.map(p => '<div class="report-item">#'+p.number+' '+esc(p.title)+'</div>').join('') + '</div>' : ''}
    \${r.openPRs.length ? '<div class="report-section"><h3>Open PRs</h3>' + r.openPRs.map(p => '<div class="report-item">#'+p.number+' '+esc(p.title)+' '+badgeFor(p.action)+'</div>').join('') + '</div>' : ''}
    \${r.commits.length ? '<div class="report-section"><h3>Commits Today</h3>' + r.commits.slice(0,10).map(c => '<div class="report-item" style="font-size:11px"><code>'+c.sha.substring(0,7)+'</code> '+esc(c.message)+'</div>').join('') + '</div>' : ''}
    \${r.carryOver.length ? '<div class="report-section"><h3>Carry Over</h3>' + r.carryOver.map(i => '<div class="report-item">#'+i.number+' '+esc(i.title)+'</div>').join('') + '</div>' : ''}
  \`;
}
function renderScrum(r) {
  const c = document.getElementById('reportContent');
  c.innerHTML = \`
    <div style="font-size:11px;color:var(--fg-muted);margin-bottom:8px">Since: \${shortTime(r.since)}</div>
    <div class="report-section"><h3>Done</h3>\${r.done.length ? r.done.map(i => '<div class="report-item">#'+i.number+' '+esc(i.title)+'</div>').join('') : '<div class="empty">Nothing yet</div>'}</div>
    <div class="report-section"><h3>Ongoing</h3>\${r.ongoing.length ? r.ongoing.map(i => '<div class="report-item">#'+i.number+' '+esc(i.title)+'</div>').join('') : '<div class="empty">Nothing</div>'}</div>
    <div class="report-section"><h3>Blockers</h3>\${r.blockers.length ? r.blockers.map(i => '<div class="report-item">#'+i.number+' '+esc(i.title)+' — '+esc(i.reason||'')+'</div>').join('') : '<div class="empty">No blockers</div>'}</div>
    <div class="row mt8">
      <button class="btn-s" onclick="postScrum()">Post to GitHub</button>
      <button class="btn-s btn-sec" onclick="markScrum()">Mark Scrum</button>
    </div>
  \`;
}
function postScrum() { vscode.postMessage({ type: 'postScrum' }); toast('Posted scrum to GitHub', 'success'); }
function markScrum() { vscode.postMessage({ type: 'markScrum' }); toast('Scrum marked', 'success'); }

// ===== Accounts =====
function switchAccount(user) { vscode.postMessage({ type: 'switchAccount', user }); }
function renderAccounts(list) {
  const sel = document.getElementById('accountSelect');
  if (list.length <= 1) { sel.style.display = 'none'; return; }
  sel.style.display = '';
  sel.innerHTML = list.map(a => '<option value="'+esc(a.user)+'" '+(a.active?'selected':'')+'>'+esc(a.user)+'</option>').join('');
}

// ===== Confirm dialog =====
function confirmAction(title, msg, cb) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMsg').textContent = msg;
  document.getElementById('confirmDialog').classList.add('show');
  confirmCallback = cb;
}
function doConfirm() { closeConfirm(); if (confirmCallback) confirmCallback(); confirmCallback = null; }
function closeConfirm() { document.getElementById('confirmDialog').classList.remove('show'); }

// ===== Toast =====
function toast(msg, variant) {
  const container = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast toast-' + (variant || 'info');
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ===== Utilities =====
function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function shortTime(ts) { if (!ts) return ''; try { return new Date(ts).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}); } catch { return ts; } }
function duration(ts) {
  if (!ts) return '';
  const ms = Date.now() - new Date(ts).getTime();
  const m = Math.floor(ms / 60000); const s = Math.floor((ms % 60000) / 1000);
  return m + 'm ' + s + 's';
}
function openExternal(url) { vscode.postMessage({ type: 'openExternal', url }); }

// ===== Message handler =====
window.addEventListener('message', e => {
  const msg = e.data;
  switch (msg.type) {
    case 'issues':
      issues = msg.data; issuesLoaded = true;
      document.getElementById('statIssues').textContent = issues.length;
      renderIssues(issues);
      break;
    case 'issueBody':
      { const issue = issues.find(i => i.number === msg.number);
      if (issue) { issue._body = msg.body; renderIssues(issues); } }
      break;
    case 'prs':
      prs = msg.data; prsLoaded = true;
      document.getElementById('statPRs').textContent = (prs.mine.length + prs.review.length);
      renderPRs();
      break;
    case 'tasks':
      tasks = msg.data;
      document.getElementById('statTasks').textContent = tasks.filter(t => t.status === 'running').length;
      renderTasks(tasks);
      break;
    case 'decisions':
      decisions = msg.data;
      document.getElementById('statActions').textContent = decisions.length;
      renderDecisions(decisions);
      break;
    case 'skills':
      skills = msg.data;
      renderSkills();
      break;
    case 'accounts':
      accounts = msg.data;
      renderAccounts(accounts);
      break;
    case 'eodReport':
      renderEOD(msg.data);
      break;
    case 'scrumReport':
      renderScrum(msg.data);
      break;
    case 'toast':
      toast(msg.message, msg.variant);
      break;
  }
});

// ===== Keyboard shortcuts =====
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  const tabMap = { '1': 'issues', '2': 'prs', '3': 'tasks', '4': 'actions', '5': 'skills', '6': 'report' };
  if (tabMap[e.key]) { switchTab(tabMap[e.key]); e.preventDefault(); }
  if (e.key === 'r' || e.key === 'R') { refreshIssues(); refreshPRs(); refreshTasks(); }
  if (e.key === 'Escape') { closeConfirm(); expandedIssue = null; expandedTask = null; }
});

// ===== Initial load — only issues (lazy load everything else) =====
refreshIssues();
vscode.postMessage({ type: 'getAccounts' });
</script>
</body>
</html>`;
}
