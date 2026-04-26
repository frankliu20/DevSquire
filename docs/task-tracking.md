# Task Tracking & Terminal Link — Design Document

## Overview

DevSquire tracks tasks through two parallel systems that merge in the dashboard:

1. **Runtime tasks** — in-memory `Map<string, TaskInfo>` in `task-runner.ts`, tied to VS Code terminals.
2. **JSONL log tasks** — persisted files under `.squire/logs/`, written by both the extension and AI agents.

The dashboard merges these two sources to show status, phase progress, and terminal links.

---

## 1. ID System

Each task has two IDs:

| ID | Purpose | Lifetime |
|----|---------|----------|
| **Runtime ID** (`taskInfo.id`) | Map key, in-memory unique identifier | Session only |
| **Task Log ID** (`taskInfo.taskLogId`) | JSONL filename + agent log ID | Persisted on disk |

### Task Log ID Convention

| Task Type | Runtime ID | Task Log ID |
|-----------|-----------|-------------|
| dev-issue #123 | `dev-<ts>` | `task-issue-123` |
| dev-issue (adhoc) | `dev-adhoc-<ts>` | `task-adhoc-<ts>` |
| review-pr #32 | `review-<ts>` | `task-review-32` |
| watch-pr | `watch-<ts>` | `task-watch` |
| fix-comments #789 | `fix-<ts>` | `task-issue-789` |
| run-agent | `agent-<ts>` | `task-adhoc-<ts>` |
| run-command | `dev-adhoc-<ts>` | `task-adhoc-<ts>` |

The Task Log ID is passed to agents via `--task-log-id <ID>` in the initial prompt. Agents parse it and use it for all JSONL writes and decision files, ensuring extension and agent write to the **same file**.

---

## 2. Data Flow

```
Extension (task-runner.ts)                    Agent (in terminal)
+-----------------------+                     +----------------------+
| 1. Create TaskInfo    |                     |                      |
| 2. tasks.set(id, ti)  |                     |                      |
| 3. Write JSONL:       |                     |                      |
|    task_start event   |--> .squire/logs/    |                      |
| 4. Inject --task-log-id -> terminal prompt  |                      |
| 5. Launch terminal    |                     | 6. Parse --task-log-id
|                       |                     | 7. Append JSONL      |
|                       |  <-- .squire/logs/  |    (same file)       |
|                       |                     | 8. Write decisions   |
|                       |  <-- .squire/       |    pending-decisions/|
+-----------------------+  pending-decisions/ +----------------------+
         |
   dashboard-provider.ts
   +---------------------------+
   | sendTasks():              |
   |  runtime tasks (Map)      |
   |  + log tasks (JSONL scan) |
   |  --> merge by taskLogId   |
   |  --> post to webview      |
   +---------------------------+
```

---

## 3. Merge Logic (`sendTasks()` in `dashboard-provider.ts`)

Runtime tasks take priority. Each runtime task tries to find a matching log task:

1. `rt.taskLogId === lt.id` — primary match
2. `rt.id === lt.id` — fallback
3. `rt.issueUrl === lt.issueUrl` — fallback
4. `rt.worktreeBranch === lt.branch` — fallback

Matched log tasks are "claimed." Unclaimed log tasks appear as standalone entries (orphan or completed).

### Merged Task Object

| Field | Source |
|-------|--------|
| `status` | Runtime (running/completed/failed) |
| `phase` | JSONL log (analyzing/implementing/testing...) |
| `hasTerminal` | Runtime (`!!task.terminal`) |
| `events` | JSONL (all parsed events) |
| `branch`, `prNumber`, `worktreeDir` | Log task, fallback to runtime |

---

## 4. Terminal Link

| Action | Trigger | Logic |
|--------|---------|-------|
| **focusTerminal** | Click terminal button on task card | `tasks.get(taskId).terminal.show()` |
| **Fallback** | Decision taskId is `task-issue-N` format | Extract issue number, scan Map for matching `issueUrl` |
| **Terminal close** | User closes / process exits | `onDidCloseTerminal` -> status='completed', terminal=undefined |

---

## 5. Real-Time Updates

```
fs.watch(.squire/logs/)              --+
                                       +--> debounce 300ms --> sendTasks() + sendDecisions()
fs.watch(.squire/pending-decisions/) --+

taskRunner.onTasksChanged            ----> sendTasks()
```

The extension uses `fs.watch` (push) instead of polling. Changes to JSONL files or decision files trigger a debounced refresh of the dashboard.

---

## 6. Task Lifecycle

```
Created --> running (has terminal)
              |
         terminal closes --> completed (no terminal, log task remains)
              |
         user cleanup --> delete from Map + remove worktree
              |
         log-only task --> orphan display (can cleanOrphan to delete JSONL)
```

### Duplicate Detection

- `runDevIssue()`: checks if a running task with the same `issueUrl` exists. If so, returns the existing task with a warning.
- Other methods: no duplicate detection (e.g., `runFixComments` on the same PR can run multiple times; JSONL appends, no conflict).

### Same Issue Re-trigger

When the same issue is triggered again after completion:
- JSONL is append-only, so a new `task_start` event is added to the same file.
- `readTask()` returns the **last** phase, so the phase resets to `planned`.
- The new runtime task claims the log task via `taskLogId` match.

---

## 7. Per-Type Phase Pipelines

Each task type has a defined phase pipeline displayed in the dashboard:

| Task Type | Pipeline |
|-----------|----------|
| dev-issue | analyzing -> exploring -> planning -> implementing -> testing -> creating_pr -> done |
| review-pr | fetching -> reviewing -> summarizing -> done |
| watch-pr | analyzing -> monitoring -> fixing_ci -> fixing_comments -> monitoring (cyclic) |
| fix-comments | analyzing -> implementing -> testing -> creating_pr -> done |
| run-command | implementing -> done |

Phase transitions are driven by JSONL event types via `EVENT_TYPE_TO_PHASE` mapping in `task-state.ts`.

---

## 8. Decision Notifications

Agents write decision files to `.squire/pending-decisions/<TASK_LOG_ID>.json` when they need user input. The dashboard detects these via `fs.watch` and shows notification cards.

After the user responds in the terminal, the agent deletes the decision file. Decisions auto-expire after 24 hours.

---

## 9. Known Limitations

- **focusTerminal fallback** only handles `issue-N` format; `task-review-N` and `task-watch` rely on direct runtime ID lookup (sufficient since they always have a runtime task while terminal is open).
- **watch-pr is singleton** (`task-watch`): running two watch-pr tasks simultaneously would write to the same JSONL file. Only one should be active at a time.
- **run-agent for non-dev-issue agents**: uses `task-adhoc-<ts>` which has no semantic meaning; phase tracking depends on agents actually writing JSONL (custom agents may not).
