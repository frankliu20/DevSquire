/**
 * Embedded source for the `.squire/bin/sq.mjs` helper script.
 *
 * This Node.js script is written to disk by SquireDir.ensureBinScript()
 * and invoked by LLM agents to log events and manage decisions.
 * Using Node.js ensures cross-platform compatibility (Windows/macOS/Linux).
 *
 * Usage (from agent prompts):
 *   node "$SQUIRE_DIR/bin/sq.mjs" log "$SQUIRE_DIR" <task-id> <event-type> <detail> [--branch X] [--pr N] [--pr-url U]
 *   node "$SQUIRE_DIR/bin/sq.mjs" decision "$SQUIRE_DIR" <task-id> <title> <options-csv>
 *   node "$SQUIRE_DIR/bin/sq.mjs" decision-clear "$SQUIRE_DIR" <task-id>
 */
export const SQ_SCRIPT = `#!/usr/bin/env node
import { writeFileSync, appendFileSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';

const [,, cmd, squireDir, ...rest] = process.argv;

if (!cmd || !squireDir) {
  console.error('Usage: sq.mjs <log|decision|decision-clear> <squire-dir> ...');
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

  mkdirSync(logsDir, { recursive: true });
  appendFileSync(join(logsDir, taskId + '.jsonl'), JSON.stringify(entry) + String.fromCharCode(10));

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
  console.error('Unknown command: ' + cmd + '. Use: log, decision, decision-clear');
  process.exit(1);
}
`;
