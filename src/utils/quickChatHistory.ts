/**
 * 快速模式「Asking AI」多轮对话持久化（IndexedDB via Dexie）
 */
import Dexie, { type Table } from "dexie";

export type QuickChatMessage = {
  role: "user" | "assistant";
  content: string;
  ts: number;
};

export type QuickChatSessionMeta = {
  source: "snippet" | "agency-chat";
  snippetId: string | null;
  snippetTitle: string | null;
  model: string | null;
  agencyEnhance: boolean | null;
};

export type QuickChatSessionRow = QuickChatSessionMeta & {
  id: string;
  createdAt: number;
  updatedAt: number;
  messages: QuickChatMessage[];
};

class QuickChatDexie extends Dexie {
  sessions!: Table<QuickChatSessionRow, string>;

  constructor() {
    super("TalkWebSourQuickChat");
    this.version(1).stores({
      sessions: "id, updatedAt, source, snippetId",
    });
  }
}

let dbSingleton: QuickChatDexie | null = null;

function db(): QuickChatDexie {
  if (!dbSingleton) dbSingleton = new QuickChatDexie();
  return dbSingleton;
}

function genId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export async function upsertSession(
  sessionId: string | null,
  meta: QuickChatSessionMeta,
  messages: QuickChatMessage[],
): Promise<string> {
  const now = Date.now();
  const table = db().sessions;

  if (sessionId) {
    const prev = await table.get(sessionId);
    if (prev) {
      await table.put({
        ...prev,
        ...meta,
        messages: messages.map((m) => ({ ...m })),
        updatedAt: now,
      });
      return sessionId;
    }
  }

  const id = genId();
  await table.add({
    id,
    createdAt: now,
    updatedAt: now,
    ...meta,
    messages: messages.map((m) => ({ ...m })),
  });
  return id;
}

export async function listSessions(limit = 80): Promise<QuickChatSessionRow[]> {
  const rows = await db()
    .sessions.orderBy("updatedAt")
    .reverse()
    .limit(Math.max(1, Math.min(500, limit)))
    .toArray();
  return rows;
}

/** 同一 script 的最近会话（按 updatedAt 新→旧，供恢复提示） */
export async function listSessionsBySnippetId(
  snippetId: string,
  limit = 5,
): Promise<QuickChatSessionRow[]> {
  const id = String(snippetId || "").trim();
  if (!id) return [];
  const lim = Math.max(1, Math.min(50, limit));
  const rows = await db().sessions.where("snippetId").equals(id).toArray();
  rows.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return rows.slice(0, lim);
}

export async function getSession(
  id: string,
): Promise<QuickChatSessionRow | undefined> {
  return db().sessions.get(id);
}

export async function deleteSession(id: string): Promise<void> {
  await db().sessions.delete(id);
}
