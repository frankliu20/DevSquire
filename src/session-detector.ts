import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface AiSession {
  source: 'claude' | 'copilot';
  id: string;
  resumable: boolean;
}

/**
 * Parse a Claude session JSON file and return the sessionId if it matches the given cwd.
 * Exported for testing.
 */
export function parseClaudeSessionFile(content: string, cwd: string): string | null {
  try {
    const data = JSON.parse(content);
    if (!data.sessionId || !data.cwd) return null;
    // Normalize paths for comparison (handle Windows vs Unix)
    const normalizedCwd = cwd.replace(/\\/g, '/').toLowerCase();
    const normalizedSessionCwd = String(data.cwd).replace(/\\/g, '/').toLowerCase();
    if (normalizedSessionCwd === normalizedCwd) {
      return data.sessionId;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse a Copilot workspace.yaml file and extract the session id.
 * Exported for testing.
 */
export function parseCopilotWorkspaceYaml(content: string): string | null {
  // Simple YAML parsing — extract `id:` field from top level
  for (const line of content.split('\n')) {
    const match = line.match(/^id:\s*(.+)$/);
    if (match) return match[1].trim();
  }
  return null;
}

/**
 * Check if a Copilot events.jsonl contains a reference to the given taskLogId.
 * Exported for testing.
 */
export function copilotEventsMatchTaskLogId(content: string, taskLogId: string): boolean {
  return content.includes(taskLogId);
}

/**
 * Detect Claude AI sessions by scanning ~/.claude/projects/<encoded-cwd>/
 * for session JSONL files. The filename (minus .jsonl) is the session ID.
 *
 * Claude encodes the cwd into a directory name by replacing : \ / . with -
 */
export function detectClaudeSession(cwd: string): AiSession | null {
  try {
    const encodedCwd = cwd.replace(/[:\\/\.]/g, '-');
    const projectDir = path.join(os.homedir(), '.claude', 'projects', encodedCwd);
    if (!fs.existsSync(projectDir)) return null;

    const jsonlFiles = fs.readdirSync(projectDir).filter(f => f.endsWith('.jsonl'));
    if (jsonlFiles.length === 0) return null;

    // Pick the most recently modified .jsonl — that's the latest session
    let bestFile = '';
    let bestMtime = 0;
    for (const file of jsonlFiles) {
      const stat = fs.statSync(path.join(projectDir, file));
      if (stat.mtimeMs > bestMtime) {
        bestMtime = stat.mtimeMs;
        bestFile = file;
      }
    }

    const sessionId = bestFile.replace('.jsonl', '');
    return { source: 'claude', id: sessionId, resumable: true };
  } catch {
    return null;
  }
}

/**
 * Detect Copilot AI sessions by scanning ~/.copilot/session-state/
 * for sessions whose events.jsonl references the given taskLogId.
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
        const eventsContent = fs.readFileSync(eventsPath, 'utf-8');
        if (copilotEventsMatchTaskLogId(eventsContent, taskLogId)) {
          // Found matching session — extract id from workspace.yaml
          const yamlPath = path.join(sessionStateDir, dir, 'workspace.yaml');
          if (fs.existsSync(yamlPath)) {
            const yamlContent = fs.readFileSync(yamlPath, 'utf-8');
            const sessionId = parseCopilotWorkspaceYaml(yamlContent);
            if (sessionId) {
              return { source: 'copilot', id: sessionId, resumable: false };
            }
          }
          // Fallback: use directory name as session id
          return { source: 'copilot', id: dir, resumable: false };
        }
      } catch {
        // Skip unreadable session directories
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
 * Returns empty array on failure — never throws.
 */
export function detectAiSessions(cwd: string, taskLogId: string): AiSession[] {
  const sessions: AiSession[] = [];
  try {
    const claude = detectClaudeSession(cwd);
    if (claude) sessions.push(claude);
  } catch { /* graceful fallback */ }
  try {
    const copilot = detectCopilotSession(taskLogId);
    if (copilot) sessions.push(copilot);
  } catch { /* graceful fallback */ }
  return sessions;
}
