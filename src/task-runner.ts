import * as vscode from 'vscode';
import * as cp from 'child_process';
import { WorktreeManager } from './worktree';
import { GitHubRepoInfo } from './github-detector';
import { SquireDir } from './squire-dir';
import { SquireBackend } from './backend';

export type TaskType = 'dev-issue' | 'watch-pr' | 'review-pr' | 'fix-comments' | 'run-command' | 'run-agent';

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
  strategy: 'normal' | 'auto' | 'quick-approve';
  level: 'high' | 'medium' | 'low';
  isOwn?: boolean;
}

/** Describes how to launch a task */
interface AgentLaunch {
  agent?: string;
  prompt?: string;
  initialPrompt?: string;
  /** Slash command to run interactively (not single-shot) */
  interactivePrompt?: string;
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
    private backend: SquireBackend,
  ) {
    vscode.window.onDidCloseTerminal((closedTerminal) => {
      for (const task of this.tasks.values()) {
        if (task.terminal === closedTerminal) {
          task.status = 'completed';
          task.terminal = undefined;
          this._onTasksChanged.fire();
          this.squireDir.log('extension', `Task ${task.id} (${task.label}) terminal closed`);
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
  async runDevIssue(issueInput: string, mode?: 'normal' | 'auto', issueTitle?: string): Promise<TaskInfo> {
    const effectiveMode = mode || vscode.workspace.getConfiguration('devSquire').get<string>('devIssue.mode', 'auto') as 'normal' | 'auto';
    const issueNum = this.extractIssueNumber(issueInput);
    const issueUrl = issueNum
      ? `${this.repoUrl}/issues/${issueNum}`
      : issueInput;

    const branchName = issueNum ? `dev/issue-${issueNum}` : `dev/task-${Date.now()}`;

    const wt = this.worktree.create(this.workspaceRoot, branchName);

    const terminalTitle = issueNum
      ? `Squire: Dev #${issueNum}`
      : `Squire: dev-adhoc-${Date.now()}`;

    const autoFlag = effectiveMode === 'auto' ? '--auto ' : '';
    const agentArgs: AgentLaunch = {
      agent: 'squire-dev-issue',
      initialPrompt: `${autoFlag}${issueUrl}`,
    };

    const taskInfo: TaskInfo = {
      id: `dev-${Date.now()}`,
      type: 'dev-issue',
      label: this.formatDevLabel(effectiveMode, issueNum, issueTitle, issueInput),
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
    }, this.workspaceRoot, 'Squire: Watch PRs', 'eye');
    return taskInfo;
  }

  /** Review a PR via squire-pr-reviewer agent */
  async runReviewPR(prNumberOrUrl: number | string, config?: Partial<ReviewConfig>, prTitle?: string): Promise<TaskInfo> {
    const cfg = vscode.workspace.getConfiguration('devSquire');
    const strategy = config?.strategy || cfg.get<string>('reviewPR.strategy', 'normal') as ReviewConfig['strategy'];
    const level = config?.level || cfg.get<string>('reviewPR.level', 'medium') as ReviewConfig['level'];

    let prUrl: string;
    let prNumber: number | undefined;
    if (typeof prNumberOrUrl === 'string' && prNumberOrUrl.startsWith('http')) {
      prUrl = prNumberOrUrl;
      const m = prUrl.match(/\/pull\/(\d+)/);
      prNumber = m ? parseInt(m[1]) : undefined;
    } else {
      prNumber = typeof prNumberOrUrl === 'string' ? parseInt(prNumberOrUrl) : prNumberOrUrl;
      prUrl = `${this.repoUrl}/pull/${prNumber}`;
    }

    const prLabel = prNumber ? `#${prNumber}` : prUrl;

    let strategySuffix = '';
    if (strategy === 'quick-approve') strategySuffix = '[Quick Approve]';
    else if (strategy === 'auto') strategySuffix = '[Auto]';
    else strategySuffix = '[Normal]';

    const levelSuffix = level !== 'medium' ? ` ${level}` : '';
    const terminalTitle = `Squire: Review PR ${prLabel}`;

    let prompt = `Review this PR: ${prUrl} --strategy ${strategy} --level ${level}`;
    if (config?.isOwn) {
      prompt += '\nIMPORTANT: This is the user\'s own PR. NEVER publish any comments, approvals, or reviews to GitHub. Present all findings locally only.';
    }

    const agentArgs: AgentLaunch = {
      agent: 'squire-pr-reviewer',
      initialPrompt: prompt,
    };

    const taskInfo: TaskInfo = {
      id: `review-${Date.now()}`,
      type: 'review-pr',
      label: `${strategySuffix} Review PR ${prLabel}${prTitle ? ' ' + prTitle : ''}`,
      prNumber,
      status: 'running',
      createdAt: Date.now(),
    };

    this.launchTerminal(taskInfo, agentArgs, this.workspaceRoot, terminalTitle, 'code-review');
    return taskInfo;
  }

  /** Fix PR comments via squire-dev-issue agent */
  async runFixComments(prNumber: number, mode?: 'normal' | 'auto'): Promise<TaskInfo> {
    const effectiveMode = mode || vscode.workspace.getConfiguration('devSquire').get<string>('fixComments.mode', 'auto') as 'normal' | 'auto';
    const autoFlag = effectiveMode === 'auto' ? '--auto ' : '';
    const agentArgs: AgentLaunch = {
      agent: 'squire-dev-issue',
      initialPrompt: `${autoFlag}check open comments on ${this.repoUrl}/pull/${prNumber} and fix them`,
    };
    const terminalTitle = `Squire: Fix PR #${prNumber} comments`;

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

  /** Run an agent-based skill from the dashboard with user input */
  async runAgent(agentName: string, input: string): Promise<TaskInfo> {
    const terminalTitle = `Squire: ${agentName}`;

    const agentArgs: AgentLaunch = {
      agent: agentName,
      initialPrompt: input,
    };

    const taskInfo: TaskInfo = {
      id: `agent-${Date.now()}`,
      type: 'run-agent',
      label: `${agentName}: ${input.substring(0, 60)}${input.length > 60 ? '…' : ''}`,
      status: 'running',
      createdAt: Date.now(),
    };

    this.launchTerminal(taskInfo, agentArgs, this.workspaceRoot, terminalTitle, 'squirrel');
    return taskInfo;
  }

  /** Run a custom command or prompt — matches dashboard run-command */
  async runCommand(command: string): Promise<TaskInfo> {
    const label = command.startsWith('/')
      ? command.split(' ')[0]
      : command.substring(0, 40) + (command.length > 40 ? '…' : '');
    const terminalTitle = `Squire: ${label}`;

    const taskInfo: TaskInfo = {
      id: `cmd-${Date.now()}`,
      type: 'run-command',
      label,
      status: 'running',
      createdAt: Date.now(),
    };

    // Slash commands run interactively (not single-shot) so the AI can
    // prompt the user for missing arguments — matching dev-pilot behavior.
    const isSlashCommand = command.startsWith('/');
    if (isSlashCommand) {
      this.launchTerminal(taskInfo, { interactivePrompt: command }, this.workspaceRoot, terminalTitle, 'terminal');
    } else {
      this.launchTerminal(taskInfo, { prompt: command }, this.workspaceRoot, terminalTitle, 'terminal');
    }
    return taskInfo;
  }

  getAllTasks(): TaskInfo[] {
    return Array.from(this.tasks.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  killTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task?.terminal) {
      task.terminal.sendText('\x03', false); // Ctrl+C
      task.status = 'failed';
      this._onTasksChanged.fire();
      this.squireDir.log('extension', `Task ${taskId} killed by user`);
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
    this.squireDir.log('extension', `Task ${taskId} cleaned up`);
  }

  cleanAll(): void {
    for (const [id, task] of this.tasks) {
      if (task.status !== 'running') {
        if (task.terminal) task.terminal.dispose();
        this.tasks.delete(id);
      }
    }
    this.squireDir.log('extension', 'Clean all: removed logs, pending-decisions, worktrees');
    this.squireDir.cleanDirs();
    this._onTasksChanged.fire();
    vscode.window.showInformationMessage('DevSquire: Clean all done.');
  }

  syncMain(): void {
    try {
      const defaultBranch = cp.execSync(
        'git symbolic-ref refs/remotes/origin/HEAD --short',
        { cwd: this.workspaceRoot, encoding: 'utf-8' },
      ).trim().replace('origin/', '');
      cp.execSync(`git checkout ${defaultBranch} && git pull`, { cwd: this.workspaceRoot, encoding: 'utf-8' });
      vscode.window.showInformationMessage(`DevSquire: Synced to latest ${defaultBranch}.`);
      this.squireDir.log('extension', `Synced to ${defaultBranch}`);
    } catch (err: any) {
      this.squireDir.log('extension', `Sync main failed: ${err.message || err}`);
      vscode.window.showErrorMessage(`DevSquire: Failed to sync — ${err.message || err}`);
    }
  }

  openWorktree(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task?.worktreeDir) {
      const uri = vscode.Uri.file(task.worktreeDir);
      vscode.commands.executeCommand('vscode.openFolder', uri, true);
    }
  }

  focusTerminal(taskId: string): void {
    // Direct lookup first
    const task = this.tasks.get(taskId);
    if (task?.terminal) {
      task.terminal.show();
      return;
    }
    // Fallback: decision taskIds use "issue-<N>" format but TaskRunner uses
    // "dev-<timestamp>".  Match by issue number in the task's issueUrl.
    const issueMatch = taskId.match(/^issue-(\d+)$/);
    if (issueMatch) {
      const num = issueMatch[1];
      for (const t of this.tasks.values()) {
        if (t.terminal && t.issueUrl?.endsWith(`/issues/${num}`)) {
          t.terminal.show();
          return;
        }
      }
    }
  }

  /**
   * Launch a VS Code terminal with the configured backend.
   */
  private launchTerminal(taskInfo: TaskInfo, launch: AgentLaunch, cwd: string, terminalTitle: string, icon: string): void {
    this.tasks.set(taskInfo.id, taskInfo);
    this.squireDir.log('extension', `Task created: ${taskInfo.type} — ${taskInfo.label} (${taskInfo.id})`);
    this.squireDir.logJson('tasks', {
      event: 'task_created',
      taskId: taskInfo.id,
      type: taskInfo.type,
      label: taskInfo.label,
    });

    // Write per-task JSONL with worktree_dir so the dashboard can show the
    // Worktree button even after the extension reloads (issue #7).
    const issueNum = taskInfo.issueUrl?.match(/\/issues\/(\d+)/)?.[1];
    const taskLogId = issueNum ? `task-issue-${issueNum}` : `task-${taskInfo.id}`;
    this.squireDir.logJson(taskLogId, {
      event: 'task_start',
      phase: 'planned',
      task_id: taskLogId,
      type: taskInfo.type,
      label: taskInfo.label,
      branch: taskInfo.worktreeBranch,
      issue_number: issueNum ? parseInt(issueNum) : undefined,
      issue_url: taskInfo.issueUrl,
      worktree_dir: taskInfo.worktreeDir,
    });

    const terminal = vscode.window.createTerminal({
      name: terminalTitle,
      cwd,
      iconPath: new vscode.ThemeIcon(icon),
    });

    terminal.show(false);

    if (launch.agent) {
      this.backend.launchAgent({ terminal, agentName: launch.agent, initialPrompt: launch.initialPrompt });
    } else if (launch.interactivePrompt) {
      this.backend.launchInteractiveCommand({ terminal, prompt: launch.interactivePrompt });
    } else if (launch.prompt) {
      this.backend.launchPrompt({ terminal, prompt: launch.prompt });
    }

    taskInfo.terminal = terminal;
    this._onTasksChanged.fire();
  }

  private formatDevLabel(mode: string, issueNum: string | null, title?: string, rawInput?: string): string {
    const modeTag = mode === 'auto' ? '[Auto]' : '[Normal]';
    if (issueNum) {
      const suffix = title ? ` ${title}` : '';
      return `${modeTag} Dev #${issueNum}${suffix}`;
    }
    return `${modeTag} ${(rawInput || 'task').substring(0, 50)}`;
  }

  private extractIssueNumber(input: string): string | null {
    const urlMatch = input.match(/\/issues\/(\d+)/);
    if (urlMatch) return urlMatch[1];
    const refMatch = input.match(/#?(\d+)$/);
    if (refMatch) return refMatch[1];
    return null;
  }
}
