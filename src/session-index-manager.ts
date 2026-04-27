import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { detectClaudeSession, detectCopilotSession, AiSession } from './session-detector';

/**
 * A single flat session record — the primary unit in the index.
 * Each record is self-contained with all metadata needed for grouping/filtering.
 */
export interface SessionRecord {
  id: string;               // dsq-xxx — unique per session run
  taskLogId: string;         // e.g. "task-issue-39"
  aiPlatform: string;        // "claude-code" | "copilot-cli" | "copilot-chat"
  aiSessions: AiSession[];
  startedAt: string;
  endedAt: string | null;
}

/**
 * Events that the SessionIndexManager listens to.
 */
export interface SessionCreatedEvent {
  type: 'session_created';
  workspacePath: string;
  taskLogId: string;
  sessionId: string;
  cwd: string;
  aiPlatform: 'claude-code' | 'copilot-cli' | 'copilot-chat';
}

export interface SessionEndedEvent {
  type: 'session_ended';
  workspacePath: string;
  taskLogId: string;
  cwd: string;
  aiPlatform: 'claude-code' | 'copilot-cli' | 'copilot-chat';
}

export interface SessionDetectAiEvent {
  type: 'session_detect_ai';
  workspacePath: string;
  taskLogId: string;
  cwd: string;
  aiPlatform: 'claude-code' | 'copilot-cli' | 'copilot-chat';
}

export type SessionEvent = SessionCreatedEvent | SessionEndedEvent | SessionDetectAiEvent;

/**
 * Manages the global session index at ~/.squire/sessions/index.json.
 *
 * Listens to session lifecycle events from TaskRunner and keeps the index
 * up to date. All file I/O for the session index lives here — TaskRunner
 * only fires events.
 */
export class SessionIndexManager {
  private static readonly INDEX_DIR = path.join(os.homedir(), '.squire', 'sessions');
  private static readonly INDEX_PATH = path.join(SessionIndexManager.INDEX_DIR, 'index.json');

  private static readonly AI_DETECT_INTERVAL = 10_000; // 10s between retries
  private static readonly AI_DETECT_MAX_RETRIES = 12;  // up to 2 minutes
  static generateSessionId(): string {
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
    return `dsq-${ts}-${rand}`;
  }

  private activePollers = new Map<string, ReturnType<typeof setInterval>>();

  /** Handle a session lifecycle event */
  handleEvent(event: SessionEvent): void {
    switch (event.type) {
      case 'session_created':
        this.createSession(event.workspacePath, event.taskLogId, event.sessionId, event.aiPlatform);
        this.startAiDetectionPolling(event.workspacePath, event.taskLogId, event.sessionId, event.cwd, event.aiPlatform);
        break;
      case 'session_ended': {
        this.stopAiDetectionPolling(event.taskLogId);
        const latestSessionId = this.getLatestSessionId(event.workspacePath, event.taskLogId);
        this.endSession(event.workspacePath, event.taskLogId, latestSessionId, event.cwd, event.aiPlatform);
        break;
      }
      case 'session_detect_ai': {
        const sid = this.getLatestSessionId(event.workspacePath, event.taskLogId);
        this.detectAndWriteAiSessions(event.workspacePath, event.taskLogId, sid, event.cwd, event.aiPlatform);
        break;
      }
    }
  }

  /** Read all sessions for a workspace path. Used by dashboard-provider. */
  readWorkspaceSessions(workspacePath: string): SessionRecord[] {
    const index = this.readIndex();
    return index[workspacePath] || [];
  }

  // --- Private ---

  private createSession(workspacePath: string, taskLogId: string, sessionId: string, aiPlatform: string): void {
    try {
      const index = this.readIndex();
      if (!index[workspacePath]) index[workspacePath] = [];

      const session: SessionRecord = {
        id: sessionId,
        taskLogId,
        aiPlatform,
        aiSessions: [],
        startedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        endedAt: null,
      };
      index[workspacePath].push(session);
      this.writeIndex(index);
    } catch {
      // Non-critical
    }
  }

