import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TaskRunner } from './task-runner';
import { GitHubRepoInfo } from './github-detector';
import { SquireDir } from './squire-dir';
import { GitHubData } from './github-data';
import { TaskStateReader } from './task-state';
import { SkillsReader } from './skills-reader';
import { ReportGenerator } from './report';
import { getDashboardHtml } from './dashboard-html';

export class DashboardViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private watchers: fs.FSWatcher[] = [];
  private debounceTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly taskRunner: TaskRunner,
    private readonly repoInfo: GitHubRepoInfo,
    private readonly squireDir: SquireDir,
    private readonly ghData: GitHubData,
    private readonly taskStateReader: TaskStateReader,
    private readonly skillsReader: SkillsReader,
    private readonly reportGenerator: ReportGenerator,
  ) {
    this.taskRunner.onTasksChanged(() => this.sendTasks());
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    const defaultMode = vscode.workspace.getConfiguration('devSquire').get<string>('devIssue.mode', 'auto');
    webviewView.webview.html = getDashboardHtml(this.repoInfo, defaultMode);

    webviewView.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));

    // Watch .squire/logs/ and .squire/pending-decisions/ for changes (push instead of poll)
    this.setupFileWatchers();

    webviewView.onDidDispose(() => {
      this.watchers.forEach(w => w.close());
      this.watchers = [];
    });
  }

  private setupFileWatchers(): void {
    const logsDir = this.squireDir.logsDir;
    const decisionsDir = this.squireDir.decisionsDir;

    for (const dir of [logsDir, decisionsDir]) {
      try {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const watcher = fs.watch(dir, () => {
          if (this.debounceTimer) clearTimeout(this.debounceTimer);
          this.debounceTimer = setTimeout(() => {
            this.sendTasks();
            const decisions = this.taskStateReader.readDecisions();
            this.post('decisions', decisions);
          }, 300);
        });
        this.watchers.push(watcher);
      } catch { /* non-critical — fall back to manual refresh */ }
    }
  }

  private async handleMessage(msg: any): Promise<void> {
    switch (msg.type) {
      // --- Issues (always assigned to me) ---
      case 'getIssues': {
        // Run async to avoid blocking webview
        setImmediate(() => {
          const issues = this.ghData.listMyIssues();
          this.post('issues', issues);
        });
        break;
      }
      case 'getIssueBody': {
        setImmediate(() => {
          const body = this.ghData.getIssueBody(msg.number);
          this._view?.webview.postMessage({ type: 'issueBody', number: msg.number, body });
        });
        break;
      }
      case 'getPRBody': {
        setImmediate(() => {
          const body = this.ghData.getPRBody(msg.number);
          this._view?.webview.postMessage({ type: 'prBody', number: msg.number, body });
        });
        break;
      }

      // --- PRs ---
      case 'getPRs': {
        setImmediate(() => {
          const mine = this.ghData.listMyPRs();
          const review = this.ghData.listReviewRequestedPRs();
          const unresolvedMap = this.ghData.getUnresolvedCounts(mine.map((p) => p.number));
          for (const pr of mine) {
            pr.unresolvedCount = unresolvedMap.get(pr.number) || 0;
          }
          this.post('prs', { mine, review });
        });
        break;
      }

      // --- Tasks ---
      case 'getTasks': {
        this.sendTasks();
        break;
      }
      case 'devIssue': {
        this.taskRunner.runDevIssue(msg.issueUrl, msg.mode || 'auto', msg.title);
        break;
      }
      case 'reviewPR': {
        this.taskRunner.runReviewPR(msg.prNumber, msg.config, msg.title);
        break;
      }
      case 'fixComments': {
        this.taskRunner.runFixComments(msg.prNumber);
        break;
      }
      case 'runCommand': {
        this.taskRunner.runCommand(msg.command);
        break;
      }
      case 'runAgent': {
        this.taskRunner.runAgent(msg.agent, msg.input);
        break;
      }
      case 'promptInput': {
        const input = await vscode.window.showInputBox({ prompt: msg.placeholder, placeHolder: msg.placeholder });
        if (input?.trim()) {
          this.taskRunner.runAgent(msg.agent, input.trim());
        }
        break;
      }
      case 'watchPRs': {
        this.taskRunner.runWatchPRs();
        break;
      }
      case 'killTask': {
        this.taskRunner.killTask(msg.taskId);
        break;
      }
      case 'cleanupTask': {
        this.taskRunner.cleanupTask(msg.taskId);
        break;
      }
      case 'cleanupOrphan': {
        this.taskRunner.cleanOrphanTask(msg.taskId);
        this.sendTasks();
        break;
      }
      case 'cleanAll': {
        this.taskRunner.cleanAll();
        break;
      }
      case 'syncMain': {
        this.taskRunner.syncMain();
        break;
      }
      case 'openWorktree': {
        this.taskRunner.openWorktree(msg.taskId, msg.worktreeDir);
        break;
      }
      case 'focusTerminal': {
        this.taskRunner.focusTerminal(msg.taskId);
        break;
      }

      // --- Decisions ---
      case 'getDecisions': {
        const decisions = this.taskStateReader.readDecisions();
        this.post('decisions', decisions);
        break;
      }
      case 'dismissDecision': {
        // Log the dismissal event to JSONL so orphan decisions don't reappear
        if (msg.taskId) {
          this.squireDir.logJson(msg.taskId, { event: 'decision_dismissed', decision_id: msg.id });
        }
        this.taskStateReader.dismissDecision(msg.id);
        const decisions = this.taskStateReader.readDecisions();
        this.post('decisions', decisions);
        break;
      }

      // --- Skills ---
      case 'getSkills': {
        const skills = this.skillsReader.readAll(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '');
        this.post('skills', skills);
        break;
      }

      // --- Report ---
      case 'getReport': {
        setImmediate(() => {
          if (msg.view === 'scrum') {
            const scrum = this.reportGenerator.generateScrum();
            this._view?.webview.postMessage({ type: 'scrumReport', data: scrum });
          } else {
            const eod = this.reportGenerator.generateEOD();
            this._view?.webview.postMessage({ type: 'eodReport', data: eod });
          }
        });
        break;
      }
      case 'postScrum': {
        const report = this.reportGenerator.generateScrum();
        this.reportGenerator.postScrumToGitHub(report);
        break;
      }
      case 'markScrum': {
        this.reportGenerator.markScrum();
        break;
      }

      // --- Accounts ---
      case 'getAccounts': {
        const accounts = this.ghData.listAccounts();
        this.post('accounts', accounts);
        break;
      }
      case 'switchAccount': {
        this.ghData.switchAccount(msg.user);
        const accounts = this.ghData.listAccounts();
        this.post('accounts', accounts);
        this._view?.webview.postMessage({ type: 'toast', message: `Switched to ${msg.user}`, variant: 'success' });
        break;
      }

      // --- External ---
      case 'openExternal': {
        if (msg.url) {
          vscode.env.openExternal(vscode.Uri.parse(msg.url));
        }
        break;
      }
    }
  }

  private sendTasks(): void {
    // Merge runtime tasks (terminals) with persisted task states (JSONL logs)
    const runtimeTasks = this.taskRunner.getAllTasks();
    const logTasks = this.taskStateReader.readAllTasks();
    const decisions = this.taskStateReader.readDecisions();
    const waitingTaskIds = new Set(decisions.map(d => d.taskId));

    // Track which log tasks have been claimed by a runtime task
    const claimedLogIds = new Set<string>();

    // Runtime tasks take priority, supplement with log data
    const merged = runtimeTasks.map((rt) => {
      const logTask = logTasks.find(
        (lt) => !claimedLogIds.has(lt.id) && (
          lt.id === rt.id
          || (rt.issueUrl && lt.issueUrl === rt.issueUrl)
          || (rt.worktreeBranch && lt.branch === rt.worktreeBranch)
        ),
      );
      if (logTask) claimedLogIds.add(logTask.id);
      const phase = logTask?.phase || (rt.status === 'completed' ? 'done' : rt.status === 'running' ? 'implementing' : 'planned');
      const isWaiting = waitingTaskIds.has(rt.id) || waitingTaskIds.has(logTask?.id || '');
      return {
        id: rt.id,
        label: rt.label,
        type: rt.type,
        status: rt.status,
        phase,
        waiting: isWaiting,
        branch: logTask?.branch || rt.worktreeBranch,
        prNumber: logTask?.prNumber || rt.prNumber,
        worktreeDir: rt.worktreeDir,
        hasTerminal: !!rt.terminal,
        startedAt: logTask?.startedAt || new Date(rt.createdAt).toISOString(),
        events: logTask?.events || [],
        createdAt: rt.createdAt,
        updatedAt: logTask?.updatedAt ? new Date(logTask.updatedAt).getTime() : rt.createdAt,
      };
    });

    // Add log-only tasks not in runtime
    for (const lt of logTasks) {
      if (!claimedLogIds.has(lt.id) && !merged.find((m) => m.id === lt.id)) {
        merged.push({
          id: lt.id,
          label: lt.issueNumber ? `Issue #${lt.issueNumber}` : lt.id,
          type: 'dev-issue' as const,
          status: lt.phase === 'done' ? 'completed' as const : lt.phase === 'failed' ? 'failed' as const : 'orphan' as const,
          phase: lt.phase,
          branch: lt.branch,
          prNumber: lt.prNumber,
          worktreeDir: lt.worktreeDir,
          hasTerminal: false,
          startedAt: lt.startedAt,
          events: lt.events,
          createdAt: new Date(lt.startedAt).getTime(),
          updatedAt: new Date(lt.updatedAt).getTime(),
        });
      }
    }

    merged.sort((a, b) => b.updatedAt - a.updatedAt);
    this.post('tasks', merged);
  }

  private post(type: string, data: any): void {
    this._view?.webview.postMessage({ type, data });
  }
}
