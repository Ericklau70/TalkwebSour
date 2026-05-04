/**
 * Agency + SuperStar 与用户自定义 Agent：拼接到发往 LLM 的 user 文本外层。
 * 依赖：TW_SUPERSTAR_BUILTIN（tw_superstar_builtin.js）、agency-index.json（fetch）
 */
(function () {
  'use strict';

  /** @type {null | () => object} */
  let _getState = null;

  /** @type {object | null} */
  let _cachedIndex = null;

  /** @type {Record<string, object>} */
  const _bodyCache = {};

  /** @type {Promise<object> | null} */
  let _indexLoading = null;

  function baseUrlAgency() {
    try {
      return chrome.runtime.getURL('src/agency/');
    } catch (_) {
      return '';
    }
  }

  function langKey(st) {
    const l = st?.lang;
    return l === 'en' ? 'en' : l === 'ko' ? 'ko' : 'zh';
  }

  function pickLoc(obj, key) {
    if (!obj || typeof obj !== 'object') return '';
    return String(obj[key] || obj.zh || obj.en || '').trim();
  }

  /**
   * @param {{ prefetch?: boolean }} [opts]
   */
  async function loadIndex(opts) {
    if (_cachedIndex) return _cachedIndex;
    if (_indexLoading) return _indexLoading;
    const root = baseUrlAgency();
    if (!root) return { version: 1, categories: [] };
    _indexLoading = fetch(`${root}agency-index.json`)
      .then((r) => (r.ok ? r.json() : { version: 1, categories: [] }))
      .catch(() => ({ version: 1, categories: [] }))
      .then((j) => {
        _cachedIndex = j;
        _indexLoading = null;
        if (opts?.prefetch && j?.categories?.length) {
          const first = j.categories[0]?.agents?.[0];
          if (first?.bodyUrl) loadBody(first.id, first.bodyUrl).catch(() => {});
        }
        return j;
      });
    return _indexLoading;
  }

  /**
   * @param {string} agentId
   * @param {string} bodyUrl relative e.g. bodies/foo.json
   */
  async function loadBody(agentId, bodyUrl) {
    if (_bodyCache[agentId]) return _bodyCache[agentId];
    const root = baseUrlAgency();
    const url = bodyUrl.startsWith('http') ? bodyUrl : root + bodyUrl.replace(/^\//, '');
    const res = await fetch(url);
    if (!res.ok) throw new Error('body ' + agentId);
    const j = await res.json();
    _bodyCache[agentId] = j;
    return j;
  }

  function truncate(s, max) {
    const t = String(s || '');
    if (t.length <= max) return t;
    return t.slice(0, max) + '\n\n…（已截断以节省上下文）';
  }

  function formatBuiltinCeleb(celeb, key) {
    const pm =
      celeb.personaMarkdown && typeof celeb.personaMarkdown === 'object'
        ? String(pickLoc(celeb.personaMarkdown, key) || pickLoc(celeb.personaMarkdown, 'zh') || '').trim()
        : '';
    if (pm) {
      const header = '【说话风格 · ' + pickLoc(celeb.displayName, key) + '】';
      return header + '\n' + truncate(pm, 14000);
    }
    const lines = [];
    lines.push('【说话风格 · ' + pickLoc(celeb.displayName, key) + '】');
    lines.push(pickLoc(celeb.oneLiner, key));
    if (Array.isArray(celeb.traits) && celeb.traits.length) lines.push('性格关键词：' + celeb.traits.join('、'));
    lines.push(pickLoc(celeb.voiceGuidelines, key));
    const qs = celeb.quotes?.[key] || celeb.quotes?.zh || [];
    if (Array.isArray(qs) && qs.length) lines.push('可参考语气（不必逐句引用）：\n- ' + qs.slice(0, 3).join('\n- '));
    return lines.filter(Boolean).join('\n');
  }

  function formatUserCeleb(u, key) {
    const lines = [];
    lines.push('【自定义说话风格 · ' + String(u.displayName || u.name || '').trim() + '】');
    if (String(u.oneLiner || '').trim()) lines.push(String(u.oneLiner).trim());
    if (Array.isArray(u.traits) && u.traits.length) lines.push('性格关键词：' + u.traits.join('、'));
    if (String(u.voiceGuidelines || '').trim()) lines.push(String(u.voiceGuidelines).trim());
    const qs = u.quotes;
    if (Array.isArray(qs) && qs.length) lines.push('参考短句：\n- ' + qs.slice(0, 3).map(String).join('\n- '));
    return lines.filter(Boolean).join('\n');
  }

  async function formatAgentBlock(sel, key) {
    if (!sel || sel.kind === 'none') return '';
    const maxBody = 10000;
    if (sel.kind === 'user') {
      const list = (_getState && _getState().userAgencyAgents) || [];
      const u = list.find((x) => x.id === sel.id);
      if (!u) return '';
      const header = '【自定义 Agent · ' + String(u.title || 'untitled') + '】\n';
      return header + truncate(String(u.content || ''), maxBody);
    }
    const idx = _cachedIndex || (await loadIndex({}));
    let bodyUrl = sel.bodyUrl;
    let aid = sel.id;
    if (!bodyUrl && aid) {
      outer: for (const c of idx.categories || []) {
        for (const a of c.agents || []) {
          if (a.id === aid) {
            bodyUrl = a.bodyUrl;
            break outer;
          }
        }
      }
    }
    if (!bodyUrl || !aid) return '';
    let data;
    try {
      data = await loadBody(aid, bodyUrl);
    } catch (_) {
      return '';
    }
    const raw = String(data.content || '');
    const fm = data.frontMatter || {};
    const title = fm.name || fm.title || '';
    const header = '【Agency Agent · ' + title + '】\n';
    return header + truncate(raw, maxBody);
  }

  /**
   * 默认任务定义（当用户未填写「任务说明」时）
   */
  function defaultTaskLine(commandId, key) {
    const labels = {
      rewrite: { zh: '润色改写', en: 'Rewrite', ko: '다시 쓰기' },
      shorten: { zh: '精简压缩', en: 'Shorten', ko: '축약' },
      translate: { zh: '翻译', en: 'Translate', ko: '번역' },
      expand: { zh: '扩写补充', en: 'Expand', ko: '확장' },
      bullets: { zh: '转为要点', en: 'Bullet list', ko: '요점 목록' },
      tone_formal: { zh: '正式语气', en: 'Formal tone', ko: '격식체' },
      tone_casual: { zh: '轻松语气', en: 'Casual tone', ko: '캐주얼' },
      proofread: { zh: '校对', en: 'Proofread', ko: '교정' },
    };
    const cmdLabel = labels[commandId]?.[key] || commandId || 'AI';
    if (key === 'en') {
      return '## Task definition\nExecute the palette command 「' + cmdLabel + '」 on the selected text below. Follow any Agent / style blocks above.';
    }
    if (key === 'ko') {
      return '## 작업 정의\n아래 선택 텍스트에 대해 패널 명령 「' + cmdLabel + '」을 수행하세요. 위의 Agent/스타일 블록을 우선합니다.';
    }
    return '## 任务定义\n对下方「选中文本」执行当前 AI 指令「' + cmdLabel + '」。若上方存在 Agent 或说话风格说明，请一并遵守。';
  }

  /**
   * @param {string} selectionText
   * @param {string} commandId
   * @returns {Promise<string>}
   */
  function normalizeCelebForCompose(st, cs) {
    if (!cs || !cs.id) return null;
    if (cs.kind === 'user' || cs.kind === 'builtin') return cs;
    const users = st.userSuperstars || [];
    if (users.some((u) => u.id === cs.id)) return { kind: 'user', id: cs.id };
    const builtin = typeof TW_SUPERSTAR_BUILTIN !== 'undefined' ? TW_SUPERSTAR_BUILTIN : [];
    if (builtin.some((c) => c.id === cs.id)) return { kind: 'builtin', id: cs.id };
    return { kind: 'builtin', id: cs.id };
  }

  function normalizeAgentForCompose(st, ag) {
    if (!ag || !ag.id) return null;
    if (ag.kind === 'user' || ag.kind === 'builtin') return ag;
    const users = st.userAgencyAgents || [];
    if (users.some((u) => u.id === ag.id)) return { kind: 'user', id: ag.id };
    return { kind: 'builtin', id: ag.id, title: ag.title || '' };
  }

  /**
   * 已勾选「拼接增强」时：收集说话风格 + Agent 正文块（不含任务层与选中文本）。
   * @returns {Promise<string[]>}
   */
  async function collectAgencyInjectParts(st, key) {
    const parts = [];
    if (!st || st.agencyEnhanceEnabled !== true) return parts;

    const celebSel = normalizeCelebForCompose(st, st.agencySelectedCeleb);
    if (celebSel && celebSel.kind === 'builtin') {
      const c = (typeof TW_SUPERSTAR_BUILTIN !== 'undefined' ? TW_SUPERSTAR_BUILTIN : []).find((x) => x.id === celebSel.id);
      if (c) parts.push(formatBuiltinCeleb(c, key));
    } else if (celebSel && celebSel.kind === 'user') {
      const list = st.userSuperstars || [];
      const u = list.find((x) => x.id === celebSel.id);
      if (u) parts.push(formatUserCeleb(u, key));
    }

    const agentSel = normalizeAgentForCompose(st, st.agencySelectedAgent);
    if (agentSel && agentSel.kind && agentSel.kind !== 'none') {
      const block = await formatAgentBlock(agentSel, key);
      if (block) parts.push(block);
    }

    return parts;
  }

  function paletteChatModeLine(key) {
    if (key === 'en') {
      return (
        '## Quick-mode AI chat\n' +
        'The blocks above (if any) define the required voice style and/or Agent persona. You MUST embody them in tone, vocabulary, and reasoning. ' +
        'Do not claim you have no preset style or persona when those blocks are present; answer in character.'
      );
    }
    if (key === 'ko') {
      return (
        '## 빠른 모드 AI 대화\n' +
        '위 블록이 말투·Agent 페르소나를 정의합니다. 반드시 반영하세요. 블록이 있는데도「설정 없음」이라고 하지 마세요.'
      );
    }
    return (
      '## 快速模式 · AI 对话\n' +
      '若上方已有「说话风格」和/或「Agent」正文，你必须在语气、用词与思路上始终贯彻这些人设与规则。' +
      '当用户询问你是否带有某明星/某风格时，应基于上述设定如实、一贯地回应，不要回答「没有预设任何明星风格」或否认上述说明。'
    );
  }

  /**
   * 供快速模式「Asking AI」多轮对话：把当前选用的说话风格 + Agent 注入 system（须已勾选拼接增强）。
   * @returns {Promise<string>}
   */
  async function buildAgencyChatAugment() {
    const st = _getState ? _getState() : {};
    const key = langKey(st);
    if (st.agencyPrefetchIndex) await loadIndex({ prefetch: true });
    const parts = await collectAgencyInjectParts(st, key);
    if (!parts.length) return '';
    parts.push(paletteChatModeLine(key));
    return parts.join('\n\n');
  }

  async function wrapSelection(selectionText, commandId) {
    const st = _getState ? _getState() : {};
    const key = langKey(st);

    if (st.agencyPrefetchIndex) await loadIndex({ prefetch: true });

    const parts = await collectAgencyInjectParts(st, key);

    const taskExtra = String(st.agencyTaskContext || '').trim();
    parts.push(taskExtra ? '## 任务定义\n' + taskExtra : defaultTaskLine(commandId, key));

    parts.push('---\n## ' + (key === 'en' ? 'Selected text' : key === 'ko' ? '선택 본문' : '选中文本') + '\n' + String(selectionText || ''));

    return parts.filter(Boolean).join('\n\n');
  }

  function init(getStateFn) {
    _getState = typeof getStateFn === 'function' ? getStateFn : null;
  }

  function invalidateCache() {
    _cachedIndex = null;
    _indexLoading = null;
    Object.keys(_bodyCache).forEach((k) => delete _bodyCache[k]);
  }

  window.TwAgencyCompose = {
    init,
    loadIndex,
    loadBody,
    wrapSelection,
    buildAgencyChatAugment,
    invalidateCache,
    formatBuiltinCeleb,
    pickLoc,
  };
})();
