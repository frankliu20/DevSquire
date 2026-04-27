/**
 * Embedded source for the `.squire/bin/sq.mjs` helper script.
 *
 * This Node.js script is written to disk by SquireDir.ensureBinScript()
 * and invoked by LLM agents to log events and manage decisions.
 * Using Node.js ensures cross-platform compatibility (Windows/macOS/Linux).
 *
 * Usage (from agent prompts):
 *   node "$SQUIRE_DIR/bin/sq.mjs" log "$SQUIRE_DIR" <task-id> <event-type> <detail> [--branch X] [--pr N] [--pr-url U] [--session-id S]
 *   node "$SQUIRE_DIR/bin/sq.mjs" decision "$SQUIRE_DIR" <task-id> <title> <options-csv>
 *   node "$SQUIRE_DIR/bin/sq.mjs" decision-clear "$SQUIRE_DIR" <task-id>
 *   node "$SQUIRE_DIR/bin/sq.mjs" session-id
 */
export const SQ_SCRIPT = `#!/usr/bin/env node
import { writeFileSync, readFileSync, existsSync, appendFileSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname, basename } from 'path';
import { homedir } from 'os';

const [,, cmd, ...argv] = process.argv;

function generateSessionId() {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
  return \\\`dsq-\\\${ts}-\\\${rand}\\\`;
}


if (cmd === 'session-id') {
  console.log(generateSessionId());
  process.exit(0);
}

const squireDir = argv[0];
const rest = argv.slice(1);

if (!cmd || !squireDir) {
  console.error('Usage: sq.mjs <log|decision|decision-clear|session-id> <squire-dir> ...');
  process.exit(1);
}

const logsDir = join(squireDir, 'logs');
const decisionsDir = join(squireDir, 'pending-decisions');
const ts = new Date().toISOString().replace(/\\.\\d{3}Z$/, 'Z');

function parseFlags(args) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length) {
      flags[args[i].slice(2)] = args[++i];
    } else {
      positional.push(args[i]);
    }
  }
  return { positional, flags };
}

// --- Session Index helpers ---
const GLOBAL_SQUIRE_DIR = join(homedir(), '.squire');
const SESSION_INDEX_DIR = join(GLOBAL_SQUIRE_DIR, 'sessions');
const SESSION_INDEX_PATH = join(SESSION_INDEX_DIR, 'index.json');

function readSessionIndex() {
  try {
    if (existsSync(SESSION_INDEX_PATH)) {
      return JSON.parse(readFileSync(SESSION_INDEX_PATH, 'utf-8'));
    }
  } catch { /* corrupted — start fresh */ }
  return {};
}

function writeSessionIndex(index) {
  mkdirSync(SESSION_INDEX_DIR, { recursive: true });
  writeFileSync(SESSION_INDEX_PATH, JSON.stringify(index, null, 2));
}

function deriveRepoSlug(sqDir) {
  // Resolve the repo root from squireDir (handles worktree paths)
  const normalized = sqDir.replace(/\\\\/g, '/');
  const worktreeMatch = normalized.match(/^(.+?\\.squire)\\/worktrees\\//);
  const rootSquire = worktreeMatch ? worktreeMatch[1] : normalized;
  const repoRoot = dirname(rootSquire);
  // Try to read repo slug from git remote
  try {
    const { execSync } = require('child_process');
    const url = execSync('git remote get-url origin', { cwd: repoRoot, encoding: 'utf-8', timeout: 5000 }).trim();
    const m = url.match(/github\\.com[/:](.+?)(?:\\.git)?$/);
    if (m) return m[1];
  } catch { /* fallback */ }
  return basename(repoRoot);
}

function createSessionRecord(taskId, flags) {
  const index = readSessionIndex();
  const repo = deriveRepoSlug(squireDir);

  if (!index[repo]) index[repo] = {};
  if (!index[repo][taskId]) index[repo][taskId] = { sessions: [] };

  const session = {
    id: flags['session-id'] || generateSessionId(),
    startedAt: ts,
    endedAt: null,
    aiSessions: [],
  };
  index[repo][taskId].sessions.push(session);

  writeSessionIndex(index);
}

if (cmd === 'log') {
  // sq.mjs log <squire-dir> <task-id> <event-type> <detail> [--branch X] [--pr N] [--pr-url U]
  const { positional, flags } = parseFlags(rest);
  const [taskId, eventType, detail] = positional;
  if (!taskId || !eventType) {
    console.error('Usage: sq.mjs log <squire-dir> <task-id> <event-type> <detail> [--branch X] [--pr N]');
    process.exit(1);
  }
  const entry = {
    timestamp: ts,
    task_id: taskId,
    type: eventType,
    detail: detail || '',
  };
  if (flags.branch) entry.branch = flags.branch;
  if (flags.pr) entry.pr_number = parseInt(flags.pr, 10);
  if (flags['pr-url']) entry.pr_url = flags['pr-url'];
  if (flags['session-id']) entry.dsq_session = flags['session-id'];

  mkdirSync(logsDir, { recursive: true });
  appendFileSync(join(logsDir, taskId + '.jsonl'), JSON.stringify(entry) + String.fromCharCode(10));

  // Create session record in global index on session_start
  if (eventType === 'session_start' || eventType === 'task_start') {
    try { createSessionRecord(taskId, flags); } catch { /* non-critical */ }
  }

} else if (cmd === 'decision') {
  // sq.mjs decision <squire-dir> <task-id> <title> <options-csv>
  const [taskId, title, optionsCsv] = rest;
  if (!taskId || !title) {
    console.error('Usage: sq.mjs decision <squire-dir> <task-id> <title> <options-csv>');
    process.exit(1);
  }
  const options = optionsCsv ? optionsCsv.split(',').map(s => s.trim()) : [];
  const id = taskId + '-' + Date.now();
  const decision = {
    id,
    taskId,
    type: 'decision',
    title,
    message: title,
    options,
    createdAt: ts,
  };
  mkdirSync(decisionsDir, { recursive: true });
  writeFileSync(join(decisionsDir, taskId + '.json'), JSON.stringify(decision, null, 2));

  // Also log the decision_requested event
  const logEntry = {
    timestamp: ts,
    task_id: taskId,
    type: 'decision_requested',
    detail: title,
  };
  mkdirSync(logsDir, { recursive: true });
  appendFileSync(join(logsDir, taskId + '.jsonl'), JSON.stringify(logEntry) + String.fromCharCode(10));

} else if (cmd === 'decision-clear') {
  // sq.mjs decision-clear <squire-dir> <task-id>
  const [taskId] = rest;
  if (!taskId) {
    console.error('Usage: sq.mjs decision-clear <squire-dir> <task-id>');
    process.exit(1);
  }
  try { unlinkSync(join(decisionsDir, taskId + '.json')); } catch { /* ok if missing */ }

} else {
  console.error('Unknown command: ' + cmd + '. Use: log, decision, decision-clear, session-id');
  process.exit(1);
}
`;