  private endSession(workspacePath: string, taskLogId: string, sessionId: string | null, cwd: string, aiPlatform: string): void {
    try {
      const index = this.readIndex();
      const sessions = index[workspacePath];
      if (!sessions?.length) return;

      // Find by sessionId, or last session for this taskLogId
      const session = sessionId
        ? sessions.find(s => s.id === sessionId)
        : [...sessions].reverse().find(s => s.taskLogId === taskLogId);
      if (!session) return;

      let changed = false;

      // Detect AI sessions if not already set
      if (!session.aiSessions || session.aiSessions.length === 0) {
        const matchId = sessionId || session.id;
        const aiSession = this.detectForPlatform(cwd, matchId, aiPlatform);
        if (aiSession) {
          session.aiSessions = [aiSession];
          changed = true;
        }
      }

      if (!session.endedAt) {
        session.endedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
        changed = true;
      }

      if (changed) {
        this.writeIndex(index);
      }
    } catch {
      // Non-critical
    }
  }

  /** @returns true if AI sessions were found */
  private detectAndWriteAiSessions(workspacePath: string, taskLogId: string, sessionId: string | null, cwd: string, aiPlatform: string): boolean {
    try {
      const index = this.readIndex();
      const sessions = index[workspacePath];
      if (!sessions?.length) return false;

      const session = sessionId
        ? sessions.find(s => s.id === sessionId)
        : [...sessions].reverse().find(s => s.taskLogId === taskLogId);
      if (!session) return false;
      if (session.aiSessions && session.aiSessions.length > 0) return true; // Already detected

      const matchId = sessionId || session.id;
      const aiSession = this.detectForPlatform(cwd, matchId, aiPlatform);
      if (aiSession) {
        session.aiSessions = [aiSession];
        this.writeIndex(index);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /** Detect AI session for the specific platform, matching by sessionId */
  private detectForPlatform(cwd: string, sessionId: string, aiPlatform: string): AiSession | null {
    try {
      if (aiPlatform === 'claude-code') {
        return detectClaudeSession(cwd, sessionId);
      } else {
        return detectCopilotSession(sessionId);
      }
    } catch {
      return null;
    }
  }

  /** Get the latest sessionId for a task from the index */
  private getLatestSessionId(workspacePath: string, taskLogId: string): string | null {
    try {
      const index = this.readIndex();
      const sessions = index[workspacePath];
      if (sessions?.length) {
        for (let i = sessions.length - 1; i >= 0; i--) {
          if (sessions[i].taskLogId === taskLogId) return sessions[i].id;
        }
      }
    } catch { /* ignore */ }
    return null;
  }

  /**
   * Poll for AI session files every 10s until detected or max retries reached.
   */
  private startAiDetectionPolling(workspacePath: string, taskLogId: string, sessionId: string, cwd: string, aiPlatform: string): void {
    this.stopAiDetectionPolling(taskLogId);

    let retries = 0;
    const interval = setInterval(() => {
      retries++;
      const found = this.detectAndWriteAiSessions(workspacePath, taskLogId, sessionId, cwd, aiPlatform);
      if (found || retries >= SessionIndexManager.AI_DETECT_MAX_RETRIES) {
        this.stopAiDetectionPolling(taskLogId);
      }
    }, SessionIndexManager.AI_DETECT_INTERVAL);

    this.activePollers.set(taskLogId, interval);
  }

  private stopAiDetectionPolling(taskLogId: string): void {
    const interval = this.activePollers.get(taskLogId);
    if (interval) {
      clearInterval(interval);
      this.activePollers.delete(taskLogId);
    }
  }

  private readIndex(): Record<string, SessionRecord[]> {
    try {
      if (fs.existsSync(SessionIndexManager.INDEX_PATH)) {
        return JSON.parse(fs.readFileSync(SessionIndexManager.INDEX_PATH, 'utf-8'));
      }
    } catch { /* corrupted — start fresh */ }
    return {};
  }

  private writeIndex(index: Record<string, SessionRecord[]>): void {
    try {
      fs.mkdirSync(SessionIndexManager.INDEX_DIR, { recursive: true });
      fs.writeFileSync(SessionIndexManager.INDEX_PATH, JSON.stringify(index, null, 2));
    } catch {
      // Non-critical
    }
  }
}
