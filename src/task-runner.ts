import * as vscode from 'vscode';
import * as path from 'path';
import { ClaudeCli, ClaudeSession } from './claude-cli';
import { WorktreeManager } from './worktree';
import { PilotConfig } from './config';

export interface TaskInfo {
  id: string;
  type: 'dev-issue' | 'watch-pr';
  label: string;
  issueUrl?: string;
  repoUrl: string;
  repoDir: string;
  worktreeBranch?: string;
  worktreeDir?: string;
  session?: ClaudeSession;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: number;
  output: string[];
}

export class TaskRunner {
  private tasks: Map<string, TaskInfo> = new Map();
  private _onTasksChanged = new vscode.EventEmitter<void>();
  readonly onTasksChanged = this._onTasksChanged.event;

  constructor(
    private cli: ClaudeCli,
    private worktree: WorktreeManager,
    private config: PilotConfig,
  ) {}

  /** Run /pilot-dev-issue for a given issue */
  async runDevIssue(issueUrl: string): Promise<TaskInfo> {
    // Determine which repo to use
    const repoUrl = this.detectRepo(issueUrl) || this.config.yaml.repos[0];
    if (!repoUrl) {
      vscode.window.showErrorMessage('No repo configured in pilot.yaml');
      throw new Error('No repo configured');
    }

    const repoName = this.config.repoName(repoUrl);
    const repoDir = path.join(this.config.workspacePath, repoName);

    // Create branch name from issue
    const issueNum = this.extractIssueNumber(issueUrl);
    const branchName = issueNum ? `dev/issue-${issueNum}` : `dev/task-${Date.now()}`;

    // Create worktree
    this.worktree.ensureGitignore(repoDir);
    const wt = this.worktree.create(repoDir, branchName);

    const taskInfo: TaskInfo = {
      id: `dev-${Date.now()}`,
      type: 'dev-issue',
      label: issueNum ? `Issue #${issueNum}` : issueUrl.substring(0, 40),
      issueUrl,
      repoUrl,
      repoDir,
      worktreeBranch: branchName,
      worktreeDir: wt?.path,
      status: 'pending',
      createdAt: Date.now(),
      output: [],
    };

    this.tasks.set(taskInfo.id, taskInfo);
    this._onTasksChanged.fire();

    // Run Claude Code in the worktree directory
    const cwd = wt?.path || repoDir;
    const command = `/pilot-dev-issue --auto ${issueUrl}`;

    taskInfo.status = 'running';
    const session = this.cli.run(command, cwd);
    taskInfo.session = session;

    session.onOutput.event((text) => {
      taskInfo.output.push(text);
      this._onTasksChanged.fire();
    });

    session.onStatusChange.event((status) => {
      taskInfo.status = status === 'completed' ? 'completed' : 'failed';
      this._onTasksChanged.fire();

      if (taskInfo.status === 'completed') {
        vscode.window.showInformationMessage(`Dev Pilot: ${taskInfo.label} completed!`);
      } else {
        vscode.window.showWarningMessage(`Dev Pilot: ${taskInfo.label} failed.`);
      }
    });

    this._onTasksChanged.fire();
    return taskInfo;
  }

  /** Run /pilot-watch-pr */
  async runWatchPRs(): Promise<TaskInfo> {
    const repoUrl = this.config.yaml.repos[0] || '';
    const repoName = this.config.repoName(repoUrl);
    const repoDir = path.join(this.config.workspacePath, repoName);

    const taskInfo: TaskInfo = {
      id: `watch-${Date.now()}`,
      type: 'watch-pr',
      label: 'Watch PRs',
      repoUrl,
      repoDir,
      status: 'running',
      createdAt: Date.now(),
      output: [],
    };

    this.tasks.set(taskInfo.id, taskInfo);

    const session = this.cli.run('/pilot-watch-pr', repoDir);
    taskInfo.session = session;

    session.onOutput.event((text) => {
      taskInfo.output.push(text);
      this._onTasksChanged.fire();
    });

    session.onStatusChange.event((status) => {
      taskInfo.status = status === 'completed' ? 'completed' : 'failed';
      this._onTasksChanged.fire();
    });

    this._onTasksChanged.fire();
    return taskInfo;
  }

  /** Get all tasks */
  getAllTasks(): TaskInfo[] {
    return Array.from(this.tasks.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  /** Kill a task */
  killTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task?.session) {
      this.cli.kill(task.session.taskId);
      task.status = 'failed';
      this._onTasksChanged.fire();
    }
  }

  /** Clean up worktree for a completed task */
  cleanupTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task?.worktreeBranch) {
      this.worktree.remove(task.repoDir, task.worktreeBranch);
    }
    this.tasks.delete(taskId);
    this._onTasksChanged.fire();
  }

  /** Open a task's worktree in a new VS Code window */
  openWorktree(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task?.worktreeDir) {
      const uri = vscode.Uri.file(task.worktreeDir);
      vscode.commands.executeCommand('vscode.openFolder', uri, true);
    }
  }

  private detectRepo(issueUrl: string): string | undefined {
    // Try to match issue URL to a configured repo
    for (const repo of this.config.yaml.repos) {
      // Extract org/repo from URL
      const match = repo.match(/([^/]+\/[^/]+?)(?:\.git)?$/);
      if (match && issueUrl.includes(match[1])) {
        return repo;
      }
    }
    return undefined;
  }

  private extractIssueNumber(input: string): string | null {
    // Match GitHub/GitLab issue URLs or #123 references
    const urlMatch = input.match(/\/issues\/(\d+)/);
    if (urlMatch) return urlMatch[1];

    const refMatch = input.match(/#(\d+)/);
    if (refMatch) return refMatch[1];

    return null;
  }
}
