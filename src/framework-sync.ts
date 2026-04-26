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
    const location = vscode.workspace.getConfiguration('devSquire').get<string>('frameworkLocation', 'home') as 'home' | 'project';
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (!workspaceRoot && location === 'project') {
      if (showNotification) {
        vscode.window.showErrorMessage('DevSquire: Cannot determine workspace for project-level sync.');
      }
      return;
    }

    const targetDirs = this.backend.getAgentSyncDirs(location, workspaceRoot || '');
    const srcDir = path.join(this.bundledDir, 'agents');
    let synced = 0;

    if (targetDirs.commands) {
      // Backend has separate commands dir — split files by COMMAND_AGENTS list
      const commandNames = new Set(['squire-dev-issue', 'squire-watch-pr']);
      synced += this.syncDir(srcDir, targetDirs.commands, (f) => commandNames.has(f.replace('.md', '')));
      synced += this.syncDir(srcDir, targetDirs.agents, (f) => !commandNames.has(f.replace('.md', '')));
    } else {
      // All go to agents dir
      synced += this.syncDir(srcDir, targetDirs.agents);
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
