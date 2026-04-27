import { GitHubRepoInfo } from './github-detector';

/**
 * Generates the full 6-tab dashboard HTML for the webview.
 */
export function getDashboardHtml(repoInfo: GitHubRepoInfo, defaultMode: string = 'auto'): string {
  const { owner, repo } = repoInfo;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DevSquire</title>
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
  --sp-0: 0; --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px; --sp-5: 20px; --sp-6: 24px;
  --sp-7: 28px; --sp-8: 32px; --sp-9: 36px; --sp-10: 40px; --sp-12: 48px; --sp-16: 64px;

  /* Radii */
  --r-sm: 3px; --r-md: 5px; --r-lg: 8px; --r-full: 9999px;

  /* Shadows — VS Code-aware */
  --shadow-sm: 0 1px 2px var(--vscode-widget-shadow, rgba(0,0,0,0.15));
  --shadow-md: 0 2px 8px var(--vscode-widget-shadow, rgba(0,0,0,0.2));
  --shadow-lg: 0 4px 16px var(--vscode-widget-shadow, rgba(0,0,0,0.25));
  --shadow-xl: 0 8px 32px var(--vscode-widget-shadow, rgba(0,0,0,0.3));

  /* Transitions */
  --t-fast: 100ms ease; --t-normal: 150ms ease;

  /* Typography */
  --font: var(--vscode-font-family);
  --font-mono: var(--vscode-editor-font-family);
  --text-xs: calc(var(--vscode-font-size, 16px) * 0.88); --text-sm: var(--vscode-font-size, 16px); --text-base: calc(var(--vscode-font-size, 16px) * 1.06); --text-lg: calc(var(--vscode-font-size, 16px) * 1.13); --text-xl: calc(var(--vscode-font-size, 16px) * 1.25);
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
.stat-issues { border-left: 3px solid var(--blue); }
.stat-prs { border-left: 3px solid var(--purple); }
.stat-tasks { border-left: 3px solid var(--yellow); }
.stat-actions { border-left: 3px solid var(--green); }
.stat-num { font-size: 20px; font-weight: 700; line-height: 1.2; }
.stat-label { font-size: var(--text-xs); color: var(--fg-muted); margin-top: 2px; }

/* ===== Tabs ===== */
.tabs {
  display: flex; border-bottom: 1px solid var(--border); overflow-x: auto;
  background: var(--bg-subtle); padding: 0 var(--sp-2);
}
.tab {
  flex: 1; text-align: center;
  padding: var(--sp-2) var(--sp-1); font-size: var(--text-sm); cursor: pointer;
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
  line-height: 1.4; min-height: 28px;
}
button:hover { background: var(--btn-hover); }
button:active { transform: scale(0.97); }
.btn-s { padding: var(--sp-1) var(--sp-3); font-size: var(--text-xs); min-height: 26px; }
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
  border: 1px solid var(--input-border); border-radius: var(--r-md); padding: var(--sp-1) var(--sp-4) var(--sp-1) var(--sp-2);
  font-family: var(--font); cursor: pointer; transition: border var(--t-fast);
  appearance: none; -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23888'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 6px center; background-size: 8px;
}
select:focus { outline: none; border-color: var(--focus); box-shadow: 0 0 0 1px var(--focus); }
select:hover { border-color: var(--fg-muted); }
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
.empty { color: var(--fg-muted); padding: var(--sp-6) 0; text-align: center; font-size: var(--text-sm); }
.empty::before { content: attr(data-icon); display: block; font-size: 28px; margin-bottom: var(--sp-2); opacity: 0.5; }
.loading { color: var(--fg-muted); padding: var(--sp-4) 0; text-align: center; font-size: var(--text-sm); }
.loading::after { content: ''; display: inline-block; width: 12px; height: 12px; border: 2px solid var(--fg-muted); border-top-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite; margin-left: 6px; vertical-align: middle; }

