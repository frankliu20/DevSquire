import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

export interface PilotYaml {
  workspace: string;
  platform: string;
  repos: string[];
  chat_language: string;
  watch_pr?: {
    auto_fix_ci?: boolean;
    auto_fix_comments?: boolean;
  };
}

export class PilotConfig {
  private _config: PilotYaml | null = null;

  get claudeCodePath(): string {
    return vscode.workspace.getConfiguration('devPilot').get('claudeCodePath', 'claude');
  }

  get pilotYamlPath(): string {
    const configured = vscode.workspace.getConfiguration('devPilot').get<string>('pilotYamlPath', '');
    return configured || path.join(os.homedir(), '.claude', 'pilot.yaml');
  }

  reload(): void {
    this._config = null;
  }

  get yaml(): PilotYaml {
    if (!this._config) {
      this._config = this.loadYaml();
    }
    return this._config;
  }

  private loadYaml(): PilotYaml {
    const defaults: PilotYaml = {
      workspace: path.join(os.homedir(), 'claude', 'workdir'),
      platform: 'github',
      repos: [],
      chat_language: 'English',
    };

    try {
      const content = fs.readFileSync(this.pilotYamlPath, 'utf-8');
      return this.parseYaml(content, defaults);
    } catch {
      return defaults;
    }
  }

  private parseYaml(content: string, defaults: PilotYaml): PilotYaml {
    const result = { ...defaults };
    let currentKey = '';

    for (const rawLine of content.split('\n')) {
      if (rawLine.trim() === '' || rawLine.trim().startsWith('#')) continue;

      const indent = rawLine.length - rawLine.trimStart().length;
      const line = rawLine.trim();

      if (indent === 0 && line.includes(':')) {
        const colonIdx = line.indexOf(':');
        const key = line.substring(0, colonIdx).trim();
        const value = line.substring(colonIdx + 1).trim();
        currentKey = key;

        if (value && key === 'workspace') result.workspace = value.replace(/^~/, os.homedir());
        if (value && key === 'platform') result.platform = value;
        if (value && key === 'chat_language') result.chat_language = value;
        if (key === 'repos') result.repos = [];
      } else if (indent > 0 && line.startsWith('- ') && currentKey === 'repos') {
        result.repos.push(line.substring(2).trim());
      }
    }

    return result;
  }

  /** Extract repo name from URL */
  repoName(repoUrl: string): string {
    return repoUrl.replace(/\.git$/, '').split('/').pop() || 'unknown';
  }

  /** Get workspace absolute path */
  get workspacePath(): string {
    return this.yaml.workspace.replace(/^~/, os.homedir());
  }

  /** Get logs directory */
  get logsPath(): string {
    return path.join(this.workspacePath, 'logs');
  }
}
