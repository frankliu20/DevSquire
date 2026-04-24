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
  --desc: var(--vscode-descriptionForeground);
  --link: var(--vscode-textLink-foreground);
  --green: var(--vscode-terminal-ansiGreen);
  --yellow: var(--vscode-terminal-ansiYellow);
  --red: var(--vscode-terminal-ansiRed);
  --blue: var(--vscode-terminal-ansiBlue);
  --purple: var(--vscode-terminal-ansiMagenta);
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: var(--vscode-font-family); color: var(--fg); background: var(--bg); font-size: 13px; overflow-x: hidden; }
.pad { padding: 10px 12px; }

/* --- Header --- */
.header { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid var(--border); }
.header-left { display: flex; align-items: center; gap: 8px; }
.header h2 { font-size: 14px; font-weight: 600; }
.header code { font-size: 11px; color: var(--desc); background: var(--input-bg); padding: 1px 5px; border-radius: 3px; }
.account-select { font-size: 11px; background: var(--input-bg); color: var(--input-fg); border: 1px solid var(--input-border); border-radius: 3px; padding: 2px 4px; }

/* --- Summary bar --- */
.summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; padding: 8px 12px; }
.stat-card {
  text-align: center; padding: 6px 4px; border: 1px solid var(--border); border-radius: 4px;
  cursor: pointer; font-size: 11px; transition: background 0.15s;
}
.stat-card:hover { background: var(--input-bg); }
.stat-num { font-size: 18px; font-weight: 700; }
.stat-label { color: var(--desc); }

/* --- Tabs --- */
.tabs { display: flex; border-bottom: 1px solid var(--border); overflow-x: auto; }
.tab {
  padding: 6px 10px; font-size: 12px; cursor: pointer; border: none; background: none;
  color: var(--desc); border-bottom: 2px solid transparent; white-space: nowrap;
  flex-shrink: 0;
}
.tab:hover { color: var(--fg); }
.tab.active { color: var(--fg); border-bottom-color: var(--btn-bg); }
.tab-count { font-size: 10px; background: var(--input-bg); padding: 0 4px; border-radius: 8px; margin-left: 3px; }

.tab-content { display: none; }
.tab-content.active { display: block; }

/* --- Sub-tabs --- */
.sub-tabs { display: flex; gap: 0; margin: 8px 12px 4px; border-bottom: 1px solid var(--border); }
.sub-tab { padding: 3px 10px; font-size: 11px; cursor: pointer; border: none; background: none; color: var(--desc); border-bottom: 2px solid transparent; }
.sub-tab.active { color: var(--fg); border-bottom-color: var(--btn-bg); }

/* --- Common --- */
button { padding: 4px 10px; border: none; border-radius: 3px; cursor: pointer; background: var(--btn-bg); color: var(--btn-fg); font-size: 12px; }
button:hover { background: var(--btn-hover); }
.btn-s { padding: 2px 8px; font-size: 11px; }
.btn-sec { background: transparent; color: var(--fg); border: 1px solid var(--border); }
.btn-sec:hover { background: var(--input-bg); }
.btn-danger { background: var(--red); }
.btn-ghost { background: none; border: none; color: var(--link); padding: 0; cursor: pointer; font-size: 12px; }
.btn-ghost:hover { text-decoration: underline; }
select { font-size: 11px; background: var(--input-bg); color: var(--input-fg); border: 1px solid var(--input-border); border-radius: 3px; padding: 2px 4px; }
input[type=text], input[type=search] {
  width: 100%; padding: 5px 8px; background: var(--input-bg); color: var(--input-fg);
  border: 1px solid var(--input-border); border-radius: 3px; font-size: 12px;
}
input:focus { outline: 1px solid var(--btn-bg); }
.row { display: flex; gap: 6px; align-items: center; }
.flex1 { flex: 1; }
.mb8 { margin-bottom: 8px; }
.mt8 { margin-top: 8px; }
.empty { color: var(--desc); font-style: italic; padding: 16px 0; text-align: center; font-size: 12px; }
.loading { color: var(--desc); padding: 12px 0; text-align: center; font-size: 12px; }

