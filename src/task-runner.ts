import * as vscode from 'vscode';
import { WorktreeManager } from './worktree';
import { GitHubRepoInfo } from './github-detector';
import { DevPilotDir } from './dev-pilot-dir';

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

  get repoSlug(): string {
    return `${this.repoInfo.owner}/${this.repoInfo.repo}`;
  }

  get repoUrl(): string {
    return `https://github.com/${this.repoSlug}`;
  }

  /** Run /pilot-dev-issue — matches dashboard assign command */
  async runDevIssue(issueInput: string, mode: 'normal' | 'auto' = 'auto'): Promise<TaskInfo> {
    const issueNum = this.extractIssueNumber(issueInput);
    const issueUrl = issueNum
      ? `${this.repoUrl}/issues/${issueNum}`
      : issueInput;

    const branchName = issueNum ? `dev/issue-${issueNum}` : `dev/task-${Date.now()}`;

    this.worktree.ensureGitignore(this.workspaceRoot);
    const wt = this.worktree.create(this.workspaceRoot, branchName);

    const terminalTitle = issueNum
      ? `Copilot: #${issueNum}`
      : `Copilot: dev-issue-adhoc-${Date.now()}`;

    const autoFlag = mode === 'auto' ? ' --auto' : '';
    const prompt = `/pilot-dev-issue${autoFlag} ${issueUrl}`;

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
    this.launchTerminal(taskInfo, prompt, cwd, terminalTitle, 'rocket');
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

    this.launchTerminal(taskInfo, '/pilot-watch-pr', this.workspaceRoot, 'Copilot: Watch PRs', 'eye');
    return taskInfo;
  }

  /** Review a PR — matches dashboard review-pr command */
  async runReviewPR(prNumber: number, config: ReviewConfig): Promise<TaskInfo> {
    const prUrl = `${this.repoUrl}/pull/${prNumber}`;

    let strategySuffix = '';
    if (config.strategy === 'quick-approve') strategySuffix = ' [Quick Approve]';
    else if (config.strategy === 'auto-publish') strategySuffix = ' [Auto]';

    const terminalTitle = `Copilot: Review PR #${prNumber}${strategySuffix}`;

    const prompt = `Use the pilot-pr-reviewer agent to review this PR: ${prUrl} --strategy ${config.strategy} --level ${config.level}`;

    const taskInfo: TaskInfo = {
      id: `review-${Date.now()}`,
      type: 'review-pr',
      label: `Review PR #${prNumber}`,
      prNumber,
      status: 'running',
      createdAt: Date.now(),
    };

    this.launchTerminal(taskInfo, prompt, this.workspaceRoot, terminalTitle, 'code-review');
    return taskInfo;
  }

  /** Fix PR comments — matches dashboard fix-comments command */
  async runFixComments(prNumber: number, mode: 'normal' | 'auto' = 'auto'): Promise<TaskInfo> {
    const autoFlag = mode === 'auto' ? ' --auto' : '';
    const prompt = `/pilot-dev-issue${autoFlag} check open comments on ${this.repoUrl}/pull/${prNumber} and fix them`;
    const terminalTitle = `Copilot: Fix PR #${prNumber} comments`;

    const taskInfo: TaskInfo = {
      id: `fix-${Date.now()}`,
      type: 'fix-comments',
      label: `Fix comments PR #${prNumber}`,
      prNumber,
      status: 'running',
      createdAt: Date.now(),
    };

    this.launchTerminal(taskInfo, prompt, this.workspaceRoot, terminalTitle, 'wrench');
    return taskInfo;
  }

  /** Run a custom command or prompt — matches dashboard run-command */
  async runCommand(command: string): Promise<TaskInfo> {
    const label = command.startsWith('/')
      ? command.split(' ')[0]
      : command.substring(0, 40) + (command.length > 40 ? '…' : '');
    const terminalTitle = `Copilot: ${label}`;

    const taskInfo: TaskInfo = {
      id: `cmd-${Date.now()}`,
      type: 'run-command',
      label,
      status: 'running',
      createdAt: Date.now(),
    };

    this.launchTerminal(taskInfo, command, this.workspaceRoot, terminalTitle, 'terminal');
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

  /**
   * Launch a VS Code terminal with the copilot CLI command.
   * Command format matches dashboard: copilot -i "<prompt>" --allow-all
   */
  private launchTerminal(taskInfo: TaskInfo, prompt: string, cwd: string, terminalTitle: string, icon: string): void {
    this.tasks.set(taskInfo.id, taskInfo);
    this.devPilotDir.logJson('tasks', {
      event: 'task_created',
      taskId: taskInfo.id,
      type: taskInfo.type,
      label: taskInfo.label,
    });

    const terminal = vscode.window.createTerminal({
      name: terminalTitle,
      cwd,
      iconPath: new vscode.ThemeIcon(icon),
    });

    terminal.show(false);

    // Match dashboard command format: copilot -i "<prompt>" --allow-all
    const sanitizedPrompt = prompt.replace(/\n/g, ' ').replace(/"/g, '\\"');
    terminal.sendText(`copilot -i "${sanitizedPrompt}" --allow-all`, true);

    taskInfo.terminal = terminal;
    this._onTasksChanged.fire();
  }

  private extractIssueNumber(input: string): string | null {
    const urlMatch = input.match(/\/issues\/(\d+)/);
    if (urlMatch) return urlMatch[1];
    const refMatch = input.match(/#?(\d+)$/);
    if (refMatch) return refMatch[1];
    return null;
  }
}
