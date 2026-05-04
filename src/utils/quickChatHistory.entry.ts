/**
 * IIFE bundle entry：挂到 window.TwQuickChatHistory，供快速模式脚本调用
 */
import {
  upsertSession,
  listSessions,
  listSessionsBySnippetId,
  getSession,
  deleteSession,
  type QuickChatMessage,
  type QuickChatSessionMeta,
  type QuickChatSessionRow,
} from "./quickChatHistory";

export type TwQuickChatHistoryApi = {
  upsertSession: (
    sessionId: string | null,
    meta: QuickChatSessionMeta,
    messages: QuickChatMessage[],
  ) => Promise<string>;
  listSessions: (limit?: number) => Promise<QuickChatSessionRow[]>;
  listSessionsBySnippetId: (
    snippetId: string,
    limit?: number,
  ) => Promise<QuickChatSessionRow[]>;
  getSession: (id: string) => Promise<QuickChatSessionRow | undefined>;
  deleteSession: (id: string) => Promise<void>;
};

declare global {
  interface Window {
    TwQuickChatHistory?: TwQuickChatHistoryApi;
  }
}

type BgHistoryResp<T> = { ok?: boolean; data?: T };

function hasBgBridge(): boolean {
  return !!(typeof chrome !== "undefined" && chrome.runtime?.sendMessage);
}

function callBg<T>(payload: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!hasBgBridge()) {
      reject(new Error("bg_bridge_unavailable"));
      return;
    }
    chrome.runtime.sendMessage(payload, (resp: BgHistoryResp<T>) => {
      const le = chrome.runtime.lastError;
      if (le) {
        reject(new Error(String(le.message || le)));
        return;
      }
      if (!resp?.ok) {
        reject(new Error("bg_history_failed"));
        return;
      }
      resolve(resp.data as T);
    });
  });
}

async function upsertSessionGlobal(
  sessionId: string | null,
  meta: QuickChatSessionMeta,
  messages: QuickChatMessage[],
): Promise<string> {
  try {
    return await callBg<string>({
      type: "TW_HISTORY_UPSERT",
      sessionId,
      meta,
      messages,
    });
  } catch {
    return upsertSession(sessionId, meta, messages);
  }
}

async function listSessionsGlobal(limit = 80): Promise<QuickChatSessionRow[]> {
  try {
    return await callBg<QuickChatSessionRow[]>({
      type: "TW_HISTORY_LIST",
      limit,
    });
  } catch {
    return listSessions(limit);
  }
}

async function listSessionsBySnippetIdGlobal(
  snippetId: string,
  limit = 5,
): Promise<QuickChatSessionRow[]> {
  try {
    return await callBg<QuickChatSessionRow[]>({
      type: "TW_HISTORY_LIST_BY_SNIPPET",
      snippetId,
      limit,
    });
  } catch {
    return listSessionsBySnippetId(snippetId, limit);
  }
}

async function getSessionGlobal(id: string): Promise<QuickChatSessionRow | undefined> {
  try {
    return await callBg<QuickChatSessionRow | undefined>({
      type: "TW_HISTORY_GET",
      id,
    });
  } catch {
    return getSession(id);
  }
}

async function deleteSessionGlobal(id: string): Promise<void> {
  try {
    await callBg<true>({
      type: "TW_HISTORY_DELETE",
      id,
    });
  } catch {
    await deleteSession(id);
  }
}

window.TwQuickChatHistory = {
  upsertSession: upsertSessionGlobal,
  listSessions: listSessionsGlobal,
  listSessionsBySnippetId: listSessionsBySnippetIdGlobal,
  getSession: getSessionGlobal,
  deleteSession: deleteSessionGlobal,
};