/* --- Badge --- */
.badge {
  display: inline-block; font-size: 10px; padding: 1px 6px; border-radius: 8px;
  font-weight: 600; text-transform: uppercase;
}
.badge-green { background: var(--green); color: #000; }
.badge-yellow { background: var(--yellow); color: #000; }
.badge-red { background: var(--red); color: #fff; }
.badge-blue { background: var(--blue); color: #000; }
.badge-purple { background: var(--purple); color: #fff; }
.badge-neutral { background: var(--input-bg); color: var(--desc); }
.badge-pulse { animation: pulse 2s infinite; }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }

/* --- Issue list --- */
.issue-row {
  display: flex; align-items: center; gap: 6px; padding: 5px 8px; border-radius: 3px; cursor: pointer;
}
.issue-row:hover { background: var(--input-bg); }
.issue-num { color: var(--desc); font-size: 12px; min-width: 36px; }
.issue-title { flex: 1; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.issue-label { font-size: 10px; padding: 0 5px; border-radius: 8px; background: var(--input-bg); color: var(--desc); }
.issue-detail { padding: 8px 12px; border-top: 1px solid var(--border); font-size: 12px; line-height: 1.5; background: var(--input-bg); margin: 0 8px 4px; border-radius: 0 0 4px 4px; max-height: 200px; overflow-y: auto; }
.issue-actions { display: flex; gap: 4px; margin-left: auto; }
.issue-actions button { visibility: hidden; }
.issue-row:hover .issue-actions button { visibility: visible; }

/* --- PR card --- */
.pr-card { border: 1px solid var(--border); border-radius: 4px; padding: 8px 10px; background: var(--input-bg); margin-bottom: 6px; }
.pr-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.pr-title { font-weight: 600; font-size: 12px; flex: 1; }
.pr-meta { font-size: 11px; color: var(--desc); margin-bottom: 4px; }
.pr-actions { display: flex; gap: 4px; flex-wrap: wrap; }

/* --- Task card --- */
.task-card { border: 1px solid var(--border); border-radius: 4px; padding: 8px 10px; margin-bottom: 6px; position: relative; }
.task-card.running { border-left: 3px solid var(--yellow); }
.task-card.done { border-left: 3px solid var(--green); }
.task-card.failed { border-left: 3px solid var(--red); }
.task-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.task-label { font-weight: 600; font-size: 13px; }
.task-meta { font-size: 11px; color: var(--desc); margin-bottom: 4px; }
.task-actions { display: flex; gap: 4px; flex-wrap: wrap; }

/* Progress pipeline */
.pipeline { display: flex; gap: 2px; margin: 6px 0; }
.pipeline-step {
  flex: 1; height: 4px; border-radius: 2px; background: var(--input-bg);
}
.pipeline-step.done { background: var(--green); }
.pipeline-step.active { background: var(--yellow); animation: pulse 1.5s infinite; }

/* --- Event log --- */
.event-log { font-size: 11px; max-height: 120px; overflow-y: auto; margin-top: 4px; border-top: 1px solid var(--border); padding-top: 4px; }
.event-item { display: flex; gap: 6px; padding: 1px 0; }
.event-time { color: var(--desc); white-space: nowrap; min-width: 60px; }
.event-msg { color: var(--fg); }

/* --- Action card (decisions) --- */
.action-card { border: 1px solid var(--border); border-radius: 4px; padding: 8px 10px; background: var(--input-bg); margin-bottom: 6px; }
.action-title { font-weight: 600; font-size: 12px; margin-bottom: 4px; }
.action-msg { font-size: 12px; color: var(--desc); margin-bottom: 6px; }
.action-btns { display: flex; gap: 4px; }

/* --- Skill card --- */
.skill-card { border: 1px solid var(--border); border-radius: 4px; padding: 8px 10px; margin-bottom: 6px; cursor: pointer; }
.skill-card:hover { background: var(--input-bg); }
.skill-header { display: flex; align-items: center; justify-content: space-between; }
.skill-name { font-weight: 600; font-size: 12px; }
.skill-desc { font-size: 11px; color: var(--desc); margin-top: 2px; }
.skill-content { font-family: var(--vscode-editor-font-family); font-size: 11px; line-height: 1.5; margin-top: 6px; padding: 6px; background: var(--bg); border-radius: 3px; max-height: 200px; overflow-y: auto; white-space: pre-wrap; display: none; }

/* --- Report --- */
.report-stat { display: inline-block; text-align: center; padding: 8px 12px; border: 1px solid var(--border); border-radius: 4px; min-width: 60px; margin-right: 6px; margin-bottom: 6px; }
.report-stat-num { font-size: 20px; font-weight: 700; }
.report-stat-label { font-size: 10px; color: var(--desc); }
.report-item { padding: 3px 0; font-size: 12px; border-bottom: 1px solid var(--border); }
.report-section { margin-bottom: 12px; }
.report-section h3 { font-size: 12px; font-weight: 600; margin-bottom: 4px; }

/* --- Confirm dialog --- */
.dialog-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: none; align-items: center; justify-content: center; z-index: 100; }
.dialog-backdrop.show { display: flex; }
.dialog { background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 16px; max-width: 280px; width: 100%; }
.dialog h3 { font-size: 13px; margin-bottom: 8px; }
.dialog p { font-size: 12px; color: var(--desc); margin-bottom: 12px; }
.dialog-btns { display: flex; gap: 6px; justify-content: flex-end; }

/* --- Toast --- */
.toast-container { position: fixed; bottom: 12px; right: 12px; z-index: 200; display: flex; flex-direction: column; gap: 6px; }
.toast {
  padding: 8px 12px; border-radius: 4px; font-size: 12px; min-width: 180px;
  background: var(--input-bg); border: 1px solid var(--border); animation: slideIn 0.2s;
}
.toast-success { border-left: 3px solid var(--green); }
.toast-danger { border-left: 3px solid var(--red); }
.toast-info { border-left: 3px solid var(--blue); }
@keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: none; opacity: 1; } }
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
      <input type="search" id="issueSearch" placeholder="Search issues..." oninput="filterIssues()" />
      <button class="btn-s btn-sec" onclick="refreshIssues()">↻</button>
    </div>
    <div class="sub-tabs">
      <button class="sub-tab active" id="issueTabAll" onclick="switchIssueFilter('all')">All Open</button>
      <button class="sub-tab" id="issueTabMine" onclick="switchIssueFilter('mine')">Assigned to Me</button>
    </div>
    <div id="issueList"><div class="loading">Loading issues...</div></div>
    <!-- Manual input fallback -->
    <div class="row mt8">
      <input type="text" id="issueUrl" placeholder="#123 or paste URL..." style="flex:1" />
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
    <div id="prList"><div class="loading">Loading PRs...</div></div>
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
    <div id="skillList"><div class="loading">Loading...</div></div>
  </div>
</div>

<!-- ======== REPORT TAB ======== -->
<div class="tab-content" id="tc-report">
  <div class="pad">
    <div class="sub-tabs">
      <button class="sub-tab active" id="reportTabEOD" onclick="switchReportView('eod')">End of Day</button>
      <button class="sub-tab" id="reportTabScrum" onclick="switchReportView('scrum')">Scrum</button>
    </div>
    <div id="reportContent" class="mt8"><div class="loading">Loading report...</div></div>
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
let currentTab = 'issues', issueFilter = 'all', prFilter = 'mine', reportView = 'eod', skillFilter = 'all';
let expandedIssue = null, expandedPR = null, expandedTask = null, expandedSkill = null;
let confirmCallback = null;

// ===== Tab switching =====
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(tc => tc.classList.toggle('active', tc.id === 'tc-' + tab));
  // Lazy-load data
  if (tab === 'issues') refreshIssues();
  if (tab === 'prs') refreshPRs();
  if (tab === 'tasks') refreshTasks();
  if (tab === 'actions') vscode.postMessage({ type: 'getDecisions' });
  if (tab === 'skills') vscode.postMessage({ type: 'getSkills' });
  if (tab === 'report') refreshReport();
}

// ===== Issues =====
function switchIssueFilter(f) {
  issueFilter = f;
  document.getElementById('issueTabAll').className = f === 'all' ? 'sub-tab active' : 'sub-tab';
  document.getElementById('issueTabMine').className = f === 'mine' ? 'sub-tab active' : 'sub-tab';
  refreshIssues();
}
function refreshIssues() {
  document.getElementById('issueList').innerHTML = '<div class="loading">Loading...</div>';
  vscode.postMessage({ type: 'getIssues', filter: issueFilter });
}
function filterIssues() {
  const q = document.getElementById('issueSearch').value.toLowerCase();
  renderIssues(issues.filter(i => (i.title + ' #' + i.number + ' ' + i.labels.join(' ')).toLowerCase().includes(q)));
}
function renderIssues(list) {
  const c = document.getElementById('issueList');
  if (!list.length) { c.innerHTML = '<div class="empty">No issues found</div>'; return; }
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
    \${expandedIssue === i.number ? '<div class="issue-detail" id="issueDetail-'+i.number+'">' + (i._body || 'Loading...') + '</div>' : ''}
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
  document.getElementById('prList').innerHTML = '<div class="loading">Loading...</div>';
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
        \${t.status !== 'running' ? '<button class="btn-s btn-sec" onclick="event.stopPropagation();confirmAction(\\'Clean up?\\',\\'This will remove the worktree and logs.\\',()=>cleanupTask(\\''+t.id+'\\'))">Clean</button>' : ''}
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
  document.getElementById('reportContent').innerHTML = '<div class="loading">Loading report...</div>';
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
    \${r.closedIssues.length ? '<div class="report-section"><h3>✅ Closed Issues</h3>' + r.closedIssues.map(i => '<div class="report-item">#'+i.number+' '+esc(i.title)+'</div>').join('') + '</div>' : ''}
    \${r.mergedPRs.length ? '<div class="report-section"><h3>🎉 Merged PRs</h3>' + r.mergedPRs.map(p => '<div class="report-item">#'+p.number+' '+esc(p.title)+'</div>').join('') + '</div>' : ''}
    \${r.openPRs.length ? '<div class="report-section"><h3>📋 Open PRs</h3>' + r.openPRs.map(p => '<div class="report-item">#'+p.number+' '+esc(p.title)+' '+badgeFor(p.action)+'</div>').join('') + '</div>' : ''}
    \${r.commits.length ? '<div class="report-section"><h3>📝 Commits Today</h3>' + r.commits.slice(0,10).map(c => '<div class="report-item" style="font-size:11px"><code>'+c.sha.substring(0,7)+'</code> '+esc(c.message)+'</div>').join('') + '</div>' : ''}
    \${r.carryOver.length ? '<div class="report-section"><h3>📌 Carry Over</h3>' + r.carryOver.map(i => '<div class="report-item">#'+i.number+' '+esc(i.title)+'</div>').join('') + '</div>' : ''}
  \`;
}
function renderScrum(r) {
  const c = document.getElementById('reportContent');
  c.innerHTML = \`
    <div style="font-size:11px;color:var(--desc);margin-bottom:8px">Since: \${shortTime(r.since)}</div>
    <div class="report-section"><h3>✅ Done</h3>\${r.done.length ? r.done.map(i => '<div class="report-item">#'+i.number+' '+esc(i.title)+'</div>').join('') : '<div class="empty">Nothing yet</div>'}</div>
    <div class="report-section"><h3>🔄 Ongoing</h3>\${r.ongoing.length ? r.ongoing.map(i => '<div class="report-item">#'+i.number+' '+esc(i.title)+'</div>').join('') : '<div class="empty">Nothing</div>'}</div>
    <div class="report-section"><h3>🚫 Blockers</h3>\${r.blockers.length ? r.blockers.map(i => '<div class="report-item">#'+i.number+' '+esc(i.title)+' — '+esc(i.reason||'')+'</div>').join('') : '<div class="empty">No blockers 🎉</div>'}</div>
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
      issues = msg.data;
      document.getElementById('statIssues').textContent = issues.length;
      renderIssues(issues);
      break;
    case 'issueBody':
      const issue = issues.find(i => i.number === msg.number);
      if (issue) { issue._body = msg.body; renderIssues(issues); }
      break;
    case 'prs':
      prs = msg.data;
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

// ===== Initial load =====
refreshIssues();
vscode.postMessage({ type: 'getAccounts' });
</script>
</body>
</html>`;
}
