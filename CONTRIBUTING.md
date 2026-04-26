# Contributing to DevSquire

Thank you for your interest in contributing to DevSquire! This guide covers everything you need to get started.

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [VS Code](https://code.visualstudio.com/) v1.85+
- [GitHub CLI](https://cli.github.com/) (`gh`) installed and authenticated
- [GitHub Copilot CLI](https://docs.github.com/en/copilot/github-copilot-in-the-cli) extension (`gh extension install github/gh-copilot`)

## Development Setup

```bash
# Clone the repo
git clone https://github.com/frankliu20/DevSquire.git
cd DevSquire

# Install dependencies
npm install

# Compile the extension
npm run compile

# Launch in development — press F5 in VS Code
# This opens a new Extension Development Host window
```

### Useful Commands

| Command | Description |
|---------|-------------|
| `npm run compile` | Build the extension |
| `npm run watch` | Build and watch for changes |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests (vitest) |
| `npm run package` | Package as `.vsix` |

## Making Changes

### Branch Naming

- Bug fixes: `fix/issue-<N>`
- Features: `feat/issue-<N>`
- Documentation: `docs/issue-<N>`
- Development / exploratory: `dev/issue-<N>`

### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
fix(scope): short description
feat(scope): short description
docs(scope): short description
refactor(scope): short description
test(scope): short description
```

Common scopes: `agents`, `tasks`, `review-pr`, `dashboard`, `extension`.

### Code Style

- TypeScript with strict mode
- ESLint with `@typescript-eslint` — run `npm run lint` before submitting
- Follow existing patterns in the codebase — don't introduce new conventions without discussion
- Webview UI uses VS Code design tokens (no custom color values)

## Pull Request Process

1. **Open an issue first** — describe the bug or feature before writing code
2. **Create a feature branch** from `main` (never commit directly to `main`)
3. **Keep changes minimal** — one logical change per PR
4. **Add tests** for any behavior changes
5. **Run lint and tests** before pushing:
   ```bash
   npm run lint
   npm test
   npm run compile
   ```
6. **Open a PR** referencing the issue (e.g., "Closes #37" in the PR body)
7. **Wait for review** — a maintainer will review your PR

### PR Checklist

- [ ] Branch is up to date with `main`
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] `npm run compile` succeeds
- [ ] PR description references the related issue
- [ ] Changes are minimal and focused

## Reporting Issues

When filing a bug report, include:

- **VS Code version** and **OS**
- **Steps to reproduce** the issue
- **Expected behavior** vs **actual behavior**
- **Relevant logs** from the Output panel (`DevSquire` channel)

For feature requests, describe the use case and why the feature would be valuable.

## Project Structure

```
src/
  extension.ts          # Extension entry point
  agents/               # Copilot agent definitions
  commands/             # VS Code command handlers
  tasks/                # Task management
  views/                # Webview UI (dashboard)
resources/              # Icons, assets
```

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
