import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { detectClaudeSession, detectCopilotSession, AiSession } from './session-detector';

/**
 * Events that the SessionIndexManager listens to.
 */
export interface SessionCreatedEvent {
  type: 'session_created';
  repoSlug: string;
  taskLogId: string;
  sessionId: string;
  cwd: string;
  aiPlatform: 'claude-code' | 'copilot-cli' | 'copilot-chat';
}

export interface SessionEndedEvent {
  type: 'session_ended';
  repoSlug: string;
  taskLogId: string;
  cwd: string;
  aiPlatform: 'claude-code' | 'copilot-cli' | 'copilot-chat';
}

export interface SessionDetectAiEvent {
  type: 'session_detect_ai';
  repoSlug: string;
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
        this.createSession(event.repoSlug, event.taskLogId, event.sessionId);
        this.startAiDetectionPolling(event.repoSlug, event.taskLogId, event.cwd, event.aiPlatform);
        break;
      case 'session_ended':
        this.stopAiDetectionPolling(event.taskLogId);
        this.endSession(event.repoSlug, event.taskLogId, event.cwd, event.aiPlatform);
        break;
      case 'session_detect_ai':
        this.detectAndWriteAiSessions(event.repoSlug, event.taskLogId, event.cwd, event.aiPlatform);
        break;
    }
  }

  /** Read the index for a specific repo. Used by dashboard-provider. */
  readRepoSessions(repoSlug: string): Record<string, { sessions: SessionRecord[] }> {
    const index = this.readIndex();
    return index[repoSlug] || {};
  }

  // --- Private ---

  private createSession(repoSlug: string, taskLogId: string, sessionId: string): void {
    try {
      const index = this.readIndex();
      if (!index[repoSlug]) index[repoSlug] = {};
      if (!index[repoSlug][taskLogId]) index[repoSlug][taskLogId] = { sessions: [] };

      const session: SessionRecord = {
        id: sessionId,
        startedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        endedAt: null,
        aiSessions: [],
      };
      index[repoSlug][taskLogId].sessions.push(session);
      this.writeIndex(index);
    } catch {
      // Non-critical
    }
  }

  private endSession(repoSlug: string, taskLogId: string, cwd: string, aiPlatform: string): void {
    try {
      const index = this.readIndex();
      const taskEntry = index[repoSlug]?.[taskLogId];
      if (!taskEntry?.sessions?.length) return;

      const latest = taskEntry.sessions[taskEntry.sessions.length - 1];
      let changed = false;

      // Detect AI sessions if not already set
      if (!latest.aiSessions || latest.aiSessions.length === 0) {
        const aiSession = this.detectForPlatform(cwd, taskLogId, aiPlatform);
        if (aiSession) {
          latest.aiSessions = [aiSession];
          changed = true;
        }
      }

      // Write endedAt
      if (!latest.endedAt) {
        latest.endedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
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
  private detectAndWriteAiSessions(repoSlug: string, taskLogId: string, cwd: string, aiPlatform: string): boolean {
    try {
      const index = this.readIndex();
      const taskEntry = index[repoSlug]?.[taskLogId];
      if (!taskEntry?.sessions?.length) return false;

      const latest = taskEntry.sessions[taskEntry.sessions.length - 1];
      if (latest.aiSessions && latest.aiSessions.length > 0) return true; // Already detected

      const aiSession = this.detectForPlatform(cwd, taskLogId, aiPlatform);
      if (aiSession) {
        latest.aiSessions = [aiSession];
        this.writeIndex(index);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /** Detect AI session for the specific platform only */
  private detectForPlatform(cwd: string, taskLogId: string, aiPlatform: string): AiSession | null {
    try {
      if (aiPlatform === 'claude-code') {
        return detectClaudeSession(cwd, taskLogId);
      } else {
        return detectCopilotSession(taskLogId);
      }
    } catch {
      return null;
    }
  }

  /**
   * Poll for AI session files every 10s until detected or max retries reached.
   * Claude/Copilot session files may take time to appear on disk.
   */
  private startAiDetectionPolling(repoSlug: string, taskLogId: string, cwd: string, aiPlatform: string): void {
    // Stop any existing poller for this task
    this.stopAiDetectionPolling(taskLogId);

    let retries = 0;
    const interval = setInterval(() => {
      retries++;
      const found = this.detectAndWriteAiSessions(repoSlug, taskLogId, cwd, aiPlatform);
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

  private readIndex(): Record<string, Record<string, { sessions: SessionRecord[] }>> {
    try {
      if (fs.existsSync(SessionIndexManager.INDEX_PATH)) {
        return JSON.parse(fs.readFileSync(SessionIndexManager.INDEX_PATH, 'utf-8'));
      }
    } catch { /* corrupted — start fresh */ }
    return {};
  }

  private writeIndex(index: Record<string, Record<string, { sessions: SessionRecord[] }>>): void {
    try {
      fs.mkdirSync(SessionIndexManager.INDEX_DIR, { recursive: true });
      fs.writeFileSync(SessionIndexManager.INDEX_PATH, JSON.stringify(index, null, 2));
    } catch {
      // Non-critical
    }
  }
}

interface SessionRecord {
  id: string;
  startedAt: string;
  endedAt: string | null;
  aiSessions: AiSession[];
}
