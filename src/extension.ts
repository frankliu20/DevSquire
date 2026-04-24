import * as vscode from 'vscode';
import { DashboardViewProvider } from './dashboard-provider';
import { ClaudeCli } from './claude-cli';
import { WorktreeManager } from './worktree';
import { PilotConfig } from './config';
import { TaskRunner } from './task-runner';

let dashboardProvider: DashboardViewProvider;

export function activate(context: vscode.ExtensionContext) {
  const config = new PilotConfig();
  const cli = new ClaudeCli(config);
  const worktree = new WorktreeManager();
  const taskRunner = new TaskRunner(cli, worktree, config);

  dashboardProvider = new DashboardViewProvider(
    context.extensionUri,
    taskRunner,
    config,
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('devPilot.dashboard', dashboardProvider),

    vscode.commands.registerCommand('devPilot.openDashboard', () => {
      vscode.commands.executeCommand('devPilot.dashboard.focus');
    }),

    vscode.commands.registerCommand('devPilot.devIssue', async () => {
      const issueUrl = await vscode.window.showInputBox({
        prompt: 'Enter issue URL or description',
        placeHolder: 'https://github.com/org/repo/issues/123',
      });
      if (issueUrl) {
        taskRunner.runDevIssue(issueUrl);
      }
    }),

    vscode.commands.registerCommand('devPilot.watchPRs', () => {
      taskRunner.runWatchPRs();
    }),
  );

  // Listen for config changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('devPilot')) {
        config.reload();
      }
    }),
  );
}

export function deactivate() {
  // Cleanup handled by disposables
}
