import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Syncs DevSquire commands and agents to the configured location.
 * Bundled markdown files are in the extension's `framework/` directory.
 *
 * Locations:
 *   - "home": ~/.copilot/agents/  (default)
 *   - "project": <workspace>/.github/copilot/agents/
 */
export class FrameworkSync {
  private readonly bundledDir: string;

  constructor(private context: vscode.ExtensionContext) {
    this.bundledDir = path.join(context.extensionPath, 'framework');
  }

  async sync(showNotification = false): Promise<void> {
    const location = vscode.workspace.getConfiguration('devSquire').get<string>('frameworkLocation', 'home');
    const targetDirs = this.getTargetDirs(location);

    if (!targetDirs) {
      if (showNotification) {
        vscode.window.showErrorMessage('DevSquire: Cannot determine target directory for framework sync.');
      }
      return;
    }

    let synced = 0;

    // Sync agents (Copilot CLI only recognizes agents, not commands)
    synced += this.syncDir(
      path.join(this.bundledDir, 'agents'),
      targetDirs.agents,
    );

    if (showNotification) {
      vscode.window.showInformationMessage(`DevSquire: Synced ${synced} files to ${location === 'home' ? '~/.copilot/' : '.github/copilot/'}`);
    }
  }

  private getTargetDirs(location: string): { agents: string } | null {
    if (location === 'project') {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) return null;
      return {
        agents: path.join(workspaceRoot, '.github', 'copilot', 'agents'),
      };
    }

    // Default: home directory
    const copilotDir = path.join(os.homedir(), '.copilot');
    return {
      agents: path.join(copilotDir, 'agents'),
    };
  }

  private syncDir(srcDir: string, destDir: string): number {
    if (!fs.existsSync(srcDir)) return 0;

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    let count = 0;
    const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.md'));

    for (const file of files) {
      const src = path.join(srcDir, file);
      const dest = path.join(destDir, file);

      // Always overwrite — extension is source of truth
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
