import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SquireBackend } from './backend';

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
  constructor(private backend: SquireBackend) {}

  /** Read all installed skills from the configured backend dirs */
  readAll(workspaceRoot: string): SkillInfo[] {
    const results: SkillInfo[] = [];
    const dirs = this.backend.getSkillScanDirs(workspaceRoot);

    for (const dir of dirs) {
      const type = dir.includes('agents') ? 'agent' : dir.includes('skills') ? 'skill' : 'command';
      results.push(...this.readDir(dir, type));
    }

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
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      // Flat file pattern: <name>.md
      if (entry.isFile() && entry.name.endsWith('.md')) {
        const filePath = path.join(dirPath, entry.name);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const name = entry.name.replace('.md', '');
          const description = this.extractDescription(content);
          const isPersonal = dirPath.includes(os.homedir());
          results.push({ name, type, description, content, isPersonal, path: filePath });
        } catch { /* skip */ }
      }
      // Directory pattern: <name>/SKILL.md
      if (entry.isDirectory()) {
        const skillFile = path.join(dirPath, entry.name, 'SKILL.md');
        if (fs.existsSync(skillFile)) {
          try {
            const content = fs.readFileSync(skillFile, 'utf-8');
            const description = this.extractDescription(content);
            const isPersonal = dirPath.includes(os.homedir());
            results.push({ name: entry.name, type, description, content, isPersonal, path: skillFile });
          } catch { /* skip */ }
        }
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
