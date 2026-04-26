# Audit Report: DevSquire vs dev-pilot Feature & CSS Alignment

> Issue: [#4](https://github.com/frankliu20/DevSquire/issues/4)
> Date: 2026-04-26
> Branch: `dev/issue-4`

## Executive Summary

DevSquire (VS Code extension) has successfully ported the **core workflow** from dev-pilot (Next.js dashboard) — issues, PRs, tasks, actions, skills, and reports all work within VS Code. However, there are **9 feature gaps** and **8 CSS/design gaps** identified in the issue. After detailed code analysis, the true picture is more nuanced: some gaps are **by design** (VS Code constraints), some are **partially implemented**, and some are **genuine missing features**.

---

## 1. Feature Alignment Analysis

### Legend
- :white_check_mark: = Present in DevSquire
- :warning: = Partially implemented
- :x: = Missing
- :no_entry: = Not applicable (by design / VS Code constraint)

| # | Feature | DevSquire | dev-pilot | Status | Notes |
|---|---------|-----------|-----------|--------|-------|
| 1 | Off-work celebration (emoji particles + audio + encouragement) | :x: | :white_check_mark: `OffWorkCelebration.tsx` | **Missing** | dev-pilot has 40 emoji particles, Web Audio API C-E-G-C arpeggio, 10 random encouragement messages. DevSquire has nothing. |
| 2 | Scrum report "Post to GitHub" | :white_check_mark: `report.ts` | :white_check_mark: `ReportTab.tsx` + `/api/scrum` | **Parity** | Both have `generateScrum()` + `postScrumToGitHub()` + "Post to GitHub" / "Mark Scrum" buttons. |
| 3 | Multi-platform Git support (GitLab, Azure DevOps) | :no_entry: | :white_check_mark: `git-provider.ts` | **By design** | CLAUDE.md explicitly states "GitHub only — no GitLab/Azure DevOps support". dev-pilot has `github|gitlab|azdevops` abstraction layer. |
| 4 | Dual CLI backend | :white_check_mark: `backend.ts` (3 backends!) | :white_check_mark: `types.ts` (2 backends) | **DevSquire ahead** | DevSquire supports `copilot-cli`, `claude-code`, AND `copilot-chat`. dev-pilot only has `claude` + `copilot`. |
| 5 | Terminal spawner cross-platform | :no_entry: | :white_check_mark: `terminal.ts` | **By design** | dev-pilot spawns OS terminals (wt.exe/Terminal.app/gnome-terminal). DevSquire uses `vscode.window.createTerminal()` — VS Code handles cross-platform natively. |
| 6 | Agent model/turn config in frontmatter | :x: | :white_check_mark: `pilot-pr-creator.md` etc. | **Missing** | dev-pilot agents have `model`, `maxTurns`, `effort` in frontmatter. DevSquire's `skills-reader.ts` only reads name/description/content, ignores frontmatter fields. |
| 7 | Auto-fix state tracking (per-PR 3-attempt limit) | :x: | :warning: `registry.ts` | **Both incomplete** | Neither has explicit per-PR 3-attempt limit persisted to JSON. dev-pilot's `TaskRegistry` tracks running/completed/cancelled but no attempt counter. DevSquire's `task-runner.ts` has no retry logic at all. |
| 8 | SSE real-time task streaming | :x: | :white_check_mark: `stream/route.ts` + `useTaskStream.ts` | **Missing** | dev-pilot uses SSE (`EventSource`) with auto-reconnect. DevSquire uses `setInterval` polling (tasks 5s, decisions 10s). |
| 9 | Issue detail side panel | :warning: | :white_check_mark: `IssuePanel.tsx` + `IssueDetail.tsx` | **Partial** | DevSquire has inline expand (`toggleIssueDetail`). dev-pilot has full slide-in overlay panel with breadcrumb, markdown body, task timeline, action bar. |

### Summary: 3 missing, 2 by design, 1 partial, 2 at parity, 1 ahead

---

## 2. CSS/Design Gap Analysis

| # | Gap | DevSquire | dev-pilot | Verdict |
|---|-----|-----------|-----------|---------|
| 1 | Token system | 38 CSS vars inline in `dashboard-html.ts` (6 spacing, 5 typography, 4 radius, 2 shadow, 2 transition) | Dedicated `tokens.css` (229 lines): 13 spacing, 7 typography, 5 radius, 4 shadow, 7 z-index, 3 transition | **Gap: DevSquire tokens are fewer and inline** |
| 2 | Dark theme palette | Uses `--vscode-*` tokens directly (auto theme) | Custom zinc palette (`#09090b` base) | **By design**: DevSquire follows CLAUDE.md "no custom color values", using VS Code tokens is correct for a VS Code extension |
| 3 | Light theme status opacities | Uses `color-mix(in srgb, color 18%, transparent)` uniformly | Dark: 0.12 opacity, Light: 0.08 opacity (separate optimization) | **Minor gap**: DevSquire could benefit from light/dark-aware opacity, but VS Code tokens partially handle this |
| 4 | Shadow system | 2 levels (`--shadow-sm`, `--shadow-md`) | 4 levels (sm/md/lg/xl) with light/dark variants | **Gap**: Missing `--shadow-lg` and `--shadow-xl` |
| 5 | CSS Modules per component | All styles in one `<style>` block in `dashboard-html.ts` | 19 CSS Module files, one per component | **Architecture gap**: DevSquire is a monolith; however, VS Code webview is a single HTML string, so CSS Modules aren't directly applicable. Could use template functions per component section. |
| 6 | `reduced-motion` media query | :x: None — 6 animations with no fallback | :white_check_mark: `globals.css` sets all durations to 0.01ms | **Gap: Accessibility issue** |
| 7 | Responsive breakpoints | :x: None (relies on flex/grid) | `clamp(800px, 90vw, 1200px)` + fixed panel width | **By design**: VS Code sidebar is fixed width, responsive breakpoints are unnecessary |
| 8 | Component library | All components inline in dashboard-html.ts | 10 reusable components in `ui/` directory (Badge, Button, ConfirmDialog, EmptyState, Select, Skeleton, StatusDot, Toast, Tooltip, Icon) | **Architecture gap**: Same as #5 — monolith vs modular. DevSquire has equivalent UI elements but not separated. |

### Summary: 3 genuine gaps (shadow levels, reduced-motion, token completeness), 3 by design, 2 architecture considerations

---

## 3. Architecture Comparison

| Dimension | DevSquire | dev-pilot |
|-----------|-----------|-----------|
| Runtime | VS Code Extension (Node.js + Webview) | Next.js App Router (React + Node.js) |
| UI | Single `dashboard-html.ts` (1,098 lines) template string | Component tree: 10+ React components + 19 CSS Modules |
| Data fetching | `gh` CLI via `cp.execSync` | `gh` CLI via API routes + SSE streaming |
| State | Webview message passing + `setInterval` polling | React state + hooks + SSE |
| Styling | Inline `<style>` with VS Code design tokens | `tokens.css` + CSS Modules + custom theme |
| Backend | 3 CLI backends (`backend.ts` + `backends/`) | 2 CLI backends (`types.ts` + `terminal.ts`) |
| Code size | ~3,135 lines TypeScript | ~6,000+ lines TypeScript/TSX/CSS |

### Should DevSquire refactor dashboard into modular template functions?

**Recommendation: Yes, but incrementally.** The 1,098-line `dashboard-html.ts` is maintainable today but approaching a complexity threshold. Suggested approach:
1. Extract CSS into a `dashboard-styles.ts` function
2. Extract JS into a `dashboard-scripts.ts` function
3. Extract tab content into per-tab template functions (e.g., `renderIssuesTab()`, `renderPRsTab()`)
4. Keep everything as template strings (no framework needed for VS Code webview)

This preserves the VS Code webview architecture while improving maintainability.

---

## 4. Prioritized Recommendations

### Priority 1 — Quick Wins (Low effort, High value)
1. **Add `prefers-reduced-motion` support** — 5 lines of CSS, fixes accessibility gap
2. **Add `--shadow-lg` and `--shadow-xl` tokens** — 4 lines of CSS
3. **Expand spacing tokens** to match dev-pilot's 13 levels — minor CSS addition

### Priority 2 — Feature Gaps (Medium effort)
4. **Off-work celebration** — Fun feature, ~150 lines. Emoji particles via DOM animation + Web Audio API arpeggio. Good for morale.
5. **Agent frontmatter parsing** — Extend `skills-reader.ts` to parse `model`, `maxTurns`, `effort` from YAML frontmatter. ~50 lines.
6. **Issue detail panel upgrade** — Enhance inline expand to full slide-in panel with markdown rendering + task timeline. ~200 lines.

### Priority 3 — Architecture (Higher effort, Long term)
7. **SSE streaming vs polling** — Replace `setInterval` polling with VS Code webview `postMessage`-based streaming. Note: true SSE isn't possible in VS Code webview; the equivalent is extension-side `fs.watch` → `postMessage` push. ~100 lines.
8. **Dashboard modularization** — Split `dashboard-html.ts` into template functions per section. ~0 new lines, reorganization only.

### Priority 4 — Intentionally Not Porting
9. **Multi-platform Git** — CLAUDE.md says "GitHub only". Skip.
10. **Cross-platform terminal spawner** — VS Code API handles this. Skip.
11. **CSS Modules** — Not applicable to VS Code webview template strings. Skip.
12. **Responsive breakpoints** — VS Code sidebar is fixed width. Skip.
13. **Auto-fix 3-attempt limit** — Neither codebase has this fully implemented. Tracked as a separate feature request.

---

## 5. Issue Checklist Status

### Feature Alignment
- [x] Off-work celebration — **MISSING** (Priority 2)
- [x] Scrum report "Post to GitHub" — **AT PARITY** :white_check_mark:
- [x] Multi-platform Git support — **BY DESIGN: GitHub only** :no_entry:
- [x] Dual CLI backend — **DEVSQUIRE AHEAD** (3 backends vs 2) :white_check_mark:
- [x] Terminal spawner cross-platform — **BY DESIGN: VS Code API** :no_entry:
- [x] Agent model/turn config in frontmatter — **MISSING** (Priority 2)
- [x] Auto-fix state tracking (per-PR 3-attempt limit) — **BOTH INCOMPLETE** (separate issue)
- [x] SSE real-time task streaming — **MISSING** (Priority 3)
- [x] Issue detail side panel — **PARTIAL** (Priority 2)

### CSS/Design Gaps
- [x] Dedicated tokens.css with full semantic system — **Gap: inline tokens are fewer** (Priority 1)
- [x] Dark theme zinc palette — **BY DESIGN: VS Code tokens** :no_entry:
- [x] Light theme optimized opacities — **Minor gap** (Priority 1)
- [x] 4-level shadow system — **Gap: only 2 levels** (Priority 1)
- [x] CSS Modules per component — **BY DESIGN: not applicable** :no_entry:
- [x] `reduced-motion` media query — **MISSING** (Priority 1)
- [x] Responsive breakpoints — **BY DESIGN: VS Code sidebar** :no_entry:
- [x] Component library as separate modules — **Architecture consideration** (Priority 3)

### Architecture
- [x] Should DevSquire refactor dashboard? — **Yes, incrementally** (Priority 3)
