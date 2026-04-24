import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DashboardViewProvider } from './dashboard-provider';
import { WorktreeManager } from './worktree';
import { TaskRunner } from './task-runner';
import { FrameworkSync } from './framework-sync';
import { GitHubDetector } from './github-detector';
import { DevPilotDir } from './dev-pilot-dir';

let dashboardProvider: DashboardViewProvider;

export async function activate(context: vscode.ExtensionContext) {
  // Only activate if this workspace is a GitHub repo
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) return;

  const detector = new GitHubDetector();
  const repoInfo = detector.detect(workspaceRoot);
  if (!repoInfo) {
    // Not a GitHub repo — silently skip
    return;
  }

  // Initialize .dev-pilot/ directory in workspace
  const devPilotDir = new DevPilotDir(workspaceRoot);
  devPilotDir.ensureDir();
  devPilotDir.ensureGitignore();

  // Sync framework commands/agents if enabled
  const frameworkSync = new FrameworkSync(context);
  const autoSync = vscode.workspace.getConfiguration('devPilot').get('autoSyncFramework', true);
  if (autoSync) {
    await frameworkSync.sync();
  }

  const worktree = new WorktreeManager();
  const taskRunner = new TaskRunner(worktree, workspaceRoot, repoInfo, devPilotDir);

  dashboardProvider = new DashboardViewProvider(
    context.extensionUri,
    taskRunner,
    repoInfo,
    devPilotDir,
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('devPilot.dashboard', dashboardProvider),

    vscode.commands.registerCommand('devPilot.openDashboard', () => {
      vscode.commands.executeCommand('devPilot.dashboard.focus');
    }),

    vscode.commands.registerCommand('devPilot.devIssue', async () => {
      const issueUrl = await vscode.window.showInputBox({
        prompt: 'Enter GitHub issue URL or #number',
        placeHolder: `https://github.com/${repoInfo.owner}/${repoInfo.repo}/issues/123`,
      });
      if (issueUrl) {
        taskRunner.runDevIssue(issueUrl);
      }
    }),

    vscode.commands.registerCommand('devPilot.watchPRs', () => {
      taskRunner.runWatchPRs();
    }),

    vscode.commands.registerCommand('devPilot.syncFramework', () => {
      frameworkSync.sync(true);
    }),
  );

  // Log activation
  devPilotDir.log('extension', `Activated for ${repoInfo.owner}/${repoInfo.repo}`);
}

export function deactivate() {}
