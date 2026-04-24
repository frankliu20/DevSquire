import * as fs from 'fs';
import * as path from 'path';

/**
 * Manages the .dev-pilot/ directory in the workspace root.
 * All logs, task state, and runtime data go here.
 */
export class DevPilotDir {
  readonly dir: string;
  readonly logsDir: string;
  readonly tasksDir: string;
  readonly decisionsDir: string;

  constructor(private workspaceRoot: string) {
    this.dir = path.join(workspaceRoot, '.dev-pilot');
    this.logsDir = path.join(this.dir, 'logs');
    this.tasksDir = path.join(this.dir, 'tasks');
    this.decisionsDir = path.join(this.dir, 'pending-decisions');
  }

  /** Ensure .dev-pilot/ and subdirectories exist */
  ensureDir(): void {
    for (const dir of [this.dir, this.logsDir, this.tasksDir, this.decisionsDir]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /** Add .dev-pilot/ to .gitignore if not already there */
  ensureGitignore(): void {
    const gitignorePath = path.join(this.workspaceRoot, '.gitignore');
    const entry = '.dev-pilot/';

    try {
      let content = '';
      if (fs.existsSync(gitignorePath)) {
        content = fs.readFileSync(gitignorePath, 'utf-8');
      }
      if (!content.includes(entry)) {
        const section = `\n# Dev Pilot workspace data\n${entry}\n`;
        fs.appendFileSync(gitignorePath, section);
      }
    } catch {
      // Non-critical — continue
    }
  }

  /** Append a log entry */
  log(category: string, message: string): void {
    const logFile = path.join(this.logsDir, `${category}.log`);
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${message}\n`;
    try {
      fs.appendFileSync(logFile, line);
    } catch {
      // Non-critical
    }
  }

  /** Append a JSONL log entry */
  logJson(category: string, data: Record<string, unknown>): void {
    const logFile = path.join(this.logsDir, `${category}.jsonl`);
    const entry = { timestamp: new Date().toISOString(), ...data };
    try {
      fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
    } catch {
      // Non-critical
    }
  }

  /** Read a task state file */
  readTaskState(taskId: string): Record<string, unknown> | null {
    const filePath = path.join(this.tasksDir, `${taskId}.json`);
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      return null;
    }
  }

  /** Write a task state file */
  writeTaskState(taskId: string, state: Record<string, unknown>): void {
    const filePath = path.join(this.tasksDir, `${taskId}.json`);
    try {
      fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
    } catch {
      // Non-critical
    }
  }
}
