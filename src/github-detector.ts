import * as fs from 'fs';
import * as path from 'path';

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  remoteUrl: string;
}

export class GitHubDetector {
  /**
   * Detect if the workspace is a GitHub repo by reading .git/config.
   * Returns repo info if it's GitHub, null otherwise.
   */
  detect(workspaceRoot: string): GitHubRepoInfo | null {
    const gitConfigPath = path.join(workspaceRoot, '.git', 'config');

    // Also handle worktree case where .git is a file pointing to the real .git dir
    let configContent: string;
    try {
      const gitPath = path.join(workspaceRoot, '.git');
      const stat = fs.statSync(gitPath);
      if (stat.isFile()) {
        // This is a worktree — .git is a file with "gitdir: ..." content
        const gitdirLine = fs.readFileSync(gitPath, 'utf-8').trim();
        const gitdir = gitdirLine.replace('gitdir: ', '');
        // Navigate up to the main repo's .git/config
        const mainGitDir = this.resolveMainGitDir(gitdir);
        configContent = fs.readFileSync(path.join(mainGitDir, 'config'), 'utf-8');
      } else {
        configContent = fs.readFileSync(gitConfigPath, 'utf-8');
      }
    } catch {
      return null;
    }

    return this.parseGitConfig(configContent);
  }

  private resolveMainGitDir(gitdir: string): string {
    // worktree gitdir looks like: /path/to/repo/.git/worktrees/<name>
    // We need to go up to /path/to/repo/.git
    let dir = path.resolve(gitdir);
    while (dir !== path.dirname(dir)) {
      if (path.basename(dir) === '.git') return dir;
      // Check if this dir has a commondir file (worktree marker)
      const commondirPath = path.join(dir, 'commondir');
      if (fs.existsSync(commondirPath)) {
        const commondir = fs.readFileSync(commondirPath, 'utf-8').trim();
        return path.resolve(dir, commondir);
      }
      dir = path.dirname(dir);
    }
    return gitdir;
  }

  private parseGitConfig(content: string): GitHubRepoInfo | null {
    // Find [remote "origin"] section and extract url
    const lines = content.split('\n');
    let inOrigin = false;
    let url = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '[remote "origin"]') {
        inOrigin = true;
        continue;
      }
      if (trimmed.startsWith('[') && inOrigin) {
        break; // next section
      }
      if (inOrigin && trimmed.startsWith('url = ')) {
        url = trimmed.substring(6).trim();
        break;
      }
    }

    if (!url) return null;

    // Parse GitHub URL (HTTPS or SSH)
    return this.parseGitHubUrl(url);
  }

  private parseGitHubUrl(url: string): GitHubRepoInfo | null {
    // HTTPS: https://github.com/owner/repo.git
    const httpsMatch = url.match(/github\.com\/([^/]+)\/([^/.]+)/);
    if (httpsMatch) {
      return { owner: httpsMatch[1], repo: httpsMatch[2], remoteUrl: url };
    }

    // SSH: git@github.com:owner/repo.git
    const sshMatch = url.match(/github\.com:([^/]+)\/([^/.]+)/);
    if (sshMatch) {
      return { owner: sshMatch[1], repo: sshMatch[2], remoteUrl: url };
    }

    return null;
  }
}
