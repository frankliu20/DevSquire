import { describe, it, expect } from 'vitest';
import {
  contentMatchesTaskLogId,
  parseCopilotWorkspaceYaml,
  parseClaudeLastPrompt,
} from '../src/session-detector';

// --- Tests ---

describe('Session Detector', () => {
  describe('contentMatchesTaskLogId', () => {
    it('returns true when taskLogId is in content', () => {
      const content = '[task-log-id:task-issue-42] [squire-dir:/path]';
      expect(contentMatchesTaskLogId(content, 'task-issue-42')).toBe(true);
    });

    it('returns true in multiline JSONL content', () => {
      const content = '{"type":"user.message","data":{"content":"do stuff [task-log-id:task-issue-42]"}}\n{"type":"done"}';
      expect(contentMatchesTaskLogId(content, 'task-issue-42')).toBe(true);
    });

    it('returns false when taskLogId is not found', () => {
      const content = '{"event":"start","task":"task-issue-99"}';
      expect(contentMatchesTaskLogId(content, 'task-issue-42')).toBe(false);
    });

    it('returns false for empty content', () => {
      expect(contentMatchesTaskLogId('', 'task-issue-42')).toBe(false);
    });
  });

  describe('parseClaudeLastPrompt', () => {
    it('extracts lastPrompt and sessionId from last-prompt line', () => {
      const tail = '{"type":"assistant","message":"done"}\n{"type":"last-prompt","lastPrompt":"/squire-dev-issue --auto https://github.com/org/repo/issues/42 [task-log-id:task-issue-42]","sessionId":"bb21d985-1234"}\n';
      const result = parseClaudeLastPrompt(tail);
      expect(result).toEqual({ lastPrompt: '/squire-dev-issue --auto https://github.com/org/repo/issues/42 [task-log-id:task-issue-42]', sessionId: 'bb21d985-1234' });
    });

    it('returns null when no last-prompt line', () => {
      expect(parseClaudeLastPrompt('{"type":"assistant"}\n{"type":"done"}\n')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(parseClaudeLastPrompt('')).toBeNull();
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
});
