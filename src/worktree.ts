import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
  bare: boolean;
}

export class WorktreeManager {
  /**
   * List all worktrees for a given repo directory.
   */
  list(repoDir: string): WorktreeInfo[] {
    try {
      const output = cp.execSync('git worktree list --porcelain', {
        cwd: repoDir,
        encoding: 'utf-8',
      });
      return this.parseWorktreeList(output);
    } catch {
      return [];
    }
  }

  /**
   * Create a new worktree for a task.
   * Convention: .squire/worktrees/<branch-name>
   */
  create(repoDir: string, branchName: string, baseBranch = 'main'): WorktreeInfo | null {
    const worktreeDir = path.join(repoDir, '.squire/worktrees', branchName);

    if (fs.existsSync(worktreeDir)) {
      // Already exists — return info
      const worktrees = this.list(repoDir);
      return worktrees.find((w) => w.path === worktreeDir) || null;
    }

    try {
      // Ensure .squire/worktrees directory exists
      const worktreesRoot = path.join(repoDir, '.squire/worktrees');
      if (!fs.existsSync(worktreesRoot)) {
        fs.mkdirSync(worktreesRoot, { recursive: true });
      }

      // Fetch latest
      try {
        cp.execSync(`git fetch origin ${baseBranch}`, { cwd: repoDir, stdio: 'pipe' });
      } catch {
        // Ignore fetch errors — may be offline
      }

      // Create worktree with new branch
      cp.execSync(
        `git worktree add -b ${branchName} "${worktreeDir}" origin/${baseBranch}`,
        { cwd: repoDir, stdio: 'pipe' },
      );

      const worktrees = this.list(repoDir);
      return worktrees.find((w) => w.branch === branchName) || null;
    } catch (err) {
      console.error(`Failed to create worktree: ${err}`);
      return null;
    }
  }

  /**
   * Remove a worktree.
   */
  remove(repoDir: string, branchName: string, force = false): boolean {
    const worktreeDir = path.join(repoDir, '.squire/worktrees', branchName);
    try {
      const forceFlag = force ? ' --force' : '';
      cp.execSync(`git worktree remove "${worktreeDir}"${forceFlag}`, {
        cwd: repoDir,
        stdio: 'pipe',
      });
      // Also delete the branch
      try {
        cp.execSync(`git branch -D ${branchName}`, { cwd: repoDir, stdio: 'pipe' });
      } catch {
        // Branch may already be deleted
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ensure .squire/worktrees is in .gitignore
   */
  ensureGitignore(repoDir: string): void {
    const gitignorePath = path.join(repoDir, '.gitignore');
    const entry = '.squire/worktrees/';

    try {
      let content = '';
      if (fs.existsSync(gitignorePath)) {
        content = fs.readFileSync(gitignorePath, 'utf-8');
      }
      if (!content.includes(entry)) {
        fs.appendFileSync(gitignorePath, `\n# DevSquire worktrees\n${entry}\n`);
      }
    } catch {
      // Ignore
    }
  }

  private parseWorktreeList(output: string): WorktreeInfo[] {
    const worktrees: WorktreeInfo[] = [];
    let current: Partial<WorktreeInfo> = {};

    for (const line of output.split('\n')) {
      if (line.startsWith('worktree ')) {
        if (current.path) worktrees.push(current as WorktreeInfo);
        current = { path: line.substring(9), bare: false };
      } else if (line.startsWith('HEAD ')) {
        current.head = line.substring(5);
      } else if (line.startsWith('branch ')) {
        current.branch = line.substring(7).replace('refs/heads/', '');
      } else if (line === 'bare') {
        current.bare = true;
      }
    }

    if (current.path) worktrees.push(current as WorktreeInfo);
    return worktrees;
  }
}
