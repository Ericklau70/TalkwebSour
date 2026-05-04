// ─────────────────────────────────────────────────────────────
//  TalkwebSour · AI Client Layer
//
//  职责：
//    - 统一封装多家 AI provider 的调用差异
//    - 暴露一致的 generate(messages) 流式接口
//    - 内置 provider 注册表，支持用户扩展
//
//  用法：
//    const client = createAIClient({ provider:'openai', apiKey:'sk-...', model:'gpt-4o-mini' });
//    for await (const chunk of client.generate(messages))  console.log(chunk);
//    const result = await client.generateFull(messages);   // { text, usage, elapsed_ms, ... }
//
//    // 切换 provider / 模型
//    client.switchProvider('gemini', { apiKey:'AIza...' });
//    client.switchModel('gemini-1.5-pro');
//
//    // 注册自定义 provider
//    createAIClient.registerProvider({ id:'my-api', name:'My API', ... });
//
//  暴露：window.createAIClient
// ─────────────────────────────────────────────────────────────

(function (global) {
  'use strict';

  // ══════════════════════════════════════════════════════════════
  //  统一错误类
  // ══════════════════════════════════════════════════════════════
  class AIError extends Error {
    constructor(message, { provider, status, body } = {}) {
      super(message);
      this.name     = 'AIError';
      this.provider = provider;
      this.status   = status;
      this.body     = body;
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  SSE 流读取器（所有 provider 共用）
  //
  //  @param {Response}        res           fetch 返回值
  //  @param {Function}        extractChunk  (parsedJson) → string | null
  //  @param {Function}        [onMeta]      (parsedJson) → void  处理 usage 等元信息
  //  @yields {string}  文本 chunk
  // ══════════════════════════════════════════════════════════════
  function* _yieldSseLine(line, extractChunk, onMeta) {
    const raw = String(line || '').trim();
    if (!raw || raw.startsWith(':')) return;
    const data = raw.replace(/^data:\s*/, '');
    if (data === '[DONE]') return;
    try {
      const json  = JSON.parse(data);
      const chunk = extractChunk(json);
      if (chunk) yield chunk;
      if (onMeta) onMeta(json);
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn && data && data.length < 4000) {
        console.warn('[TalkwebSour AI] SSE 行解析跳过', data.slice(0, 200), e?.message || e);
      }
    }
  }

  async function* _sseReader(res, extractChunk, onMeta) {
    const reader  = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let   buf     = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          yield* _yieldSseLine(line, extractChunk, onMeta);
        }
      }
      // 流结束：flush UTF-8 与最后一行缓冲（避免 for-await 永远等不到结束）
      buf += decoder.decode();
      for (const line of buf.split('\n')) {
        yield* _yieldSseLine(line, extractChunk, onMeta);
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  Provider 定义结构（接口约定）
  //
  //  每个 provider 必须实现：
  //    id            string
  //    name          string
  //    icon          string  (emoji 或文字)
  //    defaultApiUrl string
  //    defaultModel  string
  //    models        Model[]
  //    configFields  ConfigField[]  （用于 UI 渲染设置表单）
  //    validate(cfg) → { ok, error? }
  //    stream(messages, cfg) → AsyncGenerator<string>
  //
  //  可选：
  //    extractUsage(lastJson) → { input, output, total } | null
  // ══════════════════════════════════════════════════════════════

  // ── 内置 Provider：OpenAI ─────────────────────────────────────
  const _providerOpenAI = {
    id:   'openai',
    name: 'OpenAI',
    icon: '🤖',
    defaultApiUrl: 'https://api.openai.com/v1',
    defaultModel:  'gpt-4o-mini',

    models: [
      { id: 'gpt-5.2',        name: 'GPT-5.2',        ctx: 256000, desc: '新一代旗舰（以账户可用为准）' },
      { id: 'gpt-5.2-mini',   name: 'GPT-5.2 Mini',   ctx: 256000, desc: '高性价比' },
      { id: 'gpt-5.1',        name: 'GPT-5.1',        ctx: 256000, desc: '均衡旗舰' },
      { id: 'gpt-5',          name: 'GPT-5',          ctx: 256000, desc: '多任务旗舰' },
      { id: 'gpt-5-mini',     name: 'GPT-5 Mini',     ctx: 256000, desc: '快速省成本' },
      { id: 'gpt-5-nano',     name: 'GPT-5 Nano',     ctx: 256000, desc: '高并发轻量' },
      { id: 'gpt-4.1',        name: 'GPT-4.1',        ctx: 1000000, desc: '超长上下文' },
      { id: 'gpt-4o',         name: 'GPT-4o',         ctx: 128000, desc: '旗舰多模态' },
      { id: 'gpt-4o-mini',    name: 'GPT-4o Mini',    ctx: 128000, desc: '快速低成本，推荐' },
      { id: 'gpt-4-turbo',    name: 'GPT-4 Turbo',    ctx: 128000, desc: '强力推理' },
      { id: 'o4-mini',        name: 'o4-mini',        ctx: 200000, desc: '推理·省算力' },
      { id: 'o3',             name: 'o3',             ctx: 200000, desc: '复杂推理' },
      { id: 'o3-mini',        name: 'o3-mini',        ctx: 200000, desc: '推理轻量' },
      { id: 'o1-mini',        name: 'o1-mini',        ctx: 128000, desc: '数理推理' },
      { id: 'gpt-3.5-turbo',  name: 'GPT-3.5 Turbo',  ctx: 16385,  desc: '经济实惠' },
    ],

    configFields: [
      { key: 'apiKey',  label: 'API Key',  type: 'password', placeholder: 'sk-...',                   required: true  },
      { key: 'apiUrl',  label: 'Base URL', type: 'text',     placeholder: 'https://api.openai.com/v1', required: false },
    ],

    validate(cfg) {
      if (!cfg.apiKey?.trim()) return { ok: false, error: 'API Key 不能为空' };
      return { ok: true };
    },

    async *stream(messages, cfg) {
      const url = `${cfg.apiUrl || this.defaultApiUrl}/chat/completions`;

      const res = await fetch(url, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model:          cfg.model       || this.defaultModel,
          messages,
          temperature:    cfg.temperature ?? 0.7,
          max_tokens:     cfg.maxTokens   ?? 2000,
          stream:         true,
          // 在 stream 模式下取回 usage（OpenAI 2024+ 支持）
          stream_options: { include_usage: true },
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new AIError(`OpenAI ${res.status}`, { provider: 'openai', status: res.status, body });
      }

      let _lastJson = null;
      yield* _sseReader(
        res,
        (json) => { _lastJson = json; return json.choices?.[0]?.delta?.content ?? null; },
        null,
      );
      // 将最后一个 json 挂在 generator 对象上，供 generateFull 读取
      this._lastJson = _lastJson;
    },

    extractUsage(json) {
      const u = json?.usage;
      if (!u) return null;
      return { input: u.prompt_tokens, output: u.completion_tokens, total: u.total_tokens };
    },
  };

  // ── 内置 Provider：Google Gemini ──────────────────────────────
  const _providerGemini = {
    id:   'gemini',
    name: 'Google Gemini',
    icon: '✨',
    defaultApiUrl: 'https://generativelanguage.googleapis.com',
    defaultModel:  'gemini-2.0-flash',

    models: [
      { id: 'gemini-2.5-pro',            name: 'Gemini 2.5 Pro',        ctx: 1048576, desc: '最新旗舰·推理增强（以 API 可用为准）' },
      { id: 'gemini-2.5-flash',          name: 'Gemini 2.5 Flash',      ctx: 1048576, desc: '新版高速（以 API 可用为准）' },
      { id: 'gemini-2.5-flash-lite',   name: 'Gemini 2.5 Flash-Lite', ctx: 1048576, desc: '更省成本' },
      { id: 'gemini-2.0-flash',          name: 'Gemini 2.0 Flash',      ctx: 1048576, desc: '稳定高速' },
      { id: 'gemini-2.0-flash-thinking', name: 'Gemini 2.0 Flash Think',ctx: 1048576, desc: '2.0 推理版' },
      { id: 'gemini-1.5-pro',            name: 'Gemini 1.5 Pro',        ctx: 2097152, desc: '超长上下文' },
      { id: 'gemini-1.5-flash',          name: 'Gemini 1.5 Flash',      ctx: 1048576, desc: '快速均衡' },
      { id: 'gemini-1.5-flash-8b',       name: 'Gemini 1.5 Flash-8B',   ctx: 1048576, desc: '轻量极速' },
    ],

    configFields: [
      { key: 'apiKey',  label: 'API Key',  type: 'password', placeholder: 'AIzaSy...', required: true  },
    ],

    validate(cfg) {
      if (!cfg.apiKey?.trim()) return { ok: false, error: 'API Key 不能为空' };
      return { ok: true };
    },

    async *stream(messages, cfg) {
      const model   = cfg.model || this.defaultModel;
      const baseUrl = cfg.apiUrl || this.defaultApiUrl;
      const url     = `${baseUrl}/v1beta/models/${model}:streamGenerateContent?key=${cfg.apiKey}&alt=sse`;

      // OpenAI messages → Gemini contents 格式
      const systemMsg = messages.find(m => m.role === 'system');
      const contents  = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role:  m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
        }));

      const body = {
        contents,
        generationConfig: {
          temperature:     cfg.temperature ?? 0.7,
          maxOutputTokens: cfg.maxTokens   ?? 2000,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
        ...(systemMsg ? { systemInstruction: { parts: [{ text: systemMsg.content }] } } : {}),
      };

      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => '');
        throw new AIError(`Gemini ${res.status}`, { provider: 'gemini', status: res.status, body: err });
      }

      let _lastJson = null;
      yield* _sseReader(
        res,
        (json) => { _lastJson = json; return json.candidates?.[0]?.content?.parts?.[0]?.text ?? null; },
        null,
      );
      this._lastJson = _lastJson;
    },

    extractUsage(json) {
      const m = json?.usageMetadata;
      if (!m) return null;
      return { input: m.promptTokenCount, output: m.candidatesTokenCount, total: m.totalTokenCount };
    },
  };

  /** 百炼 Key：去 BOM/零宽符/误换行；去掉误粘贴的 Bearer 前缀（仍用 Authorization: Bearer 发送） */
  function _normalizeDashScopeKey(k) {
    let s = String(k ?? '').replace(/^\uFEFF/, '');
    s = s.replace(/[\u200B-\u200D\uFEFF]/g, '');
    s = s.split(/\r?\n/)[0].trim();
    if (/^bearer\s+/i.test(s)) s = s.replace(/^bearer\s+/i, '').trim();
    return s;
  }

  function _dashScopeHostAllowed(hostname) {
    const h = String(hostname || '').toLowerCase();
    return new Set([
      'dashscope.aliyuncs.com',
      'dashscope-intl.aliyuncs.com',
      'dashscope-us.aliyuncs.com',
      'cn-hongkong.dashscope.aliyuncs.com',
      'coding.dashscope.aliyuncs.com',
    ]).has(h);
  }

  /**
   * 扩展环境：经 Background 转发 DashScope 流，减少页面上下文 fetch 与鉴权偶发问题。
   */
  function _fetchQianwenViaExtensionBridge(url, headers, body) {
    if (typeof chrome === 'undefined' || !chrome.runtime?.connect) {
      return null;
    }
    let u;
    try {
      u = new URL(url);
    } catch {
      return null;
    }
    if (!_dashScopeHostAllowed(u.hostname)) return null;

    const headerObj =
      headers && typeof headers === 'object' && !(headers instanceof Headers)
        ? { ...headers }
        : Object.fromEntries(new Headers(headers).entries());

    return new Promise((resolve, reject) => {
      let port;
      try {
        port = chrome.runtime.connect({ name: 'tw-dashscope-sse' });
      } catch (e) {
        reject(e);
        return;
      }

      let ctrl;
      const readable = new ReadableStream({
        start(c) {
          ctrl = c;
        },
      });

      let settled = false;

      function onMsg(msg) {
        if (msg.type === 'httpError') {
          if (!settled) {
            settled = true;
            port.onMessage.removeListener(onMsg);
            try {
              port.disconnect();
            } catch (_) {}
            resolve(new Response(msg.body || '', { status: msg.status || 502 }));
          }
          return;
        }
        if (msg.type === 'error') {
          if (!settled) {
            settled = true;
            port.onMessage.removeListener(onMsg);
            try {
              port.disconnect();
            } catch (_) {}
            reject(new Error(msg.body || 'DashScope proxy error'));
          }
          return;
        }
        if (msg.type === 'chunk') {
          if (!settled) {
            settled = true;
            resolve(
              new Response(readable, {
                status: 200,
                headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
              }),
            );
          }
          try {
            ctrl.enqueue(new TextEncoder().encode(msg.text || ''));
          } catch (_) {}
          return;
        }
        if (msg.type === 'end') {
          if (!settled) {
            settled = true;
            resolve(
              new Response(readable, {
                status: 200,
                headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
              }),
            );
          }
          try {
            ctrl.close();
          } catch (_) {}
          port.onMessage.removeListener(onMsg);
          try {
            port.disconnect();
          } catch (_) {}
        }
      }

      port.onMessage.addListener(onMsg);
      port.postMessage({ type: 'start', url, headers: headerObj, body });
    });
  }

  /** 千问：兼容 OpenAI 路径 vs 官方原生 /api/v1（HTTP 与 body 不同，不可混用） */
  function _qianwenIsCompatibleBaseUrl(baseRaw) {
    return /compatible-mode/i.test(String(baseRaw || ''));
  }

  function _qianwenNativeRootFromBase(baseRaw) {
    const s = String(baseRaw || '').replace(/\/+$/, '');
    if (!s) return 'https://dashscope.aliyuncs.com/api/v1';
    if (/\/api\/v1$/i.test(s)) return s;
    try {
      const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
      return `${u.origin}/api/v1`;
    } catch {
      return 'https://dashscope.aliyuncs.com/api/v1';
    }
  }

  // ── 内置 Provider：通义千问（阿里云 DashScope）─────────────────
  const _providerQianwen = {
    id:   'qianwen',
    name: '通义千问 (Qianwen)',
    icon: '🌟',
    // 官方 HTTP 基址（原生）；若填写含 compatible-mode 的地址则走 OpenAI 兼容路径
    defaultApiUrl: 'https://dashscope.aliyuncs.com/api/v1',
    defaultModel:  'qwen3.5-plus',

    models: [
      { id: 'qwen3.6-plus',          name: 'Qwen 3.6 Plus',         ctx: 1048576,  desc: '最新均衡旗舰（百炼/国际地域）' },
      { id: 'qwen3.6-flash',         name: 'Qwen 3.6 Flash',        ctx: 1048576,  desc: '3.6 高速低成本' },
      { id: 'qwen3.5-plus',          name: 'Qwen 3.5 Plus',         ctx: 131072,   desc: '千问3.5 均衡' },
      { id: 'qwen3.5-flash',         name: 'Qwen 3.5 Flash',        ctx: 131072,   desc: '千问3.5 高速' },
      { id: 'qwen3-max',             name: 'Qwen3 Max',             ctx: 32768,    desc: '旗舰推理' },
      { id: 'qwen-max',              name: 'Qwen Max',              ctx: 32768,    desc: '旗舰推理，最强' },
      { id: 'qwen-plus',             name: 'Qwen Plus',             ctx: 131072,   desc: '强力均衡' },
      { id: 'qwen-flash',            name: 'Qwen Flash',            ctx: 131072,   desc: '高速场景' },
      { id: 'qwen-turbo',            name: 'Qwen Turbo',            ctx: 131072,   desc: '极速低成本，推荐' },
      { id: 'qwen-long',             name: 'Qwen Long',             ctx: 10000000, desc: '超长文档处理' },
      { id: 'qwen3-coder-plus',      name: 'Qwen3 Coder Plus',      ctx: 131072,   desc: '代码（商业版）' },
      { id: 'qwen3-coder-flash',     name: 'Qwen3 Coder Flash',     ctx: 131072,   desc: '代码高速' },
      { id: 'qwen2.5-72b-instruct',  name: 'Qwen2.5-72B',          ctx: 131072,   desc: '开源最强版' },
      { id: 'qwen2.5-14b-instruct',  name: 'Qwen2.5-14B',          ctx: 131072,   desc: '中等规模均衡' },
      { id: 'qwen2.5-7b-instruct',   name: 'Qwen2.5-7B',           ctx: 131072,   desc: '轻量开源' },
      { id: 'qwen-math-plus',        name: 'Qwen Math Plus',        ctx: 4096,     desc: '数学推理专用' },
      { id: 'qwen-coder-turbo',      name: 'Qwen Coder Turbo',      ctx: 131072,   desc: '代码生成专用' },
    ],

    configFields: [
      { key: 'apiKey',  label: 'API Key (DashScope)', type: 'password', placeholder: 'sk-...', required: true  },
      { key: 'apiUrl',  label: 'Base URL（可选）',    type: 'text',     placeholder: '默认北京原生 https://…/api/v1；兼容模式填 …/compatible-mode/v1', required: false },
    ],

    validate(cfg) {
      if (!_normalizeDashScopeKey(cfg.apiKey)) return { ok: false, error: 'DashScope API Key 不能为空' };
      return { ok: true };
    },

    async *stream(messages, cfg) {
      const apiKey = _normalizeDashScopeKey(cfg.apiKey);
      const model  = cfg.model || this.defaultModel;
      const baseRaw = (cfg.apiUrl || this.defaultApiUrl || '').replace(/\/+$/, '');
      const compatible = _qianwenIsCompatibleBaseUrl(baseRaw);

      const reqHeaders = {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      };
      let url;
      let reqBody;

      if (compatible) {
        url = `${baseRaw}/chat/completions`;
        reqBody = JSON.stringify({
          model,
          messages,
          temperature: cfg.temperature ?? 0.7,
          max_tokens:  cfg.maxTokens   ?? 2000,
          stream:      true,
        });
      } else {
        const root = _qianwenNativeRootFromBase(baseRaw);
        url = `${root}/services/aigc/text-generation/generation`;
        reqHeaders['X-DashScope-SSE'] = 'enable';
        reqBody = JSON.stringify({
          model,
          input: { messages },
          parameters: {
            temperature:       cfg.temperature ?? 0.7,
            max_tokens:        cfg.maxTokens   ?? 2000,
            result_format:       'message',
            incremental_output:  true,
          },
        });
      }

      const bridged = _fetchQianwenViaExtensionBridge(url, reqHeaders, reqBody);
      let res = bridged ? await bridged.catch(() => null) : null;
      if (!res) {
        res = await fetch(url, {
          method:  'POST',
          headers: reqHeaders,
          body:    reqBody,
        });
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new AIError(`Qianwen ${res.status}`, { provider: 'qianwen', status: res.status, body });
      }

      let _lastJson = null;
      const extractChunk = compatible
        ? (json) => {
            _lastJson = json;
            return json.choices?.[0]?.delta?.content ?? null;
          }
        : (json) => {
            _lastJson = json;
            if (json && json.code != null && json.code !== '' && String(json.code).toLowerCase() !== 'null') {
              const ok = ['Success', 'success', 'OK', 'Ok'];
              if (!ok.includes(json.code)) {
                throw new AIError(`Qianwen ${json.code}: ${json.message || json.msg || ''}`, {
                  provider: 'qianwen',
                  body: JSON.stringify(json).slice(0, 800),
                });
              }
            }
            const ch = json.output?.choices?.[0];
            if (!ch) return null;
            let piece = ch.message?.content;
            if (piece != null && piece !== '') return piece;
            piece = ch.delta?.content;
            if (piece != null && piece !== '') return piece;
            const t = json.output?.text;
            if (t != null && t !== '') return t;
            return null;
          };

      yield* _sseReader(res, extractChunk, null);
      this._lastJson = _lastJson;
    },

    extractUsage(json) {
      const u = json?.usage;
      if (!u) return null;
      if (u.prompt_tokens != null || u.completion_tokens != null) {
        return { input: u.prompt_tokens, output: u.completion_tokens, total: u.total_tokens };
      }
      if (u.input_tokens != null || u.output_tokens != null) {
        return {
          input: u.input_tokens,
          output: u.output_tokens,
          total: u.total_tokens ?? ((u.input_tokens || 0) + (u.output_tokens || 0)),
        };
      }
      return null;
    },
  };

  // ── 内置 Provider：DeepSeek ───────────────────────────────────
  const _providerDeepSeek = {
    id:   'deepseek',
    name: 'DeepSeek',
    icon: '🔥',
    defaultApiUrl: 'https://api.deepseek.com/v1',
    defaultModel:  'deepseek-chat',

    models: [
      { id: 'deepseek-chat',     name: 'DeepSeek Chat (V3)', ctx: 64000,  desc: '通用对话' },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (R1)', ctx: 64000,  desc: '推理增强' },
    ],

    configFields: [
      { key: 'apiKey',  label: 'API Key', type: 'password', placeholder: 'sk-...', required: true  },
    ],

    validate(cfg) {
      if (!cfg.apiKey?.trim()) return { ok: false, error: 'API Key 不能为空' };
      return { ok: true };
    },

    async *stream(messages, cfg) {
      const url = `${cfg.apiUrl || this.defaultApiUrl}/chat/completions`;

      const res = await fetch(url, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model:       cfg.model       || this.defaultModel,
          messages,
          temperature: cfg.temperature ?? 0.7,
          max_tokens:  cfg.maxTokens   ?? 2000,
          stream:      true,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new AIError(`DeepSeek ${res.status}`, { provider: 'deepseek', status: res.status, body });
      }

      let _lastJson = null;
      yield* _sseReader(
        res,
        (json) => { _lastJson = json; return json.choices?.[0]?.delta?.content ?? null; },
        null,
      );
      this._lastJson = _lastJson;
    },

    extractUsage(json) {
      const u = json?.usage;
      if (!u) return null;
      return { input: u.prompt_tokens, output: u.completion_tokens, total: u.total_tokens };
    },
  };

  // ── 内置 Provider：Anthropic Claude ──────────────────────────
  const _providerClaude = {
    id:   'claude',
    name: 'Anthropic Claude',
    icon: '🧠',
    defaultApiUrl: 'https://api.anthropic.com',
    defaultModel:  'claude-3-5-sonnet-latest',

    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4',        ctx: 200000, desc: '最新 Sonnet（以账户可用为准）' },
      { id: 'claude-opus-4-20250514',   name: 'Claude Opus 4',          ctx: 200000, desc: '最强质量' },
      { id: 'claude-3-7-sonnet-latest', name: 'Claude 3.7 Sonnet',      ctx: 200000, desc: '推理增强' },
      { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet',      ctx: 200000, desc: '综合能力强，推荐' },
      { id: 'claude-3-5-haiku-latest',  name: 'Claude 3.5 Haiku',       ctx: 200000, desc: '速度快、成本低' },
      { id: 'claude-3-opus-latest',     name: 'Claude 3 Opus',          ctx: 200000, desc: '高质量输出' },
    ],

    configFields: [
      { key: 'apiKey', label: 'API Key',  type: 'password', placeholder: 'sk-ant-...', required: true  },
      { key: 'apiUrl', label: 'Base URL', type: 'text',     placeholder: 'https://api.anthropic.com', required: false },
    ],

    validate(cfg) {
      if (!cfg.apiKey?.trim()) return { ok: false, error: 'API Key 不能为空' };
      return { ok: true };
    },

    async *stream(messages, cfg) {
      const url = `${cfg.apiUrl || this.defaultApiUrl}/v1/messages`;
      const model = cfg.model || this.defaultModel;
      const systemMsg = messages.find(m => m.role === 'system');
      const anthropicMessages = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: [{ type: 'text', text: String(m.content || '') }],
        }));

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cfg.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: cfg.maxTokens ?? 2000,
          temperature: cfg.temperature ?? 0.7,
          stream: true,
          ...(systemMsg ? { system: systemMsg.content } : {}),
          messages: anthropicMessages,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new AIError(`Claude ${res.status}`, { provider: 'claude', status: res.status, body });
      }

      let _lastJson = null;
      yield* _sseReader(
        res,
        (json) => {
          _lastJson = json;
          if (json?.type === 'content_block_delta') {
            return json.delta?.text ?? null;
          }
          return null;
        },
        null,
      );
      this._lastJson = _lastJson;
    },

    extractUsage(json) {
      const u = json?.usage;
      if (!u) return null;
      return { input: u.input_tokens, output: u.output_tokens, total: (u.input_tokens || 0) + (u.output_tokens || 0) };
    },
  };

  // ── 内置 Provider：Ollama（本地模型）──────────────────────────
  const _providerOllama = {
    id:   'ollama',
    name: 'Ollama (本地)',
    icon: '🦙',
    defaultApiUrl: 'http://localhost:11434/v1',
    defaultModel:  'llama3.2',

    models: [
      { id: 'llama3.3',       name: 'Llama 3.3',       ctx: 128000, desc: 'Meta 新一代' },
      { id: 'llama3.2',       name: 'Llama 3.2',       ctx: 128000, desc: '通用，推荐' },
      { id: 'llama3.1',       name: 'Llama 3.1',       ctx: 128000, desc: '上一代旗舰' },
      { id: 'qwen2.5',        name: 'Qwen 2.5',        ctx: 128000, desc: '中文优化' },
      { id: 'qwen3',          name: 'Qwen 3',          ctx: 128000, desc: 'Qwen3 本地版名（以 ollama pull 为准）' },
      { id: 'mistral',        name: 'Mistral',         ctx: 32000,  desc: '欧洲高效模型' },
      { id: 'deepseek-r1',    name: 'DeepSeek R1',     ctx: 64000,  desc: '推理模型本地版' },
      { id: 'phi4',           name: 'Phi-4',           ctx: 16000,  desc: 'Microsoft 轻量' },
    ],

    configFields: [
      { key: 'apiUrl',  label: 'Ollama 地址', type: 'text', placeholder: 'http://localhost:11434/v1', required: false },
      { key: 'model',   label: '模型名称',    type: 'text', placeholder: 'llama3.2',                 required: false },
    ],

    validate(_cfg) {
      return { ok: true }; // 本地无需 key
    },

    async *stream(messages, cfg) {
      const url = `${cfg.apiUrl || this.defaultApiUrl}/chat/completions`;

      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:       cfg.model       || this.defaultModel,
          messages,
          temperature: cfg.temperature ?? 0.7,
          max_tokens:  cfg.maxTokens   ?? 2000,
          stream:      true,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new AIError(`Ollama ${res.status}`, { provider: 'ollama', status: res.status, body });
      }

      yield* _sseReader(
        res,
        (json) => json.choices?.[0]?.delta?.content ?? null,
        null,
      );
    },

    extractUsage: () => null,
  };

  // ══════════════════════════════════════════════════════════════
  //  全局 Provider 注册表
  // ══════════════════════════════════════════════════════════════
  const _registry = new Map([
    ['openai',   _providerOpenAI],
    ['gemini',   _providerGemini],
    ['qianwen',  _providerQianwen],
    ['deepseek', _providerDeepSeek],
    ['claude',   _providerClaude],
    ['ollama',   _providerOllama],
  ]);

  /** 注册自定义 provider（覆盖同 id 的内置 provider） */
  function registerProvider(def) {
    const required = ['id', 'name', 'defaultModel', 'models', 'validate', 'stream'];
    const missing  = required.filter(k => !def[k]);
    if (missing.length) {
      throw new Error(`[createAIClient] registerProvider 缺少必填字段: ${missing.join(', ')}`);
    }
    _registry.set(def.id, def);
  }

  /** 列出所有已注册的 provider（含自定义）*/
  function listProviders() {
    return [..._registry.values()].map(p => ({
      id:           p.id,
      name:         p.name,
      icon:         p.icon || '🔌',
      defaultApiUrl:p.defaultApiUrl || '',
      defaultModel: p.defaultModel,
      models:       [...(p.models || [])],
      configFields: p.configFields || [],
    }));
  }

  // ══════════════════════════════════════════════════════════════
  //  createAIClient 工厂
  // ══════════════════════════════════════════════════════════════
  /**
   * 创建 AI 客户端实例。
   *
   * @param {Object}  config
   * @param {string}  config.provider      provider id（'openai' | 'gemini' | 'qianwen' | 'deepseek' | 'claude' | 'ollama' | 自定义）
   * @param {string}  [config.apiKey]      API 密钥
   * @param {string}  [config.apiUrl]      自定义接口地址（覆盖默认值）
   * @param {string}  [config.model]       模型 id（覆盖 provider 默认值）
   * @param {number}  [config.temperature] 0~2，默认 0.7
   * @param {number}  [config.maxTokens]   最大输出 token 数，默认 2000
   * @param {string}  [config.systemPrompt]全局 system prompt
   *
   * @returns {AIClient}
   */
  function createAIClient(config = {}) {
    // ── 可变运行时配置（支持切换）────────────────────────────
    let _cfg = {
      provider:     config.provider     || 'openai',
      apiKey:       config.apiKey       || '',
      apiUrl:       config.apiUrl       || '',
      model:        config.model        || '',
      temperature:  config.temperature  ?? 0.7,
      maxTokens:    config.maxTokens    ?? 2000,
      systemPrompt: config.systemPrompt || '',
    };

    function _getProvider() {
      const p = _registry.get(_cfg.provider);
      if (!p) throw new AIError(`未知 provider: "${_cfg.provider}"。请先调用 createAIClient.registerProvider() 注册。`);
      return p;
    }

    function _buildCfg() {
      const p = _getProvider();
      return {
        ..._cfg,
        apiUrl: _cfg.apiUrl || p.defaultApiUrl || '',
        model:  _cfg.model  || p.defaultModel  || '',
      };
    }

    // ── 构建完整 messages（注入全局 systemPrompt）────────────
    function _wrapMessages(messages) {
      if (!_cfg.systemPrompt) return messages;
      // 如果已有 system message，不重复注入
      if (messages[0]?.role === 'system') return messages;
      return [{ role: 'system', content: _cfg.systemPrompt }, ...messages];
    }

    // ── 核心：流式 generate ───────────────────────────────────
    /**
     * 流式调用 AI，返回 AsyncGenerator<string>。
     *
     * @param {string | { role, content }[]} input
     *   - string → 当作 user message，配合 systemPrompt 使用
     *   - 数组   → 直接使用（不再注入全局 systemPrompt）
     * @param {Object} [overrides]  临时覆盖配置（temperature / model 等）
     * @yields {string}  文本 chunk
     */
    async function* generate(input, overrides = {}) {
      const p = _getProvider();

      // 校验配置
      const merged   = { ..._buildCfg(), ...overrides };
      const validity = p.validate(merged);
      if (!validity.ok) throw new AIError(validity.error, { provider: p.id });

      // 规范化 input → messages[]
      const messages = typeof input === 'string'
        ? _wrapMessages([{ role: 'user', content: input }])
        : (Array.isArray(input) ? input : [{ role: 'user', content: String(input) }]);

      yield* p.stream(messages, merged);
    }

    // ── generateFull：收集所有 chunk，返回统一结果对象 ────────
    /**
     * @param {string | { role, content }[]} input
     * @param {Object} [overrides]
     * @returns {Promise<{
     *   text:       string,
     *   provider:   string,
     *   model:      string,
     *   usage:      { input: number, output: number, total: number } | null,
     *   elapsed_ms: number,
     * }>}
     */
    async function generateFull(input, overrides = {}) {
      const t0  = Date.now();
      let   acc = '';

      for await (const chunk of generate(input, overrides)) {
        acc += chunk;
      }

      const p       = _getProvider();
      const merged  = { ..._buildCfg(), ...overrides };
      // 尝试提取最后一次响应的 usage
      const usage   = p.extractUsage?.(p._lastJson) ?? null;

      return {
        text:       acc,
        provider:   _cfg.provider,
        model:      merged.model || p.defaultModel,
        usage,
        elapsed_ms: Date.now() - t0,
      };
    }

    // ── 切换 model（同一 provider 内）────────────────────────
    function switchModel(modelId) {
      const p = _getProvider();
      const m = p.models.find(m => m.id === modelId);
      if (!m) {
        console.warn(`[AIClient] "${modelId}" 不在 ${p.id} 的内置列表中，仍将使用（可能不受支持）`);
      }
      _cfg.model = modelId;
    }

    // ── 切换 provider ─────────────────────────────────────────
    function switchProvider(providerId, newConfig = {}) {
      if (!_registry.has(providerId)) {
        throw new AIError(`未知 provider: "${providerId}"`);
      }
      _cfg = {
        ..._cfg,
        provider: providerId,
        model:    '',   // 重置为新 provider 的默认模型
        ...newConfig,
      };
    }

    // ── 获取当前 provider 的模型列表 ─────────────────────────
    function getModels() {
      return [..._getProvider().models];
    }

    // ── 获取当前 provider 信息 ────────────────────────────────
    function getProviderInfo() {
      const p = _getProvider();
      return {
        id:           p.id,
        name:         p.name,
        icon:         p.icon || '🔌',
        currentModel: _cfg.model || p.defaultModel,
        models:       [...p.models],
        configFields: p.configFields || [],
      };
    }

    // ── 更新配置（部分更新）──────────────────────────────────
    function updateConfig(partial) {
      _cfg = { ..._cfg, ...partial };
    }

    // ── 获取当前完整配置（只读副本）──────────────────────────
    function getConfig() {
      return { ..._cfg };
    }

    // ── 校验当前配置是否合法 ─────────────────────────────────
    function validate() {
      return _getProvider().validate(_buildCfg());
    }

    // ── 公开接口 ──────────────────────────────────────────────
    return {
      generate,
      generateFull,
      switchModel,
      switchProvider,
      updateConfig,
      getConfig,
      getModels,
      getProviderInfo,
      validate,
    };
  }

  // ── 静态方法：注册 & 列表 ─────────────────────────────────────
  createAIClient.registerProvider = registerProvider;
  createAIClient.listProviders    = listProviders;
  createAIClient.AIError          = AIError;

  // ── 暴露 ──────────────────────────────────────────────────────
  global.createAIClient = createAIClient;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = createAIClient;
  }

})(typeof globalThis !== 'undefined' ? globalThis : window);
