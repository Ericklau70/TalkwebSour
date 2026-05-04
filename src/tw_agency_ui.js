/**
 * Agency · SuperStar 侧栏弹层 UI（V3.5）
 * 依赖：TwAgencyCompose、TW_SUPERSTAR_BUILTIN、chrome.storage、createAIClient（AI化）
 */
(function () {
  'use strict';

  /** 上游分类目录名 → 界面语言显示（与 agency-index 中 label 小写一致） */
  var AGENCY_CAT_I18N = {
    academic: { zh: '学术', en: 'Academic', ko: '학술' },
    design: { zh: '设计', en: 'Design', ko: '디자인' },
    engineering: { zh: '工程', en: 'Engineering', ko: '엔지니어링' },
    examples: { zh: '示例', en: 'Examples', ko: '예시' },
    finance: { zh: '财务', en: 'Finance', ko: '금융' },
    'game-development': { zh: '游戏开发', en: 'Game development', ko: '게임 개발' },
    integrations: { zh: '集成', en: 'Integrations', ko: '연동' },
    marketing: { zh: '营销', en: 'Marketing', ko: '마케팅' },
    'paid-media': { zh: '付费媒体', en: 'Paid media', ko: '유료 미디어' },
    product: { zh: '产品', en: 'Product', ko: '제품' },
    'project-management': { zh: '项目管理', en: 'Project management', ko: '프로젝트 관리' },
    sales: { zh: '销售', en: 'Sales', ko: '세일즈' },
    'spatial-computing': { zh: '空间计算', en: 'Spatial computing', ko: '공간 컴퓨팅' },
    specialized: { zh: '专项', en: 'Specialized', ko: '특수' },
    strategy: { zh: '战略', en: 'Strategy', ko: '전략' },
    support: { zh: '支持', en: 'Support', ko: '지원' },
    testing: { zh: '测试', en: 'Testing', ko: '테스트' },
  };

  let _root = null;
  let _getState = null;
  let _patchState = null;
  let _getLabels = null;
  let _onNotify = null;
  let _didInit = false;

  /** src/agency/ui-l10n/{lang}.json 缓存 id -> { title, description } */
  let _l10nAgents = null;
  let _l10nLoadedKey = '';

  function $(sel, el) {
    return (el || _root || document).querySelector(sel);
  }

  function langKey() {
    const l = _getState?.()?.lang;
    return l === 'en' ? 'en' : l === 'ko' ? 'ko' : 'zh';
  }

  async function ensureUiL10nLoaded() {
    const k = langKey();
    if (_l10nLoadedKey === k && _l10nAgents != null) return;
    try {
      _l10nLoadedKey = k;
      _l10nAgents = {};
      const url = chrome.runtime.getURL('src/agency/ui-l10n/' + k + '.json');
      const r = await fetch(url);
      if (!r.ok) return;
      try {
        const j = await r.json();
        _l10nAgents = j.agents && typeof j.agents === 'object' ? j.agents : {};
      } catch (_) {
        _l10nAgents = {};
      }
    } catch (_) {
      _l10nAgents = {};
      _l10nLoadedKey = k;
    }
  }

  function pickStarName(c) {
    const k = langKey();
    const d = c.displayName;
    if (typeof d === 'string') return d;
    return (d && d[k]) || d?.zh || d?.en || c.id;
  }

  function labels() {
    return _getLabels?.() || {};
  }

  /** UI 文案短三语（与扩展 lang：非 en/ko 即 zh） */
  function msg3(zh, en, ko) {
    const k = langKey();
    if (k === 'en') return en;
    if (k === 'ko') return ko;
    return zh;
  }

  function agencySearchQuery() {
    return String($('#tw-agency-search')?.value || '').trim().toLowerCase();
  }

  function refreshAgencySearchTargets() {
    const active = _root?.querySelector?.('.tw-agency-tab.active');
    const id = active?.id || '';
    if (id === 'tw-agency-tab-builtin') {
      void renderBuiltinAgents();
    } else if (id === 'tw-agency-tab-voice') {
      renderBuiltinStars();
      renderUserStars();
    } else if (id === 'tw-agency-tab-uagent') {
      renderUserAgents();
    }
  }

  function categoryDisplayLabel(cat) {
    const raw = String(cat.label || cat.id || '').toLowerCase();
    const row = AGENCY_CAT_I18N[raw];
    const k = langKey();
    if (row && row[k]) return row[k];
    return cat.label || cat.id || '';
  }

  function pickAgentTitle(a) {
    if (!a) return '';
    const ov = _l10nAgents && _l10nAgents[a.id];
    if (ov && ov.title) return String(ov.title);
    const k = langKey();
    if (k === 'zh' && a.titleZh) return String(a.titleZh);
    if (k === 'ko' && a.titleKo) return String(a.titleKo);
    return String(a.title || '');
  }

  function pickAgentDesc(a) {
    if (!a) return '';
    const ov = _l10nAgents && _l10nAgents[a.id];
    if (ov && ov.description) return String(ov.description);
    const k = langKey();
    if (k === 'zh' && a.descZh) return String(a.descZh);
    if (k === 'ko' && a.descKo) return String(a.descKo);
    return String(a.description || '');
  }

  function readAgencyState() {
    if (typeof _getState === 'function') {
      try {
        const s = _getState();
        if (s && typeof s === 'object') return s;
      } catch (_) {}
    }
    if (typeof window.__twGetExtensionState === 'function') {
      try {
        const s = window.__twGetExtensionState();
        if (s && typeof s === 'object') return s;
      } catch (_) {}
    }
    return null;
  }

  function normalizeCelebSelection(st, cs) {
    if (!cs || !cs.id) return null;
    if (cs.kind === 'user' || cs.kind === 'builtin') return cs;
    const users = st.userSuperstars || [];
    if (users.some((u) => u.id === cs.id)) return { kind: 'user', id: cs.id };
    if (typeof TW_SUPERSTAR_BUILTIN !== 'undefined' && TW_SUPERSTAR_BUILTIN.some((c) => c.id === cs.id)) {
      return { kind: 'builtin', id: cs.id };
    }
    return { kind: 'builtin', id: cs.id };
  }

  function normalizeAgentSelection(st, ag) {
    if (!ag || !ag.id) return null;
    if (ag.kind === 'user' || ag.kind === 'builtin') return ag;
    const users = st.userAgencyAgents || [];
    if (users.some((u) => u.id === ag.id)) return { kind: 'user', id: ag.id };
    return { kind: 'builtin', id: ag.id, title: ag.title || '' };
  }

  /**
   * @returns {Promise<{ voicePart: string, agentPart: string, skillHint: string, lineBase: string, lineDisplay: string, enhanceEnabled: boolean }>}
   */
  async function computeAgencyStackParts() {
    try {
      await ensureUiL10nLoaded();
      const st = readAgencyState();
      const empty = {
        voicePart: '',
        agentPart: '',
        skillHint: '',
        lineBase: '',
        lineDisplay: '',
        enhanceEnabled: !!(st && st.agencyEnhanceEnabled === true),
        hasStar: false,
        hasAgent: false,
      };
      if (!st) return empty;

      const idx = (await window.TwAgencyCompose?.loadIndex?.({})) || { categories: [] };
      const findAgent = (id) => {
        for (const c of idx.categories || []) {
          for (const x of c.agents || []) if (x.id === id) return x;
        }
        return null;
      };
      const L = labels();
      const plus = L.agencyStackPlus != null ? L.agencyStackPlus : ' + ';
      const cs = normalizeCelebSelection(st, st.agencySelectedCeleb);
      const ag = normalizeAgentSelection(st, st.agencySelectedAgent);
      let voicePart = '';
      if (cs?.kind === 'builtin') {
        const c = TW_SUPERSTAR_BUILTIN?.find((x) => x.id === cs.id);
        voicePart = c ? pickStarName(c) : cs.id;
      } else if (cs?.kind === 'user') {
        const u = (st.userSuperstars || []).find((x) => x.id === cs.id);
        voicePart = u?.displayName || cs.id;
      }
      let agentPart = '';
      let skillHint = '';
      if (ag?.kind === 'user') {
        const u = (st.userAgencyAgents || []).find((x) => x.id === ag.id);
        agentPart = u?.title || ag.id;
        skillHint = String(u?.content || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 88);
      } else if (ag?.kind === 'builtin') {
        const x = findAgent(ag.id);
        agentPart = x ? pickAgentTitle(x) : ag.title || ag.id;
        skillHint = x ? pickAgentDesc(x).replace(/\s+/g, ' ').trim().slice(0, 96) : '';
      }
      const bits = [];
      if (voicePart) bits.push(voicePart);
      if (agentPart) bits.push(agentPart);
      let lineBase = '';
      if (bits.length === 2) lineBase = bits[0] + plus + bits[1];
      else if (bits.length === 1) lineBase = bits[0];
      if (lineBase && skillHint) {
        const short = skillHint.length > 90 ? skillHint.slice(0, 90) + '…' : skillHint;
        const k = langKey();
        lineBase += k === 'zh' ? '（' + short + '）' : ' (' + short + ')';
      }
      const enhanceEnabled = st.agencyEnhanceEnabled === true;
      let lineDisplay = lineBase;
      if (lineBase && !enhanceEnabled) {
        lineDisplay = lineBase + (L.agencyEnhanceInjectSuffix || '');
      }
      return {
        voicePart,
        agentPart,
        skillHint,
        lineBase,
        lineDisplay,
        enhanceEnabled,
        hasStar: !!voicePart,
        hasAgent: !!agentPart,
      };
    } catch (_) {
      const st = readAgencyState();
      return {
        voicePart: '',
        agentPart: '',
        skillHint: '',
        lineBase: '',
        lineDisplay: '',
        enhanceEnabled: !!(st && st.agencyEnhanceEnabled === true),
        hasStar: false,
        hasAgent: false,
      };
    }
  }

  async function refreshAgencyStack() {
    const el = $('#tw-agency-stack');
    if (!el) return;
    const p = await computeAgencyStackParts();
    el.style.display = p.lineBase ? 'block' : 'none';
    el.textContent = p.lineDisplay || '';
  }

  /** 快速模式面板：读取当前风格/Agent 摘要（供 render.js） */
  async function getPaletteStripModel() {
    return computeAgencyStackParts();
  }

  async function runAgencyAiGen() {
    const inp = $('#tw-agency-ai-prompt');
    const raw = String(inp?.value || '').trim();
    const L = labels();
    if (!raw.length) {
      alert(L.agencyAiPromptEmpty || '');
      return;
    }
    const st = _getState?.();
    if (!st || !String(st.aiApiKey || '').trim()) {
      alert(L.agencyAiNeedKey || '');
      return;
    }
    if (typeof window.createAIClient !== 'function') {
      alert(msg3('AI 客户端未加载', 'AI client not loaded', 'AI 클라이언트가 로드되지 않았습니다'));
      return;
    }
    const btn = $('#tw-agency-ai-gen');
    const prev = btn?.textContent;
    if (btn) {
      btn.disabled = true;
      btn.textContent = L.agencyAiBusy || '…';
    }
    try {
      const client = window.createAIClient({
        provider: st.aiProvider || 'openai',
        apiKey: st.aiApiKey,
        apiUrl: st.aiApiUrl || 'https://api.openai.com/v1',
        model: st.aiModel || 'gpt-4o-mini',
      });
      const lk = langKey();
      const sys =
        lk === 'en'
          ? 'You write detailed AI persona markdown for a browser extension, in the style of msitarzewski/agency-agents: optional YAML frontmatter (name, description, emoji), sections for Identity, Communication/Vibe, Stack & tools, Deliverables, Success metrics. Output ONLY Markdown, no JSON wrapper, no fenced code block around the whole file.'
          : lk === 'ko'
            ? 'msitarzewski/agency-agents 스타일의 상세 에이전트 마크다운을 작성합니다. YAML(name, description, emoji), 정체성, 커뮤니케이션, 도구 스택, 산출물, 지표 섹션을 포함합니다. 마크다운만 출력.'
            : '你根据 msitarzewski/agency-agents 仓库中 agent 文件的风格，写一份完整的 Markdown 人设：可含 YAML 前言（name、description、emoji/vibe）；正文包含身份定位、沟通风格（可含电影感独白或江湖口吻）、核心技能栈、交付物要求、成功指标。只输出 Markdown，不要外层 JSON，不要用整体代码围栏。';
      const userMsg =
        lk === 'en'
          ? `Create an agent persona from this user brief:\n${raw}`
          : lk === 'ko'
            ? `사용자 요청:\n${raw}`
            : `请根据以下用户描述生成完整人设 Markdown：\n${raw}`;
      const r = await client.generateFull(
        [
          { role: 'system', content: sys },
          { role: 'user', content: userMsg },
        ],
        { maxTokens: 4096, temperature: 0.65 },
      );
      const md = String(r.text || '').trim();
      if (!md) throw new Error('empty response');
      let displayName = raw.slice(0, 28);
      const hm = md.match(/^#\s+(.+)/m);
      if (hm) displayName = hm[1].replace(/\*+/g, '').replace(/[#]/g, '').trim().slice(0, 36);
      const firstLine =
        md
          .split('\n')
          .map((x) => x.trim())
          .find((x) => x.length > 0 && !x.startsWith('---')) || '';
      const id = genId('ai_star');
      const arr = [...(st.userSuperstars || [])];
      arr.unshift({
        id,
        displayName,
        oneLiner: firstLine.slice(0, 200),
        voiceGuidelines: md,
        traits: [],
        quotes: [],
        createdAt: Date.now(),
      });
      _patchState?.({ userSuperstars: arr, agencySelectedCeleb: { kind: 'user', id }, agencyEnhanceEnabled: true });
      inp.value = '';
      renderUserStars();
      await renderSelectionChips();
      switchTab('voice');
      if (_onNotify) _onNotify(L.agencyAiDoneToast || '');
    } catch (e) {
      alert(String(e?.message || e));
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = prev || labels().agencyAiBtn || 'AI';
      }
    }
  }

  async function openModal() {
    const ov = $('#tw-agency-modal');
    if (!ov) return;
    ov.classList.add('open');
    await renderAll();
    const st0 = _getState?.();
    const pf = st0?.agencyPrefetchIndex;
    const cb = $('#tw-agency-prefetch');
    if (cb) cb.checked = !!pf;
    const enc = $('#tw-agency-enhance-enable');
    if (enc) enc.checked = !!st0?.agencyEnhanceEnabled;
    if (window.TwAgencyCompose?.loadIndex && pf) {
      TwAgencyCompose.loadIndex({ prefetch: true }).catch(() => {});
    }
  }

  function closeModal() {
    const ov = $('#tw-agency-modal');
    if (ov) ov.classList.remove('open');
  }

  async function renderAll() {
    await renderBuiltinAgents();
    renderBuiltinStars();
    renderUserAgents();
    renderUserStars();
    await renderSelectionChips();
    updateHiddenStrip();
    const ta = $('#tw-agency-task');
    if (ta) ta.value = String(_getState?.()?.agencyTaskContext || '');
  }

  function hiddenAgentSet() {
    return new Set((_getState?.()?.agencyHiddenBuiltinAgentIds || []).map(String));
  }
  function hiddenStarSet() {
    return new Set((_getState?.()?.agencyHiddenBuiltinStarIds || []).map(String));
  }

  function updateHiddenStrip() {
    const el = $('#tw-agency-hidden-strip');
    if (!el) return;
    const st = _getState?.() || {};
    const ha = Array.isArray(st.agencyHiddenBuiltinAgentIds) ? st.agencyHiddenBuiltinAgentIds : [];
    const hs = Array.isArray(st.agencyHiddenBuiltinStarIds) ? st.agencyHiddenBuiltinStarIds : [];
    const L = labels();
    if (!ha.length && !hs.length) {
      el.style.display = 'none';
      el.innerHTML = '';
      return;
    }
    el.style.display = 'block';
    const parts = [];
    parts.push(`<span>${escapeHtml(L.agencyHiddenBuiltinBar || '')}</span>`);
    ha.forEach((id) => {
      parts.push(
        `<button type="button" data-restore-hidden-agent="${escapeHtml(String(id))}">${escapeHtml(String(id).slice(0, 14))}${String(id).length > 14 ? '…' : ''} · ${escapeHtml(L.agencyCardRestore || '')}</button>`,
      );
    });
    hs.forEach((id) => {
      parts.push(
        `<button type="button" data-restore-hidden-star="${escapeHtml(String(id))}">${escapeHtml(String(id).slice(0, 14))}${String(id).length > 14 ? '…' : ''} · ${escapeHtml(L.agencyCardRestore || '')}</button>`,
      );
    });
    el.innerHTML = parts.join(' ');
    el.querySelectorAll('[data-restore-hidden-agent]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const id = btn.getAttribute('data-restore-hidden-agent');
        const next = (_getState?.()?.agencyHiddenBuiltinAgentIds || []).filter((x) => String(x) !== String(id));
        _patchState?.({ agencyHiddenBuiltinAgentIds: next });
        void renderBuiltinAgents();
        updateHiddenStrip();
      });
    });
    el.querySelectorAll('[data-restore-hidden-star]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const id = btn.getAttribute('data-restore-hidden-star');
        const next = (_getState?.()?.agencyHiddenBuiltinStarIds || []).filter((x) => String(x) !== String(id));
        _patchState?.({ agencyHiddenBuiltinStarIds: next });
        renderBuiltinStars();
        updateHiddenStrip();
      });
    });
  }

  let _agencyEditCtx = null;

  function closeAgencyEdit() {
    $('#tw-agency-edit-ov')?.classList.remove('open');
    _agencyEditCtx = null;
  }

  function openEditUserAgent(id) {
    const u = (_getState?.()?.userAgencyAgents || []).find((x) => x.id === id);
    if (!u) return;
    const L = labels();
    const mt = $('#tw-agency-edit-mt');
    const inner = $('#tw-agency-edit-inner');
    if (mt) mt.textContent = L.agencyEditUserAgentTitle || '';
    if (inner) {
      inner.innerHTML =
        `<label class="tw-fl">${escapeHtml(L.agencyNewAgentTitle || '')}</label>`
        + `<input type="text" class="tw-fi" id="tw-agency-ed-ua-title" value="${escapeHtml(u.title || '')}" />`
        + `<label class="tw-fl" style="margin-top:10px">${escapeHtml(L.agencyNewAgentBody || '')}</label>`
        + `<textarea class="tw-ft" id="tw-agency-ed-ua-body" style="min-height:140px"></textarea>`;
      const tb = $('#tw-agency-ed-ua-body');
      if (tb) tb.value = String(u.content || '');
    }
    _agencyEditCtx = { kind: 'ua', id };
    $('#tw-agency-edit-ov')?.classList.add('open');
  }

  function openEditUserStar(id) {
    const u = (_getState?.()?.userSuperstars || []).find((x) => x.id === id);
    if (!u) return;
    const L = labels();
    const mt = $('#tw-agency-edit-mt');
    const inner = $('#tw-agency-edit-inner');
    if (mt) mt.textContent = L.agencyEditUserStarTitle || '';
    if (inner) {
      inner.innerHTML =
        `<label class="tw-fl">${escapeHtml(L.agencyNewStarName || '')}</label>`
        + `<input type="text" class="tw-fi" id="tw-agency-ed-us-name" value="${escapeHtml(u.displayName || '')}" />`
        + `<label class="tw-fl" style="margin-top:10px">${escapeHtml(L.agencyNewStarOne || '')}</label>`
        + `<input type="text" class="tw-fi" id="tw-agency-ed-us-one" value="${escapeHtml(u.oneLiner || '')}" />`
        + `<label class="tw-fl" style="margin-top:10px">${escapeHtml(L.agencyNewStarVoice || '')}</label>`
        + `<textarea class="tw-ft" id="tw-agency-ed-us-voice" style="min-height:100px"></textarea>`;
      const tv = $('#tw-agency-ed-us-voice');
      if (tv) tv.value = String(u.voiceGuidelines || '');
    }
    _agencyEditCtx = { kind: 'us', id };
    $('#tw-agency-edit-ov')?.classList.add('open');
  }

  function saveAgencyEdit() {
    const ctx = _agencyEditCtx;
    if (!ctx) return;
    const st = _getState?.() || {};
    if (ctx.kind === 'ua') {
      const title = String($('#tw-agency-ed-ua-title')?.value || '').trim();
      const content = String($('#tw-agency-ed-ua-body')?.value || '').trim();
      if (!title || !content) return;
      const arr = (st.userAgencyAgents || []).map((x) =>
        x.id === ctx.id ? { ...x, title, content } : x,
      );
      _patchState?.({ userAgencyAgents: arr });
      renderUserAgents();
      void renderSelectionChips();
    } else if (ctx.kind === 'us') {
      const displayName = String($('#tw-agency-ed-us-name')?.value || '').trim();
      const oneLiner = String($('#tw-agency-ed-us-one')?.value || '').trim();
      const voiceGuidelines = String($('#tw-agency-ed-us-voice')?.value || '').trim();
      if (!displayName) return;
      const arr = (st.userSuperstars || []).map((x) =>
        x.id === ctx.id ? { ...x, displayName, oneLiner, voiceGuidelines } : x,
      );
      _patchState?.({ userSuperstars: arr });
      renderUserStars();
      void renderSelectionChips();
    }
    closeAgencyEdit();
    if (_onNotify) _onNotify(labels().agencySavedToast || '');
  }

  async function forkBuiltinAgent(agentId) {
    const L = labels();
    const idx = (await window.TwAgencyCompose?.loadIndex?.({})) || { categories: [] };
    let a = null;
    outer: for (const c of idx.categories || []) {
      for (const x of c.agents || []) {
        if (x.id === agentId) {
          a = x;
          break outer;
        }
      }
    }
    if (!a || !a.bodyUrl || !window.TwAgencyCompose?.loadBody) {
      alert(L.agencyEmpty || '—');
      return;
    }
    let text = '';
    try {
      const data = await TwAgencyCompose.loadBody(a.id, a.bodyUrl);
      text = data && typeof data.content === 'string' ? data.content : JSON.stringify(data, null, 2);
    } catch (e) {
      alert(String(e?.message || e));
      return;
    }
    const title = `${pickAgentTitle(a)} (${L.agencyForkSuffix || 'copy'})`;
    const uid = genId('user_agent');
    const arr = [...(_getState?.()?.userAgencyAgents || []), { id: uid, title, content: text, createdAt: Date.now(), forkedFrom: agentId }];
    _patchState?.({ userAgencyAgents: arr });
    switchTab('uagent');
    renderUserAgents();
    if (_onNotify) _onNotify(L.agencyUserAgentSavedToast || '');
  }

  function forkBuiltinStar(starId) {
    const L = labels();
    const c = TW_SUPERSTAR_BUILTIN?.find((x) => x.id === starId);
    if (!c) return;
    const body = builtinStarDetailText(starId);
    const uid = genId('user_ss');
    const displayName = `${pickStarName(c)} (${L.agencyForkSuffix || 'copy'})`;
    const arr = [
      ...(_getState?.()?.userSuperstars || []),
      {
        id: uid,
        displayName,
        oneLiner: '',
        voiceGuidelines: body,
        traits: [],
        quotes: [],
        createdAt: Date.now(),
        forkedFrom: starId,
      },
    ];
    _patchState?.({ userSuperstars: arr });
    switchTab('voice');
    renderUserStars();
    if (_onNotify) _onNotify(L.agencyUserStarSavedToast || '');
  }

  async function renderBuiltinAgents() {
    const host = $('#tw-agency-tree');
    if (!host) return;
    await ensureUiL10nLoaded();
    const idx = (await window.TwAgencyCompose?.loadIndex?.({})) || { categories: [] };
    const q = String($('#tw-agency-search')?.value || '').trim().toLowerCase();
    const hid = hiddenAgentSet();
    let html = '';
    for (const cat of idx.categories || []) {
      const agents = (cat.agents || []).filter((a) => {
        if (hid.has(String(a.id))) return false;
        if (!q) return true;
        const hay = `${pickAgentTitle(a)} ${pickAgentDesc(a)} ${a.title} ${a.titleZh || ''} ${a.description || ''}`
          .toLowerCase();
        return hay.includes(q);
      });
      if (!agents.length) continue;
      const cname = categoryDisplayLabel(cat);
      html += `<div class="tw-agency-cat"><div class="tw-agency-cat-name">${escapeHtml(cname)}</div>`;
      for (const a of agents) {
        const pt = pickAgentTitle(a);
        const pd = pickAgentDesc(a);
        const ptip = escapeHtml(labels().agencyDetailBtnTip || '');
        const L = labels();
        html +=
          `<div class="tw-agency-card agency-agent-row">`
          + `<button type="button" class="tw-agency-card-main" data-agent-builtin="${escapeHtml(a.id)}" data-agent-title="${escapeHtml(pt)}">`
          + `<div class="tw-agency-card-title">${escapeHtml(pt)}</div>`
          + `<div class="tw-agency-card-desc">${escapeHtml(pd.slice(0, 160))}</div></button>`
          + `<div class="tw-agency-card-actions">`
          + `<button type="button" class="tw-agency-icon-btn" data-preview-builtin-agent="${escapeHtml(a.id)}" data-body-url="${escapeHtml(a.bodyUrl || '')}" title="${ptip}">📄</button>`
          + `<button type="button" class="tw-agency-icon-btn" data-fork-builtin-agent="${escapeHtml(a.id)}" title="${escapeHtml(L.agencyCardFork || '')}">⧉</button>`
          + `<button type="button" class="tw-agency-icon-btn danger" data-hide-builtin-agent="${escapeHtml(a.id)}" title="${escapeHtml(L.agencyCardHide || '')}">⌧</button>`
          + `</div></div>`;
      }
      html += '</div>';
    }
    host.innerHTML = html || `<div class="tw-agency-empty">${escapeHtml(labels().agencyEmpty || 'Empty')}</div>`;
    host.querySelectorAll('[data-agent-builtin]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-agent-builtin');
        const title = btn.getAttribute('data-agent-title') || id;
        _patchState?.({ agencySelectedAgent: { kind: 'builtin', id, title }, agencyEnhanceEnabled: true });
        void renderSelectionChips();
      });
    });
  }

  function renderBuiltinStars() {
    const host = $('#tw-agency-stars');
    if (!host || typeof TW_SUPERSTAR_BUILTIN === 'undefined') return;
    const q = agencySearchQuery();
    const hid = hiddenStarSet();
    const list = TW_SUPERSTAR_BUILTIN.filter((c) => !hid.has(String(c.id)));
    let html = '';
    const L = labels();
    for (const c of list) {
      const nm = pickStarName(c);
      const desc = (c.oneLiner?.[langKey()] || c.oneLiner?.zh || '').slice(0, 120);
      const hay = `${nm}${desc}`.toLowerCase();
      if (q && !hay.includes(q)) continue;
      const ptip = escapeHtml(labels().agencyDetailBtnTip || '');
      html +=
        `<div class="tw-agency-card agency-agent-row">`
        + `<button type="button" class="tw-agency-card-main" data-star-builtin="${escapeHtml(c.id)}">`
        + `<div class="tw-agency-card-title">${escapeHtml(nm)}</div>`
        + `<div class="tw-agency-card-desc">${escapeHtml(desc)}</div></button>`
        + `<div class="tw-agency-card-actions">`
        + `<button type="button" class="tw-agency-icon-btn" data-preview-builtin-star="${escapeHtml(c.id)}" title="${ptip}">📄</button>`
        + `<button type="button" class="tw-agency-icon-btn" data-fork-builtin-star="${escapeHtml(c.id)}" title="${escapeHtml(L.agencyCardFork || '')}">⧉</button>`
        + `<button type="button" class="tw-agency-icon-btn danger" data-hide-builtin-star="${escapeHtml(c.id)}" title="${escapeHtml(L.agencyCardHide || '')}">⌧</button>`
        + `</div></div>`;
    }
    if (html) {
      host.innerHTML = html;
    } else if (q && TW_SUPERSTAR_BUILTIN.length) {
      host.innerHTML = `<div class="tw-agency-empty">${escapeHtml(L.agencyVoiceNoMatch || '')}</div>`;
    } else {
      host.innerHTML = '';
    }
    host.querySelectorAll('[data-star-builtin]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-star-builtin');
        _patchState?.({ agencySelectedCeleb: { kind: 'builtin', id }, agencyEnhanceEnabled: true });
        void renderSelectionChips();
      });
    });
  }

  function renderUserAgents() {
    const host = $('#tw-agency-user-agents');
    if (!host) return;
    const q = agencySearchQuery();
    const arr = _getState?.()?.userAgencyAgents || [];
    let html = '';
    const L = labels();
    for (const u of arr) {
      const hay = `${u.title || ''}${u.content || ''}`.toLowerCase();
      if (q && !hay.includes(q)) continue;
      const ptip = escapeHtml(L.agencyDetailBtnTip || '');
      const sum = String(u.content || '').replace(/\s+/g, ' ').trim().slice(0, 140);
      html +=
        `<div class="tw-agency-card">`
        + `<button type="button" class="tw-agency-card-main" data-user-agent="${escapeHtml(u.id)}">`
        + `<div class="tw-agency-card-title">${escapeHtml(u.title || u.id)}</div>`
        + `<div class="tw-agency-card-desc">${escapeHtml(sum)}</div></button>`
        + `<div class="tw-agency-card-actions">`
        + `<button type="button" class="tw-agency-icon-btn" data-preview-user-agent="${escapeHtml(u.id)}" title="${ptip}">📄</button>`
        + `<button type="button" class="tw-agency-icon-btn" data-edit-ua="${escapeHtml(u.id)}" title="${escapeHtml(L.agencyCardEdit || '')}">✎</button>`
        + `<button type="button" class="tw-agency-icon-btn danger" data-del-ua="${escapeHtml(u.id)}" title="${escapeHtml(L.agencyCardDelete || '')}">✕</button>`
        + `</div></div>`;
    }
    if (html) {
      host.innerHTML = html;
    } else if (q && arr.length) {
      host.innerHTML = `<div class="tw-agency-empty">${escapeHtml(L.agencyVoiceNoMatch || '')}</div>`;
    } else {
      host.innerHTML = `<div class="tw-agency-empty">${escapeHtml(L.agencyNoUserAgent || '')}</div>`;
    }
    host.querySelectorAll('[data-user-agent]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-user-agent');
        _patchState?.({ agencySelectedAgent: { kind: 'user', id }, agencyEnhanceEnabled: true });
        void renderSelectionChips();
      });
    });
    host.querySelectorAll('[data-del-ua]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-del-ua');
        const next = (_getState?.()?.userAgencyAgents || []).filter((x) => x.id !== id);
        _patchState?.({ userAgencyAgents: next });
        renderUserAgents();
        void renderSelectionChips();
      });
    });
    host.querySelectorAll('[data-edit-ua]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditUserAgent(btn.getAttribute('data-edit-ua'));
      });
    });
  }

  function renderUserStars() {
    const host = $('#tw-agency-user-stars');
    if (!host) return;
    const q = agencySearchQuery();
    const arr = _getState?.()?.userSuperstars || [];
    let html = '';
    const L = labels();
    for (const u of arr) {
      const hay = `${u.displayName || ''}${u.oneLiner || ''}${u.voiceGuidelines || ''}`.toLowerCase();
      if (q && !hay.includes(q)) continue;
      const ptip = escapeHtml(L.agencyDetailBtnTip || '');
      const sum = String(u.oneLiner || u.voiceGuidelines || '').replace(/\s+/g, ' ').trim().slice(0, 140);
      html +=
        `<div class="tw-agency-card">`
        + `<button type="button" class="tw-agency-card-main" data-user-star="${escapeHtml(u.id)}">`
        + `<div class="tw-agency-card-title">${escapeHtml(u.displayName || u.id)}</div>`
        + `<div class="tw-agency-card-desc">${escapeHtml(sum)}</div></button>`
        + `<div class="tw-agency-card-actions">`
        + `<button type="button" class="tw-agency-icon-btn" data-preview-user-star="${escapeHtml(u.id)}" title="${ptip}">📄</button>`
        + `<button type="button" class="tw-agency-icon-btn" data-edit-us="${escapeHtml(u.id)}" title="${escapeHtml(L.agencyCardEdit || '')}">✎</button>`
        + `<button type="button" class="tw-agency-icon-btn danger" data-del-us="${escapeHtml(u.id)}" title="${escapeHtml(L.agencyCardDelete || '')}">✕</button>`
        + `</div></div>`;
    }
    if (html) {
      host.innerHTML = html;
    } else if (q && arr.length) {
      host.innerHTML = `<div class="tw-agency-empty">${escapeHtml(L.agencyVoiceNoMatch || '')}</div>`;
    } else {
      host.innerHTML = `<div class="tw-agency-empty">${escapeHtml(L.agencyNoUserStar || '')}</div>`;
    }
    host.querySelectorAll('[data-user-star]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-user-star');
        _patchState?.({ agencySelectedCeleb: { kind: 'user', id }, agencyEnhanceEnabled: true });
        void renderSelectionChips();
      });
    });
    host.querySelectorAll('[data-del-us]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-del-us');
        const next = (_getState?.()?.userSuperstars || []).filter((x) => x.id !== id);
        _patchState?.({ userSuperstars: next });
        renderUserStars();
        void renderSelectionChips();
      });
    });
    host.querySelectorAll('[data-edit-us]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditUserStar(btn.getAttribute('data-edit-us'));
      });
    });
  }

  async function renderSelectionChips() {
    await ensureUiL10nLoaded();
    const el = $('#tw-agency-chips');
    if (!el) return;
    const st = _getState?.() || {};
    const parts = [];
    const chipLab = (k) => escapeHtml(labels()[k] || '');
    const cs = st.agencySelectedCeleb;
    if (cs?.kind === 'builtin') {
      const c = TW_SUPERSTAR_BUILTIN?.find((x) => x.id === cs.id);
      parts.push(
        `<span class="tw-agency-chip">${chipLab('agencyChipStar')}${escapeHtml(c ? pickStarName(c) : cs.id)} <button type="button" title="${escapeHtml(labels().agencyChipClearTitle || '')}" data-clear="celeb">✕</button></span>`,
      );
    } else if (cs?.kind === 'user') {
      const u = (st.userSuperstars || []).find((x) => x.id === cs.id);
      parts.push(
        `<span class="tw-agency-chip">${chipLab('agencyChipStar')}${escapeHtml(u?.displayName || cs.id)} <button type="button" title="${escapeHtml(labels().agencyChipClearTitle || '')}" data-clear="celeb">✕</button></span>`,
      );
    }
    const ag = st.agencySelectedAgent;
    if (ag?.kind === 'user') {
      const u = (st.userAgencyAgents || []).find((x) => x.id === ag.id);
      parts.push(
        `<span class="tw-agency-chip">${chipLab('agencyChipAgent')}${escapeHtml(u?.title || ag.id)} <button type="button" title="${escapeHtml(labels().agencyChipClearTitle || '')}" data-clear="agent">✕</button></span>`,
      );
    } else if (ag?.kind === 'builtin') {
      let disp = ag.title || ag.id;
      try {
        const idx = (await window.TwAgencyCompose?.loadIndex?.({})) || { categories: [] };
        outer: for (const c of idx.categories || []) {
          for (const x of c.agents || []) {
            if (x.id === ag.id) {
              disp = pickAgentTitle(x);
              break outer;
            }
          }
        }
      } catch (_) {}
      parts.push(
        `<span class="tw-agency-chip">${chipLab('agencyChipAgent')}${escapeHtml(disp)} <button type="button" title="${escapeHtml(labels().agencyChipClearTitle || '')}" data-clear="agent">✕</button></span>`,
      );
    }
    el.innerHTML = parts.join(' ') || `<span class="tw-agency-empty">${escapeHtml(labels().agencyNoSel || '')}</span>`;
    el.querySelectorAll('[data-clear]').forEach((b) => {
      b.addEventListener('click', () => {
        const k = b.getAttribute('data-clear');
        if (k === 'celeb') _patchState?.({ agencySelectedCeleb: null });
        if (k === 'agent') _patchState?.({ agencySelectedAgent: null });
        void renderSelectionChips();
      });
    });
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function pickLocStr(obj, key) {
    if (!obj || typeof obj !== 'object') return '';
    return String(obj[key] || obj.zh || obj.en || '').trim();
  }

  function builtinStarDetailText(id) {
    const c = TW_SUPERSTAR_BUILTIN?.find((x) => x.id === id);
    if (!c) return '';
    const k = langKey();
    if (c.personaMarkdown && typeof c.personaMarkdown === 'object') {
      const raw = pickLocStr(c.personaMarkdown, k) || pickLocStr(c.personaMarkdown, 'zh');
      if (raw) return raw;
    }
    const bits = [];
    bits.push(pickStarName(c));
    const ol = typeof c.oneLiner === 'object' ? pickLocStr(c.oneLiner, k) : '';
    if (ol) bits.push(ol);
    if (Array.isArray(c.traits) && c.traits.length) bits.push('关键词：' + c.traits.join('、'));
    const vg = typeof c.voiceGuidelines === 'object' ? pickLocStr(c.voiceGuidelines, k) : '';
    if (vg) bits.push(vg);
    const qs = c.quotes?.[k] || c.quotes?.zh || [];
    if (Array.isArray(qs) && qs.length) bits.push(qs.slice(0, 6).join('\n'));
    return bits.filter(Boolean).join('\n\n');
  }

  function openAgencyDetail(title, bodyText) {
    const ov = $('#tw-agency-detail-ov');
    const tt = $('#tw-agency-detail-title');
    const bd = $('#tw-agency-detail-body');
    if (!ov || !bd) return;
    if (tt) tt.textContent = title || labels().agencyDetailModalTitle || '';
    bd.textContent = bodyText === undefined || bodyText === null ? '' : String(bodyText);
    ov.classList.add('open');
  }

  function closeAgencyDetail() {
    $('#tw-agency-detail-ov')?.classList.remove('open');
  }

  async function resolveAgentBodyUrl(aid) {
    const idx = (await window.TwAgencyCompose?.loadIndex?.({})) || { categories: [] };
    for (const c of idx.categories || []) {
      for (const a of c.agents || []) {
        if (a.id === aid) return a.bodyUrl || '';
      }
    }
    return '';
  }

  async function previewBuiltinAgent(agentId, bodyUrlHint, displayTitle) {
    const L = labels();
    const title = displayTitle || agentId;
    openAgencyDetail(title, L.agencyDetailLoading || '…');
    let u = bodyUrlHint || '';
    if (!u) u = await resolveAgentBodyUrl(agentId);
    if (!u || !window.TwAgencyCompose?.loadBody) {
      openAgencyDetail(title, L.agencyEmpty || '—');
      return;
    }
    try {
      const data = await TwAgencyCompose.loadBody(agentId, u);
      const raw = data && typeof data.content === 'string' ? data.content : JSON.stringify(data, null, 2);
      openAgencyDetail(title, raw);
    } catch (e) {
      openAgencyDetail(title, String(e?.message || e));
    }
  }

  async function onAgencyModalDelegatedClick(e) {
    const pb = e.target.closest('[data-preview-builtin-agent]');
    if (pb) {
      e.preventDefault();
      e.stopPropagation();
      const id = pb.getAttribute('data-preview-builtin-agent');
      const url = pb.getAttribute('data-body-url') || '';
      const card = pb.closest('.tw-agency-card');
      const titleEl = card?.querySelector?.('.tw-agency-card-title');
      let t = titleEl ? String(titleEl.textContent || '').trim().slice(0, 96) : id;
      await previewBuiltinAgent(id, url, t);
      return;
    }
    const ps = e.target.closest('[data-preview-builtin-star]');
    if (ps) {
      e.preventDefault();
      e.stopPropagation();
      const sid = ps.getAttribute('data-preview-builtin-star');
      const name = TW_SUPERSTAR_BUILTIN?.find((x) => x.id === sid);
      openAgencyDetail(name ? pickStarName(name) : sid, builtinStarDetailText(sid));
      return;
    }
    const pua = e.target.closest('[data-preview-user-agent]');
    if (pua) {
      e.preventDefault();
      e.stopPropagation();
      const uid = pua.getAttribute('data-preview-user-agent');
      const u = (_getState?.()?.userAgencyAgents || []).find((x) => x.id === uid);
      openAgencyDetail(u?.title || uid, u ? String(u.content || '').trim() : '');
      return;
    }
    const pus = e.target.closest('[data-preview-user-star]');
    if (pus) {
      e.preventDefault();
      e.stopPropagation();
      const uid = pus.getAttribute('data-preview-user-star');
      const u = (_getState?.()?.userSuperstars || []).find((x) => x.id === uid);
      const nl = msg3('名称：', 'Name: ', '이름: ');
      const sl = msg3('摘要：', 'Summary: ', '요약: ');
      const empty = msg3('（空）', '(empty)', '(비어 있음)');
      const body = u
        ? [u.displayName && `${nl}${u.displayName}`, u.oneLiner && `${sl}${u.oneLiner}`, String(u.voiceGuidelines || '').trim()]
            .filter(Boolean)
            .join('\n\n')
        : '';
      openAgencyDetail(u?.displayName || uid, body || empty);
      return;
    }

    const hf = e.target.closest('[data-hide-builtin-agent]');
    if (hf) {
      e.preventDefault();
      e.stopPropagation();
      const id = hf.getAttribute('data-hide-builtin-agent');
      const cur = (_getState?.()?.agencyHiddenBuiltinAgentIds || []).map(String);
      if (!cur.includes(String(id))) cur.push(String(id));
      _patchState?.({ agencyHiddenBuiltinAgentIds: cur });
      void renderBuiltinAgents();
      updateHiddenStrip();
      return;
    }
    const hs = e.target.closest('[data-hide-builtin-star]');
    if (hs) {
      e.preventDefault();
      e.stopPropagation();
      const id = hs.getAttribute('data-hide-builtin-star');
      const cur = (_getState?.()?.agencyHiddenBuiltinStarIds || []).map(String);
      if (!cur.includes(String(id))) cur.push(String(id));
      _patchState?.({ agencyHiddenBuiltinStarIds: cur });
      renderBuiltinStars();
      updateHiddenStrip();
      return;
    }
    const fk = e.target.closest('[data-fork-builtin-agent]');
    if (fk) {
      e.preventDefault();
      e.stopPropagation();
      void forkBuiltinAgent(fk.getAttribute('data-fork-builtin-agent'));
      return;
    }
    const fks = e.target.closest('[data-fork-builtin-star]');
    if (fks) {
      e.preventDefault();
      e.stopPropagation();
      forkBuiltinStar(fks.getAttribute('data-fork-builtin-star'));
      return;
    }
  }

  function genId(prefix) {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function bindFormNewAgent() {
    $('#tw-agency-add-ua')?.addEventListener('click', () => {
      const title = String($('#tw-ua-title')?.value || '').trim();
      const content = String($('#tw-ua-body')?.value || '').trim();
      if (!title || !content) return;
      const id = genId('user_agent');
      const arr = [...(_getState?.()?.userAgencyAgents || []), { id, title, content, createdAt: Date.now() }];
      _patchState?.({ userAgencyAgents: arr });
      $('#tw-ua-title').value = '';
      $('#tw-ua-body').value = '';
      renderUserAgents();
      if (_onNotify) _onNotify(labels().agencyUserAgentSavedToast || '');
    });
  }

  function bindFormNewStar() {
    $('#tw-agency-add-us')?.addEventListener('click', () => {
      const displayName = String($('#tw-us-name')?.value || '').trim();
      const oneLiner = String($('#tw-us-one')?.value || '').trim();
      const voiceGuidelines = String($('#tw-us-voice')?.value || '').trim();
      if (!displayName) return;
      const id = genId('user_ss');
      const arr = [...(_getState?.()?.userSuperstars || []), { id, displayName, oneLiner, voiceGuidelines, traits: [], quotes: [], createdAt: Date.now() }];
      _patchState?.({ userSuperstars: arr });
      $('#tw-us-name').value = '';
      $('#tw-us-one').value = '';
      $('#tw-us-voice').value = '';
      renderUserStars();
      if (_onNotify) _onNotify(labels().agencyUserStarSavedToast || '');
    });
  }

  function init(opts) {
    const force = !!opts?.force;
    if (_didInit && !force) return;
    _didInit = true;
    if (force) {
      _l10nLoadedKey = '';
      _l10nAgents = null;
    }
    _root = opts.root;
    _getState = opts.getState;
    _patchState = opts.patchState;
    _getLabels = typeof opts.getLabels === 'function' ? opts.getLabels : () => ({});
    _onNotify = typeof opts.onNotify === 'function' ? opts.onNotify : null;

    $('#tw-agency-hub-btn')?.addEventListener('click', () => void openModal());
    $('#tw-agency-close')?.addEventListener('click', closeModal);
    $('#tw-agency-done')?.addEventListener('click', () => {
      closeModal();
      const msg = labels().agencySavedToast;
      if (msg && _onNotify) _onNotify(msg);
    });
    $('#tw-agency-clear-sel')?.addEventListener('click', () => {
      _patchState?.({ agencySelectedCeleb: null, agencySelectedAgent: null });
      void renderSelectionChips();
    });
    $('#tw-agency-ai-gen')?.addEventListener('click', () => void runAgencyAiGen());
    $('#tw-agency-modal')?.addEventListener('click', (e) => {
      if (e.target?.id === 'tw-agency-modal') closeModal();
    });
    $('#tw-agency-search')?.addEventListener('input', () => {
      refreshAgencySearchTargets();
    });
    const taskEl = $('#tw-agency-task');
    if (taskEl) {
      const saveTask = () => _patchState?.({ agencyTaskContext: String(taskEl.value || '') });
      taskEl.addEventListener('input', saveTask);
      taskEl.addEventListener('change', saveTask);
    }
    $('#tw-agency-prefetch')?.addEventListener('change', () => {
      const v = !!$('#tw-agency-prefetch').checked;
      _patchState?.({ agencyPrefetchIndex: v });
      if (v && window.TwAgencyCompose?.loadIndex) TwAgencyCompose.loadIndex({ prefetch: true }).catch(() => {});
    });
    $('#tw-agency-enhance-enable')?.addEventListener('change', () => {
      const v = !!$('#tw-agency-enhance-enable').checked;
      _patchState?.({ agencyEnhanceEnabled: v });
      void refreshAgencyStack();
    });
    $('#tw-agency-modal')?.addEventListener('click', (e) => {
      void onAgencyModalDelegatedClick(e);
    });
    $('#tw-agency-detail-ov')?.addEventListener('click', (e) => {
      if (e.target?.id === 'tw-agency-detail-ov') closeAgencyDetail();
    });
    $('#tw-agency-detail-close')?.addEventListener('click', () => closeAgencyDetail());
    $('#tw-agency-edit-cancel')?.addEventListener('click', () => closeAgencyEdit());
    $('#tw-agency-edit-save')?.addEventListener('click', () => saveAgencyEdit());
    $('#tw-agency-edit-ov')?.addEventListener('click', (e) => {
      if (e.target?.id === 'tw-agency-edit-ov') closeAgencyEdit();
    });
    $('#tw-agency-tab-builtin')?.addEventListener('click', () => switchTab('builtin'));
    $('#tw-agency-tab-voice')?.addEventListener('click', () => switchTab('voice'));
    $('#tw-agency-tab-uagent')?.addEventListener('click', () => switchTab('uagent'));

    bindFormNewAgent();
    bindFormNewStar();
    {
      const e0 = $('#tw-agency-enhance-enable');
      if (e0) e0.checked = !!_getState?.()?.agencyEnhanceEnabled;
    }
  }

  function switchTab(name) {
    const tabs = ['builtin', 'voice', 'uagent'];
    for (const t of tabs) {
      const p = $('#tw-agency-panel-' + t);
      const btn = $('#tw-agency-tab-' + t);
      const on = t === name;
      if (p) p.style.display = on ? 'block' : 'none';
      if (btn) btn.classList.toggle('active', on);
    }
    if (name === 'builtin') void renderBuiltinAgents();
    if (name === 'voice') {
      renderBuiltinStars();
      renderUserStars();
    }
    if (name === 'uagent') renderUserAgents();
    updateHiddenStrip();
  }

  window.TwAgencyUI = { init, openModal, closeModal, renderAll, refreshStack: refreshAgencyStack, getPaletteStripModel };
})();
