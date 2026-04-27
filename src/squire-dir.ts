import * as fs from 'fs';
import * as path from 'path';
import { SQ_SCRIPT } from './sq-script';

/**
 * Manages the .squire/ directory in the workspace root.
 * All logs, task state, and runtime data go here.
 */
export class SquireDir {
  readonly dir: string;
  readonly logsDir: string;
  readonly tasksDir: string;
  readonly decisionsDir: string;

  constructor(private workspaceRoot: string) {
    this.dir = path.join(workspaceRoot, '.squire');
    this.logsDir = path.join(this.dir, 'logs');
    this.tasksDir = path.join(this.dir, 'tasks');
    this.decisionsDir = path.join(this.dir, 'pending-decisions');
  }

  /** Ensure .squire/ and subdirectories exist */
  ensureDir(): void {
    for (const dir of [this.dir, this.logsDir, this.tasksDir, this.decisionsDir]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.ensureConfig();
    this.ensureBinScript();
  }

  /** Place a .gitignore inside .squire/ to ignore its own contents (never modify project .gitignore) */
  ensureGitignore(): void {
    const gitignorePath = path.join(this.dir, '.gitignore');

    try {
      if (!fs.existsSync(gitignorePath)) {
        fs.writeFileSync(gitignorePath, '# Ignore everything in .squire/ except this file\n*\n!.gitignore\n');
      }
    } catch {
      // Non-critical — continue
    }
  }

  /** Append a log entry. 'extension' category writes to .squire/extension.log (outside logs/) */
  log(category: string, message: string): void {
    const logFile = category === 'extension'
      ? path.join(this.dir, 'extension.log')
      : path.join(this.logsDir, `${category}.log`);
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

  /** Generate config.yaml with commented-out defaults if it doesn't exist */
  private ensureConfig(): void {
    const configPath = path.join(this.dir, 'config.yaml');
    if (fs.existsSync(configPath)) return;

    const template = `# DevSquire project configuration
# Uncomment and customize the sections below as needed.

# build:
#   command: npm run build
#   test_command: npx jest --testPathPattern={{file}} --no-coverage
#   test_all_command: npx jest --coverage
#   lint_command: npx eslint .
#   default_branch: main

# test_runner_skill: my-test-runner   # Custom test runner skill in ~/.claude/skills/
`;

    try {
      fs.writeFileSync(configPath, template, 'utf-8');
    } catch {
      // Non-critical
    }
  }

  /** Install the cross-platform sq.mjs helper script into .squire/bin/ */
  ensureBinScript(): void {
    const binDir = path.join(this.dir, 'bin');
    const scriptPath = path.join(binDir, 'sq.mjs');
    try {
      if (!fs.existsSync(binDir)) {
        fs.mkdirSync(binDir, { recursive: true });
      }
      // Always overwrite so updates propagate
      fs.writeFileSync(scriptPath, SQ_SCRIPT, 'utf-8');
    } catch {
      // Non-critical
    }
  }

  /** Remove logs, pending-decisions, and worktrees dirs, then recreate them */
  cleanDirs(): void {
    const worktreesDir = path.join(this.dir, 'worktrees');
    for (const dir of [this.logsDir, this.decisionsDir, worktreesDir]) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
        fs.mkdirSync(dir, { recursive: true });
      } catch {
        // Non-critical
      }
    }
  }
}
