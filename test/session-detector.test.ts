import { describe, it, expect } from 'vitest';

// --- Extracted logic from session-detector.ts for unit testing ---

function parseClaudeSessionFile(content: string, cwd: string): string | null {
  try {
    const data = JSON.parse(content);
    if (!data.sessionId || !data.cwd) return null;
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

function parseCopilotWorkspaceYaml(content: string): string | null {
  for (const line of content.split('\n')) {
    const match = line.match(/^id:\s*(.+)$/);
    if (match) return match[1].trim();
  }
  return null;
}

function copilotEventsMatchTaskLogId(content: string, taskLogId: string): boolean {
  return content.includes(taskLogId);
}

// --- Tests ---

describe('Session Detector', () => {
  describe('parseClaudeSessionFile', () => {
    const validSession = JSON.stringify({
      pid: 38440,
      sessionId: '010eddef-3f05-4711-8270-ad465e88aad5',
      cwd: 'C:\\Users\\alice\\project',
      startedAt: 1777273077137,
      version: '2.1.116',
    });

    it('returns sessionId when cwd matches', () => {
      expect(parseClaudeSessionFile(validSession, 'C:\\Users\\alice\\project'))
        .toBe('010eddef-3f05-4711-8270-ad465e88aad5');
    });

    it('matches cwd case-insensitively', () => {
      expect(parseClaudeSessionFile(validSession, 'c:\\users\\alice\\project'))
        .toBe('010eddef-3f05-4711-8270-ad465e88aad5');
    });

    it('normalizes slashes for comparison', () => {
      expect(parseClaudeSessionFile(validSession, 'C:/Users/alice/project'))
        .toBe('010eddef-3f05-4711-8270-ad465e88aad5');
    });

    it('returns null when cwd does not match', () => {
      expect(parseClaudeSessionFile(validSession, '/other/path')).toBeNull();
    });

    it('returns null for missing sessionId', () => {
      expect(parseClaudeSessionFile('{"cwd":"/a"}', '/a')).toBeNull();
    });

    it('returns null for missing cwd', () => {
      expect(parseClaudeSessionFile('{"sessionId":"abc"}', '/a')).toBeNull();
    });

    it('returns null for invalid JSON', () => {
      expect(parseClaudeSessionFile('not json', '/a')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(parseClaudeSessionFile('', '/a')).toBeNull();
    });
  });

  describe('parseCopilotWorkspaceYaml', () => {
    const validYaml = `id: 09f18f7c-0419-4a29-8432-b9d8f8180bdd
cwd: C:\\Users\\alice\\project
git_root: C:\\Users\\alice\\project
repository: org/repo
branch: main
summary: Review PR 123`;

    it('extracts id from workspace.yaml', () => {
      expect(parseCopilotWorkspaceYaml(validYaml))
        .toBe('09f18f7c-0419-4a29-8432-b9d8f8180bdd');
    });

    it('returns null when no id field', () => {
      expect(parseCopilotWorkspaceYaml('cwd: /a\nbranch: main')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(parseCopilotWorkspaceYaml('')).toBeNull();
    });
  });

  describe('copilotEventsMatchTaskLogId', () => {
    it('returns true when taskLogId is in content', () => {
      const events = '{"event":"start","task":"task-issue-42"}\n{"event":"done"}';
      expect(copilotEventsMatchTaskLogId(events, 'task-issue-42')).toBe(true);
    });

    it('returns false when taskLogId is not found', () => {
      const events = '{"event":"start","task":"task-issue-99"}';
      expect(copilotEventsMatchTaskLogId(events, 'task-issue-42')).toBe(false);
    });

    it('returns false for empty content', () => {
      expect(copilotEventsMatchTaskLogId('', 'task-issue-42')).toBe(false);
    });
  });
});
