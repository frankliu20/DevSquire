import * as path from 'path';
import * as os from 'os';
import { SquireBackend, AgentLaunchOptions, PromptLaunchOptions } from '../backend';

/**
 * Claude Code backend.
 *
 * - dev-issue / watch-pr are installed as **commands** (`~/.claude/commands/`)
 *   and launched via `claude "/<name> <prompt>"`
 * - Other agents (code-explorer, pr-creator, pr-reviewer) stay as **agents**
 *   and launched via `claude --agent <name> -p "<prompt>"`
 * - Skills live in `~/.claude/skills/`.
 */
export class ClaudeCodeBackend implements SquireBackend {
  readonly type = 'claude-code' as const;

  /** Agent names that are synced as commands (triggered via /name) */
  private static readonly COMMAND_AGENTS = new Set([
    'squire-dev-issue',
    'squire-watch-pr',
  ]);

  launchAgent(options: AgentLaunchOptions): void {
    if (ClaudeCodeBackend.COMMAND_AGENTS.has(options.agentName)) {
      // Commands: launched via slash command
      const prompt = options.initialPrompt ? ` ${options.initialPrompt}` : '';
      options.terminal.sendText(
        `claude "/${options.agentName}${prompt}"`,
        true,
      );
    } else {
      // Agents: launched in interactive mode (not single-shot -p) so the
      // agent can make multiple tool calls without hanging.  See #24, #15.
      const prompt = options.initialPrompt
        ? ` "${options.initialPrompt.replace(/"/g, '\\"')}"`
        : '';
      options.terminal.sendText(
        `claude --agent ${options.agentName}${prompt}`,
        true,
      );
    }
  }

  launchPrompt(options: PromptLaunchOptions): void {
    const sanitized = options.prompt.replace(/\n/g, ' ').replace(/"/g, '\\"');
    options.terminal.sendText(`claude -p "${sanitized}"`, true);
  }

  launchInteractiveCommand(options: PromptLaunchOptions): void {
    const sanitized = options.prompt.replace(/\n/g, ' ').replace(/"/g, '\\"');
    options.terminal.sendText(`claude "${sanitized}"`, true);
  }

  getAgentSyncDirs(location: 'home' | 'project', workspaceRoot: string): { agents: string; commands: string } {
    const base = location === 'project'
      ? path.join(workspaceRoot, '.claude')
      : path.join(os.homedir(), '.claude');
    return {
      agents: path.join(base, 'agents'),
      commands: path.join(base, 'commands'),
    };
  }

  getSkillScanDirs(workspaceRoot: string): string[] {
    const claudeHome = path.join(os.homedir(), '.claude');
    return [
      path.join(workspaceRoot, '.claude', 'commands'),
      path.join(workspaceRoot, '.claude', 'agents'),
      path.join(workspaceRoot, '.claude', 'skills'),
      path.join(claudeHome, 'commands'),
      path.join(claudeHome, 'agents'),
      path.join(claudeHome, 'skills'),
    ];
  }
}
