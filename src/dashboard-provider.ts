import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TaskRunner } from './task-runner';
import { GitHubRepoInfo } from './github-detector';
import { SquireDir } from './squire-dir';
import { GitHubData } from './github-data';
import { TaskStateReader, defaultRunningPhase } from './task-state';
import { SkillsReader } from './skills-reader';
import { ReportGenerator } from './report';
import { getDashboardHtml } from './dashboard-html';
import { SessionIndexManager } from './session-index-manager';

/** A single session entry from the global session index */
export interface SessionEntry {
  id: string;
  startedAt?: string;
  endedAt?: string | null;
  aiSessions?: Array<{ source: 'claude' | 'copilot'; id: string; resumable: boolean }>;
}

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
    private readonly sessionIndexManager: SessionIndexManager,
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
      case 'stopTask': {
        this.taskRunner.stopTask(msg.taskId);
        break;
      }
      case 'dismissTask': {
        this.taskRunner.dismissTask(msg.taskId);
        this.sendTasks();
        break;
      }
      case 'loadHistory': {
        setImmediate(() => this.sendHistorySessions());
        break;
      }
      case 'cleanupTask': {
        this.taskRunner.cleanTask(msg.taskId);
        this.sendTasks();
        break;
      }
      case 'cleanAll': {
        this.taskRunner.cleanAll();
        this.sendTasks();
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
      case 'resumeSession': {
        this.taskRunner.resumeSession(msg.taskId, msg.aiSessionId, msg.aiSource || 'claude', msg.worktreeDir);
        break;
      }

      // --- Decisions ---
      case 'getDecisions': {
        const decisions = this.taskStateReader.readDecisions();
        this.post('decisions', decisions);
        break;
      }
      case 'dismissDecision': {
        // Log the dismissal event to JSONL so dismissed decisions don't reappear
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

    // Read global session index for session history
    const sessionIndex = this.readGlobalSessionIndex();

    // Track which log tasks have been claimed by a runtime task
    const claimedLogIds = new Set<string>();

    // Runtime tasks take priority, supplement with log data
    const merged = runtimeTasks.map((rt) => {
      const logTask = logTasks.find(
        (lt) => !claimedLogIds.has(lt.id) && (
          (rt.taskLogId && lt.id === rt.taskLogId)
          || lt.id === rt.id
          || (rt.issueUrl && lt.issueUrl === rt.issueUrl)
          || (rt.worktreeBranch && lt.branch === rt.worktreeBranch)
        ),
      );
      if (logTask) claimedLogIds.add(logTask.id);
      const phase = logTask?.phase || (rt.status === 'completed' ? 'done' : rt.status === 'running' ? defaultRunningPhase(rt.type) : 'planned');
      const isWaiting = waitingTaskIds.has(rt.id) || waitingTaskIds.has(logTask?.id || '');
      const taskLogId = rt.taskLogId || logTask?.id || '';
      const issueNum = logTask?.issueNumber || (rt.issueUrl ? parseInt(rt.issueUrl.match(/\/issues\/(\d+)/)?.[1] || '0') || undefined : undefined);
      return {
        id: rt.id,
        label: rt.label,
        type: rt.type,
        status: rt.status,
        phase,
        waiting: isWaiting,
        isOwnPR: rt.isOwnPR,
        branch: logTask?.branch || rt.worktreeBranch,
        prNumber: logTask?.prNumber || rt.prNumber,
        issueNumber: issueNum,
        issueUrl: logTask?.issueUrl || rt.issueUrl,
        worktreeDir: rt.worktreeDir,
        hasTerminal: !!rt.terminal,
        startedAt: logTask?.startedAt || new Date(rt.createdAt).toISOString(),
        events: logTask?.events || [],
        sessions: sessionIndex[taskLogId] || [],
        createdAt: rt.createdAt,
        updatedAt: logTask?.updatedAt ? new Date(logTask.updatedAt).getTime() : rt.createdAt,
      };
    });

    // Add log-only tasks not in runtime
    for (const lt of logTasks) {
      if (!claimedLogIds.has(lt.id) && !merged.find((m) => m.id === lt.id)) {
        merged.push({
          id: lt.id,
          label: lt.issueNumber ? `Issue #${lt.issueNumber}` : lt.prNumber ? `PR #${lt.prNumber}` : lt.id,
          type: (lt.id.startsWith('task-review-') ? 'review-pr'
            : lt.id.startsWith('task-fix-') ? 'fix-comments'
            : lt.id.startsWith('task-watch-') ? 'watch-pr'
            : 'dev-issue') as const,
          status: lt.phase === 'done' ? 'completed' as const : lt.phase === 'failed' ? 'failed' as const : 'completed' as const,
          phase: lt.phase,
          branch: lt.branch,
          prNumber: lt.prNumber,
          issueNumber: lt.issueNumber,
          issueUrl: lt.issueUrl,
          worktreeDir: lt.worktreeDir,
          hasTerminal: false,
          startedAt: lt.startedAt,
          events: lt.events,
          sessions: sessionIndex[lt.id] || [],
          createdAt: new Date(lt.startedAt).getTime(),
          updatedAt: new Date(lt.updatedAt).getTime(),
        });
      }
    }

    merged.sort((a, b) => b.updatedAt - a.updatedAt);
    this.post('tasks', merged);
  }

  /**
   * Read the global session index via SessionIndexManager
   * and return a map of taskLogId → SessionEntry[] for the current repo.
   */
  private readGlobalSessionIndex(): Record<string, SessionEntry[]> {
    try {
      const repoSlug = `${this.repoInfo.owner}/${this.repoInfo.repo}`;
      const repoData = this.sessionIndexManager.readRepoSessions(repoSlug);
      const result: Record<string, SessionEntry[]> = {};
      for (const [taskLogId, taskEntry] of Object.entries(repoData)) {
        const sessions = taskEntry?.sessions;
        if (Array.isArray(sessions) && sessions.length > 0) {
          result[taskLogId] = sessions;
        }
      }
      return result;
    } catch {
      return {};
    }
  }

  /**
   * Load historical sessions for open issues from the global session index.
   * Returns session summaries filtered to only issues that are currently open.
   */
  private sendHistorySessions(): void {
    try {
      const repoSlug = `${this.repoInfo.owner}/${this.repoInfo.repo}`;
      const repoEntry = this.sessionIndexManager.readRepoSessions(repoSlug);
      if (!Object.keys(repoEntry).length) {
        this.post('historySessions', []);
        return;
      }

      // Get open issues to filter against
      const openIssues = this.ghData.listMyIssues();
      const openIssueNums = new Set(openIssues.map((i: any) => i.number));

      const results: Array<{
        taskLogId: string;
        issueNumber: number;
        label: string;
        sessionCount: number;
        lastSessionTime: string;
        resumableSessionId: string | null;
        worktreeDir: string;
      }> = [];

      for (const [taskLogId, taskEntry] of Object.entries(repoEntry)) {
        // Extract issue number from taskLogId like "task-issue-38"
        const issueMatch = taskLogId.match(/task-issue-(\d+)/);
        if (!issueMatch) continue;
        const issueNum = parseInt(issueMatch[1]);
        if (!openIssueNums.has(issueNum)) continue;

        const sessions = (taskEntry as any)?.sessions;
        if (!Array.isArray(sessions) || sessions.length === 0) continue;

        // Find the matching open issue for the label
        const issue = openIssues.find((i: any) => i.number === issueNum);
        const label = issue ? `Issue #${issueNum} ${issue.title}` : `Issue #${issueNum}`;

        // Find last resumable AI session
        let resumableSessionId: string | null = null;
        let resumableSessionSource: string = 'claude';
        for (let i = sessions.length - 1; i >= 0; i--) {
          const aiSessions = sessions[i].aiSessions;
          if (aiSessions) {
            for (const ai of aiSessions) {
              if (ai.resumable) { resumableSessionId = ai.id; resumableSessionSource = ai.source; break; }
            }
          }
          if (resumableSessionId) break;
        }

        const lastSession = sessions[sessions.length - 1];
        results.push({
          taskLogId,
          issueNumber: issueNum,
          label,
          sessionCount: sessions.length,
          lastSessionTime: lastSession.endedAt || lastSession.startedAt || '',
          resumableSessionId,
          resumableSessionSource,
          worktreeDir: '',
        });
      }

      // Sort by last session time, newest first
      results.sort((a, b) => b.lastSessionTime.localeCompare(a.lastSessionTime));
      this.post('historySessions', results);
    } catch {
      this.post('historySessions', []);
    }
  }

  private post(type: string, data: any): void {
    this._view?.webview.postMessage({ type, data });
  }
}
