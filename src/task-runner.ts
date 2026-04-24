import * as vscode from 'vscode';
import { WorktreeManager } from './worktree';
import { GitHubRepoInfo } from './github-detector';
import { DevPilotDir } from './dev-pilot-dir';
import * as path from 'path';

export interface TaskInfo {
  id: string;
  type: 'dev-issue' | 'watch-pr';
  label: string;
  issueUrl?: string;
  worktreeBranch?: string;
  worktreeDir?: string;
  terminal?: vscode.Terminal;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: number;
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
    // Watch for terminal close events to update task status
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
  async runDevIssue(issueInput: string): Promise<TaskInfo> {
    const issueNum = this.extractIssueNumber(issueInput);
    const issueUrl = issueNum
      ? `https://github.com/${this.repoInfo.owner}/${this.repoInfo.repo}/issues/${issueNum}`
      : issueInput;

    const branchName = issueNum ? `dev/issue-${issueNum}` : `dev/task-${Date.now()}`;

    // Create worktree
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

    this.tasks.set(taskInfo.id, taskInfo);
    this.devPilotDir.logJson('tasks', {
      event: 'task_created',
      taskId: taskInfo.id,
      type: taskInfo.type,
      issueUrl,
      worktreeBranch: branchName,
    });

    // Run Copilot CLI in VS Code terminal
    const cwd = wt?.path || this.workspaceRoot;
    const command = `/pilot-dev-issue --auto ${issueUrl}`;
    const terminalName = `Dev Pilot: ${taskInfo.label}`;

    const terminal = vscode.window.createTerminal({
      name: terminalName,
      cwd,
      iconPath: new vscode.ThemeIcon('rocket'),
    });

    terminal.show(false); // Show but don't steal focus
    terminal.sendText(`gh copilot suggest "${command}"`, true);

    taskInfo.terminal = terminal;
    this._onTasksChanged.fire();
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

    this.tasks.set(taskInfo.id, taskInfo);

    const terminal = vscode.window.createTerminal({
      name: 'Dev Pilot: Watch PRs',
      cwd: this.workspaceRoot,
      iconPath: new vscode.ThemeIcon('eye'),
    });

    terminal.show(false);
    terminal.sendText(`gh copilot suggest "/pilot-watch-pr"`, true);

    taskInfo.terminal = terminal;
    this._onTasksChanged.fire();
    return taskInfo;
  }

  /** Get all tasks */
  getAllTasks(): TaskInfo[] {
    return Array.from(this.tasks.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  /** Kill a task (dispose its terminal) */
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

  /** Clean up worktree for a completed task */
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

  /** Open a task's worktree in a new VS Code window */
  openWorktree(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task?.worktreeDir) {
      const uri = vscode.Uri.file(task.worktreeDir);
      vscode.commands.executeCommand('vscode.openFolder', uri, true);
    }
  }

  /** Focus a task's terminal */
  focusTerminal(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task?.terminal) {
      task.terminal.show();
    }
  }

  private extractIssueNumber(input: string): string | null {
    const urlMatch = input.match(/\/issues\/(\d+)/);
    if (urlMatch) return urlMatch[1];
    const refMatch = input.match(/#?(\d+)$/);
    if (refMatch) return refMatch[1];
    return null;
  }
}
