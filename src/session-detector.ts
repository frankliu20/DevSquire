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
 * Detect Claude AI sessions by scanning ~/.claude/projects/<encoded-cwd>/*.jsonl
 * for session files whose last-prompt entry contains the taskLogId.
 *
 * Claude encodes the cwd into a directory name by replacing : . \ / with -
 * The JSONL filename (minus .jsonl) is the Claude session ID.
 * The last-prompt line near the end of the file is used for fast matching.
 */
export function detectClaudeSession(cwd: string, taskLogId: string): AiSession | null {
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
      const tail = readTail(path.join(projectDir, file.name));
      // Fast path: look for last-prompt line containing taskLogId
      if (contentMatchesTaskLogId(tail, taskLogId)) {
        const sessionId = file.name.replace('.jsonl', '');
        return { source: 'claude', id: sessionId, resumable: true };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Detect Copilot AI sessions by scanning ~/.copilot/session-state/{id}/events.jsonl
 * for sessions whose content contains the taskLogId.
 */
export function detectCopilotSession(taskLogId: string): AiSession | null {
  const sessionStateDir = path.join(os.homedir(), '.copilot', 'session-state');
  try {
    if (!fs.existsSync(sessionStateDir)) return null;
    const dirs = fs.readdirSync(sessionStateDir);

    for (const dir of dirs) {
      const eventsPath = path.join(sessionStateDir, dir, 'events.jsonl');
      try {
        if (!fs.existsSync(eventsPath)) continue;
        const content = fs.readFileSync(eventsPath, 'utf-8');
        if (contentMatchesTaskLogId(content, taskLogId)) {
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

/**
 * Detect all AI sessions. Tries both Claude and Copilot adapters.
 * Both use taskLogId matching on session log content.
 * Returns empty array on failure — never throws.
 */
export function detectAiSessions(cwd: string, taskLogId: string): AiSession[] {
  const sessions: AiSession[] = [];
  try {
    const claude = detectClaudeSession(cwd, taskLogId);
    if (claude) sessions.push(claude);
  } catch { /* graceful fallback */ }
  try {
    const copilot = detectCopilotSession(taskLogId);
    if (copilot) sessions.push(copilot);
  } catch { /* graceful fallback */ }
  return sessions;
}
