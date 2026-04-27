import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SquireBackend } from './backend';

/**
 * Syncs DevSquire agent .md files to the backend's agent directory.
 * Bundled markdown files are in the extension's `framework/` directory.
 */
export class FrameworkSync {
  private readonly bundledDir: string;

  constructor(
    private context: vscode.ExtensionContext,
    private backend: SquireBackend,
  ) {
    this.bundledDir = path.join(context.extensionPath, 'framework');
  }

  async sync(showNotification = false): Promise<void> {
    const location = vscode.workspace.getConfiguration('devSquire').get<string>('agentConfigLocation', 'home') as 'home' | 'project';
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (!workspaceRoot && location === 'project') {
      if (showNotification) {
        vscode.window.showErrorMessage('DevSquire: Cannot determine workspace for project-level sync.');
      }
      return;
    }

    const targetDirs = this.backend.getAgentSyncDirs(location, workspaceRoot || '');
    const agentsSrcDir = path.join(this.bundledDir, 'agents');

    // Backend-specific commands directory (e.g., framework/commands/claude/)
    const commandsSrcDir = path.join(this.bundledDir, 'commands', this.backend.type);
    const hasBackendCommands = fs.existsSync(commandsSrcDir);

    let synced = 0;

    if (targetDirs.commands) {
      // Backend has separate commands dir — split files by COMMAND_AGENTS list
      const commandNames = new Set(['squire-dev-issue', 'squire-watch-pr', 'squire-pr-reviewer']);

      if (hasBackendCommands) {
        // Prefer backend-specific command files, fall back to generic agents
        synced += this.syncDir(commandsSrcDir, targetDirs.commands);
        // Also sync any command agents that don't have a backend-specific version
        const backendCommandFiles = new Set(
          fs.existsSync(commandsSrcDir)
            ? fs.readdirSync(commandsSrcDir).filter((f) => f.endsWith('.md')).map((f) => f.replace('.md', ''))
            : [],
        );
        synced += this.syncDir(agentsSrcDir, targetDirs.commands, (f) =>
          commandNames.has(f.replace('.md', '')) && !backendCommandFiles.has(f.replace('.md', '')),
        );
      } else {
        // No backend-specific commands — use generic agent files as commands
        synced += this.syncDir(agentsSrcDir, targetDirs.commands, (f) => commandNames.has(f.replace('.md', '')));
      }

      // Non-command agents always come from framework/agents/
      synced += this.syncDir(agentsSrcDir, targetDirs.agents, (f) => !commandNames.has(f.replace('.md', '')));
    } else {
      // All go to agents dir (e.g., Copilot backend)
      synced += this.syncDir(agentsSrcDir, targetDirs.agents);
    }

    if (showNotification) {
      vscode.window.showInformationMessage(`DevSquire: Synced ${synced} agent files.`);
    }
  }

  private syncDir(srcDir: string, destDir: string, filter?: (filename: string) => boolean): number {
    if (!fs.existsSync(srcDir)) return 0;

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    let count = 0;
    let files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.md'));
    if (filter) {
      files = files.filter(filter);
    }

    for (const file of files) {
      const src = path.join(srcDir, file);
      const dest = path.join(destDir, file);

      const srcContent = fs.readFileSync(src, 'utf-8');
      let destContent = '';
      try {
        destContent = fs.readFileSync(dest, 'utf-8');
      } catch {
        // File doesn't exist yet
      }

      if (srcContent !== destContent) {
        fs.writeFileSync(dest, srcContent);
        count++;
      }
    }

    return count;
  }
}
