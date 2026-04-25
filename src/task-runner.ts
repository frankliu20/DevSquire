import * as vscode from 'vscode';
import { WorktreeManager } from './worktree';
import { GitHubRepoInfo } from './github-detector';
import { SquireDir } from './squire-dir';

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

/** Describes how to launch a copilot CLI session */
interface AgentLaunch {
  /** Agent name — launches `copilot --agent <name> --allow-all` */
  agent?: string;
  /** Plain prompt — launches `copilot -i "<prompt>" --allow-all` */
  prompt?: string;
  /** Sent as first message after agent REPL starts */
  initialPrompt?: string;
}

export class TaskRunner {
  private tasks: Map<string, TaskInfo> = new Map();
  private _onTasksChanged = new vscode.EventEmitter<void>();
  readonly onTasksChanged = this._onTasksChanged.event;

  constructor(
    private worktree: WorktreeManager,
    private workspaceRoot: string,
    private repoInfo: GitHubRepoInfo,
    private squireDir: SquireDir,
  ) {
    vscode.window.onDidCloseTerminal((closedTerminal) => {
      for (const task of this.tasks.values()) {
        if (task.terminal === closedTerminal) {
          task.status = 'completed';
          task.terminal = undefined;
          this._onTasksChanged.fire();
          this.squireDir.log('tasks', `Task ${task.id} (${task.label}) terminal closed`);
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

  /** Run /squire-dev-issue — matches dashboard assign command */
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

    const autoFlag = mode === 'auto' ? '--auto ' : '';
    const agentArgs: AgentLaunch = {
      agent: 'squire-dev-issue',
      initialPrompt: `${autoFlag}${issueUrl}`,
    };

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
    this.launchTerminal(taskInfo, agentArgs, cwd, terminalTitle, 'rocket');
    return taskInfo;
  }

  /** Run squire-watch-pr agent */
  async runWatchPRs(): Promise<TaskInfo> {
    const taskInfo: TaskInfo = {
      id: `watch-${Date.now()}`,
      type: 'watch-pr',
      label: 'Watch PRs',
      status: 'running',
      createdAt: Date.now(),
    };

    const autoFixCI = vscode.workspace.getConfiguration('devSquire').get('watchPR.autoFixCI', true);
    const autoFixComments = vscode.workspace.getConfiguration('devSquire').get('watchPR.autoFixComments', false);

    this.launchTerminal(taskInfo, {
      agent: 'squire-watch-pr',
      initialPrompt: `Repo: ${this.repoSlug}. Auto-fix CI: ${autoFixCI ? 'on' : 'off'}. Auto-fix comments: ${autoFixComments ? 'on' : 'off'}.`,
    }, this.workspaceRoot, 'Copilot: Watch PRs', 'eye');
    return taskInfo;
  }

  /** Review a PR via squire-pr-reviewer agent */
  async runReviewPR(prNumber: number, config: ReviewConfig): Promise<TaskInfo> {
    const prUrl = `${this.repoUrl}/pull/${prNumber}`;

    let strategySuffix = '';
    if (config.strategy === 'quick-approve') strategySuffix = ' [Quick Approve]';
    else if (config.strategy === 'auto-publish') strategySuffix = ' [Auto]';

    const terminalTitle = `Copilot: Review PR #${prNumber}${strategySuffix}`;

    const agentArgs: AgentLaunch = {
      agent: 'squire-pr-reviewer',
      initialPrompt: `Review this PR: ${prUrl} --strategy ${config.strategy} --level ${config.level}`,
    };

    const taskInfo: TaskInfo = {
      id: `review-${Date.now()}`,
      type: 'review-pr',
      label: `Review PR #${prNumber}`,
      prNumber,
      status: 'running',
      createdAt: Date.now(),
    };

    this.launchTerminal(taskInfo, agentArgs, this.workspaceRoot, terminalTitle, 'code-review');
    return taskInfo;
  }

  /** Fix PR comments via squire-dev-issue agent */
  async runFixComments(prNumber: number, mode: 'normal' | 'auto' = 'auto'): Promise<TaskInfo> {
    const autoFlag = mode === 'auto' ? '--auto ' : '';
    const agentArgs: AgentLaunch = {
      agent: 'squire-dev-issue',
      initialPrompt: `${autoFlag}check open comments on ${this.repoUrl}/pull/${prNumber} and fix them`,
    };
    const terminalTitle = `Copilot: Fix PR #${prNumber} comments`;

    const taskInfo: TaskInfo = {
      id: `fix-${Date.now()}`,
      type: 'fix-comments',
      label: `Fix comments PR #${prNumber}`,
      prNumber,
      status: 'running',
      createdAt: Date.now(),
    };

    this.launchTerminal(taskInfo, agentArgs, this.workspaceRoot, terminalTitle, 'wrench');
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

    this.launchTerminal(taskInfo, { prompt: command }, this.workspaceRoot, terminalTitle, 'terminal');
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
      this.squireDir.log('tasks', `Task ${taskId} killed by user`);
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
    this.squireDir.log('tasks', `Task ${taskId} cleaned up`);
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
   * Launch a VS Code terminal with the copilot CLI.
   *
   * Agent mode: `copilot --agent <name> --allow-all`, then send initialPrompt.
   * Prompt mode: `copilot -i "<prompt>" --allow-all`.
   */
  private launchTerminal(taskInfo: TaskInfo, launch: AgentLaunch, cwd: string, terminalTitle: string, icon: string): void {
    this.tasks.set(taskInfo.id, taskInfo);
    this.squireDir.logJson('tasks', {
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

    if (launch.agent) {
      // Start copilot with the specified agent
      terminal.sendText(`copilot --agent ${launch.agent} --allow-all`, true);
      if (launch.initialPrompt) {
        // Send initial prompt after REPL starts
        setTimeout(() => {
          terminal.sendText(launch.initialPrompt!, true);
        }, 2000);
      }
    } else if (launch.prompt) {
      // Plain prompt — use -i flag directly
      const sanitized = launch.prompt.replace(/\n/g, ' ').replace(/"/g, '\\"');
      terminal.sendText(`copilot -i "${sanitized}" --allow-all`, true);
    }

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
