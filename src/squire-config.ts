import * as fs from 'fs';
import * as path from 'path';

export interface SquireConfig {
  build: {
    command: string;
    test_command: string;
  };
  test_scenarios: Record<string, {
    name: string;
    command: string;
    description?: string;
  }>;
}

const DEFAULT_CONFIG: SquireConfig = {
  build: {
    command: 'npm run build',
    test_command: 'npm test',
  },
  test_scenarios: {},
};

/**
 * Manages .squire/config.yaml — project-level build/test configuration.
 * Auto-detects build system on first run.
 */
export class SquireConfigManager {
  private configPath: string;
  private _config: SquireConfig | null = null;

  constructor(private squireDir: string, private workspaceRoot: string) {
    this.configPath = path.join(squireDir, 'config.yaml');
  }

  /** Ensure config.yaml exists, auto-detecting build commands if needed */
  ensureConfig(): void {
    if (fs.existsSync(this.configPath)) return;

    const detected = this.detectBuildSystem();
    const yaml = [
      '# DevSquire project configuration',
      '# Auto-detected — edit as needed',
      '',
      'build:',
      `  command: "${detected.build}"`,
      `  test_command: "${detected.test}"`,
      '',
      '# Define test scenarios for manual verification (strategy 3)',
      '# test_scenarios:',
      '#   e2e:',
      '#     name: "End-to-end tests"',
      '#     command: "npm run test:e2e"',
      '',
    ].join('\n');

    fs.writeFileSync(this.configPath, yaml);
  }

  /** Read config, falling back to defaults */
  read(): SquireConfig {
    if (this._config) return this._config;

    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      this._config = this.parseYaml(content);
      return this._config;
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  /** Simple YAML parser for our flat config structure */
  private parseYaml(content: string): SquireConfig {
    const config: SquireConfig = { ...DEFAULT_CONFIG, build: { ...DEFAULT_CONFIG.build }, test_scenarios: {} };

    const lines = content.split('\n');
    let section = '';
    let scenarioKey = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || trimmed === '') continue;

      if (trimmed === 'build:') { section = 'build'; continue; }
      if (trimmed === 'test_scenarios:') { section = 'scenarios'; continue; }

      if (section === 'build') {
        const match = trimmed.match(/^(command|test_command):\s*"?([^"]*)"?$/);
        if (match) {
          const [, key, value] = match;
          if (key === 'command') config.build.command = value;
          if (key === 'test_command') config.build.test_command = value;
        }
      }

      if (section === 'scenarios') {
        // Scenario key (2-space indent)
        const keyMatch = line.match(/^ {2}(\w[\w-]*):\s*$/);
        if (keyMatch) {
          scenarioKey = keyMatch[1];
          config.test_scenarios[scenarioKey] = { name: scenarioKey, command: '' };
          continue;
        }
        // Scenario fields (4-space indent)
        if (scenarioKey) {
          const fieldMatch = line.match(/^ {4}(name|command|description):\s*"?([^"]*)"?$/);
          if (fieldMatch) {
            const [, field, value] = fieldMatch;
            (config.test_scenarios[scenarioKey] as any)[field] = value;
          }
        }
      }
    }

    return config;
  }

  /** Auto-detect build system from project files */
  private detectBuildSystem(): { build: string; test: string } {
    // package.json (Node.js)
    const pkgPath = path.join(this.workspaceRoot, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const scripts = pkg.scripts || {};
        return {
          build: scripts.build ? 'npm run build' : scripts.compile ? 'npm run compile' : 'npm run build',
          test: scripts.test ? 'npm test' : 'npm run test',
        };
      } catch { /* fall through */ }
    }

    // pom.xml (Maven)
    if (fs.existsSync(path.join(this.workspaceRoot, 'pom.xml'))) {
      return { build: 'mvn compile', test: 'mvn test' };
    }

    // build.gradle (Gradle)
    if (fs.existsSync(path.join(this.workspaceRoot, 'build.gradle')) ||
        fs.existsSync(path.join(this.workspaceRoot, 'build.gradle.kts'))) {
      return { build: './gradlew build', test: './gradlew test' };
    }

    // Cargo.toml (Rust)
    if (fs.existsSync(path.join(this.workspaceRoot, 'Cargo.toml'))) {
      return { build: 'cargo build', test: 'cargo test' };
    }

    // Makefile
    if (fs.existsSync(path.join(this.workspaceRoot, 'Makefile'))) {
      return { build: 'make', test: 'make test' };
    }

    // Go
    if (fs.existsSync(path.join(this.workspaceRoot, 'go.mod'))) {
      return { build: 'go build ./...', test: 'go test ./...' };
    }

    // requirements.txt / pyproject.toml (Python)
    if (fs.existsSync(path.join(this.workspaceRoot, 'pyproject.toml')) ||
        fs.existsSync(path.join(this.workspaceRoot, 'setup.py'))) {
      return { build: 'python -m build', test: 'pytest' };
    }

    return { build: 'npm run build', test: 'npm test' };
  }
}
