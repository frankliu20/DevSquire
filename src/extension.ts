import * as vscode from 'vscode';
import { DashboardViewProvider } from './dashboard-provider';
import { WorktreeManager } from './worktree';
import { TaskRunner } from './task-runner';
import { FrameworkSync } from './framework-sync';
import { GitHubDetector } from './github-detector';
import { DevSquireDir } from './devsquire-dir';
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

  // Initialize .devsquire/
  const devSquireDir = new DevSquireDir(workspaceRoot);
  devSquireDir.ensureDir();
  devSquireDir.ensureGitignore();

  // Sync framework
  const frameworkSync = new FrameworkSync(context);
  if (vscode.workspace.getConfiguration('devSquire').get('autoSyncFramework', true)) {
    await frameworkSync.sync();
  }

  // Core services
  const ghData = new GitHubData(repoInfo.owner, repoInfo.repo);
  const worktree = new WorktreeManager();
  const taskRunner = new TaskRunner(worktree, workspaceRoot, repoInfo, devSquireDir);
  const taskStateReader = new TaskStateReader(devSquireDir.dir);
  const skillsReader = new SkillsReader();
  const reportGenerator = new ReportGenerator(ghData, devSquireDir.dir, workspaceRoot, repoInfo.owner, repoInfo.repo);

  dashboardProvider = new DashboardViewProvider(
    context.extensionUri,
    taskRunner,
    repoInfo,
    devSquireDir,
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

  devSquireDir.log('extension', `Activated for ${repoInfo.owner}/${repoInfo.repo}`);
}

export function deactivate() {}
