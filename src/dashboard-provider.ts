import * as vscode from 'vscode';
import { TaskRunner } from './task-runner';
import { GitHubRepoInfo } from './github-detector';
import { DevPilotDir } from './dev-pilot-dir';
import { GitHubData } from './github-data';
import { TaskStateReader } from './task-state';
import { SkillsReader } from './skills-reader';
import { ReportGenerator } from './report';
import { getDashboardHtml } from './dashboard-html';

export class DashboardViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly taskRunner: TaskRunner,
    private readonly repoInfo: GitHubRepoInfo,
    private readonly devPilotDir: DevPilotDir,
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

    webviewView.webview.html = getDashboardHtml(this.repoInfo);

    webviewView.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
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
        this.taskRunner.runDevIssue(msg.issueUrl, msg.mode || 'auto');
        break;
      }
      case 'reviewPR': {
        this.taskRunner.runReviewPR(msg.prNumber, msg.config);
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
      case 'killTask': {
        this.taskRunner.killTask(msg.taskId);
        break;
      }
      case 'cleanupTask': {
        this.taskRunner.cleanupTask(msg.taskId);
        break;
      }
      case 'openWorktree': {
        this.taskRunner.openWorktree(msg.taskId);
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
        this.taskStateReader.dismissDecision(msg.id);
        const decisions = this.taskStateReader.readDecisions();
        this.post('decisions', decisions);
        break;
      }

      // --- Skills ---
      case 'getSkills': {
        const skills = this.skillsReader.readAll();
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

    // Runtime tasks take priority, supplement with log data
    const merged = runtimeTasks.map((rt) => {
      const logTask = logTasks.find(
        (lt) => lt.issueUrl === rt.issueUrl || lt.id === rt.id,
      );
      return {
        id: rt.id,
        label: rt.label,
        type: rt.type,
        status: rt.status,
        phase: logTask?.phase || (rt.status === 'completed' ? 'done' : rt.status === 'running' ? 'implementing' : 'planned'),
        branch: logTask?.branch || rt.worktreeBranch,
        prNumber: logTask?.prNumber || rt.prNumber,
        worktreeDir: rt.worktreeDir,
        hasTerminal: !!rt.terminal,
        startedAt: logTask?.startedAt || new Date(rt.createdAt).toISOString(),
        events: logTask?.events || [],
        createdAt: rt.createdAt,
      };
    });

    // Add log-only tasks not in runtime
    for (const lt of logTasks) {
      if (!merged.find((m) => m.id === lt.id)) {
        merged.push({
          id: lt.id,
          label: lt.issueNumber ? `Issue #${lt.issueNumber}` : lt.id,
          type: 'dev-issue' as const,
          status: lt.phase === 'done' ? 'completed' as const : lt.phase === 'failed' ? 'failed' as const : 'running' as const,
          phase: lt.phase,
          branch: lt.branch,
          prNumber: lt.prNumber,
          worktreeDir: lt.worktreeDir,
          hasTerminal: false,
          startedAt: lt.startedAt,
          events: lt.events,
          createdAt: new Date(lt.startedAt).getTime(),
        });
      }
    }

    merged.sort((a, b) => b.createdAt - a.createdAt);
    this.post('tasks', merged);
  }

  private post(type: string, data: any): void {
    this._view?.webview.postMessage({ type, data });
  }
}
