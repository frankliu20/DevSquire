import * as fs from 'fs';
import * as path from 'path';

/** Task phases matching the DevSquire pipeline */
export type TaskPhase =
  | 'planned' | 'analyzing' | 'exploring' | 'planning'
  | 'implementing' | 'testing' | 'test_failed'
  | 'waiting_confirm' | 'waiting_manual_test'
  | 'creating_pr' | 'done' | 'failed';

/** Derived from JSONL log entries */
export interface TaskState {
  id: string;
  issueNumber?: number;
  issueUrl?: string;
  phase: TaskPhase;
  branch?: string;
  prNumber?: number;
  prUrl?: string;
  worktreeDir?: string;
  startedAt: string;
  updatedAt: string;
  events: TaskEvent[];
}

export interface TaskEvent {
  timestamp: string;
  phase?: string;
  message?: string;
  type?: string;
}

/** Pending decision from the AI */
export interface PendingDecision {
  id: string;
  taskId: string;
  type: 'pr_notification' | 'decision';
  title: string;
  message: string;
  options?: string[];
  prNumber?: number;
  prUrl?: string;
  createdAt: string;
}

/**
 * Maps JSONL event types to pipeline phases.
 * When the agent logs an event type (e.g. "test_pass"), we can derive
 * which pipeline phase the task has reached, even if the agent didn't
 * explicitly set the phase field.
 */
const EVENT_TYPE_TO_PHASE: Record<string, TaskPhase> = {
  task_start: 'analyzing',
  analysis_done: 'exploring',
  exploration_done: 'planning',
  plan_approved: 'implementing',
  implementation_done: 'testing',
  test_pass: 'creating_pr',
  test_fail: 'test_failed',
  manual_verify_waiting: 'waiting_manual_test',
  manual_verify_done: 'creating_pr',
  pr_created: 'done',
  blocked: 'failed',
};

/**
 * Reads task state from JSONL log files and pending decisions.
 */
export class TaskStateReader {
  constructor(private squireDir: string) {}

  /** Read all task states from log files */
  readAllTasks(): TaskState[] {
    const logsDir = path.join(this.squireDir, 'logs');
    if (!fs.existsSync(logsDir)) return [];

    const tasks: TaskState[] = [];
    const files = fs.readdirSync(logsDir).filter((f) =>
      f.endsWith('.jsonl') && (f.startsWith('task-') || f.startsWith('issue-') || f.startsWith('adhoc-')),
    );

    for (const file of files) {
      const taskId = file.replace('.jsonl', '');
      const state = this.readTask(taskId);
      if (state) tasks.push(state);
    }

    return tasks.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  /** Read a single task state */
  readTask(taskId: string): TaskState | null {
    const logFile = path.join(this.squireDir, 'logs', `${taskId}.jsonl`);
    if (!fs.existsSync(logFile)) return null;

    try {
      const content = fs.readFileSync(logFile, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      const events: TaskEvent[] = [];
      let phase: TaskPhase = 'planned';
      let branch: string | undefined;
      let prNumber: number | undefined;
      let prUrl: string | undefined;
      let issueNumber: number | undefined;
      let issueUrl: string | undefined;
      let worktreeDir: string | undefined;
      let startedAt = '';
      let updatedAt = '';

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (!startedAt) startedAt = entry.timestamp;
          updatedAt = entry.timestamp;

          // Derive phase from event type if phase field is missing or generic
          if (entry.phase) {
            phase = entry.phase;
          } else if (entry.type && EVENT_TYPE_TO_PHASE[entry.type]) {
            phase = EVENT_TYPE_TO_PHASE[entry.type];
          }
          if (entry.branch) branch = entry.branch;
          if (entry.pr_number) prNumber = entry.pr_number;
          if (entry.pr_url) prUrl = entry.pr_url;
          if (entry.issue_number) issueNumber = entry.issue_number;
          if (entry.issue_url) issueUrl = entry.issue_url;
          if (entry.worktree_dir) worktreeDir = entry.worktree_dir;

          events.push({
            timestamp: entry.timestamp,
            phase: entry.phase,
            message: entry.message || entry.event,
            type: entry.type || entry.event,
          });
        } catch {
          // Skip malformed lines
        }
      }

      return {
        id: taskId,
        issueNumber,
        issueUrl,
        phase,
        branch,
        prNumber,
        prUrl,
        worktreeDir,
        startedAt,
        updatedAt,
        events,
      };
    } catch {
      return null;
    }
  }

  /** Read pending decisions */
  readDecisions(): PendingDecision[] {
    const decisionsDir = path.join(this.squireDir, 'pending-decisions');
    if (!fs.existsSync(decisionsDir)) return [];

    try {
      const files = fs.readdirSync(decisionsDir).filter((f) => f.endsWith('.json'));
      const decisions: PendingDecision[] = [];

      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(decisionsDir, file), 'utf-8');
          decisions.push(JSON.parse(content));
        } catch {
          // Skip malformed
        }
      }

      return decisions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch {
      return [];
    }
  }

  /** Dismiss a decision */
  dismissDecision(decisionId: string): boolean {
    const decisionsDir = path.join(this.squireDir, 'pending-decisions');
    const filePath = path.join(decisionsDir, `${decisionId}.json`);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /** Delete a task's log file */
  deleteTaskLog(taskId: string): boolean {
    const logFile = path.join(this.squireDir, 'logs', `${taskId}.jsonl`);
    try {
      if (fs.existsSync(logFile)) {
        fs.unlinkSync(logFile);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /** Global cleanup: delete all logs, decisions */
  cleanupAll(): void {
    const logsDir = path.join(this.squireDir, 'logs');
    const decisionsDir = path.join(this.squireDir, 'pending-decisions');

    for (const dir of [logsDir, decisionsDir]) {
      if (fs.existsSync(dir)) {
        for (const file of fs.readdirSync(dir)) {
          try { fs.unlinkSync(path.join(dir, file)); } catch { /* skip */ }
        }
      }
    }
  }
}
