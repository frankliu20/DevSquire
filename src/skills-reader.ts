import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';

export interface SkillInfo {
  name: string;
  type: 'command' | 'agent' | 'skill';
  description: string;
  content: string;
  isPersonal: boolean;
  path: string;
}

/**
 * Lists installed skills, agents, and commands.
 */
export class SkillsReader {
  /** Read all installed skills from the configured location */
  readAll(): SkillInfo[] {
    const location = vscode.workspace.getConfiguration('devSquire').get<string>('frameworkLocation', 'home');
    const results: SkillInfo[] = [];

    if (location === 'project') {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (workspaceRoot) {
        results.push(...this.readDir(path.join(workspaceRoot, '.github', 'copilot', 'commands'), 'command'));
        results.push(...this.readDir(path.join(workspaceRoot, '.github', 'copilot', 'agents'), 'agent'));
      }
    }

    // Always also read from home dir
    const copilotDir = path.join(os.homedir(), '.copilot');
    results.push(...this.readDir(path.join(copilotDir, 'commands'), 'command'));
    results.push(...this.readDir(path.join(copilotDir, 'agents'), 'agent'));

    // Also check ~/.claude/ for skills
    const claudeDir = path.join(os.homedir(), '.claude');
    results.push(...this.readDir(path.join(claudeDir, 'commands'), 'command'));
    results.push(...this.readDir(path.join(claudeDir, 'agents'), 'agent'));

    // Dedupe by name
    const seen = new Set<string>();
    return results.filter((s) => {
      if (seen.has(s.name)) return false;
      seen.add(s.name);
      return true;
    });
  }

  private readDir(dirPath: string, type: 'command' | 'agent' | 'skill'): SkillInfo[] {
    if (!fs.existsSync(dirPath)) return [];

    const results: SkillInfo[] = [];
    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.md'));

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const name = file.replace('.md', '');
        const description = this.extractDescription(content);
        const isPersonal = dirPath.includes(os.homedir());

        results.push({ name, type, description, content, isPersonal, path: filePath });
      } catch {
        // Skip unreadable files
      }
    }

    return results;
  }

  private extractDescription(content: string): string {
    // Try to extract from YAML frontmatter
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch) {
      const descMatch = fmMatch[1].match(/description:\s*(.+)/);
      if (descMatch) return descMatch[1].trim();
    }

    // Fall back to first non-empty, non-heading line
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---')) {
        return trimmed.substring(0, 120);
      }
    }

    return '';
  }
}
