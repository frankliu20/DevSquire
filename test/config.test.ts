import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as os from 'os';

// Test config YAML parsing (extracted logic)
function parseYaml(content: string) {
  const result: Record<string, any> = {
    workspace: path.join(os.homedir(), 'claude', 'workdir'),
    platform: 'github',
    repos: [],
    chat_language: 'English',
  };
  let currentKey = '';

  for (const rawLine of content.split('\n')) {
    if (rawLine.trim() === '' || rawLine.trim().startsWith('#')) continue;
    const indent = rawLine.length - rawLine.trimStart().length;
    const line = rawLine.trim();

    if (indent === 0 && line.includes(':')) {
      const colonIdx = line.indexOf(':');
      const key = line.substring(0, colonIdx).trim();
      const value = line.substring(colonIdx + 1).trim();
      currentKey = key;
      if (value && key === 'workspace') result.workspace = value;
      if (value && key === 'platform') result.platform = value;
      if (value && key === 'chat_language') result.chat_language = value;
      if (key === 'repos') result.repos = [];
    } else if (indent > 0 && line.startsWith('- ') && currentKey === 'repos') {
      result.repos.push(line.substring(2).trim());
    }
  }
  return result;
}

describe('PilotConfig YAML parsing', () => {
  it('parses a complete pilot.yaml', () => {
    const yaml = `# Dev Pilot Configuration
workspace: ~/claude/workdir
platform: github
repos:
  - https://github.com/org/repo1
  - https://github.com/org/repo2
chat_language: Chinese`;

    const result = parseYaml(yaml);
    expect(result.workspace).toBe('~/claude/workdir');
    expect(result.platform).toBe('github');
    expect(result.repos).toEqual([
      'https://github.com/org/repo1',
      'https://github.com/org/repo2',
    ]);
    expect(result.chat_language).toBe('Chinese');
  });

  it('returns defaults for empty content', () => {
    const result = parseYaml('');
    expect(result.platform).toBe('github');
    expect(result.repos).toEqual([]);
  });

  it('handles gitlab platform', () => {
    const yaml = `workspace: /home/user/work
platform: gitlab
repos:
  - https://gitlab.com/group/project`;

    const result = parseYaml(yaml);
    expect(result.platform).toBe('gitlab');
    expect(result.repos).toHaveLength(1);
  });
});

describe('Issue number extraction', () => {
  function extractIssueNumber(input: string): string | null {
    const urlMatch = input.match(/\/issues\/(\d+)/);
    if (urlMatch) return urlMatch[1];
    const refMatch = input.match(/#(\d+)/);
    if (refMatch) return refMatch[1];
    return null;
  }

  it('extracts from GitHub URL', () => {
    expect(extractIssueNumber('https://github.com/org/repo/issues/42')).toBe('42');
  });

  it('extracts from #ref', () => {
    expect(extractIssueNumber('#123')).toBe('123');
  });

  it('returns null for plain text', () => {
    expect(extractIssueNumber('fix the login bug')).toBeNull();
  });
});
