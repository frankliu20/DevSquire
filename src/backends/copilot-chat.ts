import { SquireBackend, AgentLaunchOptions, PromptLaunchOptions } from '../backend';

/**
 * Copilot Chat backend — stub for future integration.
 * Will use VS Code Copilot Chat extension API instead of terminals.
 */
export class CopilotChatBackend implements SquireBackend {
  readonly type = 'copilot-chat' as const;

  launchAgent(_options: AgentLaunchOptions): void {
    throw new Error('Copilot Chat backend is not yet implemented. Use copilot-cli or claude-code.');
  }

  launchPrompt(_options: PromptLaunchOptions): void {
    throw new Error('Copilot Chat backend is not yet implemented. Use copilot-cli or claude-code.');
  }

  getAgentSyncDirs(_location: 'home' | 'project', _workspaceRoot: string): { agents: string } {
    throw new Error('Copilot Chat backend is not yet implemented.');
  }

  getSkillScanDirs(_workspaceRoot: string): string[] {
    return [];
  }
}
