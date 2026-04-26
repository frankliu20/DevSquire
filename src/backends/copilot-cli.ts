import * as path from 'path';
import * as os from 'os';
import { SquireBackend, AgentLaunchOptions, PromptLaunchOptions } from '../backend';

export class CopilotCliBackend implements SquireBackend {
  readonly type = 'copilot-cli' as const;

  launchAgent(options: AgentLaunchOptions): void {
    const prompt = options.initialPrompt
      ? ` -i "${options.initialPrompt.replace(/"/g, '\\"')}"`
      : '';
    options.terminal.sendText(
      `copilot --agent ${options.agentName}${prompt} --allow-all`,
      true,
    );
  }

  launchPrompt(options: PromptLaunchOptions): void {
    const sanitized = options.prompt.replace(/\n/g, ' ').replace(/"/g, '\\"');
    options.terminal.sendText(`copilot -i "${sanitized}" --allow-all`, true);
  }

  getAgentSyncDirs(location: 'home' | 'project', workspaceRoot: string): { agents: string } {
    if (location === 'project') {
      return { agents: path.join(workspaceRoot, '.github', 'copilot', 'agents') };
    }
    return { agents: path.join(os.homedir(), '.copilot', 'agents') };
  }

  getSkillScanDirs(workspaceRoot: string): string[] {
    // Copilot CLI only supports agents, not custom slash commands
    const copilotHome = path.join(os.homedir(), '.copilot');
    return [
      path.join(workspaceRoot, '.github', 'copilot', 'agents'),
      path.join(copilotHome, 'agents'),
    ];
  }
}
