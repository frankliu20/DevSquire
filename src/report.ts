import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { GitHubData, GitHubCommit } from './github-data';

export interface EODReport {
  issuesClosed: number;
  prsMerged: number;
  prsOpen: number;
  commitsToday: number;
  closedIssues: Array<{ number: number; title: string; prUrl?: string }>;
  mergedPRs: Array<{ number: number; title: string }>;
  openPRs: Array<{ number: number; title: string; action: string }>;
  commits: GitHubCommit[];
  carryOver: Array<{ number: number; title: string }>;
}

export interface ScrumReport {
  since: string;
  done: Array<{ number: number; title: string; prUrl?: string }>;
  ongoing: Array<{ number: number; title: string; phase?: string }>;
  blockers: Array<{ number: number; title: string; reason?: string }>;
}

export class ReportGenerator {
  private scrumMarkFile: string;
  private slug: string;

  constructor(
    private ghData: GitHubData,
    private squireDir: string,
    private workspaceRoot: string,
    owner: string,
    repo: string,
  ) {
    this.scrumMarkFile = path.join(squireDir, 'last-scrum.txt');
    this.slug = `${owner}/${repo}`;
  }

  /** Generate end-of-day report */
  generateEOD(): EODReport {
    const today = new Date().toISOString().split('T')[0];
    const commits = this.ghData.listTodayCommits();
    const myPRs = this.ghData.listMyPRs();
    const myIssues = this.ghData.listMyIssues();

    // Closed issues today
    let closedIssues: Array<{ number: number; title: string; prUrl?: string }> = [];
    try {
      const output = cp.execSync(
        `gh issue list --repo ${this.slug} --state closed --assignee @me --json number,title,closedAt --limit 20`,
        { encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] },
      );
      const raw = JSON.parse(output);
      closedIssues = raw
        .filter((i: any) => i.closedAt && i.closedAt.startsWith(today))
        .map((i: any) => ({ number: i.number, title: i.title }));
    } catch { /* ignore */ }

    // Merged PRs today
    let mergedPRs: Array<{ number: number; title: string }> = [];
    try {
      const output = cp.execSync(
        `gh pr list --repo ${this.slug} --state merged --author @me --json number,title,mergedAt --limit 20`,
        { encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] },
      );
      const raw = JSON.parse(output);
      mergedPRs = raw
        .filter((p: any) => p.mergedAt && p.mergedAt.startsWith(today))
        .map((p: any) => ({ number: p.number, title: p.title }));
    } catch { /* ignore */ }

    return {
      issuesClosed: closedIssues.length,
      prsMerged: mergedPRs.length,
      prsOpen: myPRs.length,
      commitsToday: commits.length,
      closedIssues,
      mergedPRs,
      openPRs: myPRs.map((pr) => ({ number: pr.number, title: pr.title, action: pr.action || 'waiting' })),
      commits,
      carryOver: myIssues.map((i) => ({ number: i.number, title: i.title })),
    };
  }

  /** Generate scrum report */
  generateScrum(): ScrumReport {
    const since = this.getLastScrumMark();
    const myIssues = this.ghData.listMyIssues();

    const done: ScrumReport['done'] = [];
    const ongoing: ScrumReport['ongoing'] = [];
    const blockers: ScrumReport['blockers'] = [];

    // Done = issues closed since last scrum
    try {
      const output = cp.execSync(
        `gh issue list --repo ${this.slug} --state closed --assignee @me --json number,title,closedAt --limit 30`,
        { encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] },
      );
      const raw = JSON.parse(output);
      const sinceDate = new Date(since).getTime();
      for (const i of raw) {
        if (i.closedAt && new Date(i.closedAt).getTime() >= sinceDate) {
          done.push({ number: i.number, title: i.title });
        }
      }
    } catch { /* ignore */ }

    // Also add merged PRs since last scrum as done items
    try {
      const output = cp.execSync(
        `gh pr list --repo ${this.slug} --state merged --author @me --json number,title,mergedAt --limit 20`,
        { encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] },
      );
      const raw = JSON.parse(output);
      const sinceDate = new Date(since).getTime();
      for (const p of raw) {
        if (p.mergedAt && new Date(p.mergedAt).getTime() >= sinceDate) {
          // Only add if not already in done (by number collision with issue)
          if (!done.find((d) => d.number === p.number)) {
            done.push({ number: p.number, title: p.title, prUrl: `https://github.com/${this.slug}/pull/${p.number}` });
          }
        }
      }
    } catch { /* ignore */ }

    // Ongoing & Blockers from open issues
    for (const issue of myIssues) {
      if (issue.labels.some((l) => l.toLowerCase().includes('block'))) {
        blockers.push({ number: issue.number, title: issue.title, reason: 'Blocked label' });
      } else {
        ongoing.push({ number: issue.number, title: issue.title });
      }
    }

    return { since, done, ongoing, blockers };
  }

  /** Post scrum status to GitHub issues */
  postScrumToGitHub(report: ScrumReport): void {
    // Aggregate and comment on each mentioned issue
    const allIssues = [...report.done, ...report.ongoing, ...report.blockers];
    for (const issue of allIssues) {
      const status = report.done.find((d) => d.number === issue.number) ? '✅ Done'
        : report.blockers.find((b) => b.number === issue.number) ? '🚫 Blocked'
        : '🔄 In Progress';

      const body = `**Scrum Update**: ${status}`;
      try {
        cp.execSync(
          `gh issue comment ${issue.number} --repo ${this.slug} --body "${body}"`,
          { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] },
        );
      } catch { /* ignore */ }
    }
  }

  /** Mark scrum timestamp */
  markScrum(): void {
    fs.writeFileSync(this.scrumMarkFile, new Date().toISOString());
  }

  /** Get last scrum mark */
  getLastScrumMark(): string {
    try {
      return fs.readFileSync(this.scrumMarkFile, 'utf-8').trim();
    } catch {
      // Default to start of today
      return new Date().toISOString().split('T')[0] + 'T00:00:00.000Z';
    }
  }
}
