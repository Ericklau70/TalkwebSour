// TalkwebSour — Background Service Worker (V3.5)
// 统一注入 + chrome.commands；首次注入后显示侧栏，已存在则切换显示

/** Service Worker 保活：定期闹钟唤醒，减轻长时间空闲后休眠导致的连接/自动化中断 */
const ALARM_NAME = 'talkweb-keepalive';

function createAlarm() {
  chrome.alarms.get(ALARM_NAME, (alarm) => {
    if (chrome.runtime.lastError) return;
    if (!alarm) {
      chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
    }
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  console.log(`[TalkWeb Keep-Alive] Tick at: ${new Date().toLocaleTimeString()}`);
  chrome.runtime.getPlatformInfo(() => {});
});

createAlarm();

const TW_AI_SCRIPTS = [
  'src/tw_superstar_builtin.js',
  'src/tw_agency_compose.js',
  'src/utils/quickChatHistory.bundle.js',
  'src/utils/mermaid.renderer.bundle.js',
  'src/utils/parseAIResponse.bundle.js',
  'src/utils/mermaidEditor.bundle.js',
  'src/ai_rewrite/ai_client.js',
  'src/ai_rewrite/insert.js',
  'src/ai_rewrite/trigger.js',
  'src/ai_rewrite/command.js',
  'src/ai_rewrite/render.js',
  'src/tw_persona_role_presets.js',
  'src/ai_rewrite/tw_ai_rewrite.js',
];
const TW_CONTENT = ['src/tw_persona_role_presets.js', 'src/tw_builtin_scenes.js', 'src/tw_agency_ui.js', 'src/content.js'];

/** 剥掉模型返回的 ``` / ```mermaid 围栏，仅保留 Mermaid 源码 */
function twStripMermaidFence(text) {
  const s = String(text || '').trim();
  const m = s.match(/^```(?:mermaid)?\s*\n?([\s\S]*?)\n?```\s*$/im);
  if (m) return m[1].trim();
  return s.replace(/^```(?:mermaid)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
}

function twMermaidRefineSystemPrompt(uiLang) {
  if (uiLang === 'en') {
    return (
      'You repair and refine Mermaid diagram source code.\n'
      + 'Output rules:\n'
      + '- Output ONLY valid Mermaid source. No markdown fences, no commentary before or after the diagram.\n'
      + '- Keep existing `%%{init:...}%%` and leading `%%` comment blocks unless the user explicitly asks to change the theme.\n'
      + '- Preserve `classDef` / `class` lines when they are valid; merge duplicates instead of deleting wholesale.\n'
      + '- Fix syntax errors (duplicate node IDs, bad arrows, unclosed subgraph), and keep node labels faithful to the original meaning.\n'
      + '- Do not invent new business entities not implied by the original diagram.'
    );
  }
  if (uiLang === 'ko') {
    return (
      'Mermaid 다이어그램 소스를 수정·다듬습니다.\n'
      + '출력: 유효한 Mermaid 코드만. 마크다운 펜스·설명 문장 금지.\n'
      + '`%%{init}%%`·`%%` 주석은 사용자가 바꾸라고 하지 않으면 유지.\n'
      + 'classDef/class는 유효하면 유지하고 중복만 정리.\n'
      + '문법 오류(중복 ID, 잘못된 화살표, subgraph 미닫힘)를 고치고, 원문에 없는 업무 엔티티는 추가하지 마세요.'
    );
  }
  return (
    '你是 Mermaid 语法修复与排版优化助手。\n'
    + '输出要求：\n'
    + '- 只输出可渲染的 Mermaid 源码，不要 markdown 代码围栏，不要在图前后写说明性长文。\n'
    + '- 除非用户明确要求改主题，否则保留现有的 `%%{init:...}%%` 与文件头 `%%` 注释块。\n'
    + '- 合理保留 `classDef` / `class`：能合并则合并，勿无故整段删除样式套件。\n'
    + '- 修正语法错误（重复节点 ID、错误连接、subgraph 未闭合等），节点文案须忠于原图语义。\n'
    + '- 不要凭空增加原图中未暗示的业务实体或步骤。'
  );
}

function twMermaidRefineUserPayload(code, userNote, uiLang) {
  const head =
    uiLang === 'en'
      ? 'Refine this Mermaid source.'
      : uiLang === 'ko'
        ? '다음 Mermaid 소스를 다듬습니다.'
        : '请根据系统规则处理以下 Mermaid 源码。';
  const note = userNote
    ? (uiLang === 'en' ? 'User instructions:\n' : uiLang === 'ko' ? '사용자 요구:\n' : '用户说明:\n') + userNote + '\n\n'
    : '';
  return `${head}\n\n${note}---\n\n${code}`;
}

/** repair 模式：把 Mermaid 抛出的解析/渲染错误与用户说明、源码一并交给模型 */
function twMermaidRepairUserPayload(code, userNote, uiLang, mermaidError) {
  const raw = typeof mermaidError === 'string' ? mermaidError.trim() : '';
  const truncated = raw.length > 2000 ? `${raw.slice(0, 2000)}…` : raw;
  let errBlock = '';
  if (truncated) {
    errBlock =
      uiLang === 'en'
        ? `Reported Mermaid parse/render error — fix the source code so this error disappears:\n${truncated}\n\n`
        : uiLang === 'ko'
          ? `Mermaid 렌더 오류(아래 오류가 나지 않도록 소스 수정):\n${truncated}\n\n`
          : `Mermaid 解析/渲染报错如下，请修正源码直至不再出现该错误：\n${truncated}\n\n`;
  }
  return errBlock + twMermaidRefineUserPayload(code, userNote, uiLang);
}

function twMermaidRepairSystemPrompt(uiLang) {
  if (uiLang === 'en') {
    return (
      'You are a Mermaid repair assistant.\n'
      + 'When the user message includes a reported parse/render error, eliminate that error first.\n'
      + 'Fix syntax/style conflicts only, while preserving business meaning.\n'
      + 'Hard constraints:\n'
      + '- Keep node IDs, subgraph hierarchy, edge directions, and business entities unchanged.\n'
      + '- Keep existing %%{init}%%, classDef, class, and linkStyle blocks unless they are syntactically broken.\n'
      + '- Output Mermaid source only (no markdown fence).'
    );
  }
  if (uiLang === 'ko') {
    return (
      '당신은 Mermaid 문법 복구 도우미입니다.\n'
      + '사용자 메시지에 렌더 오류가 있으면 그 오류를 우선 해결하세요.\n'
      + '문법/스타일 충돌만 수정하고 업무 의미는 유지하세요.\n'
      + '제약: 노드 ID·서브그래프·방향·업무 엔티티 유지, %%{init}%%/classDef/class/linkStyle 보존(깨진 경우만 최소 수정), Mermaid 코드만 출력.'
    );
  }
  return (
    '你是 Mermaid 修复助手。\n'
    + '若用户消息中包含解析或渲染报错，请优先消除该报错。\n'
    + '仅修复语法与样式冲突，不改变业务含义。\n'
    + '硬约束：保持节点 ID、子图层级、连线方向、业务实体不变；保留 %%{init}%%、classDef、class、linkStyle（仅在语法损坏时最小改动）；仅输出 Mermaid 源码。'
  );
}

function twMermaidTranslateSystemPrompt(uiLang, targetLang) {
  const target = targetLang === 'ko' ? 'Korean' : targetLang === 'ja' ? 'Japanese' : 'English';
  if (uiLang === 'en') {
    return (
      `Translate Mermaid human-readable text into ${target}.\n`
      + 'Translate only labels/comments natural language; do not change node IDs, arrows, subgraph structure, classDef/class/linkStyle/init blocks.\n'
      + 'Keep line breaks and ordering as much as possible. Output Mermaid source only.'
    );
  }
  if (uiLang === 'ko') {
    return (
      `Mermaid 내부 자연어 텍스트만 ${target}로 번역하세요.\n`
      + '노드 ID, 화살표, subgraph 구조, classDef/class/linkStyle/init 블록은 변경 금지.\n'
      + '줄 순서·형식 유지. Mermaid 코드만 출력.'
    );
  }
  return (
    `将 Mermaid 中可读文本翻译为${target}。\n`
    + '只翻译节点标签/注释中的自然语言；严禁修改节点 ID、箭头、subgraph 结构、classDef/class/linkStyle/init 配置。\n'
    + '尽量保持原始行序和格式，只输出 Mermaid 源码。'
  );
}

/** 仅允许经扩展发起的百炼 / DashScope OpenAI 兼容域名（防滥用代理） */
function twAllowedDashScopeHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  const ok = new Set([
    'dashscope.aliyuncs.com',
    'dashscope-intl.aliyuncs.com',
    'dashscope-us.aliyuncs.com',
    'cn-hongkong.dashscope.aliyuncs.com',
    'coding.dashscope.aliyuncs.com',
  ]);
  return ok.has(h);
}

/**
 * 将 DashScope SSE 从 Background 流式转发到内容脚本（ReadableStream 在页面侧组装）。
 * Port name: tw-dashscope-sse
 */
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'tw-dashscope-sse') return;

  let aborted = false;
  port.onDisconnect.addListener(() => {
    aborted = true;
  });

  port.onMessage.addListener(async (msg) => {
    if (msg?.type !== 'start' || typeof msg.url !== 'string' || !msg.headers) return;

    let u;
    try {
      u = new URL(msg.url);
    } catch {
      port.postMessage({ type: 'error', body: 'Invalid URL' });
      return;
    }
    if (!twAllowedDashScopeHost(u.hostname)) {
      port.postMessage({ type: 'error', body: 'Host not allowed' });
      return;
    }

    try {
      const res = await fetch(msg.url, {
        method: 'POST',
        headers: msg.headers,
        body: msg.body ?? '',
      });

      if (!res.ok) {
        const t = await res.text().catch(() => '');
        port.postMessage({ type: 'httpError', status: res.status, body: t });
        return;
      }

      if (!res.body) {
        port.postMessage({ type: 'end' });
        return;
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let sseBuf = '';
      while (!aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value && value.byteLength) {
          sseBuf += dec.decode(value, { stream: true });
          const parts = sseBuf.split('\n');
          sseBuf = parts.pop() ?? '';
          for (const line of parts) {
            if (line.length) port.postMessage({ type: 'chunk', text: `${line}\n` });
          }
        }
      }
      sseBuf += dec.decode();
      if (sseBuf.length && !aborted) {
        port.postMessage({ type: 'chunk', text: sseBuf.endsWith('\n') ? sseBuf : `${sseBuf}\n` });
      }
      port.postMessage({ type: 'end' });
    } catch (e) {
      port.postMessage({ type: 'error', body: String(e?.message || e) });
    }
  });
});

async function injectTalkwebSour(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: TW_AI_SCRIPTS });
  await chrome.scripting.executeScript({ target: { tabId }, files: TW_CONTENT });
}

function twEnsureSidePanelBehavior() {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  }
}

/**
 * 收起本扩展的 Chrome 侧栏，便于只显示页面上的快速模式（需 Chrome 141+，旧版静默跳过）。
 */
async function tryCloseExtensionSidePanelForWindow(windowId) {
  if (windowId == null || typeof chrome.sidePanel?.close !== 'function') return;
  try {
    await chrome.sidePanel.close({ windowId });
  } catch (_) {
    /* 侧栏未打开或浏览器不支持 close */
  }
}

/** 在当前窗口打开扩展侧栏（主界面） */
async function openSidePanelForTab(tabId) {
  try {
    await chrome.sidePanel.open({ tabId });
    return;
  } catch (_) {}
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab?.windowId != null) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    }
  } catch (e) {
    console.warn('TalkwebSour: sidePanel.open failed', e);
  }
}

async function isExtensionEnabled() {
  const r = await chrome.storage.local.get(['tw_enabled']);
  return r.tw_enabled !== false;
}

/**
 * @returns {{ ok: boolean, freshInject?: boolean }}
 */
async function prepareTab(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'TW_PING' });
    return { ok: true, freshInject: false };
  } catch {
    try {
      await injectTalkwebSour(tabId);
      let lastErr;
      for (let a = 0; a < 5; a++) {
        await new Promise((r) => setTimeout(r, 60 + a * 40));
        try {
          await chrome.tabs.sendMessage(tabId, { type: 'TW_PING' });
          return { ok: true, freshInject: true };
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr || new Error('ping failed');
    } catch (err) {
      console.warn('TalkwebSour: inject failed', err?.message || err);
      return { ok: false };
    }
  }
}

async function sendMessageToTabWithRetry(tabId, payload, retries = 14, waitMs = 140) {
  for (let i = 0; i < retries; i++) {
    try {
      await chrome.tabs.sendMessage(tabId, payload);
      return true;
    } catch (_) {
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  return false;
}

async function toggleSidebarOnTab(tabId) {
  const prep = await prepareTab(tabId);
  if (!prep.ok) return false;
  await openSidePanelForTab(tabId);
  return true;
}

async function handleCommandForTab(tabId, command) {
  if (command === 'tw_toggle_sidebar') {
    await toggleSidebarOnTab(tabId);
    return;
  }

  const prep = await prepareTab(tabId);
  if (!prep.ok) return;

  try {
    await chrome.tabs.update(tabId, { active: true });
  } catch (_) {}

  if (command === 'tw_open_palette') {
    const t = await chrome.tabs.get(tabId).catch(() => null);
    if (t?.windowId != null) await tryCloseExtensionSidePanelForWindow(t.windowId);
    await sendMessageToTabWithRetry(tabId, { type: 'TW_OPEN_PALETTE' });
    return;
  }
  const modeMap = {
    tw_ai_rewrite: 'rewrite',
    tw_ai_translate: 'translate',
  };
  const mode = modeMap[command];
  if (mode) {
    await sendMessageToTabWithRetry(tabId, { type: 'TW_AI_TRIGGER', mode });
  }
}

/**
 * 主界面在 Side Panel 时：⚡ 须在用户正在浏览的网页上打开快速模式（fixed 覆盖网页视口）。
 */
async function openPaletteOnActiveBrowserTab() {
  if (!(await isExtensionEnabled())) {
    return { ok: false, error: 'disabled' };
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return { ok: false, error: 'no_tab' };
  }
  const u = tab.url || '';
  if (!/^https?:\/\//i.test(u)) {
    return { ok: false, error: 'not_http_page' };
  }
  const prep = await prepareTab(tab.id);
  if (!prep.ok) {
    return { ok: false, error: 'inject_failed' };
  }
  if (tab.windowId != null) await tryCloseExtensionSidePanelForWindow(tab.windowId);
  try {
    await chrome.tabs.update(tab.id, { active: true });
  } catch (_) {}
  const sent = await sendMessageToTabWithRetry(tab.id, { type: 'TW_OPEN_PALETTE' });
  return { ok: sent, error: sent ? undefined : 'message_failed' };
}

chrome.runtime.onInstalled.addListener(() => {
  createAlarm();
  twEnsureSidePanelBehavior();
  chrome.storage.local.get(['tw_enabled'], (r) => {
    if (r.tw_enabled === undefined) {
      chrome.storage.local.set({ tw_enabled: true });
    }
  });
});

chrome.runtime.onStartup.addListener(() => {
  createAlarm();
  twEnsureSidePanelBehavior();
});

twEnsureSidePanelBehavior();

/** 校验可请求的 http(s) URL（用于 WebDAV PUT / 自定义云 POST，避免异常 scheme） */
function twBackupProxyUrl(urlStr) {
  try {
    const u = new URL(String(urlStr || '').trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href;
  } catch {
    return null;
  }
}

const TW_HISTORY_STORE_KEY = 'tw_quick_chat_sessions_v1';

function twHistoryNormalizeRow(row) {
  if (!row || typeof row !== 'object') return null;
  const id = String(row.id || '').trim();
  if (!id) return null;
  const createdAt = Number(row.createdAt) || Date.now();
  const updatedAt = Number(row.updatedAt) || createdAt;
  const messages = Array.isArray(row.messages)
    ? row.messages.map((m) => ({
        role: m?.role === 'assistant' ? 'assistant' : 'user',
        content: String(m?.content || ''),
        ts: Number(m?.ts) || Date.now(),
      }))
    : [];
  return {
    id,
    source: row.source === 'agency-chat' ? 'agency-chat' : 'snippet',
    snippetId: row.snippetId == null ? null : String(row.snippetId),
    snippetTitle: row.snippetTitle == null ? null : String(row.snippetTitle),
    model: row.model == null ? null : String(row.model),
    agencyEnhance: row.agencyEnhance == null ? null : row.agencyEnhance === true,
    createdAt,
    updatedAt,
    messages,
  };
}

async function twHistoryLoadMap() {
  const bag = await chrome.storage.local.get([TW_HISTORY_STORE_KEY]);
  const raw = bag[TW_HISTORY_STORE_KEY];
  const map = {};
  if (!raw || typeof raw !== 'object') return map;
  Object.values(raw).forEach((row) => {
    const norm = twHistoryNormalizeRow(row);
    if (norm) map[norm.id] = norm;
  });
  return map;
}

async function twHistorySaveMap(map) {
  await chrome.storage.local.set({ [TW_HISTORY_STORE_KEY]: map });
}

async function twHistoryUpsert(sessionId, meta, messages) {
  const map = await twHistoryLoadMap();
  const now = Date.now();
  const id =
    sessionId && map[sessionId]
      ? sessionId
      : `s_${now}_${Math.random().toString(36).slice(2, 10)}`;
  const prev = map[id];
  map[id] = twHistoryNormalizeRow({
    id,
    createdAt: prev?.createdAt || now,
    updatedAt: now,
    source: meta?.source === 'agency-chat' ? 'agency-chat' : 'snippet',
    snippetId: meta?.snippetId ?? null,
    snippetTitle: meta?.snippetTitle ?? null,
    model: meta?.model ?? null,
    agencyEnhance: meta?.agencyEnhance ?? null,
    messages: Array.isArray(messages) ? messages : [],
  });
  await twHistorySaveMap(map);
  return id;
}

async function twHistoryList(limit = 80) {
  const map = await twHistoryLoadMap();
  const lim = Math.max(1, Math.min(500, Number(limit) || 80));
  return Object.values(map)
    .sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0))
    .slice(0, lim);
}

async function twHistoryListBySnippet(snippetId, limit = 5) {
  const id = String(snippetId || '').trim();
  if (!id) return [];
  const rows = await twHistoryList(500);
  const lim = Math.max(1, Math.min(50, Number(limit) || 5));
  return rows.filter((r) => r.snippetId === id).slice(0, lim);
}

async function twHistoryGet(id) {
  const map = await twHistoryLoadMap();
  return map[String(id || '')] || undefined;
}

async function twHistoryDelete(id) {
  const map = await twHistoryLoadMap();
  delete map[String(id || '')];
  await twHistorySaveMap(map);
}

async function twMermaidCallModel({ code, uiLang, userNote, mode, targetLang, mermaidError }) {
  const keys = ['tw_aiApiKey', 'tw_aiApiUrl', 'tw_aiProvider', 'tw_aiModel'];
  const bag = await chrome.storage.local.get(keys);
  const apiKey = String(bag.tw_aiApiKey || '').trim();
  const apiUrl = String(bag.tw_aiApiUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const provider = String(bag.tw_aiProvider || 'openai').toLowerCase();
  const model = String(bag.tw_aiModel || '').trim() || 'gpt-4o-mini';
  if (!apiKey) return { ok: false, error: 'no_api_key' };
  if (provider === 'claude' || provider === 'gemini') {
    return { ok: false, error: 'unsupported_provider', provider };
  }
  if (provider === 'qianwen' && !/compatible-mode/i.test(apiUrl)) {
    return {
      ok: false,
      error: 'qianwen_compatible_url_required',
      message:
        uiLang === 'zh'
          ? 'Mermaid AI 使用 OpenAI 兼容 JSON 接口。请在设置中将千问 Base URL 设为含 compatible-mode/v1 的地址后再试。'
          : uiLang === 'ko'
            ? 'Mermaid AI는 compatible-mode/v1 Base URL이 필요합니다.'
            : 'Set Qwen Base URL to a …/compatible-mode/v1 endpoint for Mermaid AI.',
    };
  }

  const systemPrompt =
    mode === 'translate'
      ? twMermaidTranslateSystemPrompt(uiLang, targetLang)
      : mode === 'repair'
        ? twMermaidRepairSystemPrompt(uiLang)
        : twMermaidRefineSystemPrompt(uiLang);
  const userPayload =
    mode === 'translate'
      ? twMermaidRefineUserPayload(code, `Translate target: ${targetLang || 'en'}\n${userNote || ''}`, uiLang)
      : mode === 'repair'
        ? twMermaidRepairUserPayload(code, userNote || '', uiLang, mermaidError)
        : twMermaidRefineUserPayload(code, userNote || '', uiLang);

  const url = `${apiUrl}/chat/completions`;
  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), 120000);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPayload },
        ],
        temperature: mode === 'repair' ? 0 : 0.2,
        max_tokens: 8192,
        stream: false,
      }),
      signal: ac.signal,
    });
  } finally {
    clearTimeout(tid);
  }
  const rawText = await res.text().catch(() => '');
  if (!res.ok) {
    return {
      ok: false,
      error: 'http',
      status: res.status,
      body: rawText.length > 2000 ? `${rawText.slice(0, 2000)}…` : rawText,
    };
  }
  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    return { ok: false, error: 'bad_json', body: rawText.slice(0, 500) };
  }
  const content =
    data?.choices?.[0]?.message?.content ??
    data?.output?.choices?.[0]?.message?.content ??
    '';
  const out = twStripMermaidFence(content);
  if (!String(out).trim()) return { ok: false, error: 'empty_model_output' };
  return { ok: true, code: out };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'TW_BACKUP_PROXY') return;

  (async () => {
    try {
      const kind = msg.kind;
      const body = typeof msg.body === 'string' ? msg.body : JSON.stringify(msg.body ?? {});
      if (kind !== 'webdav_put' && kind !== 'http_post') {
        sendResponse({ ok: false, error: 'unknown_kind' });
        return;
      }
      const href = twBackupProxyUrl(msg.url);
      if (!href) {
        sendResponse({ ok: false, error: 'bad_url' });
        return;
      }
      const headers = { ...(msg.headers && typeof msg.headers === 'object' ? msg.headers : {}) };
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json; charset=utf-8';
      if (kind === 'webdav_put' && msg.user != null && String(msg.user).length) {
        const u = String(msg.user);
        const p = String(msg.pass ?? '');
        const token = btoa(unescape(encodeURIComponent(`${u}:${p}`)));
        headers.Authorization = `Basic ${token}`;
      }
      if (kind === 'http_post' && msg.token != null && String(msg.token).length) {
        headers.Authorization = `Bearer ${String(msg.token)}`;
      }
      const method = kind === 'webdav_put' ? 'PUT' : 'POST';
      const res = await fetch(href, { method, headers, body });
      const text = await res.text().catch(() => '');
      sendResponse({
        ok: res.ok,
        status: res.status,
        text: text.length > 4000 ? `${text.slice(0, 4000)}…` : text,
      });
    } catch (e) {
      sendResponse({ ok: false, error: String(e?.message || e) });
    }
  })();

  return true;
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'TW_HISTORY_UPSERT') {
    (async () => {
      try {
        const id = await twHistoryUpsert(msg.sessionId || null, msg.meta || {}, msg.messages || []);
        sendResponse({ ok: true, data: id });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }

  if (msg?.type === 'TW_HISTORY_LIST') {
    (async () => {
      try {
        const rows = await twHistoryList(msg.limit);
        sendResponse({ ok: true, data: rows });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }

  if (msg?.type === 'TW_HISTORY_LIST_BY_SNIPPET') {
    (async () => {
      try {
        const rows = await twHistoryListBySnippet(msg.snippetId, msg.limit);
        sendResponse({ ok: true, data: rows });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }

  if (msg?.type === 'TW_HISTORY_GET') {
    (async () => {
      try {
        const row = await twHistoryGet(msg.id);
        sendResponse({ ok: true, data: row });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }

  if (msg?.type === 'TW_HISTORY_DELETE') {
    (async () => {
      try {
        await twHistoryDelete(msg.id);
        sendResponse({ ok: true, data: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }

  if (msg?.type === 'TW_OPEN_SIDE_PANEL') {
    (async () => {
      let tabId = sender.tab?.id ?? msg.tabId;
      if (tabId == null) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        tabId = tab?.id;
      }
      if (tabId != null) await openSidePanelForTab(tabId);
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg?.type === 'TW_OPEN_PALETTE_ON_ACTIVE_TAB') {
    (async () => {
      const r = await openPaletteOnActiveBrowserTab();
      sendResponse(r);
    })();
    return true;
  }

  if (msg?.type === 'TW_OPEN_MERMAID_VIEWER') {
    (async () => {
      try {
        const lang = msg.lang === 'ko' || msg.lang === 'en' ? msg.lang : 'zh';
        const mode =
          msg.mode === 'edit' || msg.mode === 'drag' || msg.mode === 'view' ? msg.mode : 'view';

        let rawKey = typeof msg.key === 'string' ? msg.key.trim() : '';
        if (typeof msg.code === 'string' && msg.code.length) {
          rawKey = `twMv_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
          const payload = { code: msg.code, lang, mode };
          await new Promise((resolve, reject) => {
            if (!chrome.storage?.session?.set) {
              reject(new Error('chrome.storage.session unavailable'));
              return;
            }
            chrome.storage.session.set({ [rawKey]: payload }, () => {
              const err = chrome.runtime.lastError;
              if (err) reject(err);
              else resolve();
            });
          });
        }

        if (!rawKey) {
          sendResponse({ ok: false, error: 'missing_key_or_code' });
          return;
        }

        const url = chrome.runtime.getURL(`mermaid-viewer.html#${encodeURIComponent(rawKey)}`);
        try {
          await chrome.tabs.create({ url, active: true });
        } catch (e1) {
          await chrome.windows.create({
            url,
            type: 'popup',
            state: 'fullscreen',
            focused: true,
          });
        }
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }

  /** Mermaid 独立页：AI 润色/修复 */
  if (msg?.type === 'TW_MERMAID_AI_REFINE') {
    (async () => {
      const uiLang = msg.lang === 'ko' || msg.lang === 'en' ? msg.lang : 'zh';
      try {
        const code = typeof msg.code === 'string' ? msg.code : '';
        const userNote = typeof msg.userNote === 'string' ? msg.userNote.trim() : '';
        const refineMode = msg.refineMode === 'repair' ? 'repair' : 'refine';
        const mermaidError = typeof msg.mermaidError === 'string' ? msg.mermaidError : '';
        if (!code.trim()) {
          sendResponse({ ok: false, error: 'empty_code' });
          return;
        }
        const r = await twMermaidCallModel({
          code,
          uiLang,
          userNote,
          mode: refineMode,
          mermaidError: refineMode === 'repair' ? mermaidError : undefined,
        });
        sendResponse(r);
      } catch (e) {
        const name = e && e.name;
        sendResponse({
          ok: false,
          error: name === 'AbortError' ? 'timeout' : String(e?.message || e),
        });
      }
    })();
    return true;
  }

  /** Mermaid 独立页：结构不变翻译 */
  if (msg?.type === 'TW_MERMAID_AI_TRANSLATE') {
    (async () => {
      const uiLang = msg.lang === 'ko' || msg.lang === 'en' ? msg.lang : 'zh';
      try {
        const code = typeof msg.code === 'string' ? msg.code : '';
        const targetLang = msg.targetLang === 'ko' || msg.targetLang === 'ja' ? msg.targetLang : 'en';
        if (!code.trim()) {
          sendResponse({ ok: false, error: 'empty_code' });
          return;
        }
        const r = await twMermaidCallModel({
          code,
          uiLang,
          userNote: '',
          mode: 'translate',
          targetLang,
        });
        sendResponse(r);
      } catch (e) {
        const name = e && e.name;
        sendResponse({
          ok: false,
          error: name === 'AbortError' ? 'timeout' : String(e?.message || e),
        });
      }
    })();
    return true;
  }

  if (msg?.type !== 'TW_INJECT_TOGGLE') return;

  (async () => {
    if (!(await isExtensionEnabled())) {
      sendResponse({ ok: false, error: 'disabled' });
      return;
    }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      sendResponse({ ok: false, error: 'no_tab' });
      return;
    }
    const ok = await toggleSidebarOnTab(tab.id);
    if (!ok) {
      sendResponse({ ok: false, error: 'inject_failed' });
      return;
    }
    sendResponse({ ok: true });
  })();

  return true;
});

chrome.commands.onCommand.addListener(async (command) => {
  if (!(await isExtensionEnabled())) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  try {
    await handleCommandForTab(tab.id, command);
  } catch (e) {
    console.warn('TalkwebSour: command failed', e);
  }
});
