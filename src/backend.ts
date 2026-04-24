import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';

export type BackendType = 'copilot-cli' | 'claude-code' | 'copilot-chat';

export interface AgentLaunchOptions {
  terminal: vscode.Terminal;
  agentName: string;
  initialPrompt?: string;
}

export interface PromptLaunchOptions {
  terminal: vscode.Terminal;
  prompt: string;
}

/** What a backend needs to do */
export interface SquireBackend {
  readonly type: BackendType;

  /** Launch an agent-based task in a terminal (or chat panel) */
  launchAgent(options: AgentLaunchOptions): void;

  /** Launch a plain prompt task (single-shot, non-interactive) */
  launchPrompt(options: PromptLaunchOptions): void;

  /** Launch a slash command interactively (not single-shot) */
  launchInteractiveCommand(options: PromptLaunchOptions): void;

  /** Where to sync agent .md files for this backend */
  getAgentSyncDirs(location: 'home' | 'project', workspaceRoot: string): { agents: string; commands?: string };

  /** Where to scan for installed skills/agents */
  getSkillScanDirs(workspaceRoot: string): string[];
}

export function createBackend(type: BackendType): SquireBackend {
  switch (type) {
    case 'copilot-cli': {
      const { CopilotCliBackend } = require('./backends/copilot-cli');
      return new CopilotCliBackend();
    }
    case 'claude-code': {
      const { ClaudeCodeBackend } = require('./backends/claude-code');
      return new ClaudeCodeBackend();
    }
    case 'copilot-chat': {
      const { CopilotChatBackend } = require('./backends/copilot-chat');
      return new CopilotChatBackend();
    }
  }
}
