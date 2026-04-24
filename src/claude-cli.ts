import * as cp from 'child_process';
import * as vscode from 'vscode';
import { PilotConfig } from './config';

export interface ClaudeSession {
  process: cp.ChildProcess;
  taskId: string;
  command: string;
  cwd: string;
  output: string[];
  status: 'running' | 'completed' | 'failed';
  onOutput: vscode.EventEmitter<string>;
  onStatusChange: vscode.EventEmitter<string>;
}

export class ClaudeCli {
  private sessions: Map<string, ClaudeSession> = new Map();

  constructor(private config: PilotConfig) {}

  /**
   * Run a Claude Code command in the given directory.
   * Returns a session object for tracking output.
   */
  run(command: string, cwd: string): ClaudeSession {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const claudePath = this.config.claudeCodePath;

    const onOutput = new vscode.EventEmitter<string>();
    const onStatusChange = new vscode.EventEmitter<string>();

    const session: ClaudeSession = {
      process: null!,
      taskId,
      command,
      cwd,
      output: [],
      status: 'running',
      onOutput,
      onStatusChange,
    };

    // Spawn claude with --print for non-interactive mode
    // Use --dangerously-skip-permissions for auto mode (user opted in)
    const args = [
      '--print',
      '--dangerously-skip-permissions',
      command,
    ];

    const proc = cp.spawn(claudePath, args, {
      cwd,
      shell: true,
      env: { ...process.env },
    });

    session.process = proc;

    proc.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      session.output.push(text);
      onOutput.fire(text);
    });

    proc.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      session.output.push(`[stderr] ${text}`);
      onOutput.fire(text);
    });

    proc.on('close', (code) => {
      session.status = code === 0 ? 'completed' : 'failed';
      onStatusChange.fire(session.status);
    });

    proc.on('error', (err) => {
      session.status = 'failed';
      session.output.push(`[error] ${err.message}`);
      onStatusChange.fire('failed');
    });

    this.sessions.set(taskId, session);
    return session;
  }

  /** Get a running session by task ID */
  getSession(taskId: string): ClaudeSession | undefined {
    return this.sessions.get(taskId);
  }

  /** Get all sessions */
  getAllSessions(): ClaudeSession[] {
    return Array.from(this.sessions.values());
  }

  /** Kill a running session */
  kill(taskId: string): void {
    const session = this.sessions.get(taskId);
    if (session?.process && session.status === 'running') {
      session.process.kill('SIGTERM');
      session.status = 'failed';
      session.onStatusChange.fire('failed');
    }
  }

  /** Check if Claude Code CLI is available */
  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      cp.exec(`${this.config.claudeCodePath} --version`, (error) => {
        resolve(!error);
      });
    });
  }
}
