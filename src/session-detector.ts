import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface AiSession {
  source: 'claude' | 'copilot';
  id: string;
  resumable: boolean;
}

/**
 * Check if file content contains the given taskLogId (via [task-log-id:...] tag).
 * Used by both Claude and Copilot detectors.
 * Exported for testing.
 */
export function contentMatchesTaskLogId(content: string, taskLogId: string): boolean {
  return content.includes(taskLogId);
}

/**
 * Parse a Copilot workspace.yaml file and extract the session id.
 * Exported for testing.
 */
export function parseCopilotWorkspaceYaml(content: string): string | null {
  for (const line of content.split('\n')) {
    const match = line.match(/^id:\s*(.+)$/);
    if (match) return match[1].trim();
  }
  return null;
}

/**
 * Read the head of a file (first N bytes).
 */
function readHead(filePath: string, bytes: number = 4096): string {
  const stat = fs.statSync(filePath);
  if (stat.size <= bytes) return fs.readFileSync(filePath, 'utf-8');
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(bytes);
  fs.readSync(fd, buf, 0, bytes, 0);
  fs.closeSync(fd);
  return buf.toString('utf-8');
}

/**
 * Read the tail of a file (last N bytes) to avoid reading huge JSONL files.
 */
function readTail(filePath: string, bytes: number = 4096): string {
  const stat = fs.statSync(filePath);
  if (stat.size <= bytes) return fs.readFileSync(filePath, 'utf-8');
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(bytes);
  fs.readSync(fd, buf, 0, bytes, stat.size - bytes);
  fs.closeSync(fd);
  return buf.toString('utf-8');
}

/**
 * Parse the last-prompt JSON line from a Claude JSONL file tail.
 * Returns { lastPrompt, sessionId } or null if not found.
 * Exported for testing.
 */
export function parseClaudeLastPrompt(tail: string): { lastPrompt: string; sessionId: string } | null {
  // Search lines in reverse — last-prompt is near the end
  const lines = tail.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line || !line.includes('"last-prompt"')) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.type === 'last-prompt' && obj.sessionId) {
        return { lastPrompt: obj.lastPrompt || '', sessionId: obj.sessionId };
      }
    } catch { /* skip malformed lines */ }
  }
  return null;
}

/**
 * Detect Claude AI sessions by scanning ~/.claude/projects/<encoded-cwd>/*.jsonl.
 * Matches by sessionId (dsq-xxx) injected via [session-id:...] tag in the prompt.
 * Reads tail (last-prompt) then head (first user message) for matching.
 *
 * Claude encodes the cwd into a directory name by replacing : . \ / with -
 */
export function detectClaudeSession(cwd: string, sessionId: string): AiSession | null {
  try {
    const encodedCwd = cwd.replace(/[:\.\\/]/g, '-');
    const projectDir = path.join(os.homedir(), '.claude', 'projects', encodedCwd);
    if (!fs.existsSync(projectDir)) return null;

    const jsonlFiles = fs.readdirSync(projectDir).filter(f => f.endsWith('.jsonl'));
    if (jsonlFiles.length === 0) return null;

    // Sort by mtime descending — check most recent first
    const sorted = jsonlFiles
      .map(f => ({ name: f, mtime: fs.statSync(path.join(projectDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);

    for (const file of sorted) {
      const filePath = path.join(projectDir, file.name);
      // Fast path: parse last-prompt from tail
      const tail = readTail(filePath);
      const lastPrompt = parseClaudeLastPrompt(tail);
      if (lastPrompt && lastPrompt.lastPrompt.includes(sessionId)) {
        return { source: 'claude', id: lastPrompt.sessionId, resumable: true };
      }
      // Fallback: check head for sessionId in first user message
      const head = readHead(filePath);
      if (contentMatchesTaskLogId(head, sessionId)) {
        const claudeSessionId = file.name.replace('.jsonl', '');
        return { source: 'claude', id: claudeSessionId, resumable: true };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Detect Copilot AI sessions by scanning ~/.copilot/session-state/{id}/events.jsonl
 * for sessions whose content contains the sessionId (dsq-xxx).
 */
export function detectCopilotSession(sessionId: string): AiSession | null {
  const sessionStateDir = path.join(os.homedir(), '.copilot', 'session-state');
  try {
    if (!fs.existsSync(sessionStateDir)) return null;
    const dirs = fs.readdirSync(sessionStateDir);

    for (const dir of dirs) {
      const eventsPath = path.join(sessionStateDir, dir, 'events.jsonl');
      try {
        if (!fs.existsSync(eventsPath)) continue;
        const content = fs.readFileSync(eventsPath, 'utf-8');
        if (contentMatchesTaskLogId(content, sessionId)) {
          const yamlPath = path.join(sessionStateDir, dir, 'workspace.yaml');
          if (fs.existsSync(yamlPath)) {
            const yamlContent = fs.readFileSync(yamlPath, 'utf-8');
            const sessionId = parseCopilotWorkspaceYaml(yamlContent);
            if (sessionId) {
              return { source: 'copilot', id: sessionId, resumable: false };
            }
          }
          return { source: 'copilot', id: dir, resumable: false };
        }
      } catch {
        continue;
      }
    }
    return null;
  } catch {
    return null;
  }
}

