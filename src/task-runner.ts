import * as vscode from 'vscode';
import { WorktreeManager } from './worktree';
import { GitHubRepoInfo } from './github-detector';
import { DevPilotDir } from './dev-pilot-dir';
import * as path from 'path';

export type TaskType = 'dev-issue' | 'watch-pr' | 'review-pr' | 'fix-comments' | 'run-command';

export interface TaskInfo {
  id: string;
  type: TaskType;
  label: string;
  issueUrl?: string;
  prNumber?: number;
  worktreeBranch?: string;
  worktreeDir?: string;
  terminal?: vscode.Terminal;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: number;
}

export interface ReviewConfig {
  strategy: 'normal' | 'auto-publish' | 'quick-approve';
  level: 'critical' | 'important' | 'everything';
}

export class TaskRunner {
  private tasks: Map<string, TaskInfo> = new Map();
  private _onTasksChanged = new vscode.EventEmitter<void>();
  readonly onTasksChanged = this._onTasksChanged.event;

  constructor(
    private worktree: WorktreeManager,
    private workspaceRoot: string,
    private repoInfo: GitHubRepoInfo,
    private devPilotDir: DevPilotDir,
  ) {
    vscode.window.onDidCloseTerminal((closedTerminal) => {
      for (const task of this.tasks.values()) {
        if (task.terminal === closedTerminal) {
          task.status = 'completed';
          task.terminal = undefined;
          this._onTasksChanged.fire();
          this.devPilotDir.log('tasks', `Task ${task.id} (${task.label}) terminal closed`);
        }
      }
    });
  }

  /** Run /pilot-dev-issue for a given issue */
  async runDevIssue(issueInput: string, mode: 'normal' | 'auto' = 'auto'): Promise<TaskInfo> {
    const issueNum = this.extractIssueNumber(issueInput);
    const issueUrl = issueNum
      ? `https://github.com/${this.repoInfo.owner}/${this.repoInfo.repo}/issues/${issueNum}`
      : issueInput;

    const branchName = issueNum ? `dev/issue-${issueNum}` : `dev/task-${Date.now()}`;

    this.worktree.ensureGitignore(this.workspaceRoot);
    const wt = this.worktree.create(this.workspaceRoot, branchName);

    const taskInfo: TaskInfo = {
      id: `dev-${Date.now()}`,
      type: 'dev-issue',
      label: issueNum ? `Issue #${issueNum}` : issueInput.substring(0, 40),
      issueUrl,
      worktreeBranch: branchName,
      worktreeDir: wt?.path,
      status: 'running',
      createdAt: Date.now(),
    };

    const cwd = wt?.path || this.workspaceRoot;
    const autoFlag = mode === 'auto' ? ' --auto' : '';
    const command = `/pilot-dev-issue${autoFlag} ${issueUrl}`;

    this.launchTerminal(taskInfo, command, cwd, 'rocket');
    return taskInfo;
  }

  /** Run /pilot-watch-pr */
  async runWatchPRs(): Promise<TaskInfo> {
    const taskInfo: TaskInfo = {
      id: `watch-${Date.now()}`,
      type: 'watch-pr',
      label: 'Watch PRs',
      status: 'running',
      createdAt: Date.now(),
    };

    this.launchTerminal(taskInfo, '/pilot-watch-pr', this.workspaceRoot, 'eye');
    return taskInfo;
  }

  /** Review a PR */
  async runReviewPR(prNumber: number, config: ReviewConfig): Promise<TaskInfo> {
    const taskInfo: TaskInfo = {
      id: `review-${Date.now()}`,
      type: 'review-pr',
      label: `Review PR #${prNumber}`,
      prNumber,
      status: 'running',
      createdAt: Date.now(),
    };

    const prompt = `Review PR #${prNumber} in ${this.repoInfo.owner}/${this.repoInfo.repo}. Strategy: ${config.strategy}. Level: ${config.level}. Provide a thorough code review.`;
    this.launchTerminal(taskInfo, prompt, this.workspaceRoot, 'code-review');
    return taskInfo;
  }

  /** Fix PR comments */
  async runFixComments(prNumber: number): Promise<TaskInfo> {
    const taskInfo: TaskInfo = {
      id: `fix-${Date.now()}`,
      type: 'fix-comments',
      label: `Fix comments PR #${prNumber}`,
      prNumber,
      status: 'running',
      createdAt: Date.now(),
    };

    const prompt = `Check and fix all unresolved review comments on PR #${prNumber} in ${this.repoInfo.owner}/${this.repoInfo.repo}.`;
    this.launchTerminal(taskInfo, prompt, this.workspaceRoot, 'wrench');
    return taskInfo;
  }

  /** Run a custom command or prompt */
  async runCommand(command: string): Promise<TaskInfo> {
    const taskInfo: TaskInfo = {
      id: `cmd-${Date.now()}`,
      type: 'run-command',
      label: command.substring(0, 40),
      status: 'running',
      createdAt: Date.now(),
    };

    this.launchTerminal(taskInfo, command, this.workspaceRoot, 'terminal');
    return taskInfo;
  }

  getAllTasks(): TaskInfo[] {
    return Array.from(this.tasks.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  killTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task?.terminal) {
      task.terminal.dispose();
      task.status = 'failed';
      task.terminal = undefined;
      this._onTasksChanged.fire();
      this.devPilotDir.log('tasks', `Task ${taskId} killed by user`);
    }
  }

  cleanupTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task?.terminal) {
      task.terminal.dispose();
    }
    if (task?.worktreeBranch) {
      this.worktree.remove(this.workspaceRoot, task.worktreeBranch);
    }
    this.tasks.delete(taskId);
    this._onTasksChanged.fire();
    this.devPilotDir.log('tasks', `Task ${taskId} cleaned up`);
  }

  openWorktree(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task?.worktreeDir) {
      const uri = vscode.Uri.file(task.worktreeDir);
      vscode.commands.executeCommand('vscode.openFolder', uri, true);
    }
  }

  focusTerminal(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task?.terminal) {
      task.terminal.show();
    }
  }

  private launchTerminal(taskInfo: TaskInfo, command: string, cwd: string, icon: string): void {
    this.tasks.set(taskInfo.id, taskInfo);
    this.devPilotDir.logJson('tasks', {
      event: 'task_created',
      taskId: taskInfo.id,
      type: taskInfo.type,
      label: taskInfo.label,
    });

    const terminal = vscode.window.createTerminal({
      name: `Dev Pilot: ${taskInfo.label}`,
      cwd,
      iconPath: new vscode.ThemeIcon(icon),
    });

    terminal.show(false);
    // Use gh copilot CLI
    terminal.sendText(`gh copilot suggest "${this.escapeShell(command)}"`, true);

    taskInfo.terminal = terminal;
    this._onTasksChanged.fire();
  }

  private escapeShell(str: string): string {
    return str.replace(/"/g, '\\"');
  }

  private extractIssueNumber(input: string): string | null {
    const urlMatch = input.match(/\/issues\/(\d+)/);
    if (urlMatch) return urlMatch[1];
    const refMatch = input.match(/#?(\d+)$/);
    if (refMatch) return refMatch[1];
    return null;
  }
}
