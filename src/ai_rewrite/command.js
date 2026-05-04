// ─────────────────────────────────────────────────────────────
//  TalkwebSour · AI Rewrite · Layer 2: Command
//  职责：
//    - 定义所有 slash command（id / label / system prompt）
//    - 根据 command + 文本组装 messages
//    - 委托 createAIClient 执行流式 AI 调用（多 provider 统一接口）
//    - 管理「原文备份」以支持 undo / diff
//  对外接口：TwCommandLayer.getCommands() / .execute() / .backup() ...
//  对内依赖：ai_client.js（window.createAIClient）
// ─────────────────────────────────────────────────────────────

const TwCommandLayer = (() => {
  'use strict';

  /** 与扩展界面语言一致：生成结果全文使用该语言（翻译指令除外） */
  function _strictUiOutputSuffix(lang) {
    if (lang === 'ko') {
      return ' 최종 출력은 반드시 한국어로만 작성하고(필요 시 다른 언어에서 번역), 중국어·영어 등을 본문에 섞지 마세요(고유명사·코드·URL 등은 예외).';
    }
    if (lang === 'en') {
      return ' The entire output must be in English only (translate if needed); do not mix Chinese, Korean, or other languages in the body (proper nouns, code, URLs excepted).';
    }
    return ' 最终输出全文必须为简体中文（必要时从其他语言译入），正文中不要混杂英文、韩文等（必要的专有名词、代码、URL 等可保留）。';
  }

  // ── Slash Command 定义表 ──────────────────────────────────────
  // 新增指令：在此数组末尾追加即可，无需改其他代码
  const COMMANDS = [
    {
      id: 'rewrite',
      icon: '✍️',
      label: { zh: '润色重写', en: 'Rewrite', ko: '다시쓰기' },
      description: { zh: '保持原意，优化表达', en: 'Improve clarity & style', ko: '원문 의도 유지, 표현 개선' },
      buildSystemPrompt(lang) {
        if (lang === 'ko') {
          return '전문 작가로서 원문의 의도를 유지하면서 더 명확하고 전문적으로 다시 씁니다. 결과물만 출력하세요.'
            + _strictUiOutputSuffix(lang);
        }
        if (lang === 'en') {
          return 'You are a professional writer. Rewrite the text to be clearer and more professional while preserving the original intent. Return only the rewritten text.'
            + _strictUiOutputSuffix(lang);
        }
        return '你是专业文案改写专家。保持原意，优化表达，使文字更清晰、流畅、专业。直接输出改写结果，不加任何解释。'
          + _strictUiOutputSuffix(lang);
      },
      buildUserPrompt(text) { return text; },
    },
    {
      id: 'shorten',
      icon: '✂️',
      label: { zh: '精简压缩', en: 'Shorten', ko: '요약 압축' },
      description: { zh: '压缩至原来一半，保留核心', en: 'Cut to half, keep core info', ko: '절반 이하로 요약, 핵심 유지' },
      buildSystemPrompt(lang) {
        if (lang === 'ko') {
          return '텍스트를 절반 이하로 압축하되 핵심 정보를 유지하세요. 결과물만 출력하세요.' + _strictUiOutputSuffix(lang);
        }
        if (lang === 'en') {
          return 'Shorten the text to less than half its original length while retaining all key information. Return only the shortened text.'
            + _strictUiOutputSuffix(lang);
        }
        return '将文字压缩到原来的一半以内，保留所有核心信息，删除冗余表达。直接输出结果，不加解释。' + _strictUiOutputSuffix(lang);
      },
      buildUserPrompt(text) { return text; },
    },
    {
      id: 'expand',
      icon: '📖',
      label: { zh: '扩写补充', en: 'Expand', ko: '내용 확장' },
      description: { zh: '补充细节、示例和背景', en: 'Add details, examples, context', ko: '세부 내용, 예시, 배경 추가' },
      buildSystemPrompt(lang) {
        if (lang === 'ko') {
          return '텍스트를 더 자세하게 확장하고 예시와 배경을 추가하세요. 결과물만 출력하세요.' + _strictUiOutputSuffix(lang);
        }
        if (lang === 'en') {
          return 'Expand the text with more details, examples, and background context to make it more complete. Return only the expanded text.'
            + _strictUiOutputSuffix(lang);
        }
        return '对以下内容进行扩写，补充细节、具体示例和背景信息，使其更加完整丰富。直接输出结果，不加解释。' + _strictUiOutputSuffix(lang);
      },
      buildUserPrompt(text) { return text; },
    },
    {
      id: 'translate',
      icon: '🌐',
      label: { zh: '翻译', en: 'Translate', ko: '번역' },
      description: { zh: '中↔英互译（自动判断）', en: 'Auto detect & translate', ko: '자동 감지 후 번역' },
      buildSystemPrompt(lang) {
        if (lang === 'ko') return '텍스트가 한국어이면 영어로, 영어이면 한국어로 번역하세요. 번역문만 출력하세요.';
        if (lang === 'en') return 'If the text is in English, translate it to Chinese. Otherwise, translate it to English. Return only the translation.';
        return '如果文字是中文，翻译成英文；如果是英文，翻译成中文；其他语言统一翻译成中文。保持语气和格式，只输出译文。';
      },
      buildUserPrompt(text) { return text; },
    },
    {
      id: 'bullets',
      icon: '📋',
      label: { zh: '转为要点', en: 'To Bullets', ko: '요점 정리' },
      description: { zh: '整理为 Markdown 要点列表', en: 'Convert to Markdown bullet list', ko: 'Markdown 요점 목록으로 변환' },
      buildSystemPrompt(lang) {
        if (lang === 'ko') {
          return '텍스트를 명확한 Markdown 불릿 포인트 목록으로 정리하세요. 목록만 출력하세요.' + _strictUiOutputSuffix(lang);
        }
        if (lang === 'en') {
          return 'Convert the text into a clear, well-structured Markdown bullet-point list. Return only the list.' + _strictUiOutputSuffix(lang);
        }
        return '将以下内容整理为清晰的 Markdown 要点列表（每条以 "- " 开头）。只输出列表，不加标题或解释。' + _strictUiOutputSuffix(lang);
      },
      buildUserPrompt(text) { return text; },
    },
    {
      id: 'tone_formal',
      icon: '🎩',
      label: { zh: '正式语气', en: 'Formal Tone', ko: '격식체' },
      description: { zh: '改写为正式、专业的表达', en: 'Rewrite in formal & professional tone', ko: '격식 있고 전문적인 표현으로 재작성' },
      buildSystemPrompt(lang) {
        if (lang === 'ko') {
          return '텍스트를 격식 있고 전문적인 어조로 다시 작성하세요. 결과물만 출력하세요.' + _strictUiOutputSuffix(lang);
        }
        if (lang === 'en') {
          return 'Rewrite the text in a formal and professional tone. Return only the rewritten text.' + _strictUiOutputSuffix(lang);
        }
        return '将以下文字改写为正式、专业的表达方式，适合商务或学术场景。直接输出结果，不加解释。' + _strictUiOutputSuffix(lang);
      },
      buildUserPrompt(text) { return text; },
    },
    {
      id: 'tone_casual',
      icon: '😊',
      label: { zh: '轻松语气', en: 'Casual Tone', ko: '캐주얼체' },
      description: { zh: '改写为轻松、亲切的表达', en: 'Rewrite in friendly & casual tone', ko: '친근하고 가벼운 어조로 재작성' },
      buildSystemPrompt(lang) {
        if (lang === 'ko') {
          return '텍스트를 친근하고 가벼운 어조로 다시 작성하세요. 결과물만 출력하세요.' + _strictUiOutputSuffix(lang);
        }
        if (lang === 'en') {
          return 'Rewrite the text in a friendly, conversational, and casual tone. Return only the rewritten text.' + _strictUiOutputSuffix(lang);
        }
        return '将以下文字改写为轻松、亲切的表达方式，像朋友间对话一样自然。直接输出结果，不加解释。' + _strictUiOutputSuffix(lang);
      },
      buildUserPrompt(text) { return text; },
    },
    {
      id: 'proofread',
      icon: '🔍',
      label: { zh: '语法校对', en: 'Proofread', ko: '문법 교정' },
      description: { zh: '修正语法、标点和拼写错误', en: 'Fix grammar, punctuation & spelling', ko: '문법, 구두점, 철자 교정' },
      buildSystemPrompt(lang) {
        if (lang === 'ko') {
          return '텍스트의 문법, 구두점, 철자 오류를 교정하세요. 교정된 텍스트만 출력하세요.' + _strictUiOutputSuffix(lang);
        }
        if (lang === 'en') {
          return 'Proofread the text and fix all grammar, punctuation, and spelling errors. Return only the corrected text.'
            + _strictUiOutputSuffix(lang);
        }
        return '校对以下文字，修正所有语法错误、标点问题和错别字，保持原有内容和风格。只输出修正后的文字，不加说明。' + _strictUiOutputSuffix(lang);
      },
      buildUserPrompt(text) { return text; },
    },
  ];

  // ── 原文备份（支持多条并发 undo）────────────────────────────
  // key: snippetId 或 'selection'（页面选中场景）
  const _backupMap = new Map();

  /** 备份原文（仅备份第一次，防止多次 AI 操作覆盖最原始版本） */
  function backup(id, text) {
    if (!_backupMap.has(id)) {
      _backupMap.set(id, text);
    }
  }

  /** 取回原文；如果没有备份则返回 null */
  function restore(id) {
    return _backupMap.get(id) ?? null;
  }

  /** 清除备份（用户采用新文本后调用） */
  function clearBackup(id) {
    _backupMap.delete(id);
  }

  /** 检查某 id 是否存在备份 */
  function hasBackup(id) {
    return _backupMap.has(id);
  }

  // ── Messages 组装 ─────────────────────────────────────────────
  /**
   * 根据 commandId + 文本 + 语言组装 OpenAI-格式的 messages 数组。
   * @param {string} commandId
   * @param {string} text
   * @param {string} [lang='zh']
   * @param {Object} [options={}]
   * @returns {{ role: string, content: string }[]}
   */
  function buildMessages(commandId, text, lang = 'zh', options = {}) {
    const cmd = COMMANDS.find(c => c.id === commandId);
    if (!cmd) throw new Error(`[TwCommandLayer] Unknown command id: "${commandId}"`);
    return [
      { role: 'system', content: cmd.buildSystemPrompt(lang) },
      { role: 'user',   content: cmd.buildUserPrompt(text, options) },
    ];
  }

  // ── 统一执行入口（委托给 createAIClient）──────────────────────
  /**
   * 执行一个 AI 指令，返回流式 AsyncGenerator<string>。
   *
   * @param {string} commandId   指令 id（见 COMMANDS 表）
   * @param {string} text        待处理文本
   * @param {Object} cfg         AI 配置（透传给 createAIClient）
   * @param {string} [cfg.provider]   'openai' | 'gemini' | 'qianwen' | 'deepseek' | 'ollama'
   * @param {string} [cfg.apiKey]
   * @param {string} [cfg.apiUrl]
   * @param {string} [cfg.model]
   * @param {string} [cfg.lang]       'zh' | 'en' | 'ko'
   * @param {number} [cfg.temperature]
   * @param {number} [cfg.maxTokens]
   * @param {Object} [options]        额外参数（传给 buildUserPrompt）
   * @yields {string}  文本 chunk
   */
  async function* execute(commandId, text, cfg = {}, options = {}) {
    if (!text || !text.trim()) {
      throw new Error('[TwCommandLayer] 文本为空，无法执行指令');
    }
    if (!window.createAIClient) {
      throw new Error('[TwCommandLayer] createAIClient 未加载，请检查 ai_client.js 的注入顺序');
    }

    const messages = buildMessages(commandId, text, cfg.lang || 'zh', options);

    const client = createAIClient({
      provider:    cfg.provider    || 'openai',
      apiKey:      cfg.apiKey      || '',
      apiUrl:      cfg.apiUrl      || '',
      model:       cfg.model       || '',
      temperature: cfg.temperature ?? 0.7,
      maxTokens:   cfg.maxTokens   ?? 2000,
    });

    // 直接传 messages 数组，跳过 client 内部的 systemPrompt 注入
    yield* client.generate(messages);
  }

  /**
   * 使用已组装好的 messages（含 system）直接流式调用，用于快速模式内「问 AI」等多轮对话。
   * @param {{ role: string, content: string }[]} messages
   * @param {Object} cfg 同 execute()
   */
  async function* executeMessages(messages, cfg = {}) {
    if (!messages?.length) {
      throw new Error('[TwCommandLayer] messages 为空');
    }
    if (!window.createAIClient) {
      throw new Error('[TwCommandLayer] createAIClient 未加载，请检查 ai_client.js 的注入顺序');
    }
    const client = createAIClient({
      provider:    cfg.provider    || 'openai',
      apiKey:      cfg.apiKey      || '',
      apiUrl:      cfg.apiUrl      || '',
      model:       cfg.model       || '',
      temperature: cfg.temperature ?? 0.7,
      maxTokens:   cfg.maxTokens   ?? 2000,
    });
    yield* client.generate(messages);
  }

  // ── 公开接口 ──────────────────────────────────────────────────
  return {
    /** 返回所有内置指令的完整定义数组 */
    getCommands: () => [...COMMANDS],

    /** 流式执行指令，返回 AsyncGenerator<string chunk> */
    execute,

    /** 直接使用 messages 流式调用（多轮对话等） */
    executeMessages,

    /** Messages 组装（供调试或自定义使用） */
    buildMessages,

    // ── Backup / Undo ─────────────────────────────────────────
    backup,
    restore,
    clearBackup,
    hasBackup,
  };
})();

// 挂载到 window，供其他模块调用
window.TwCommandLayer = TwCommandLayer;
