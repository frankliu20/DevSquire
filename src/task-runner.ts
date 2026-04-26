import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { WorktreeManager } from './worktree';
import { GitHubRepoInfo } from './github-detector';
import { SquireDir } from './squire-dir';
import { SquireBackend } from './backend';

export type TaskType = 'dev-issue' | 'watch-pr' | 'review-pr' | 'fix-comments' | 'run-command' | 'run-agent';

export interface TaskInfo {
  id: string;
  taskLogId?: string;
  type: TaskType;
  label: string;
  issueUrl?: string;
  prNumber?: number;
  isOwnPR?: boolean;
  worktreeBranch?: string;
  worktreeDir?: string;
  terminal?: vscode.Terminal;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'orphan';
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
          // Write done event to JSONL so dashboard shows completion
          const taskLogId = task.taskLogId || `task-${task.id}`;
          this.squireDir.logJson(taskLogId, {
            event: 'task_completed',
            phase: 'done',
            task_id: taskLogId,
            type: task.type,
          });
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

    // Duplicate detection: check if a task with same issue is already running
    if (issueNum) {
      for (const t of this.tasks.values()) {
        if (t.status === 'running' && t.issueUrl === issueUrl) {
          vscode.window.showWarningMessage(`DevSquire: Issue #${issueNum} already has a running task.`);
          if (t.terminal) t.terminal.show();
          return t;
        }
      }
    }

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

    const ts = Date.now();
    const taskLogId = issueNum ? `task-issue-${issueNum}` : `task-adhoc-${ts}`;
    const taskInfo: TaskInfo = {
      id: `dev-${ts}`,
      taskLogId,
      type: 'dev-issue',
      label: this.formatDevLabel(effectiveMode, issueNum, issueTitle, issueInput),
      issueUrl,
      worktreeBranch: branchName,
      worktreeDir: wt?.path,
      status: 'running',
      createdAt: ts,
    };

