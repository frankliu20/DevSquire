import * as cp from 'child_process';

export interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  author: string;
  labels: string[];
  assignees: string[];
  milestone: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  body?: string;
}

export interface GitHubPR {
  number: number;
  title: string;
  state: string;
  author: string;
  branch: string;
  baseBranch: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  isDraft: boolean;
  labels: string[];
  reviewDecision: string;
  commentCount: number;
  unresolvedCount: number;
  checksStatus: string;
  body?: string;
  action?: string; // derived: ready_to_merge, ci_failing, review_pending, changes_requested, has_unresolved_comments, draft, waiting
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
}

export interface GitHubAccount {
  user: string;
  active: boolean;
}

/**
 * Fetches all GitHub data via `gh` CLI.
 */
export class GitHubData {
  constructor(
    private owner: string,
    private repo: string,
  ) {}

  // --- Issues ---

  listIssues(limit = 30): GitHubIssue[] {
    return this.execGh<GitHubIssue[]>(
      `gh issue list --repo ${this.slug} --state open --limit ${limit} --json number,title,state,author,labels,assignees,milestone,createdAt,updatedAt,url`,
      (raw: any[]) => raw.map(this.mapIssue),
    ) || [];
  }

  listMyIssues(limit = 30): GitHubIssue[] {
    return this.execGh<GitHubIssue[]>(
      `gh issue list --repo ${this.slug} --state open --assignee @me --limit ${limit} --json number,title,state,author,labels,assignees,milestone,createdAt,updatedAt,url`,
      (raw: any[]) => raw.map(this.mapIssue),
    ) || [];
  }

  getIssueBody(issueNumber: number): string {
    return this.execGh<string>(
      `gh issue view ${issueNumber} --repo ${this.slug} --json body`,
      (raw: any) => raw.body || '',
    ) || '';
  }

  // --- Pull Requests ---

  listMyPRs(limit = 20): GitHubPR[] {
    const prs = this.execGh<GitHubPR[]>(
      `gh pr list --repo ${this.slug} --state open --author @me --limit ${limit} --json number,title,state,author,headRefName,baseRefName,url,createdAt,updatedAt,isDraft,labels,reviewDecision,comments,body`,
      (raw: any[]) => raw.map(this.mapPR),
    ) || [];
    return prs.map((pr) => ({ ...pr, action: this.classifyPRAction(pr) }));
  }

  listReviewRequestedPRs(limit = 20): GitHubPR[] {
    const prs = this.execGh<GitHubPR[]>(
      `gh pr list --repo ${this.slug} --state open --search "review-requested:@me" --limit ${limit} --json number,title,state,author,headRefName,baseRefName,url,createdAt,updatedAt,isDraft,labels,reviewDecision,comments,body`,
      (raw: any[]) => raw.map(this.mapPR),
    ) || [];
    return prs;
  }

  getPRBody(prNumber: number): string {
    return this.execGh<string>(
      `gh pr view ${prNumber} --repo ${this.slug} --json body`,
      (raw: any) => raw.body || '',
    ) || '';
  }

  /** Fetch unresolved review thread counts via GraphQL */
  getUnresolvedCounts(prNumbers: number[]): Map<number, number> {
    const result = new Map<number, number>();
    for (const num of prNumbers) {
      try {
        const query = `query { repository(owner:"${this.owner}",name:"${this.repo}") { pullRequest(number:${num}) { reviewThreads(first:100) { nodes { isResolved } } } } }`;
        const output = cp.execSync(`gh api graphql -f query='${query}'`, {
          encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'],
        });
        const data = JSON.parse(output);
        const threads = data?.data?.repository?.pullRequest?.reviewThreads?.nodes || [];
        const unresolved = threads.filter((t: any) => !t.isResolved).length;
        result.set(num, unresolved);
      } catch {
        result.set(num, 0);
      }
    }
    return result;
  }

  // --- Commits ---

  listTodayCommits(): GitHubCommit[] {
    const today = new Date().toISOString().split('T')[0];
    try {
      const output = cp.execSync(
        `git log --since="${today}" --format="%H|||%s|||%an|||%aI" --all`,
        { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] },
      );
      return output.trim().split('\n').filter(Boolean).map((line) => {
        const [sha, message, author, date] = line.split('|||');
        return { sha, message, author, date };
      });
    } catch {
      return [];
    }
  }

  // --- Accounts ---

  listAccounts(): GitHubAccount[] {
    try {
      const output = cp.execSync('gh auth status 2>&1', {
        encoding: 'utf-8', timeout: 10000, shell: true,
      });
      const accounts: GitHubAccount[] = [];
      const lines = output.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const accountMatch = lines[i].match(/Logged in to github\.com account (\S+)/);
        if (accountMatch) {
          const user = accountMatch[1];
          const activeLine = lines[i + 1] || '';
          const active = activeLine.includes('Active account: true');
          accounts.push({ user, active });
        }
      }
      return accounts;
    } catch {
      return [];
    }
  }

  switchAccount(user: string): boolean {
    try {
      cp.execSync(`gh auth switch --user ${user}`, {
        encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'],
      });
      return true;
    } catch {
      return false;
    }
  }

  // --- Helpers ---

  private get slug(): string {
    return `${this.owner}/${this.repo}`;
  }

  private execGh<T>(cmd: string, transform: (raw: any) => T): T | null {
    try {
      const output = cp.execSync(cmd, {
        encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'],
      });
      const raw = JSON.parse(output);
      return transform(raw);
    } catch (err) {
      console.error(`gh command failed: ${cmd}`, err);
      return null;
    }
  }

  private mapIssue(item: any): GitHubIssue {
    return {
      number: item.number,
      title: item.title,
      state: item.state,
      author: item.author?.login || '',
      labels: (item.labels || []).map((l: any) => l.name),
      assignees: (item.assignees || []).map((a: any) => a.login),
      milestone: item.milestone?.title || '',
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      url: item.url,
    };
  }

  private mapPR(item: any): GitHubPR {
    return {
      number: item.number,
      title: item.title,
      state: item.state,
      author: item.author?.login || '',
      branch: item.headRefName || '',
      baseBranch: item.baseRefName || '',
      url: item.url,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      isDraft: item.isDraft || false,
      labels: (item.labels || []).map((l: any) => l.name),
      reviewDecision: item.reviewDecision || '',
      commentCount: (item.comments || []).length,
      unresolvedCount: 0,
      checksStatus: '',
      body: item.body,
    };
  }

  private classifyPRAction(pr: GitHubPR): string {
    if (pr.isDraft) return 'draft';
    if (pr.reviewDecision === 'CHANGES_REQUESTED') return 'changes_requested';
    if (pr.unresolvedCount > 0) return 'has_unresolved_comments';
    if (pr.reviewDecision === 'APPROVED') return 'ready_to_merge';
    if (pr.reviewDecision === 'REVIEW_REQUIRED') return 'review_pending';
    return 'waiting';
  }
}
