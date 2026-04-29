# Changelog

All notable changes to DevSquire will be documented in this file.

## [0.1.5] - 2026-04-29

### Fixed
- Restore worktree button after resuming session on extension restart ([#94](https://github.com/frankliu20/DevSquire/pull/94))
- Use stdin for scrum GitHub comments to preserve newlines ([#96](https://github.com/frankliu20/DevSquire/pull/96))

## [0.1.0] - 2026-04-26

### Added
- Dashboard with 6 tabs: Issues, PRs, Tasks, Actions, Skills, Report
- Develop Issue pipeline: analyze → explore → plan → implement → test → create PR
- Review PR with configurable strategy (normal, auto, quick-approve) and severity levels
- Watch PR monitoring with cyclic pipeline for CI failures and review comments
- Real-time task progress tracking with JSONL-based state management
- End-of-Day scrum report generation
- Claude Code backend integration
- Agent framework auto-sync to ~/.claude/
- Worktree isolation per task