    const cwd = wt?.path || this.workspaceRoot;
    this.launchTerminal(taskInfo, agentArgs, cwd, terminalTitle, 'rocket');
    return taskInfo;
  }

  /** Run squire-watch-pr agent */
  async runWatchPRs(): Promise<TaskInfo> {
    const ts = Date.now();
    const taskInfo: TaskInfo = {
      id: `watch-${ts}`,
      taskLogId: 'task-watch',
      type: 'watch-pr',
      label: 'Watch PRs',
      status: 'running',
      createdAt: ts,
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
    const defaultLevel = config?.isOwn ? 'low' : 'medium';
    const level = config?.level || cfg.get<string>('reviewPR.level', defaultLevel) as ReviewConfig['level'];

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

    const ts = Date.now();
    const taskLogId = `task-review-${prNumber || ts}`;
    const agentArgs: AgentLaunch = {
      agent: 'squire-pr-reviewer',
      initialPrompt: prompt,
    };

    const taskInfo: TaskInfo = {
      id: `review-${ts}`,
      taskLogId,
      type: 'review-pr',
      label: `${strategySuffix} Review PR ${prLabel}${prTitle ? ' ' + prTitle : ''}`,
      prNumber,
      isOwnPR: !!config?.isOwn,
      status: 'running',
      createdAt: ts,
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

    const ts = Date.now();
    const taskInfo: TaskInfo = {
      id: `fix-${ts}`,
      taskLogId: `task-issue-${prNumber}`,
      type: 'fix-comments',
      label: `Fix comments PR #${prNumber}`,
      prNumber,
      status: 'running',
      createdAt: ts,
    };

    this.launchTerminal(taskInfo, agentArgs, this.workspaceRoot, terminalTitle, 'wrench');
    return taskInfo;
  }

  /** Run an agent-based skill from the dashboard with user input */
  async runAgent(agentName: string, input: string): Promise<TaskInfo> {
    const isDevIssue = agentName === 'squire-dev-issue';
    const ts = Date.now();
    const adhocId = `dev-adhoc-${ts}`;
    const taskLogId = `task-adhoc-${ts}`;
    const terminalTitle = isDevIssue ? `Squire: ${adhocId}` : `Squire: ${agentName}`;
    const taskId = isDevIssue ? adhocId : `agent-${ts}`;
    const taskType: TaskType = isDevIssue ? 'dev-issue' : 'run-agent';

    const agentArgs: AgentLaunch = {
      agent: agentName,
      initialPrompt: input || undefined,
    };

    const taskInfo: TaskInfo = {
      id: taskId,
      taskLogId,
      type: taskType,
      label: isDevIssue ? `[Auto] ${adhocId}` : `${agentName}: ${input.substring(0, 60)}${input.length > 60 ? '…' : ''}`,
      status: 'running',
      createdAt: ts,
    };

    this.launchTerminal(taskInfo, agentArgs, this.workspaceRoot, terminalTitle, isDevIssue ? 'rocket' : 'squirrel');
    return taskInfo;
  }

  /** Run a custom command or prompt — matches dashboard run-command */
  async runCommand(command: string): Promise<TaskInfo> {
    const ts = Date.now();
    const adhocId = `dev-adhoc-${ts}`;
    const isDevIssue = command.includes('squire-dev-issue');
    const isWatchPR = command.includes('squire-watch-pr');
    const label = command.startsWith('/')
      ? command.split(' ')[0]
      : command.substring(0, 40) + (command.length > 40 ? '…' : '');
    const terminalTitle = isDevIssue ? `Squire: ${adhocId}`
      : isWatchPR ? 'Squire: Watch PRs'
      : command.startsWith('/') ? `Squire: ${command.split(' ')[0]}`
      : `Squire: ${adhocId}`;

    const taskLogId = isWatchPR ? 'task-watch' : `task-adhoc-${ts}`;
    const taskInfo: TaskInfo = {
      id: isWatchPR ? `watch-${ts}` : adhocId,
      taskLogId,
      type: isDevIssue ? 'dev-issue' : isWatchPR ? 'watch-pr' : 'run-command',
      label: isDevIssue ? `[Auto] ${adhocId}` : isWatchPR ? 'Watch PRs' : label,
      status: 'running',
      createdAt: ts,
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

  /** Find a task by runtime ID or taskLogId */
  private findTask(taskId: string): [string, TaskInfo] | undefined {
    // Direct runtime ID lookup
    const direct = this.tasks.get(taskId);
    if (direct) return [taskId, direct];
    // Fallback: match by taskLogId
    for (const [id, t] of this.tasks) {
      if (t.taskLogId === taskId) return [id, t];
    }
    return undefined;
  }

  killTask(taskId: string): void {
    const found = this.findTask(taskId);
    if (found?.[1]?.terminal) {
      const task = found[1];
      task.terminal.sendText('\x03', false); // Ctrl+C
      task.status = 'failed';
      this._onTasksChanged.fire();
      this.squireDir.log('extension', `Task ${taskId} killed by user`);
    }
  }

  cleanupTask(taskId: string): void {
    const found = this.findTask(taskId);
    if (found) {
      const [runtimeId, task] = found;
      if (task.terminal) task.terminal.dispose();
      if (task.worktreeBranch) {
        this.worktree.remove(this.workspaceRoot, task.worktreeBranch);
      }
      this.tasks.delete(runtimeId);
    }
    // Also clean JSONL log if taskId is a taskLogId
    if (taskId.startsWith('task-')) {
      const logFile = path.join(this.squireDir.logsDir, `${taskId}.jsonl`);
      try { if (fs.existsSync(logFile)) fs.unlinkSync(logFile); } catch { /* non-critical */ }
    }
    this._onTasksChanged.fire();
    this.squireDir.log('extension', `Task ${taskId} cleaned up`);
  }

  /** Clean an orphan task: remove its JSONL log, pending decisions, and optionally its worktree */
  cleanOrphanTask(taskId: string): void {
    // Delete JSONL log file
    const logFile = path.join(this.squireDir.logsDir, `${taskId}.jsonl`);
    try {
      if (fs.existsSync(logFile)) {
        fs.unlinkSync(logFile);
      }
    } catch { /* non-critical */ }

    // Delete any pending decision for this task
    const decisionFile = path.join(this.squireDir.decisionsDir, `${taskId}.json`);
    try {
      if (fs.existsSync(decisionFile)) {
        fs.unlinkSync(decisionFile);
      }
    } catch { /* non-critical */ }

    // Try to remove worktree if it exists — extract branch from taskId
    const issueMatch = taskId.match(/issue-(\d+)/);
    if (issueMatch) {
      const branchPatterns = [`dev/issue-${issueMatch[1]}`, `fix/issue-${issueMatch[1]}`, `feat/issue-${issueMatch[1]}`];
      for (const branch of branchPatterns) {
        try {
          this.worktree.remove(this.workspaceRoot, branch);
        } catch { /* ignore — branch may not exist */ }
      }
    }

    this._onTasksChanged.fire();
    this.squireDir.log('extension', `Orphan task ${taskId} cleaned up`);
  }

  cleanAll(): void {
    for (const [id, task] of this.tasks) {
      if (task.status !== 'running') {
        if (task.terminal) task.terminal.dispose();
        this.tasks.delete(id);
      }
    }
    // Remove all git worktrees under .squire/worktrees/ properly
    const worktrees = this.worktree.list(this.workspaceRoot);
    const squireWorktreePrefix = path.join(this.workspaceRoot, '.squire', 'worktrees').replace(/\\/g, '/');
    for (const wt of worktrees) {
      const wtPath = wt.path.replace(/\\/g, '/');
      if (wtPath.startsWith(squireWorktreePrefix) && wt.branch) {
        this.worktree.remove(this.workspaceRoot, wt.branch, true);
      }
    }
    this.squireDir.log('extension', 'Clean all: removed logs, pending-decisions, worktrees');
    this.squireDir.cleanDirs();
    this._onTasksChanged.fire();
    // Sync back to main after cleanup
    this.syncMain();
    vscode.window.showInformationMessage('DevSquire: Clean all done.');
  }

  syncMain(): void {
    // Run in background to avoid blocking extension host
    const cwd = this.workspaceRoot;
    const squireDir = this.squireDir;
    setImmediate(() => {
      try {
        const defaultBranch = cp.execSync(
          'git symbolic-ref refs/remotes/origin/HEAD --short',
          { cwd, encoding: 'utf-8', timeout: 30000 },
        ).trim().replace('origin/', '');
        cp.execSync(`git checkout ${defaultBranch} && git pull`, { cwd, encoding: 'utf-8', timeout: 30000 });
        vscode.window.showInformationMessage(`DevSquire: Synced to latest ${defaultBranch}.`);
        squireDir.log('extension', `Synced to ${defaultBranch}`);
      } catch (err: any) {
        squireDir.log('extension', `Sync main failed: ${err.message || err}`);
        vscode.window.showErrorMessage(`DevSquire: Failed to sync — ${err.message || err}`);
      }
    });
  }

  openWorktree(taskId: string, worktreeDir?: string): void {
    const dir = worktreeDir || this.tasks.get(taskId)?.worktreeDir;
    if (dir) {
      const uri = vscode.Uri.file(dir);
      vscode.commands.executeCommand('vscode.openFolder', uri, true);
    }
  }

  focusTerminal(taskId: string): void {
    const found = this.findTask(taskId);
    if (found?.[1]?.terminal) {
      found[1].terminal.show();
      return;
    }
    // Fallback: extract issue number and match by issueUrl
    const issueMatch = taskId.match(/issue-(\d+)/);
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
    const taskLogId = taskInfo.taskLogId || `task-${taskInfo.id}`;
    const initialPhase = taskInfo.type === 'review-pr' ? 'reviewing' : 'planned';
    this.squireDir.logJson(taskLogId, {
      event: 'task_start',
      phase: initialPhase,
      task_id: taskLogId,
      type: taskInfo.type,
      label: taskInfo.label,
      branch: taskInfo.worktreeBranch,
      issue_number: taskInfo.issueUrl?.match(/\/issues\/(\d+)/)?.[1] ? parseInt(taskInfo.issueUrl.match(/\/issues\/(\d+)/)![1]) : undefined,
      issue_url: taskInfo.issueUrl,
      pr_number: taskInfo.prNumber,
      worktree_dir: taskInfo.worktreeDir,
    });

    const terminal = vscode.window.createTerminal({
      name: terminalTitle,
      cwd,
      iconPath: new vscode.ThemeIcon(icon),
    });

    terminal.show(false);

    // Inject task-log-id so agents write to the correct JSONL file.
    // Use bracket syntax [task-log-id:xxx] appended at the END to avoid
    // interfering with slash command names or CLI flag parsing.
    const logIdTag = `[task-log-id:${taskLogId}]`;
    if (launch.agent && launch.initialPrompt) {
      launch.initialPrompt = `${launch.initialPrompt} ${logIdTag}`;
    } else if (launch.agent) {
      launch.initialPrompt = logIdTag;
    }
    if (launch.interactivePrompt) {
      launch.interactivePrompt = `${launch.interactivePrompt} ${logIdTag}`;
    }
    if (launch.prompt) {
      launch.prompt = `${launch.prompt} ${logIdTag}`;
    }

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
