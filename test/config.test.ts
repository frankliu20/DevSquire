import { describe, it, expect } from 'vitest';
import * as path from 'path';

// --- GitHubDetector logic (extracted for unit testing) ---

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const httpsMatch = url.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (httpsMatch) return { owner: httpsMatch[1], repo: httpsMatch[2] };
  const sshMatch = url.match(/github\.com:([^/]+)\/([^/.]+)/);
  if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] };
  return null;
}

function parseGitConfig(content: string): string | null {
  const lines = content.split('\n');
  let inOrigin = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '[remote "origin"]') { inOrigin = true; continue; }
    if (trimmed.startsWith('[') && inOrigin) break;
    if (inOrigin && trimmed.startsWith('url = ')) return trimmed.substring(6).trim();
  }
  return null;
}

function extractIssueNumber(input: string): string | null {
  const urlMatch = input.match(/\/issues\/(\d+)/);
  if (urlMatch) return urlMatch[1];
  const refMatch = input.match(/#?(\d+)$/);
  if (refMatch) return refMatch[1];
  return null;
}

// --- Tests ---

describe('GitHubDetector', () => {
  describe('parseGitHubUrl', () => {
    it('parses HTTPS URL', () => {
      expect(parseGitHubUrl('https://github.com/octocat/hello-world.git'))
        .toEqual({ owner: 'octocat', repo: 'hello-world' });
    });

    it('parses HTTPS URL without .git', () => {
      expect(parseGitHubUrl('https://github.com/octocat/hello-world'))
        .toEqual({ owner: 'octocat', repo: 'hello-world' });
    });

    it('parses SSH URL', () => {
      expect(parseGitHubUrl('git@github.com:octocat/hello-world.git'))
        .toEqual({ owner: 'octocat', repo: 'hello-world' });
    });

    it('returns null for non-GitHub URL', () => {
      expect(parseGitHubUrl('https://gitlab.com/group/project.git')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(parseGitHubUrl('')).toBeNull();
    });
  });

  describe('parseGitConfig', () => {
    it('extracts origin URL from git config', () => {
      const config = `[core]
\trepositoryformatversion = 0
[remote "origin"]
\turl = https://github.com/octocat/hello-world.git
\tfetch = +refs/heads/*:refs/remotes/origin/*
[branch "main"]
\tremote = origin`;
      expect(parseGitConfig(config)).toBe('https://github.com/octocat/hello-world.git');
    });

    it('returns null when no origin remote', () => {
      const config = `[core]\n\tbare = false`;
      expect(parseGitConfig(config)).toBeNull();
    });
  });
});

describe('Issue number extraction', () => {
  it('extracts from GitHub issue URL', () => {
    expect(extractIssueNumber('https://github.com/org/repo/issues/42')).toBe('42');
  });

  it('extracts from #ref', () => {
    expect(extractIssueNumber('#123')).toBe('123');
  });

  it('extracts bare number', () => {
    expect(extractIssueNumber('456')).toBe('456');
  });

  it('returns null for plain text', () => {
    expect(extractIssueNumber('fix the login bug')).toBeNull();
  });
});
