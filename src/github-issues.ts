import * as cp from 'child_process';

export interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  author: string;
  labels: string[];
  createdAt: string;
  url: string;
}

/**
 * Fetches GitHub issues using the `gh` CLI.
 */
export class GitHubIssues {
  /**
   * List open issues for the repo.
   */
  list(owner: string, repo: string, limit = 20): GitHubIssue[] {
    try {
      const output = cp.execSync(
        `gh issue list --repo ${owner}/${repo} --state open --limit ${limit} --json number,title,state,author,labels,createdAt,url`,
        { encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] },
      );
      const raw = JSON.parse(output);
      return raw.map((item: any) => ({
        number: item.number,
        title: item.title,
        state: item.state,
        author: item.author?.login || '',
        labels: (item.labels || []).map((l: any) => l.name),
        createdAt: item.createdAt,
        url: item.url,
      }));
    } catch (err) {
      console.error('Failed to fetch issues:', err);
      return [];
    }
  }

  /**
   * List issues assigned to the current user.
   */
  listMyIssues(owner: string, repo: string, limit = 20): GitHubIssue[] {
    try {
      const output = cp.execSync(
        `gh issue list --repo ${owner}/${repo} --state open --assignee @me --limit ${limit} --json number,title,state,author,labels,createdAt,url`,
        { encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] },
      );
      const raw = JSON.parse(output);
      return raw.map((item: any) => ({
        number: item.number,
        title: item.title,
        state: item.state,
        author: item.author?.login || '',
        labels: (item.labels || []).map((l: any) => l.name),
        createdAt: item.createdAt,
        url: item.url,
      }));
    } catch (err) {
      console.error('Failed to fetch my issues:', err);
      return [];
    }
  }
}