/* Skeleton loading */
.skeleton { display: flex; flex-direction: column; gap: var(--sp-2); padding: var(--sp-2) 0; }
.skeleton-row { height: 36px; border-radius: var(--r-sm); background: linear-gradient(90deg, var(--input-bg) 25%, var(--bg-surface) 50%, var(--input-bg) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
.skeleton-row:nth-child(2) { width: 85%; }
.skeleton-row:nth-child(3) { width: 70%; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* Markdown body content */
.md-body { font-size: var(--text-sm); line-height: 1.6; color: var(--fg); word-wrap: break-word; }
.md-body h1, .md-body h2, .md-body h3 { font-size: var(--text-base); font-weight: 600; margin: var(--sp-2) 0 var(--sp-1); border-bottom: 1px solid var(--border-subtle); padding-bottom: var(--sp-1); }
.md-body h3 { font-size: var(--text-sm); border: none; }
.md-body p { margin: var(--sp-1) 0; }
.md-body ul, .md-body ol { padding-left: var(--sp-4); margin: var(--sp-1) 0; }
.md-body li { margin: 2px 0; }
.md-body code { font-family: var(--font-mono); font-size: var(--text-xs); background: var(--input-bg); padding: 1px 4px; border-radius: var(--r-sm); }
.md-body pre { background: var(--input-bg); padding: var(--sp-2); border-radius: var(--r-sm); overflow-x: auto; margin: var(--sp-2) 0; }
.md-body pre code { background: none; padding: 0; }
.md-body blockquote { border-left: 3px solid var(--border); padding-left: var(--sp-2); color: var(--fg-muted); margin: var(--sp-1) 0; }
.md-body a { color: var(--link); text-decoration: none; }
.md-body a:hover { text-decoration: underline; }
.md-body img { max-width: 100%; border-radius: var(--r-sm); }
.md-body table { border-collapse: collapse; width: 100%; margin: var(--sp-2) 0; font-size: var(--text-xs); }
.md-body th, .md-body td { border: 1px solid var(--border-subtle); padding: var(--sp-1) var(--sp-2); text-align: left; }
.md-body th { background: var(--input-bg); font-weight: 600; }
.md-body hr { border: none; border-top: 1px solid var(--border-subtle); margin: var(--sp-2) 0; }
.md-body input[type=checkbox] { margin-right: var(--sp-1); }

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
.issue-row:hover .issue-title { text-decoration: underline; color: var(--link); }
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
.issue-actions select { opacity: 0; transition: opacity var(--t-fast); }
.issue-actions button { opacity: 0; transition: opacity var(--t-fast); }
.issue-row:hover .issue-actions select { opacity: 1; }
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
.task-card.orphan { border-left: 3px solid var(--fg-muted); opacity: 0.75; }
.task-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--sp-1); }
.task-label { font-weight: 600; font-size: var(--text-base); }
.task-meta { font-size: var(--text-xs); color: var(--fg-muted); margin-bottom: var(--sp-1); font-family: var(--font-mono); }
.task-actions { display: flex; gap: var(--sp-1); flex-wrap: wrap; }

/* Progress pipeline */
.pipeline { display: flex; gap: 2px; margin: var(--sp-2) 0; }
.pipeline-step { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.pipeline-bar { width: 100%; height: 3px; border-radius: 2px; background: var(--input-bg); transition: background var(--t-normal); }
.pipeline-step.done .pipeline-bar { background: var(--green); }
.pipeline-step.active .pipeline-bar { background: var(--yellow); animation: pulse 1.5s infinite; }
.pipeline-step.failed .pipeline-bar { background: var(--red); }
.pipeline-label { font-size: 9px; color: var(--fg-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.pipeline-step.done .pipeline-label { color: var(--green); }
.pipeline-step.active .pipeline-label { color: var(--yellow); font-weight: 500; }
.pipeline-step.failed .pipeline-label { color: var(--red); }
.pipeline-step.failed .pipeline-bar { background: var(--red); }

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
.report-grid { display: flex; flex-direction: column; gap: var(--sp-3); }
.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-2); }
.stat-card {
  background: var(--bg-surface); border: 1px solid var(--border-subtle);
  border-radius: var(--r-lg); padding: var(--sp-2) var(--sp-3); text-align: center;
}
.stat-card-num { font-size: var(--text-xl); font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
.stat-card-label { font-size: var(--text-xs); color: var(--fg-muted); margin-top: 4px; }
.report-section {
  background: var(--bg-surface); border: 1px solid var(--border-subtle);
  border-radius: var(--r-lg); padding: var(--sp-2) var(--sp-3);
}
.report-section-title {
  display: flex; align-items: center; gap: var(--sp-2);
  font-size: var(--text-sm); font-weight: 600; margin: 0 0 var(--sp-2) 0;
  padding-bottom: var(--sp-1); border-bottom: 1px solid var(--border-subtle);
}
.report-section-title .icon { flex-shrink: 0; }
.report-item {
  display: flex; align-items: center; gap: var(--sp-2);
  padding: var(--sp-1) 0; font-size: var(--text-sm);
}
.report-item-num {
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: var(--text-xs); color: var(--blue); white-space: nowrap; flex-shrink: 0;
  cursor: pointer;
}
.report-item-num:hover { text-decoration: underline; }
.report-item-title {
  flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; color: var(--fg-muted);
}
.commit-hash {
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: var(--text-xs); color: var(--blue);
  background: var(--bg); padding: 1px 6px; border-radius: var(--r-sm); flex-shrink: 0;
}
.commit-msg { color: var(--fg-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.since-bar {
  display: flex; align-items: center; gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3); background: var(--bg);
  border: 1px solid var(--border-subtle); border-radius: var(--r-md);
  font-size: var(--text-sm); color: var(--fg-muted);
}
.scrum-actions { display: flex; gap: var(--sp-2); margin-top: var(--sp-2); }

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
@keyframes confettiFall { 0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }

/* Off-work celebration */
.offwork-overlay { position: fixed; inset: 0; z-index: 999; background: rgba(0,0,0,0.85); display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; animation: fadeIn 0.3s; }
.offwork-msg { font-size: 28px; font-weight: 700; color: #fff; margin-bottom: var(--sp-4); text-align: center; }
.offwork-sub { font-size: var(--text-lg); color: var(--fg-muted); margin-bottom: var(--sp-2); }
.offwork-time { font-size: var(--text-xl); color: var(--yellow); font-family: var(--font-mono); }
.offwork-particle { position: fixed; font-size: 24px; pointer-events: none; animation: confettiFall linear forwards; }
</style>
</head>
<body>

<!-- Header -->
<div class="header">
  <div class="header-left">
    <h2>DevSquire — Agentic Engineer</h2>
    <code>${owner}/${repo}</code>
  </div>
  <div style="display:flex;gap:var(--sp-2);align-items:center">
    <button class="btn-s btn-sec" onclick="syncMain()">Sync Main</button>
    <button class="btn-s btn-sec" onclick="offWork()">Off Work</button>
    <button class="btn-s btn-sec" onclick="confirmAction('Clean All?','Remove all completed/failed tasks and their worktrees.',()=>cleanAll())">Clean All</button>
    <select id="accountSelect" class="account-select" onchange="switchAccount(this.value)" style="display:none"></select>
  </div>
</div>

<!-- Summary bar -->
<div class="summary">
  <div class="stat-card stat-issues" onclick="switchTab('issues')"><div class="stat-num" id="statIssues">-</div><div class="stat-label">Issues</div></div>
  <div class="stat-card stat-prs" onclick="switchTab('prs')"><div class="stat-num" id="statPRs">-</div><div class="stat-label">PRs</div></div>
  <div class="stat-card stat-tasks" onclick="switchTab('tasks')"><div class="stat-num" id="statTasks">-</div><div class="stat-label">Tasks</div></div>
  <div class="stat-card stat-actions" onclick="switchTab('actions')"><div class="stat-num" id="statActions">-</div><div class="stat-label">Actions</div></div>
</div>

<!-- Main tabs -->
<div class="tabs">
  <button class="tab active" data-tab="issues" onclick="switchTab('issues')">📋 Issues</button>
  <button class="tab" data-tab="prs" onclick="switchTab('prs')">🔀 PRs</button>
  <button class="tab" data-tab="tasks" onclick="switchTab('tasks')">⚙️ Tasks</button>
  <button class="tab" data-tab="actions" onclick="switchTab('actions')">⚡ Actions <span class="tab-badge pulse" id="actionBadge" style="display:none;background:var(--yellow);color:#000">0</span></button>
  <button class="tab" data-tab="skills" onclick="switchTab('skills')">🧩 Skills</button>
  <button class="tab" data-tab="report" onclick="switchTab('report')">📊 Report</button>
</div>

<!-- ======== ISSUES TAB ======== -->
<div class="tab-content active" id="tc-issues">
  <div class="pad">
    <div class="row mb8" style="gap:var(--sp-2)">
      <input type="search" id="issueSearch" placeholder="Search issues..." oninput="filterIssues()" class="flex1" />
      <button class="btn-s btn-ghost" id="backlogBtn" onclick="toggleBacklog()" style="display:none;white-space:nowrap"></button>
      <button class="btn-s btn-sec" onclick="refreshIssues()">↻</button>
    </div>
    <div class="issue-filter-info" id="issueFilterInfo" style="display:none;font-size:var(--text-xs);color:var(--fg-muted);padding:0 var(--sp-2) var(--sp-1)"></div>
    <div id="issueList"><div class="skeleton"><div class="skeleton-row"></div><div class="skeleton-row"></div><div class="skeleton-row"></div></div></div>
    <div class="row mt8">
      <input type="text" id="issueUrl" placeholder="#123 or paste URL..." class="flex1" />
      <select id="manualMode" class="btn-s">
        <option value="auto" \${defaultMode === 'auto' ? 'selected' : ''}>Auto</option>
        <option value="normal" \${defaultMode === 'normal' ? 'selected' : ''}>Normal</option>
      </select>
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
      <span style="flex:1"></span>
      <button class="sub-tab active" id="prSubAll" onclick="switchMyPRSub('all')" style="font-size:10px">All</button>
      <button class="sub-tab" id="prSubReady" onclick="switchMyPRSub('ready')" style="font-size:10px">Ready to Merge</button>
    </div>
    <div class="row mb8 mt8" style="gap:var(--sp-2)">
      <input id="prInput" type="text" class="input" placeholder="PR # or URL" style="flex:1" onkeydown="if(event.key==='Enter')reviewPRInput()">
      <button class="btn-s btn-pri" onclick="reviewPRInput()">Review</button>
      <button class="btn-s btn-sec" onclick="refreshPRs()">↻</button>
    </div>
    <div id="prList"><div class="skeleton"><div class="skeleton-row"></div><div class="skeleton-row"></div><div class="skeleton-row"></div></div></div>
  </div>
</div>

<!-- ======== TASKS TAB ======== -->
<div class="tab-content" id="tc-tasks">
  <div class="pad">
    <div class="row mb8">
      <button class="btn-s btn-sec" onclick="refreshTasks()">↻ Refresh</button>
    </div>
    <div id="taskList"><div class="empty" data-icon="⚙️">No active tasks</div></div>
  </div>
</div>

<!-- ======== ACTIONS TAB ======== -->
<div class="tab-content" id="tc-actions">
  <div class="pad">
    <div id="actionList"><div class="empty" data-icon="⚡">No pending actions</div></div>
  </div>
</div>

<!-- ======== SKILLS TAB ======== -->
<div class="tab-content" id="tc-skills">
  <div class="pad">
    <div class="row mb8">
      <button class="btn-s" id="skillFilterAll" onclick="filterSkills('all')">All</button>
      <button class="btn-s btn-sec" id="skillFilterCmd" onclick="filterSkills('command')">Commands</button>
      <button class="btn-s btn-sec" id="skillFilterAgent" onclick="filterSkills('agent')">Agents</button>
      <button class="btn-s btn-sec" id="skillFilterSkill" onclick="filterSkills('skill')">Skills</button>
    </div>
    <div id="skillList"><div class="skeleton"><div class="skeleton-row"></div><div class="skeleton-row"></div></div></div>
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
const REPO_URL = 'https://github.com/${owner}/${repo}';
function rIssue(n) { return '<span class="report-item-num" onclick="openExternal(REPO_URL+&quot;/issues/'+n+'&quot;)">#'+n+'</span>'; }
function rPR(n) { return '<span class="report-item-num" onclick="openExternal(REPO_URL+&quot;/pull/'+n+'&quot;)">PR #'+n+'</span>'; }
function cisBadge(status) {
  if (status === 'SUCCESS') return '<span class="badge badge-green">CI ✓</span>';
  if (status === 'FAILURE' || status === 'ERROR') return '<span class="badge badge-red badge-pulse">CI ✗</span>';
  if (status === 'PENDING') return '<span class="badge badge-yellow">CI ⏳</span>';
  return '';
}

// ===== State =====
let issues = [], prs = { mine: [], review: [] }, tasks = [], decisions = [], skills = [], accounts = [];
let currentTab = 'issues', prFilter = 'mine', reportView = 'eod', skillFilter = 'all';
let expandedIssue = null, expandedTask = null, expandedSkill = null, expandedPR = null;
let confirmCallback = null;
let issuesLoaded = false, prsLoaded = false;
let myPRSubFilter = 'all'; // 'all' | 'ready'

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
  document.getElementById('issueList').innerHTML = '<div class="skeleton"><div class="skeleton-row"></div><div class="skeleton-row"></div><div class="skeleton-row"></div></div>';
  vscode.postMessage({ type: 'getIssues', filter: 'mine' });
}
let showBacklog = false;
const defaultMode = '${defaultMode}';
const BACKLOG_LABELS = ['backlog'];
function isBacklog(i) { return i.labels.some(l => BACKLOG_LABELS.includes(l.toLowerCase())); }
function toggleBacklog() { showBacklog = !showBacklog; filterIssues(); }
function filterIssues() {
  const q = document.getElementById('issueSearch').value.toLowerCase();
  const backlogCount = issues.filter(isBacklog).length;
  const btn = document.getElementById('backlogBtn');
  if (backlogCount > 0) {
    btn.style.display = '';
    btn.textContent = (showBacklog ? 'Hide' : 'Show') + ' backlog (' + backlogCount + ')';
    btn.className = 'btn-s ' + (showBacklog ? 'btn-sec' : 'btn-ghost');
  } else { btn.style.display = 'none'; }
  const filtered = issues.filter(i => {
    if (!showBacklog && isBacklog(i)) return false;
    return (i.title + ' #' + i.number + ' ' + i.labels.join(' ')).toLowerCase().includes(q);
  });
  const info = document.getElementById('issueFilterInfo');
  if (filtered.length !== issues.length) {
    info.style.display = '';
    info.textContent = 'Showing ' + filtered.length + ' of ' + issues.length + (!showBacklog && backlogCount > 0 && !q ? ' (' + backlogCount + ' backlog hidden)' : '');
  } else { info.style.display = 'none'; }
  renderIssues(filtered);
}
function getIssueTaskPhase(num) {
  const t = tasks.find(t => t.label && t.label.includes('#' + num));
  return t ? t.phase || t.status : null;
}
function issueTaskId(num) {
  const t = tasks.find(t => t.label && t.label.includes('#' + num));
  return t ? t.id : null;
}
function phaseBadge(phase) {
  if (!phase) return '';
  const map = { done: 'badge-green', failed: 'badge-red', orphan: 'badge-neutral', implementing: 'badge-blue', testing: 'badge-yellow', exploring: 'badge-blue', analyzing: 'badge-blue', planning: 'badge-purple', creating_pr: 'badge-purple', planned: 'badge-neutral' };
  const cls = Object.entries(map).find(([k]) => phase.includes(k))?.[1] || 'badge-neutral';
  return '<span class="badge ' + cls + '">' + esc(phase) + '</span>';
}
function renderIssues(list) {
  const c = document.getElementById('issueList');
  if (!list.length) { c.innerHTML = '<div class="empty" data-icon="📋">No issues assigned to you</div>'; return; }
  c.innerHTML = list.map(i => {
    const phase = getIssueTaskPhase(i.number);
    const tid = issueTaskId(i.number);
    return \`
    <div class="issue-row" onclick="openExternal(&quot;\${i.url}&quot;)">
      <span class="issue-num">#\${i.number}</span>
      <span class="issue-title">\${esc(i.title)}</span>
      \${phase ? phaseBadge(phase) : ''}
      \${i.labels.slice(0,2).map(l => '<span class="issue-label">' + esc(l) + '</span>').join('')}
      <span class="issue-actions">
        <select class="btn-s" id="mode-\${i.number}" onclick="event.stopPropagation()">
          <option value="auto" \${defaultMode==='auto'?'selected':''}>Auto</option>
          <option value="normal" \${defaultMode==='normal'?'selected':''}>Normal</option>
        </select>
        <button class="btn-s btn-pri" onclick="event.stopPropagation();assignIssue(\${i.number})">Assign</button>
      </span>
    </div>
  \`}).join('');
}
function toggleIssueDetail(num) {
  if (expandedIssue === num) { expandedIssue = null; renderIssues(issues); return; }
  expandedIssue = num;
  renderIssues(issues);
  vscode.postMessage({ type: 'getIssueBody', number: num });
}
function assignIssue(num) {
  const sel = document.getElementById('mode-' + num);
  const mode = sel ? sel.value : defaultMode;
  startIssue(num, mode);
}
function startIssue(num, mode) {
  const issue = issues.find(i => i.number === num);
  const title = issue ? issue.title : '';
  vscode.postMessage({ type: 'devIssue', issueUrl: '#' + num, mode, title });
  toast('Started issue #' + num, 'success');
}
function submitManualIssue() {
  const v = document.getElementById('issueUrl').value.trim();
  if (!v) return;
  const mode = document.getElementById('manualMode').value || defaultMode;
  vscode.postMessage({ type: 'devIssue', issueUrl: v, mode });
  document.getElementById('issueUrl').value = '';
  toast('Task started', 'success');
}
document.getElementById('issueUrl').addEventListener('keydown', e => { if (e.key === 'Enter') submitManualIssue(); });

// ===== PRs =====
function switchPRFilter(f) {
  prFilter = f;
  document.getElementById('prTabMine').className = f === 'mine' ? 'sub-tab active' : 'sub-tab';
  document.getElementById('prTabReview').className = f === 'review' ? 'sub-tab active' : 'sub-tab';
  // Show/hide My PRs sub-filter
  document.getElementById('prSubAll').style.display = f === 'mine' ? '' : 'none';
  document.getElementById('prSubReady').style.display = f === 'mine' ? '' : 'none';
  renderPRs();
}
function switchMyPRSub(f) {
  myPRSubFilter = f;
  document.getElementById('prSubAll').className = f === 'all' ? 'sub-tab active' : 'sub-tab';
  document.getElementById('prSubReady').className = f === 'ready' ? 'sub-tab active' : 'sub-tab';
  renderPRs();
}
function refreshPRs() {
  document.getElementById('prList').innerHTML = '<div class="skeleton"><div class="skeleton-row"></div><div class="skeleton-row"></div><div class="skeleton-row"></div></div>';
  vscode.postMessage({ type: 'getPRs' });
}
function renderPRs() {
  let list = prFilter === 'mine' ? prs.mine : prs.review;
  if (prFilter === 'mine' && myPRSubFilter === 'ready') {
    list = list.filter(pr => pr.action === 'ready_to_merge');
  }
  const c = document.getElementById('prList');
  if (!list.length) { c.innerHTML = '<div class="empty" data-icon="🔀">No PRs</div>'; return; }
  c.innerHTML = list.map(pr => {
    const actionBadge = pr.action ? badgeFor(pr.action) : '';
    const isOwn = prFilter === 'mine';
    return \`
    <div class="pr-card" onclick="togglePRBody(\${pr.number})" style="cursor:pointer">
      <div class="pr-header">
        <span class="pr-title">#\${pr.number} \${esc(pr.title)}</span>
        \${actionBadge}
      </div>
      <div class="pr-meta">
        \${pr.branch} → \${pr.baseBranch}
        \${pr.checksStatus ? ' · ' + cisBadge(pr.checksStatus) : ''}
        \${pr.additions != null ? ' · <span style="color:var(--green)">+' + pr.additions + '</span> <span style="color:var(--red)">-' + pr.deletions + '</span> · ' + pr.changedFiles + ' files' : ''}
        \${pr.commentCount ? ' · ' + pr.commentCount + ' comments' : ''}
        \${pr.unresolvedCount ? ' · <b>' + pr.unresolvedCount + ' unresolved</b>' : ''}
      </div>
      \${pr.checks && pr.checks.length ? '<div style="margin:var(--sp-1) 0;display:flex;flex-wrap:wrap;gap:var(--sp-1)">' + pr.checks.map(c => '<span class="badge ' + (c.conclusion==='SUCCESS'||c.conclusion==='NEUTRAL'?'badge-green':c.conclusion==='FAILURE'?'badge-red':c.status==='COMPLETED'?'badge-green':'badge-yellow') + '" style="font-size:var(--text-xs)">' + esc(c.name) + '</span>').join('') + '</div>' : ''}
      \${expandedPR === pr.number && pr._body !== undefined ? '<div class="issue-detail" style="margin:var(--sp-1) 0 var(--sp-2);border:1px solid var(--border-subtle);border-radius:var(--r-sm)">' + renderMd(pr._body) + '</div>' : ''}
      \${expandedPR === pr.number && pr._body === undefined ? '<div class="loading" style="padding:var(--sp-2) 0">Loading body</div>' : ''}
      <div class="pr-actions">
        \${isOwn ? '<button class="btn-s btn-sec" onclick="event.stopPropagation();fixComments('+pr.number+')"' + (pr.unresolvedCount ? '' : ' disabled title="No open comments"') + '>Fix Comments</button>' : ''}
        \${!isOwn ? \`<select class="btn-s" id="strategy-\${pr.number}" onclick="event.stopPropagation()" onchange="onStrategyChange(\${pr.number})">
          <option value="normal">Normal</option>
          <option value="auto">Auto-publish</option>
          <option value="quick-approve">Quick Approve</option>
        </select>
        <select class="btn-s" id="level-\${pr.number}" onclick="event.stopPropagation()">
          <option value="high">🔴 Critical only</option>
          <option value="medium" selected>🟡 Important</option>
          <option value="low">🟢 Everything</option>
        </select>\` : ''}
        <button class="btn-s btn-pri" onclick="event.stopPropagation();reviewPRFromCard(\${pr.number}, \${isOwn})">Review</button>
        <button class="btn-s btn-ghost" onclick="event.stopPropagation();openExternal(&quot;\${pr.url}&quot;)">GitHub ↗</button>
      </div>
    </div>\`;
  }).join('');
}
function togglePRBody(num) {
  if (expandedPR === num) { expandedPR = null; renderPRs(); return; }
  expandedPR = num;
  const allPRs = [].concat(prs.mine || [], prs.review || []);
  const pr = allPRs.find(p => p.number === num);
  if (pr && pr._body === undefined) {
    vscode.postMessage({ type: 'getPRBody', number: num });
  }
  renderPRs();
}
function fixComments(num) { vscode.postMessage({ type: 'fixComments', prNumber: num }); toast('Fixing comments on PR #' + num, 'info'); }
function reviewPRFromCard(num, isOwn) {
  const strategy = document.getElementById('strategy-' + num)?.value || 'normal';
  const level = strategy === 'quick-approve' ? 'high' : (document.getElementById('level-' + num)?.value || 'medium');
  const allPRs = [].concat(prs.mine || [], prs.review || []);
  const pr = allPRs.find(p => p.number === num);
  const title = pr ? pr.title : '';
  vscode.postMessage({ type: 'reviewPR', prNumber: num, config: { strategy, level, isOwn: !!isOwn }, title });
  toast('Reviewing PR #' + num + ' (' + strategy + '/' + level + ')', 'info');
}
function onStrategyChange(num) {
  const s = document.getElementById('strategy-' + num);
  const l = document.getElementById('level-' + num);
  if (s && l) {
    if (s.value === 'quick-approve') { l.value = 'high'; l.disabled = true; }
    else { l.disabled = false; }
  }
}
function reviewPR(numOrUrl, isOwn) { vscode.postMessage({ type: 'reviewPR', prNumber: numOrUrl, config: { strategy: 'normal', level: 'medium', isOwn: !!isOwn } }); }
function reviewPRInput() {
  const input = document.getElementById('prInput').value.trim();
  if (!input) return;
  if (input.includes('/pull/')) { reviewPR(input, false); }
  else {
    const m = input.match(/^#?(\d+)$/);
    if (m) { reviewPR(parseInt(m[1]), false); }
    else { toast('Enter a valid PR number or URL', 'error'); return; }
  }
  document.getElementById('prInput').value = '';
}
function badgeFor(action) {
  const map = {
    ready_to_merge: ['Ready', 'badge-green'],
    ci_failing: ['CI Fail', 'badge-red badge-pulse'],
    review_pending: ['Review pending', 'badge-yellow'],
    changes_requested: ['Changes requested', 'badge-red'],
    has_unresolved_comments: ['Unresolved comments', 'badge-yellow'],
    draft: ['Draft', 'badge-neutral'],
    waiting: ['Waiting', 'badge-neutral'],
    approved: ['Approved', 'badge-green'],
    merged: ['Merged', 'badge-purple'],
  };
  const [label, cls] = map[action] || ['', 'badge-neutral'];
  return '<span class="badge ' + cls + '">' + label + '</span>';
}

// ===== Tasks =====
function refreshTasks() { vscode.postMessage({ type: 'getTasks' }); }
const PHASES = ['planned','analyzing','exploring','planning','implementing','testing','creating_pr','done'];
const PHASE_LABELS = { planned: 'Planned', analyzing: 'Analyzing', exploring: 'Exploring', planning: 'Planning', implementing: 'Implementing', testing: 'Testing', creating_pr: 'Creating PR', done: 'Done', reviewing: 'Reviewing', published: 'Published', monitoring: 'Monitor', fixing_ci: 'Fix CI', fixing_comments: 'Fix Comments' };
// Map internal phases to pipeline display phases
const PHASE_MAP = { planned: 'planned', analyzing: 'analyzing', exploring: 'exploring', planning: 'planning', implementing: 'implementing', testing: 'testing', test_failed: 'testing', waiting_confirm: 'testing', waiting_manual_test: 'testing', creating_pr: 'creating_pr', done: 'done', failed: 'failed', reviewing: 'reviewing', published: 'published', monitoring: 'monitoring', fixing_ci: 'fixing_ci', fixing_comments: 'fixing_comments' };
// Per-type pipeline phases
const PHASE_PIPELINES = {
  'dev-issue':    ['planned','analyzing','exploring','planning','implementing','testing','creating_pr','done'],
  'review-pr':    ['reviewing','done','published'],
  'watch-pr':     ['analyzing','monitoring','fixing_ci','fixing_comments','monitoring'],
  'fix-comments': ['analyzing','implementing','testing','creating_pr','done'],
  'run-command':  ['implementing','done'],
};
// Cyclic pipelines only highlight current step (no "done" marking for previous steps)
const CYCLIC_TYPES = { 'watch-pr': true };
function renderTasks(list) {
  const c = document.getElementById('taskList');
  if (!list.length) { c.innerHTML = '<div class="empty" data-icon="⚙️">No active tasks</div>'; return; }
  c.innerHTML = list.map(t => {
    var phases = PHASE_PIPELINES[t.type] || PHASE_PIPELINES['dev-issue'];
    // Own PR reviews don't need 'published' step
    if (t.type === 'review-pr' && t.isOwnPR) phases = ['reviewing', 'done'];
    const isCyclic = CYCLIC_TYPES[t.type] || false;
    const rawPhase = t.phase || 'planned';
    const displayPhase = PHASE_MAP[rawPhase] || phases[0];
    // For cyclic pipelines, find the last occurrence to handle repeated phases (e.g. monitoring appears twice)
    const phaseIdx = isCyclic ? phases.lastIndexOf(displayPhase) : phases.indexOf(displayPhase);
    const isFailed = rawPhase === 'failed' || rawPhase === 'test_failed';
    const phaseClass = (!isCyclic && rawPhase === 'done') ? 'done' : isFailed ? 'failed' : t.status === 'orphan' ? 'orphan' : t.status === 'running' ? 'running' : '';
    // For cyclic: show unique steps, only highlight current; for linear: show progress bar
    const displayPhases = isCyclic ? phases : (phases.length <= 2 ? phases : phases.filter(p => p !== 'done'));
    const pipeline = displayPhases.map((p, i) => {
      var cls = '';
      if (isCyclic) {
        // Cyclic: only highlight the current step, don't mark previous as done
        if (isFailed && i === phaseIdx) cls = 'failed';
        else if (i === phaseIdx && (t.status === 'running' || t.status === 'orphan')) cls = 'active';
      } else {
        if (isFailed && i === phaseIdx) cls = 'failed';
        else if (rawPhase === 'done' || i < phaseIdx) cls = 'done';
        else if (i === phaseIdx && (t.status === 'running' || t.status === 'orphan')) cls = 'active';
      }
      return '<div class="pipeline-step ' + cls + '"><div class="pipeline-bar"></div><div class="pipeline-label">' + (PHASE_LABELS[p] || p) + '</div></div>';
    }).join('');

    // Latest status: use last event detail, or phase label, never raw numbers
    var latestStatus = PHASE_LABELS[displayPhase] || rawPhase;
    if (t.events && t.events.length) {
      var lastEvt = t.events[t.events.length - 1];
      var msg = lastEvt.phase || lastEvt.type || '';
      // Prefer human-readable phase label
      if (PHASE_LABELS[msg]) msg = PHASE_LABELS[msg];
      else if (PHASE_MAP[msg]) msg = PHASE_LABELS[PHASE_MAP[msg]] || msg;
      if (msg && typeof msg === 'string' && msg.length > 1) latestStatus = msg;
    }
    if (t.waiting) latestStatus += ' ⏳';
    var badgeClass = (!isCyclic && rawPhase === 'done') ? 'badge-green' : isFailed ? 'badge-red' : t.status === 'orphan' ? 'badge-neutral' : 'badge-yellow';

    const eventsHtml = t.events && expandedTask === t.id
      ? '<div class="event-log">' + t.events.slice(-15).map(e =>
          '<div class="event-item"><span class="event-time">' + shortTime(e.timestamp) + '</span><span class="event-msg">' + esc(e.message || e.phase || '') + '</span></div>'
        ).join('') + '</div>'
      : '';

    return \`
    <div class="task-card \${phaseClass}" onclick="toggleTaskEvents('\${t.id}')">
      <div class="task-header">
        <span class="task-label">\${esc(t.label || 'Task ' + t.id)}</span>
        <span class="badge \${badgeClass}">\${t.status === 'orphan' ? 'orphan' : esc(latestStatus)}</span>
      </div>
      \${isCyclic ? '' : '<div class="pipeline">' + pipeline + '</div>'}
      <div class="task-meta">
        \${t.branch ? t.branch + ' · ' : ''}\${t.prNumber ? 'PR #' + t.prNumber + ' · ' : ''}\${shortTime(t.startedAt)}
        \${t.status === 'running' ? ' · ' + duration(t.startedAt) : ''}
      </div>
      <div class="task-actions">
        \${t.hasTerminal ? '<button class="btn btn-pri" onclick="event.stopPropagation();focusTerminal(\\''+t.id+'\\')">Terminal</button>' : ''}
        \${t.worktreeDir ? '<button class="btn-s btn-sec" onclick="event.stopPropagation();openWorktree(\\''+t.id+'\\',\\''+t.worktreeDir.replace(/\\\\/g,'/')+'\\')">Worktree</button>' : ''}
        \${t.status === 'orphan' ? '<button class="btn-s btn-sec" onclick="event.stopPropagation();cleanupOrphan(\\''+t.id+'\\')">Clean</button>' : ''}
        \${t.status !== 'running' && t.status !== 'orphan' ? '<button class="btn-s btn-sec" onclick="event.stopPropagation();confirmAction(\\'Clean up?\\',\\'Remove worktree and logs.\\',()=>cleanupTask(\\''+t.id+'\\'))">Clean</button>' : ''}
        \${t.status === 'running' ? '<button class="btn-s btn-danger" style="margin-left:auto" onclick="event.stopPropagation();confirmAction(\\'Stop task?\\',\\'Send Ctrl+C to the terminal.\\',()=>killTask(\\''+t.id+'\\'))">Stop</button>' : ''}
      </div>
      \${eventsHtml}
    </div>\`;
  }).join('');
}
function toggleTaskEvents(id) { expandedTask = expandedTask === id ? null : id; renderTasks(tasks); }
function killTask(id) { vscode.postMessage({ type: 'killTask', taskId: id }); }
function cleanupTask(id) { vscode.postMessage({ type: 'cleanupTask', taskId: id }); }
function cleanupOrphan(id) { vscode.postMessage({ type: 'cleanupOrphan', taskId: id }); }
function cleanAll() { vscode.postMessage({ type: 'cleanAll' }); }
function syncMain() { vscode.postMessage({ type: 'syncMain' }); }
function offWork() {
  const msgs = ['Great work today! 🎉','Time to recharge! 🔋','You crushed it! 💪','See you tomorrow! 👋','Rest well, hero! 🦸','Mission accomplished! 🚀'];
  const emojis = ['🎉','🌟','✨','🎊','💫','🏆','🍕','🎸','🎮','🎪','🌈','🦄','🎯','🎨','🎵'];
  const overlay = document.createElement('div');
  overlay.className = 'offwork-overlay';
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  overlay.innerHTML = '<div class="offwork-msg">' + msgs[Math.floor(Math.random()*msgs.length)] + '</div><div class="offwork-sub">Clock out time</div><div class="offwork-time">' + timeStr + '</div>';
  document.body.appendChild(overlay);
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('div');
    p.className = 'offwork-particle';
    p.textContent = emojis[Math.floor(Math.random()*emojis.length)];
    p.style.left = Math.random()*100 + 'vw';
    p.style.animationDuration = (2 + Math.random()*3) + 's';
    p.style.animationDelay = Math.random()*2 + 's';
    document.body.appendChild(p);
  }
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [261.63,329.63,392.00,523.25].forEach((f,i) => {
      const o = ac.createOscillator(); const g = ac.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.15, ac.currentTime + i*0.15);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i*0.15 + 0.4);
      o.connect(g); g.connect(ac.destination);
      o.start(ac.currentTime + i*0.15); o.stop(ac.currentTime + i*0.15 + 0.5);
    });
  } catch(e) {}
  const dismiss = () => { overlay.remove(); document.querySelectorAll('.offwork-particle').forEach(p => p.remove()); };
  overlay.onclick = dismiss;
  setTimeout(dismiss, 5000);
}
function openWorktree(id, dir) { vscode.postMessage({ type: 'openWorktree', taskId: id, worktreeDir: dir }); }
function focusTerminal(id) { vscode.postMessage({ type: 'focusTerminal', taskId: id }); }

// ===== Actions (Decisions) =====
function renderDecisions(list) {
  const c = document.getElementById('actionList');
  if (!list.length) { c.innerHTML = '<div class="empty" data-icon="⚡">No pending actions</div>'; return; }
  c.innerHTML = list.map(d => \`
    <div class="action-card">
      <div class="action-title">\${esc(d.title)}</div>
      <div class="action-msg">\${esc(d.message)}</div>
      <div class="action-btns">
        \${d.taskId ? '<button class="btn btn-pri" onclick="focusTerminal(\\''+d.taskId+'\\')">Take Action</button>' : ''}
        \${d.prUrl ? '<button class="btn-s btn-sec" onclick="openExternal(&quot;'+d.prUrl+'&quot;)">View PR</button>' : ''}
        \${d.prNumber ? '<button class="btn-s btn-sec" onclick="fixComments('+d.prNumber+')">Fix</button>' : ''}
        <button class="btn-s btn-sec" onclick="dismissDecision('\${d.id}', '\${d.taskId || ''}')">Dismiss</button>
      </div>
    </div>\`).join('');
}
function dismissDecision(id, taskId) { vscode.postMessage({ type: 'dismissDecision', id, taskId }); }

// ===== Skills =====
function filterSkills(f) {
  skillFilter = f;
  document.getElementById('skillFilterAll').className = f === 'all' ? 'btn-s' : 'btn-s btn-sec';
  document.getElementById('skillFilterCmd').className = f === 'command' ? 'btn-s' : 'btn-s btn-sec';
  document.getElementById('skillFilterAgent').className = f === 'agent' ? 'btn-s' : 'btn-s btn-sec';
  document.getElementById('skillFilterSkill').className = f === 'skill' ? 'btn-s' : 'btn-s btn-sec';
  renderSkills();
}
function renderSkills() {
  const list = skillFilter === 'all' ? skills : skills.filter(s => s.type === skillFilter);
  const c = document.getElementById('skillList');
  if (!list.length) { c.innerHTML = '<div class="empty" data-icon="🧩">No skills found</div>'; return; }
  c.innerHTML = list.map(s => \`
    <div class="skill-card" onclick="toggleSkill('\${esc(s.name)}')">
      <div class="skill-header">
        <span class="skill-name">\${esc(s.name)}</span>
        <span class="row">
          <span class="badge badge-neutral">\${s.type}</span>
        </span>
      </div>
      <div class="skill-desc">\${esc(s.description)}</div>
      <div class="skill-content" id="skill-\${esc(s.name)}">\${esc(s.content)}</div>
      \${s.type === 'command' ? '<button class="btn-s mt8" onclick="event.stopPropagation();runSkill(\\''+esc(s.name)+'\\')">Run</button>' : ''}
      \${s.type === 'agent' && isRunnableAgent(s.name) ? '<button class="btn-s mt8" onclick="event.stopPropagation();promptRunAgent(\\''+esc(s.name)+'\\')">Run</button>' : ''}
    </div>\`).join('');
}
function toggleSkill(name) {
  expandedSkill = expandedSkill === name ? null : name;
  document.querySelectorAll('.skill-content').forEach(el => {
    el.style.display = el.id === 'skill-' + name && expandedSkill === name ? 'block' : 'none';
  });
}
function runSkill(name) {
  vscode.postMessage({ type: 'runCommand', command: '/' + name }); toast('Running /' + name, 'info');
}
function isRunnableAgent(name) {
  var runnable = ['squire-watch-pr', 'squire-dev-issue'];
  return runnable.indexOf(name) !== -1;
}
function promptRunAgent(name) {
  if (name === 'squire-watch-pr') {
    vscode.postMessage({ type: 'watchPRs' });
    toast('Launching Watch PRs...', 'info');
    return;
  }
  // Agent-type skills (e.g. Copilot backend) — launch directly
  vscode.postMessage({ type: 'runAgent', agent: name, input: '' });
  toast('Launching ' + name + '...', 'info');
}

// ===== Report =====
function switchReportView(v) {
  reportView = v;
  document.getElementById('reportTabEOD').className = v === 'eod' ? 'sub-tab active' : 'sub-tab';
  document.getElementById('reportTabScrum').className = v === 'scrum' ? 'sub-tab active' : 'sub-tab';
  refreshReport();
}
function refreshReport() {
  document.getElementById('reportContent').innerHTML = '<div class="skeleton"><div class="skeleton-row"></div><div class="skeleton-row"></div></div>';
  vscode.postMessage({ type: 'getReport', view: reportView });
}
function renderEOD(r) {
  const c = document.getElementById('reportContent');
  c.innerHTML = \`
    <div class="report-grid">
      <div class="stats-row">
        <div class="stat-card"><div class="stat-card-num">\${r.issuesClosed}</div><div class="stat-card-label">Issues Closed</div></div>
        <div class="stat-card"><div class="stat-card-num">\${r.prsMerged}</div><div class="stat-card-label">PRs Merged</div></div>
        <div class="stat-card"><div class="stat-card-num">\${r.prsOpen}</div><div class="stat-card-label">Open PRs</div></div>
        <div class="stat-card"><div class="stat-card-num">\${r.commitsToday}</div><div class="stat-card-label">Commits</div></div>
      </div>
      \${r.closedIssues.length || r.mergedPRs.length ? '<div class="report-section"><div class="report-section-title">✅ Completed Today</div>'
        + r.closedIssues.map(i => '<div class="report-item">'+rIssue(i.number)+'<span class="report-item-title">'+esc(i.title)+'</span></div>').join('')
        + r.mergedPRs.map(p => '<div class="report-item">'+rPR(p.number)+'<span class="report-item-title">'+esc(p.title)+'</span><span class="badge badge-green">merged</span></div>').join('')
        + '</div>' : ''}
      \${r.openPRs.length ? '<div class="report-section"><div class="report-section-title">🔀 Open PRs</div>'
        + r.openPRs.map(p => '<div class="report-item">'+rPR(p.number)+'<span class="report-item-title">'+esc(p.title)+'</span>'+badgeFor(p.action)+'</div>').join('')
        + '</div>' : ''}
      \${r.commits.length ? '<div class="report-section"><div class="report-section-title">📝 Commits Today ('+r.commits.length+')</div>'
        + r.commits.slice(0,10).map(c => '<div class="report-item"><span class="commit-hash">'+c.sha.substring(0,7)+'</span><span class="commit-msg">'+esc(c.message)+'</span></div>').join('')
        + '</div>' : ''}
      \${r.carryOver.length ? '<div class="report-section"><div class="report-section-title">📋 Carry Over ('+r.carryOver.length+')</div>'
        + r.carryOver.map(i => '<div class="report-item"'+(i.isBacklog?' style="opacity:0.5"':'')+'>'
          +rIssue(i.number)+'<span class="report-item-title">'+esc(i.title)+'</span>'
          +(i.isBacklog?'<span class="badge badge-neutral">backlog</span>':'')
          +'</div>').join('')
        + '</div>' : ''}
    </div>
  \`;
}
function renderScrum(r) {
  const c = document.getElementById('reportContent');
  c.innerHTML = \`
    <div class="report-grid">
      <div class="since-bar">🕐 Since: \${shortTime(r.since)}</div>
      <div class="report-section">
        <div class="report-section-title">✅ Done (\${r.done.length})</div>
        \${r.done.length ? r.done.map(i => '<div class="report-item">'+rIssue(i.number)+'<span class="report-item-title">'+esc(i.title)+'</span></div>').join('')
          : '<div class="empty">No completed items since last scrum.</div>'}
      </div>
      <div class="report-section">
        <div class="report-section-title">🔄 Ongoing (\${r.ongoing.length})</div>
        \${r.ongoing.length ? r.ongoing.map(i => '<div class="report-item">'+rIssue(i.number)+'<span class="report-item-title">'+esc(i.title)+'</span></div>').join('')
          : '<div class="empty">No ongoing items.</div>'}
      </div>
      <div class="report-section">
        <div class="report-section-title">🚫 Blockers (\${r.blockers.length})</div>
        \${r.blockers.length ? r.blockers.map(i => '<div class="report-item">'+rIssue(i.number)+'<span class="report-item-title">'+esc(i.title)+(i.reason ? ' — '+esc(i.reason) : '')+'</span></div>').join('')
          : '<div class="empty">No blockers — smooth sailing!</div>'}
      </div>
      <div class="scrum-actions">
        <button class="btn-s btn-pri" onclick="postScrum()">Post to GitHub</button>
        <button class="btn-s btn-sec" onclick="markScrum()">Mark Scrum</button>
      </div>
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
function renderMd(raw) {
  if (!raw) return '<em>No description</em>';
  let h = esc(raw);
  var BT = String.fromCharCode(96);
  h = h.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  h = h.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  h = h.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  h = h.replace(/\\*\\*(.+?)\\*\\*/g, '<b>$1</b>');
  h = h.replace(new RegExp(BT + '([^' + BT + ']+)' + BT, 'g'), '<code>$1</code>');
  h = h.replace(/^- \\[x\\] (.+)$/gm, '<li><input type="checkbox" checked disabled>$1</li>');
  h = h.replace(/^- \\[ \\] (.+)$/gm, '<li><input type="checkbox" disabled>$1</li>');
  h = h.replace(/^- (.+)$/gm, '<li>$1</li>');
  h = h.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  h = h.replace(/---/g, '<hr>');
  h = h.replace(/\\n/g, '<br>');
  return '<div class="md-body">' + h + '</div>';
}
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
      filterIssues();
      break;
    case 'issueBody':
      { const issue = issues.find(i => i.number === msg.number);
      if (issue) { issue._body = msg.body; renderIssues(issues); } }
      break;
    case 'prBody':
      { const allPRs = [].concat(prs.mine || [], prs.review || []);
      const pr = allPRs.find(p => p.number === msg.number);
      if (pr) { pr._body = msg.body; renderPRs(); } }
      break;
    case 'prs':
      prs = msg.data; prsLoaded = true;
      document.getElementById('statPRs').textContent = (prs.mine.length + prs.review.length);
      renderPRs();
      break;
    case 'tasks':
      tasks = msg.data;
      document.getElementById('statTasks').textContent = tasks.filter(t => t.status === 'running' || t.status === 'orphan').length;
      renderTasks(tasks);
      if (issuesLoaded) filterIssues(); // refresh issue phase badges
      break;
    case 'decisions':
      decisions = msg.data;
      document.getElementById('statActions').textContent = decisions.length;
      const badge = document.getElementById('actionBadge');
      if (decisions.length > 0) { badge.textContent = decisions.length; badge.style.display = 'inline-block'; }
      else { badge.style.display = 'none'; }
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
vscode.postMessage({ type: 'getDecisions' });
</script>
</body>
</html>`;
}
