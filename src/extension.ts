import * as vscode from 'vscode';
import { DashboardViewProvider } from './dashboard-provider';
import { WorktreeManager } from './worktree';
import { TaskRunner } from './task-runner';
import { FrameworkSync } from './framework-sync';
import { GitHubDetector } from './github-detector';
import { SquireDir } from './squire-dir';
import { createBackend, BackendType } from './backend';
import { GitHubData } from './github-data';
import { TaskStateReader } from './task-state';
import { SkillsReader } from './skills-reader';
import { ReportGenerator } from './report';

let dashboardProvider: DashboardViewProvider;

export async function activate(context: vscode.ExtensionContext) {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) return;

  const detector = new GitHubDetector();
  const repoInfo = detector.detect(workspaceRoot);
  if (!repoInfo) return; // Not a GitHub repo

  // Initialize .squire/
  const squireDir = new SquireDir(workspaceRoot);
  squireDir.ensureDir();
  squireDir.ensureGitignore();

  // Create backend from user setting
  const backendType = vscode.workspace.getConfiguration('devSquire').get<BackendType>('backend', 'copilot-cli');
  const backend = createBackend(backendType);
  squireDir.log('extension', `Backend: ${backend.type}`);

  // Sync framework
  const frameworkSync = new FrameworkSync(context, backend);
  if (vscode.workspace.getConfiguration('devSquire').get('autoSyncFramework', true)) {
    await frameworkSync.sync();
    squireDir.log('extension', 'Framework agents synced');
  }

  // Core services
  const ghData = new GitHubData(repoInfo.owner, repoInfo.repo);
  const worktree = new WorktreeManager();
  const taskRunner = new TaskRunner(worktree, workspaceRoot, repoInfo, squireDir, backend);
  const taskStateReader = new TaskStateReader(squireDir.dir);
  const skillsReader = new SkillsReader(backend);
  const reportGenerator = new ReportGenerator(ghData, squireDir.dir, workspaceRoot, repoInfo.owner, repoInfo.repo);

  dashboardProvider = new DashboardViewProvider(
    context.extensionUri,
    taskRunner,
    repoInfo,
    squireDir,
    ghData,
    taskStateReader,
    skillsReader,
    reportGenerator,
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('devSquire.dashboard', dashboardProvider),

    vscode.commands.registerCommand('devSquire.openDashboard', () => {
      vscode.commands.executeCommand('devSquire.dashboard.focus');
    }),

    vscode.commands.registerCommand('devSquire.devIssue', async () => {
      const issueUrl = await vscode.window.showInputBox({
        prompt: 'Enter GitHub issue URL or #number',
        placeHolder: `https://github.com/${repoInfo.owner}/${repoInfo.repo}/issues/123`,
      });
      if (issueUrl) taskRunner.runDevIssue(issueUrl);
    }),

    vscode.commands.registerCommand('devSquire.watchPRs', () => {
      taskRunner.runWatchPRs();
    }),

    vscode.commands.registerCommand('devSquire.syncFramework', () => {
      frameworkSync.sync(true);
    }),
  );

  squireDir.log('extension', `Activated for ${repoInfo.owner}/${repoInfo.repo}`);
}

export function deactivate() {}
