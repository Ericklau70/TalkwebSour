// ─────────────────────────────────────────────────────────────
//  TalkwebSour · AI Rewrite · 入口 / 组装层
//
//  职责：
//    - 组装 TwTriggerLayer / TwCommandLayer / TwRenderLayer
//    - 维护运行时状态（当前文本、当前指令、备份 id）
//    - 定义三层之间的回调协议
//    - 将「采用」结果写回来源（输入框 / 剪贴板）
//
//  依赖加载顺序（manifest.json 或 executeScript 须按此顺序）：
//    1. trigger.js   → window.TwTriggerLayer
//    2. command.js   → window.TwCommandLayer
//    3. render.js    → window.TwRenderLayer
//    4. tw_ai_rewrite.js  ← 本文件
//
//  content.js 接入方式（init() 末尾追加）：
//    if (window.TwAiRewrite) TwAiRewrite.init(root, () => state);
// ─────────────────────────────────────────────────────────────

const TwAiRewrite = (() => {
  'use strict';

  // ── 运行时状态 ────────────────────────────────────────────────
  let _root      = null;   // Shadow DOM root（来自 content.js）
  let _getState  = null;   // () => state（访问 content.js 的 state 对象）

  let _pendingText = '';   // 当前待处理文本（来自选区 or 编辑框）
  let _backupId    = '';   // 备份 key（'selection' 或 snippetId）
  let _source      = null; // 来源元素（textarea / contenteditable），用于写回

  // ── 读取 content.js 的 state ──────────────────────────────────
  const _QWEN_DEFAULT_BASE = 'https://dashscope.aliyuncs.com/api/v1';

  function _cfg() {
    const s = _getState?.() || {};
    const provider = s.aiProvider || 'openai';
    let apiUrl = s.aiApiUrl || 'https://api.openai.com/v1';
    // 已选千问但地址仍是其它服务或空，避免误把 Key 发到错误网关导致 401
    if (provider === 'qianwen') {
      const u = String(apiUrl || '').trim();
      const wrong =
        !u ||
        /openai\.com|anthropic\.com|googleapis\.com|deepseek\.com|localhost/i.test(u);
      if (wrong) apiUrl = _QWEN_DEFAULT_BASE;
    }
    return {
      provider,
      apiKey:      s.aiApiKey   || '',
      apiUrl,
      model:       s.aiModel    || 'gpt-4o-mini',
      lang:        s.lang       || 'zh',
      temperature: 0.7,
      maxTokens:   1500,
    };
  }

  /** 与扩展界面语言 zh / en / ko 对齐的短文案 */
  function _uiMsg(lang, zh, en, ko) {
    if (lang === 'en') return en;
    if (lang === 'ko') return ko;
    return zh;
  }

  // ── 工具：快速 toast（复用 content.js 里的 #tw-toast） ────────
  function _toast(msg) {
    const el = _root?.querySelector('#tw-toast');
    if (!el) return;
    const old = el.textContent;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => { el.classList.remove('show'); el.textContent = old; }, 2000);
  }

  /** 未配置 API Key 时引导用户打开侧边栏「设置」 */
  function _needApiKeyMsg(lang) {
    if (lang === 'en') return 'Please configure your API key in Settings first';
    if (lang === 'ko') return '먼저 「설정」에서 API 키를 입력하세요';
    return '请先在「设置」中配置 API 密钥';
  }

  function _needApiKeyToast(lang) {
    if (lang === 'en') return '⚠️ Please configure your API key in Settings first';
    if (lang === 'ko') return '⚠️ 먼저 「설정」에서 API 키를 입력하세요';
    return '⚠️ 请先在「设置」中配置 API 密钥';
  }

  /** 将 AIError / fetch 错误整理成可读的 alert 文案（含 HTTP 状态与接口返回体片段） */
  function _formatAIError(err, cfg) {
    const lang = cfg?.lang || 'zh';
    const head =
      lang === 'en' ? 'AI call failed' :
      lang === 'ko' ? 'AI 호출 실패' : 'AI 调用失败';
    let msg = `${head}：${err?.message || String(err)}`;
    if (err?.status != null) msg += ` [HTTP ${err.status}]`;
    if (err?.body) {
      const b = String(err.body).replace(/\s+/g, ' ').trim().slice(0, 500);
      if (b) msg += `\n\n${b}`;
    }
    if (
      cfg?.provider === 'qianwen' &&
      err?.status === 401 &&
      String(err?.body || '').includes('invalid_api_key')
    ) {
      if (lang === 'zh') {
        msg += '\n\n【千问 401 排查】（通用 sk- Key 优先看地域）\n'
          + '1) 百炼控制台右上角「地域」须与 Base URL 一致：新加坡 Key 必须配新加坡地址（反之亦然）。\n'
          + '2) 在设置里用「千问地域」选对地址并保存，或对照文档：如何通过 OpenAI 接口调用千问。\n'
          + '3) 须为控制台「API-Key」；若启用了 IP 白名单，当前网络须在名单内。\n'
          + '4) 仅 sk-sp- 开头为 Coding Plan 专用 Key，需套餐内 Base URL（与通用 sk- 无关时可忽略本条）。';
      } else if (lang === 'ko') {
        msg += '\n\n[Qwen 401] For sk- keys: match console region to Base URL. sk-sp-* only → Coding Plan URL.';
      } else {
        msg += '\n\n[Qwen 401] For standard sk- keys: match console region to Base URL (e.g. dashscope-intl for Singapore). sk-sp-* only needs Coding Plan base URL.';
      }
    }
    return msg;
  }

  // ─────────────────────────────────────────────────────────────
  //  核心流程：执行一条 AI 指令
  // ─────────────────────────────────────────────────────────────
  async function _runCommand(commandId, text) {
    const cfg = _cfg();

    // 1. 检查 API 配置
    if (!cfg.apiKey) {
      alert(_needApiKeyMsg(cfg.lang));
      return;
    }
    if (!text || !text.trim()) {
      _toast(_uiMsg(cfg.lang, '请先选中文本', 'Please select text first', '먼저 텍스트를 선택하세요'));
      return;
    }

    // 2. 备份原文（仅备份第一次，防止多轮 AI 覆盖原始文本）
    _backupId = _pendingText === text ? 'selection' : `snippet_${Date.now()}`;
    TwCommandLayer.backup(_backupId, text);

    // 3. 找到 command label 用于 Preview 标题
    const cmd   = TwCommandLayer.getCommands().find(c => c.id === commandId);
    const label = (cmd?.label[cfg.lang] || cmd?.label?.en) ?? commandId;

    // 4. 打开 Preview 面板，开始流式渲染
    TwRenderLayer.openPreview(`${cmd?.icon ?? '✨'} ${label}`, cfg.lang);

    let userPayload = text;
    try {
      if (window.TwAgencyCompose && typeof TwAgencyCompose.wrapSelection === 'function') {
        userPayload = await TwAgencyCompose.wrapSelection(text, commandId);
      }
    } catch (wrapErr) {
      console.warn('[TwAiRewrite] TwAgencyCompose.wrapSelection', wrapErr);
    }

    try {
      for await (const chunk of TwCommandLayer.execute(commandId, userPayload, cfg)) {
        TwRenderLayer.appendChunk(chunk);
      }
      TwRenderLayer.finishPreview();

    } catch (err) {
      TwRenderLayer.closePreview();
      console.error('[TwAiRewrite] AI 调用失败', err);
      alert(_formatAIError(err, cfg));
      // 失败时清除备份
      TwCommandLayer.clearBackup(_backupId);
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  写回来源（委托给 insertTextToTarget 统一处理）
  // ─────────────────────────────────────────────────────────────
  function _usableWriteTarget(el) {
    return el && el !== document.body && el !== document.documentElement && el.isConnected;
  }

  /** 写回时旧 _source 可能已被 SPA 移除，依次尝试缓存焦点、当前焦点、页面 composer */
  function _resolveWriteTarget() {
    if (_usableWriteTarget(_source)) return _source;
    const lf = window.TwTriggerLayer?.getLastInputFocus?.();
    if (_usableWriteTarget(lf)) return lf;
    const ae = document.activeElement;
    if (_usableWriteTarget(ae)) return ae;
    return null;
  }

  function _writeBack(newText) {
    const target = _resolveWriteTarget();

    if (window.insertTextToTarget) {
      const method = insertTextToTarget(target, newText, 'replaceSelection');
      if (method === 'clipboard') {
        _toast(_uiMsg(_cfg().lang, '✓ 已复制到剪贴板', '✓ Copied to clipboard', '✓ 클립보드에 복사됨'));
      }
    } else {
      // insertTextToTarget 未加载时降级：直接写剪贴板
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(newText).catch(() => {});
      }
      _toast(_uiMsg(_cfg().lang, '✓ 已复制到剪贴板', '✓ Copied to clipboard', '✓ 클립보드에 복사됨'));
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  提示语片段 → 面板条目（无 API Key 时使用）
  // ─────────────────────────────────────────────────────────────
  function _snippetsToPaletteItems(snippets) {
    const groups = _getState?.()?.groups || [];
    const groupById = new Map((groups || []).map(g => [g.id, g]));
    const sortBy = _getState?.()?.snippetSortByScore !== false;
    const list = sortBy
      ? [...(snippets || [])].sort((a, b) => {
          const ua = Number(a.useCount) || 0;
          const ub = Number(b.useCount) || 0;
          if (ub !== ua) return ub - ua;
          return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
        })
      : [...(snippets || [])];
    return list.map(s => {
      const raw = s.content || '';
      const expanded = window.TwExpandSnippetContent
        ? TwExpandSnippetContent(s.id, raw)
        : raw.replace(/\{\{([^:}]+):[^}]+\}\}/g, '$1');
      const preview = expanded.replace(/\s+/g, ' ').trim().slice(0, 72);
      const gid = s.groupId || '__ungrouped__';
      const g = groupById.get(s.groupId);
      return {
        id:          `snippet:${s.id}`,
        icon:        '📋',
        label:       { zh: s.title || '未命名', en: s.title || 'Untitled', ko: s.title || '제목 없음' },
        description: { zh: preview || '（空内容）', en: preview || '(empty)', ko: preview || '(비어 있음)' },
        groupKey: gid,
        groupLabel: {
          zh: g?.name || '未分组',
          en: g?.name || 'Ungrouped',
          ko: g?.name || '미분류',
        },
        _useCount: Number(s.useCount) || 0,
      };
    });
  }

  function _paletteUiLabels(cfg) {
    const rawLang = String(cfg.lang || 'en').toLowerCase();
    const lang = rawLang === 'zh' ? 'zh' : rawLang === 'ko' ? 'ko' : 'en';
    if (lang === 'zh') {
      return {
        ctxStripLabel: '选中内容',
        footerHint: '快速模式 · ↑↓ 选择 · ↵ 打开 · Esc 关闭',
        recommendHit: '命中关键词',
        recommendWhy: '推荐理由',
        modeToMain: '⇄ 主界面',
        modeToQuick: '⇄ 快速模式',
        modeToMainTip: '关闭快速模式并回到左侧主界面',
        modeToQuickTip: '切换到快速模式（当前为完整主界面时）',
        modeToggleTip: '在快速模式与主界面之间切换',
        shortcutsBtnTip: '常用网页：展开后可修改名称与网址',
        shortcutsDdTitle: '快捷网页',
        shortcutsLabelPh: '显示名称',
        shortcutsUrlPh: 'https:// 网址',
        shortcutsOpen: '打开',
        shortcutsSave: '保存',
        shortcutsSaved: '已保存',
        shortcutsUrlRequired: '网址不能为空',
        shortcutsEmpty: '暂无快捷网页',
        shortcutsRemoveTip: '删除此项',
        listCopyBtn: '复制',
        editorBack: '← 返回',
        editorCopy: '复制',
        editorAskAi: 'Asking AI',
        editorPlaceholder: '脚本内容显示于此；可编辑后复制，或使用 Asking AI 提问。',
        copyAnswer: '复制答案',
        editorAiSectionTitle: 'AI 回答（可多轮）',
        editorAiGenerating: '生成中…',
        toastCopied: '✓ 已复制',
        toastAnswerCopied: '✓ 已复制答案',
        alertCopyFailed: '复制失败，请手动选择内容复制',
        alertCopyAnswerFailed: '复制失败，请手动选择答案文本复制',
        alertCopyFailedShort: '复制失败',
        previewGen: '生成中…',
        previewDone: '完成 ✓',
        previewAccept: '✓ 采用',
        previewDiff: '⇄ 对比',
        previewReject: '✕ 丢弃',
        diffTitle: '⇄ 修改对比',
        diffOldLabel: '原文',
        diffNewLabel: '新文',
        diffAcceptNew: '✓ 采用新文',
        diffKeepOld: '✕ 保留原文',
        diffCloseTip: '关闭',
        countUnit: '条',
        ungroupedLabel: '未分组',
        emptyDefault: '暂无内容',
        noResultsForQuery: '没有匹配「{q}」的内容',
        recommendDescDefault: '可直接用于当前输入场景。',
        recommendFromQuery: '（基于「{q}」）',
        searchPlaceholder: '搜索…',
        paletteAgencyToggle: '拼接增强',
        paletteAgencyClearVoice: '去风格',
        paletteAgencyClearAgent: '去 Agent',
        paletteAgencyOpenHub: '打开 Agency 设置',
        paletteAgencyEmpty: '未选说话风格或 Agent',
        paletteAgencyChatFooterBtn: 'AI 对话',
        paletteAgencyChatStripBtn: 'AI 对话',
        paletteAgencyChatBtnTip: '打开 AI 对话（输入问题，使用 Asking AI 多轮；若已勾选拼接增强，对话会带上当前说话风格与 Agent）。Agency 设置请在侧栏打开。',
        paletteAgencyChatEditorTitle: 'AI 对话',
        paletteAgencyChatPlaceholder: '在此输入要向 AI 提出的问题；可与下方「Asking AI」多轮对话。',
        mermaidBtnTip: '快速进入 Mermaid 编辑器（新标签页）',
        historyBtnTip:
          '对话保存在扩展本机存储，跨网站统一可见；刷新后仍可从列表恢复。',
        historyDdTitle: '对话记录',
        historyEmpty:
          '暂无记录。每轮 Asking AI 成功后自动保存；刷新页面不删数据，点上方时钟即可恢复。',
        toastSnippetHasSavedChat: '本 script 有已保存对话，点上方 🕘 打开列表即可恢复',
        historyFreeChat: '自由对话（未选 script）',
        historyUntitledScript: '未命名 script',
        historyDeleteTip: '删除此条记录',
        historyUserLabel: '你',
        historyAssistantLabel: 'AI',
      };
    }
    if (lang === 'ko') {
      return {
        ctxStripLabel: '선택 영역',
        footerHint: '빠른 모드 · ↑↓ 이동 · ↵ 열기 · Esc 닫기',
        recommendHit: '키워드 일치',
        recommendWhy: '추천 이유',
        modeToMain: '⇄ 메인',
        modeToQuick: '⇄ 빠른 모드',
        modeToMainTip: '빠른 모드를 닫고 메인 패널로',
        modeToQuickTip: '빠른 모드로 전환',
        modeToggleTip: '빠른 모드와 메인 화면 전환',
        shortcutsBtnTip: '자주 쓰는 페이지：펼쳐 이름·주소 수정',
        shortcutsDdTitle: '바로가기',
        shortcutsLabelPh: '표시 이름',
        shortcutsUrlPh: 'https:// 주소',
        shortcutsOpen: '열기',
        shortcutsSave: '저장',
        shortcutsSaved: '저장됨',
        shortcutsUrlRequired: '주소를 입력하세요',
        shortcutsEmpty: '바로가기 없음',
        shortcutsRemoveTip: '항목 삭제',
        listCopyBtn: '복사',
        editorBack: '← 뒤로',
        editorCopy: '복사',
        editorAskAi: 'Asking AI',
        editorPlaceholder: '스크립트가 여기에 표시됩니다. 편집 후 복사하거나 Asking AI로 질문하세요.',
        copyAnswer: '답안 복사',
        editorAiSectionTitle: 'AI 답변 (다중 턴)',
        editorAiGenerating: '생성 중…',
        toastCopied: '✓ 복사됨',
        toastAnswerCopied: '✓ 답안 복사됨',
        alertCopyFailed: '복사에 실패했습니다. 텍스트를 직접 선택해 복사하세요.',
        alertCopyAnswerFailed: '복사에 실패했습니다. 답변을 직접 선택해 복사하세요.',
        alertCopyFailedShort: '복사 실패',
        previewGen: '생성 중…',
        previewDone: '완료 ✓',
        previewAccept: '✓ 적용',
        previewDiff: '⇄ 비교',
        previewReject: '✕ 취소',
        diffTitle: '⇄ 수정 비교',
        diffOldLabel: '원문',
        diffNewLabel: '새 글',
        diffAcceptNew: '✓ 새 글 적용',
        diffKeepOld: '✕ 원문 유지',
        diffCloseTip: '닫기',
        countUnit: '개',
        ungroupedLabel: '미분류',
        emptyDefault: '항목 없음',
        noResultsForQuery: '「{q}」와 일치하는 항목이 없습니다',
        recommendDescDefault: '현재 입력 상황에 바로 쓸 수 있습니다.',
        recommendFromQuery: '(「{q}」 기준)',
        searchPlaceholder: '검색…',
        paletteAgencyToggle: '향상 적용',
        paletteAgencyClearVoice: '말투 해제',
        paletteAgencyClearAgent: 'Agent 해제',
        paletteAgencyOpenHub: 'Agency 설정',
        paletteAgencyEmpty: '선택된 말투/Agent 없음',
        paletteAgencyChatFooterBtn: 'AI 대화',
        paletteAgencyChatStripBtn: 'AI 대화',
        paletteAgencyChatBtnTip: 'AI 대화(Asking AI 다중 턴·향상 적용 시 말투·Agent 포함). Agency는 사이드바에서.',
        paletteAgencyChatEditorTitle: 'AI 대화',
        paletteAgencyChatPlaceholder: 'AI에게 물을 내용을 입력하세요. Asking AI로 여러 턴 대화할 수 있습니다.',
        mermaidBtnTip: 'Mermaid 편집기 바로 열기 (새 탭)',
        historyBtnTip:
          '대화는 확장 로컬 저장소에 저장되며 사이트와 관계없이 공통으로 보입니다. 새로고침 후에도 목록에서 복원할 수 있습니다.',
        historyDdTitle: '대화 기록',
        historyEmpty:
          '기록 없음. Asking AI 한 턴이 끝나면 자동 저장됩니다. 새로고침해도 유지되며 시계 버튼으로 복원하세요.',
        toastSnippetHasSavedChat: '이 스크립트에 저장된 대화가 있습니다. 위 🕘에서 복원하세요',
        historyFreeChat: '자유 대화 (스크립트 없음)',
        historyUntitledScript: '제목 없는 스크립트',
        historyDeleteTip: '기록 삭제',
        historyUserLabel: '나',
        historyAssistantLabel: 'AI',
      };
    }
    return {
      ctxStripLabel: 'Selection',
      footerHint: 'Quick mode · ↑↓ · ↵ open · Esc close',
      recommendHit: 'Matched',
      recommendWhy: 'Why',
      modeToMain: '⇄ Main',
      modeToQuick: '⇄ Quick',
      modeToMainTip: 'Leave quick mode and show main panel',
      modeToQuickTip: 'Switch to quick mode',
      modeToggleTip: 'Switch between quick mode and main panel',
      shortcutsBtnTip: 'Favorite page: edit label and URL',
      shortcutsDdTitle: 'Shortcuts',
      shortcutsLabelPh: 'Label',
      shortcutsUrlPh: 'https:// URL',
      shortcutsOpen: 'Open',
      shortcutsSave: 'Save',
      shortcutsSaved: 'Saved',
      shortcutsUrlRequired: 'URL is required',
      shortcutsEmpty: 'No shortcuts yet',
      shortcutsRemoveTip: 'Remove item',
      listCopyBtn: 'Copy',
      editorBack: '← Back',
      editorCopy: 'Copy',
      editorAskAi: 'Asking AI',
      editorPlaceholder: 'Snippet content appears here. Edit, copy, or use Asking AI.',
      copyAnswer: 'Copy answer',
      editorAiSectionTitle: 'AI reply (multi-turn)',
      editorAiGenerating: 'Generating…',
      toastCopied: '✓ Copied',
      toastAnswerCopied: '✓ Answer copied',
      alertCopyFailed: 'Copy failed. Select the text and copy manually.',
      alertCopyAnswerFailed: 'Copy failed. Select the answer and copy manually.',
      alertCopyFailedShort: 'Copy failed',
      previewGen: 'Generating…',
      previewDone: 'Done ✓',
      previewAccept: '✓ Accept',
      previewDiff: '⇄ Compare',
      previewReject: '✕ Discard',
      diffTitle: '⇄ Compare changes',
      diffOldLabel: 'Original',
      diffNewLabel: 'Revised',
      diffAcceptNew: '✓ Use revised',
      diffKeepOld: '✕ Keep original',
      diffCloseTip: 'Close',
      countUnit: 'items',
      ungroupedLabel: 'Ungrouped',
      emptyDefault: 'Nothing here',
      noResultsForQuery: 'No results for "{q}"',
      recommendDescDefault: 'Fits your current context.',
      recommendFromQuery: '(from "{q}")',
      searchPlaceholder: 'Search…',
      paletteAgencyToggle: 'Enhance',
      paletteAgencyClearVoice: 'Clear voice',
      paletteAgencyClearAgent: 'Clear agent',
      paletteAgencyOpenHub: 'Agency settings',
      paletteAgencyEmpty: 'No voice style or agent selected',
      paletteAgencyChatFooterBtn: 'AI chat',
      paletteAgencyChatStripBtn: 'AI chat',
      paletteAgencyChatBtnTip:
        'Open AI chat (Asking AI multi-turn; includes voice + Agent when Enhance is on). Open Agency from the sidebar.',
      paletteAgencyChatEditorTitle: 'AI chat',
      paletteAgencyChatPlaceholder:
        'Type your question for the AI. Use Asking AI below for multi-turn follow-ups.',
      mermaidBtnTip: 'Open Mermaid editor quickly (new tab)',
      historyBtnTip:
        'Chats are saved in extension local storage and shared across sites; they survive refresh—open the list to restore.',
      historyDdTitle: 'Chat history',
      historyEmpty:
        'No entries yet. Each successful Asking AI turn is saved locally. Data persists across refresh—use the clock button to restore.',
      toastSnippetHasSavedChat: 'Saved chat exists for this script — open 🕘 above to restore',
      historyFreeChat: 'Free chat (no script selected)',
      historyUntitledScript: 'Untitled script',
      historyDeleteTip: 'Delete entry',
      historyUserLabel: 'You',
      historyAssistantLabel: 'AI',
    };
  }

  function _inferContextTags(text, lang) {
    const raw = String(text || '');
    const t = raw.toLowerCase();
    const tags = [];
    const add = (zhT, enT, koT) => tags.push(_uiMsg(lang, zhT, enT, koT));
    if (/翻译|译文|语种|translate|english|chinese|韩文|日文/.test(raw) || /translate|english/.test(t)) {
      add('翻译/语种', 'Translate', '번역/언어');
    }
    if (/邮件|email|回信/.test(raw) || /email/.test(t)) add('邮件场景', 'Email', '이메일');
    if (/论文|学术|答辩|文献|期刊/.test(raw)) add('学术/论文', 'Academic', '학술/논문');
    if (/代码|报错|debug|堆栈|api/.test(raw) || /\berror\b|debug|api/.test(t)) add('开发调试', 'Development', '개발/디버그');
    if (/会议|纪要|汇报|prd|职场|商务/.test(raw)) add('职场/商务', 'Workplace', '직장/비즈니스');
    if (/润色|改写|优化/.test(raw)) add('润色需求', 'Polish', '다듬기');
    if (/总结|摘要|精简|压缩/.test(raw)) add('摘要/压缩', 'Summarize', '요약/압축');
    if (/语气|正式|口语|亲切|严肃/.test(raw)) add('语气风格', 'Tone', '어조/톤');
    return [...new Set(tags)];
  }

  function _cmdTraitTags(cmdId, lang) {
    const M = {
      rewrite: { zh: 'AI·润色改写', en: 'AI rewrite', ko: 'AI·다듬기' },
      shorten: { zh: 'AI·精简压缩', en: 'AI shorten', ko: 'AI·축약' },
      translate: { zh: 'AI·翻译', en: 'AI translate', ko: 'AI·번역' },
      expand: { zh: 'AI·扩写', en: 'AI expand', ko: 'AI·확장' },
      bullets: { zh: 'AI·要点列表', en: 'AI bullets', ko: 'AI·요점 목록' },
      tone_formal: { zh: 'AI·正式语气', en: 'AI formal tone', ko: 'AI·격식체' },
      tone_casual: { zh: 'AI·轻松语气', en: 'AI casual tone', ko: 'AI·캐주얼' },
      proofread: { zh: 'AI·校对', en: 'AI proofread', ko: 'AI·교정' },
    };
    const row = M[cmdId];
    return row ? [row[lang] || row.en] : [];
  }

  function _buildReasonsForItem(item, ctx) {
    const { text, cfg, queryTokens, hay } = ctx;
    const lang = cfg.lang;
    const reasons = [];
    const ctxTags = _inferContextTags(text, lang);
    const lowHay = String(hay || '').toLowerCase();

    if (String(item.id || '').startsWith('snippet:')) {
      reasons.push(_uiMsg(lang, '本地 script', 'Saved script', '저장된 스크립트'));
      ctxTags.slice(0, 4).forEach(x => reasons.push(x));
    } else {
      reasons.push(..._cmdTraitTags(item.id, lang));
      if (item.id === 'translate' && ctxTags.some(c => /翻译|번역|Translate/.test(c))) {
        reasons.push(_uiMsg(lang, '与选中内容「翻译」意图一致', 'Matches translate intent', '선택 내용의 번역 의도와 일치'));
      }
      if ((item.id === 'shorten' || item.id === 'bullets') && ctxTags.some(c => /摘要|压缩|Summarize|요약|압축/.test(c))) {
        reasons.push(_uiMsg(lang, '与摘要类需求相关', 'Summarize-related', '요약·압축 관련'));
      }
      if ((item.id === 'rewrite' || item.id === 'proofread') && ctxTags.some(c => /润色|Polish|校对|Tone|다듬기|어조/.test(c))) {
        reasons.push(_uiMsg(lang, '与润色/语气需求相关', 'Polish/tone-related', '다듬기·어조 관련'));
      }
      ctxTags.slice(0, 3).forEach(x => reasons.push(x));
    }

    for (const tk of queryTokens) {
      if (tk.length < 2) continue;
      if (lowHay.includes(tk)) {
        reasons.push(_uiMsg(lang, `关键词「${tk}」`, `Keyword “${tk}”`, `키워드 「${tk}」`));
      }
    }

    return [...new Set(reasons)].slice(0, 10);
  }

  function _tokenize(text = '') {
    return String(text)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 32);
  }

  function _intentBoost(modeText = '', cmdId = '') {
    const t = modeText.toLowerCase();
    const has = (...ks) => ks.some(k => t.includes(k));
    if (cmdId === 'translate' && has('翻译', 'translate', '英文', '中文', '日文', '韩文')) return 4;
    if (cmdId === 'shorten' && has('简化', '精简', '摘要', '总结', 'short', 'summary')) return 4;
    if (cmdId === 'expand' && has('扩写', '补充', '展开', 'detail', 'expand')) return 4;
    if (cmdId === 'proofread' && has('语法', '校对', '错别字', 'proofread', 'grammar', 'spell')) return 4;
    if (cmdId === 'rewrite' && has('润色', '改写', '优化', 'rewrite', 'polish')) return 3;
    return 0;
  }

  function _buildSmartPaletteItems(text, cfg) {
    const commands = TwCommandLayer.getCommands();
    const snippets = _getState?.()?.snippets || [];
    const queryTokens = _tokenize(text);

    const ctxShared = { text, cfg, queryTokens };

    const scoredCmds = commands.map(c => {
      const label = c.label?.[cfg.lang] || c.label?.en || c.id;
      const desc = c.description?.[cfg.lang] || c.description?.en || '';
      const hay = `${label} ${desc} ${c.id}`.toLowerCase();
      const tokenScore = queryTokens.reduce((acc, tk) => acc + (hay.includes(tk) ? 1 : 0), 0);
      const score = tokenScore + _intentBoost(text, c.id);
      const item = { ...c, _score: score };
      item._recommendReasons = _buildReasonsForItem(item, { ...ctxShared, hay: `${label} ${desc} ${c.id}` });
      return item;
    });

    const scriptItems = _snippetsToPaletteItems(snippets).map(it => {
      const sn = snippets.find(s => `snippet:${s.id}` === it.id);
      const expanded = window.TwExpandSnippetContent
        ? TwExpandSnippetContent(sn.id, String(sn?.content || ''))
        : String(sn?.content || '');
      const raw = `${sn?.title || ''} ${expanded}`.toLowerCase();
      const tokenScore = queryTokens.reduce((acc, tk) => acc + (raw.includes(tk) ? 1 : 0), 0);
      const item = {
        ...it,
        icon: '🧩',
        description: {
          ...(it.description || {}),
          zh: (it.description?.zh || '可用于当前输入场景') + ' · script',
          en: (it.description?.en || 'Useful for current input') + ' · script',
          ko: (it.description?.ko || '현재 입력에 적합') + ' · script',
        },
        _score: tokenScore + (tokenScore > 0 ? 2 : 0) + (Number(sn?.useCount) || 0) * 2,
        _useCount: Number(sn?.useCount) || 0,
      };
      item._recommendReasons = _buildReasonsForItem(item, { ...ctxShared, hay: `${sn?.title || ''} ${expanded}` });
      return item;
    });

    return [...scoredCmds, ...scriptItems].sort((a, b) => (b._score || 0) - (a._score || 0));
  }

  // ─────────────────────────────────────────────────────────────
  //  直接插入提示语片段（不经过 AI）
  // ─────────────────────────────────────────────────────────────
  function _insertSnippet(content) {
    const target = _resolveWriteTarget();
    if (window.insertTextToTarget) {
      insertTextToTarget(target, content, 'insertCursor');
    } else {
      navigator.clipboard?.writeText(content).catch(() => {});
    }
    _toast(_uiMsg(_cfg().lang, '✓ 已插入提示语', '✓ Snippet inserted', '✓ 스크립트 삽입됨'));
  }

  /** 快速模式编辑区「Asking AI」多轮对话（不含 system，由调用处拼接） */
  const _EDITOR_CHAT_MAX = 20;
  let _snippetEditorChatMessages = [];
  /** IndexedDB 当前会话 id；换 script / 新开 AI 对话时置空以新建归档 */
  let _paletteHistorySessionId = null;

  function _resetSnippetEditorChat() {
    _snippetEditorChatMessages = [];
    _paletteHistorySessionId = null;
  }

  function _stripChatTs(messages) {
    return (messages || []).map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  function _historyMetaFromEditor() {
    const cfg = _cfg();
    const st = _getState?.() || {};
    const enhance = st.agencyEnhanceEnabled === true;
    let itemId = null;
    try {
      itemId =
        typeof TwRenderLayer?.getEditorContext === 'function'
          ? TwRenderLayer.getEditorContext()?.itemId
          : null;
    } catch (_) {}
    if (itemId === 'tw:agency-chat') {
      return {
        source: /** @type {'agency-chat'} */ ('agency-chat'),
        snippetId: null,
        snippetTitle: null,
        model: cfg.model || null,
        agencyEnhance: enhance,
      };
    }
    if (itemId && String(itemId).startsWith('snippet:')) {
      const raw = String(itemId).replace(/^snippet:/, '');
      const snippets = st.snippets || [];
      const sn = snippets.find((s) => s.id === raw);
      return {
        source: /** @type {'snippet'} */ ('snippet'),
        snippetId: raw,
        snippetTitle: sn?.title || null,
        model: cfg.model || null,
        agencyEnhance: enhance,
      };
    }
    return {
      source: 'snippet',
      snippetId: null,
      snippetTitle: null,
      model: cfg.model || null,
      agencyEnhance: enhance,
    };
  }

  async function _persistPaletteChatHistory() {
    const H = window.TwQuickChatHistory;
    if (!H?.upsertSession) return;
    try {
      const meta = _historyMetaFromEditor();
      const id = await H.upsertSession(
        _paletteHistorySessionId,
        meta,
        _snippetEditorChatMessages,
      );
      _paletteHistorySessionId = id;
    } catch (e) {
      console.warn('[TwAiRewrite] persist chat history', e);
    }
  }

  async function _restorePaletteChatSession(sessionId) {
    const H = window.TwQuickChatHistory;
    if (!H?.getSession) return;
    let row;
    try {
      row = await H.getSession(sessionId);
    } catch (e) {
      console.warn('[TwAiRewrite] getSession', e);
      return;
    }
    if (!row?.messages?.length) return;

    const cfg = _cfg();
    const P = _paletteUiLabels(cfg);

    _paletteHistorySessionId = row.id;
    _snippetEditorChatMessages = row.messages.map((m) => ({
      role: m.role,
      content: m.content,
      ts: typeof m.ts === 'number' ? m.ts : Date.now(),
    }));

    if (row.source === 'agency-chat') {
      if (window.TwRenderLayer?.showEditor) {
        TwRenderLayer.showEditor(
          'tw:agency-chat',
          P.paletteAgencyChatEditorTitle || 'AI chat',
          '',
        );
      }
    } else if (row.snippetId) {
      const snippets = _getState?.()?.snippets || [];
      const snippet = snippets.find((s) => s.id === row.snippetId);
      let content = '';
      let title = row.snippetTitle || '';
      if (snippet) {
        title = snippet.title || title;
        content = snippet.content || '';
        if (window.TwExpandSnippetContent) {
          content = TwExpandSnippetContent(snippet.id, content);
        }
      }
      if (window.TwRenderLayer?.showEditor) {
        TwRenderLayer.showEditor(
          `snippet:${row.snippetId}`,
          title || 'Script',
          content,
        );
      }
    }

    if (typeof TwRenderLayer?.renderEditorChatTranscript === 'function') {
      TwRenderLayer.renderEditorChatTranscript(_snippetEditorChatMessages);
    }
    _toast(
      _uiMsg(cfg.lang, '✓ 已恢复对话', '✓ Conversation restored', '✓ 대화 복원됨'),
    );
  }

  /** 快速模式 Agency 条：进入与选中 script 相同的编辑区 + Asking AI 多轮 */
  function openPaletteAgencyChat() {
    _resetSnippetEditorChat();
    const cfg = _cfg();
    const P = _paletteUiLabels(cfg);
    if (window.TwRenderLayer?.showEditor) {
      window.TwRenderLayer.showEditor(
        'tw:agency-chat',
        P.paletteAgencyChatEditorTitle || 'AI chat',
        '',
      );
    }
  }

  function _askFreeformSystem(lang) {
    if (lang === 'en') {
      return 'You are a helpful assistant. Answer clearly and accurately. When the user refers to earlier turns, use the conversation context. Output only what answers the current question unless the user asks for a recap.';
    }
    if (lang === 'ko') {
      return '유능한 도우미입니다. 명확하고 정확하게 답하세요. 이전 대화를 언급하면 맥락을 반영하세요. 사용자가 요청하지 않은 전체 요약은 하지 마세요.';
    }
    return '你是乐于助人的助手。请清晰、准确地回答用户问题；若用户延续前文，请结合对话历史作答。除非用户明确要求总结，否则不要整段重复历史。';
  }

  async function _runSnippetEditorAskAI() {
    const cfg = _cfg();
    if (!cfg.apiKey) {
      alert(_needApiKeyMsg(cfg.lang));
      return;
    }
    const ta = _root?.querySelector('#twar-editor-textarea');
    let q = (ta?.value || '').trim();
    q = q.replace(/\{\{([^:]+):([^:]+):([^}]+)\}\}/g, '$1$3').trim();
    if (!q) {
      _toast(_uiMsg(cfg.lang, '请先输入要问的内容', 'Enter your question first', '질문을 입력하세요'));
      return;
    }

    TwRenderLayer.setEditorAskBusy(true);
    TwRenderLayer.beginEditorAiStream({
      priorMessages: _snippetEditorChatMessages.slice(),
      pendingUserContent: q,
    });

    let agencyAug = '';
    try {
      if (window.TwAgencyCompose && typeof TwAgencyCompose.buildAgencyChatAugment === 'function') {
        agencyAug = (await TwAgencyCompose.buildAgencyChatAugment()) || '';
      }
    } catch (e) {
      console.warn('[TwAiRewrite] buildAgencyChatAugment', e);
    }
    const baseSys = _askFreeformSystem(cfg.lang);
    const systemContent = agencyAug ? `${agencyAug}\n\n---\n\n${baseSys}` : baseSys;

    const messages = [
      { role: 'system', content: systemContent },
      ..._stripChatTs(_snippetEditorChatMessages),
      { role: 'user', content: q },
    ];

    let full = '';
    try {
      for await (const chunk of TwCommandLayer.executeMessages(messages, cfg)) {
        full += chunk;
        TwRenderLayer.appendEditorAiChunk(chunk);
      }
      if (!String(full).trim()) {
        TwRenderLayer.showEditorAiError(
          _uiMsg(cfg.lang, 'AI 返回内容为空', 'AI returned empty text', '빈 응답'),
        );
        return;
      }
      TwRenderLayer.completeEditorAiStream(full);
      const tUser = Date.now();
      _snippetEditorChatMessages.push({ role: 'user', content: q, ts: tUser });
      _snippetEditorChatMessages.push({
        role: 'assistant',
        content: full,
        ts: Date.now(),
      });
      while (_snippetEditorChatMessages.length > _EDITOR_CHAT_MAX) {
        _snippetEditorChatMessages.shift();
      }
      if (typeof TwRenderLayer?.renderEditorChatTranscript === 'function') {
        TwRenderLayer.renderEditorChatTranscript(_snippetEditorChatMessages);
      }
      if (ta) {
        ta.value = '';
        try {
          ta.focus();
        } catch (_) {}
      }
      void _persistPaletteChatHistory();
    } catch (err) {
      console.error('[TwAiRewrite] Asking AI', err);
      TwRenderLayer.showEditorAiError(_formatAIError(err, cfg));
    } finally {
      TwRenderLayer.setEditorAskBusy(false);
    }
  }

  // 防止扩展快捷键与页面内快捷键同时触发时重复执行
  let _triggerDebounceAt = 0;
  function _debounceTrigger() {
    const now = Date.now();
    if (now - _triggerDebounceAt < 450) return true;
    _triggerDebounceAt = now;
    return false;
  }

  // ─────────────────────────────────────────────────────────────
  //  Trigger 层回调
  // ─────────────────────────────────────────────────────────────
  function _onTrigger(text, mode) {
    if (_debounceTrigger()) return;
    // 记录来源元素（此时焦点还在原位置）
    _source      = document.activeElement;
    _pendingText = text;

    const cfg = _cfg();

    // 直接指令（快捷键 mode = 'rewrite' / 'shorten' / 'translate'）
    const directModes = ['rewrite', 'shorten', 'translate', 'expand'];
    if (directModes.includes(mode)) {
      if (!cfg.apiKey) {
        _toast(_needApiKeyToast(cfg.lang));
        return;
      }
      _runCommand(mode, text);
      return;
    }

    // mode = 'palette'
    // 与侧边栏「⚡」按钮行为保持一致：打开面板前先隐藏侧边栏
    const sb = _root?.querySelector('#sb');
    if (sb && sb.dataset.twSidePanel !== '1') {
      sb.classList.add('hidden');
      try { window.TwUpdatePageContentGutter?.(); } catch (_) {}
    }

    const paletteMode = _getState?.()?.aiPaletteMode || 'compact';

    if (!cfg.apiKey) {
      // 无 API Key：展示已保存的提示语，供快速搜索 + Copy
      const snippets = _getState?.()?.snippets || [];
      const items = _snippetsToPaletteItems(snippets);
      TwRenderLayer.openPalette(items, cfg.lang, '', {
        placeholder: _uiMsg(cfg.lang, '输入 / 搜索提示语...', 'Type / to search snippets...', '스크립트 검색 / 입력…'),
        emptyHint: _uiMsg(
          cfg.lang,
          '还没有提示语，请先在侧边栏添加',
          'No snippets yet — add some in the sidebar first.',
          '스크립트가 없습니다. 사이드바에서 추가하세요.',
        ),
        isOfflineMode: true,
        mode: paletteMode,
        labels: _paletteUiLabels(cfg),
      });
      return;
    }

    // 有 API Key：展示 AI 指令面板（需先选中文字）
    TwRenderLayer.openPalette(_buildSmartPaletteItems(text, cfg), cfg.lang, text, {
      isOfflineMode: false,
      mode: paletteMode,
      showRecommendation: true,
      recommendationTitle: _uiMsg(cfg.lang, '推荐 script：', 'Recommended script:', '추천 스크립트:'),
      labels: _paletteUiLabels(cfg),
    });
  }

  // ─────────────────────────────────────────────────────────────
  //  Render 层回调
  // ─────────────────────────────────────────────────────────────
  function _onCommand(id) {
    // snippet:insert: 前缀 → 用户在编辑区修改后点「插入」
    if (id.startsWith('snippet:insert:')) {
      const content = id.slice('snippet:insert:'.length);
      _insertSnippet(content);
      return;
    }

    // snippet: 前缀 → 提示语片段，直接插入
    if (id.startsWith('snippet:')) {
      const snippetId = id.slice('snippet:'.length);
      const snippets  = _getState?.()?.snippets || [];
      const snippet   = snippets.find(s => s.id === snippetId);
      if (snippet) {
        let c = snippet.content || '';
        if (window.TwExpandSnippetContent) c = TwExpandSnippetContent(snippet.id, c);
        _insertSnippet(c);
        try {
          window.TwBumpSnippetUseCount?.(snippetId);
        } catch (_) {}
      }
      return;
    }

    // AI 指令：用 pending text 执行
    _runCommand(id, _pendingText);
  }

  async function _maybeToastSavedChatForSnippet(snippetId) {
    const H = window.TwQuickChatHistory;
    if (!snippetId || !H?.listSessionsBySnippetId) return;
    try {
      const rows = await H.listSessionsBySnippetId(snippetId, 1);
      if (!rows?.length) return;
      const cfg = _cfg();
      const P = _paletteUiLabels(cfg);
      _toast(P.toastSnippetHasSavedChat || _uiMsg(cfg.lang, '本 script 有已保存对话，点上方 🕘 恢复', 'Saved chat for this script — tap 🕘 to restore', '저장된 대화 있음 — 위 🕘에서 복원'));
    } catch (e) {
      console.warn('[TwAiRewrite] listSessionsBySnippetId', e);
    }
  }

  function _onSelect(snippetId, title) {
    console.log('[TwAiRewrite] _onSelect 被调用', { snippetId, title });

    _resetSnippetEditorChat();

    // 离线模式选中提示语后，展开内容编辑区
    const realId  = snippetId.replace('snippet:', '');
    const snippets = _getState?.()?.snippets || [];
    const snippet  = snippets.find(s => s.id === realId);
    
    console.log('[TwAiRewrite] 找到的snippet:', snippet ? snippet.title : 'null');
    
    if (snippet && window.TwRenderLayer?.showEditor) {
      let content = snippet.content || '';
      if (window.TwExpandSnippetContent) content = TwExpandSnippetContent(realId, content);
      console.log('[TwAiRewrite] 调用 showEditor，内容长度:', content?.length || 0);
      TwRenderLayer.showEditor(snippetId, title, content);
      try {
        if (String(snippetId).startsWith('snippet:')) {
          window.TwBumpSnippetUseCount?.(realId);
        }
      } catch (_) {}
      void _maybeToastSavedChatForSnippet(realId);
    } else {
      console.error('[TwAiRewrite] 无法展示编辑区', {
        hasSnippet: !!snippet,
        hasShowEditor: !!window.TwRenderLayer?.showEditor,
      });
    }
  }

  function _onAccept(newText) {
    _writeBack(newText);
    TwCommandLayer.clearBackup(_backupId);
    _toast(_uiMsg(_cfg().lang, '✓ 已采用', '✓ Accepted', '✓ 적용됨'));
  }

  function _onReject() {
    TwCommandLayer.clearBackup(_backupId);
  }

  function _onDiff(newText) {
    const original = TwCommandLayer.restore(_backupId) || _pendingText;
    TwRenderLayer.openDiff(original, newText);
  }

  // ─────────────────────────────────────────────────────────────
  //  公开 API（供 content.js 的 snippet 编辑框直接调用）
  // ─────────────────────────────────────────────────────────────

  /**
   * 在 Snippet 编辑框内优化内容（点击 ✨ AI优化 按钮时调用）。
   * @param {string}   snippetId   current editing snippet id（或 'temp'）
   * @param {string}   text        当前 textarea 的文本
   * @param {Function} onDone      (optimizedText) → void  流结束后的回调
   */
  function _optimizeLang() {
    const s = _getState?.() || {};
    return s.lang === 'en' ? 'en' : s.lang === 'ko' ? 'ko' : 'zh';
  }

  /** 与扩展界面语言一致：强制优化结果全文使用该语言（含跨语种翻译式润色） */
  function _optimizeOutputLanguageRule(lang) {
    if (lang === 'en') {
      return '[Output language — mandatory]\n'
        + 'Write the entire polished result in English only. If the source text is in another language, '
        + 'faithfully convey the meaning in polished English (you may translate as needed). '
        + 'Do not use Chinese, Korean, or other languages in the output.';
    }
    if (lang === 'ko') {
      return '[출력 언어 — 필수]\n'
        + '최종 결과 전체를 한국어로만 작성하세요. 원문이 다른 언어면 의미를 충실히 전달하도록 한국어로 옮겨 다듬으세요. '
        + '출력에 중국어·영어 등 다른 언어를 섞지 마세요.';
    }
    return '【输出语言 — 强制】\n'
      + '优化后的全文必须使用简体中文撰写。若原文为其他语言，请在准确传达原意的前提下译为并润色为简体中文；'
      + '不要在正文中混杂英文、韩文或其他语言（必要的专有名词、代码、URL 等可保留）。';
  }

  /** 置于润色 user 提示最前，避免模型忽略界面语言 */
  function _optimizeUiLangPriorityHeader(lang) {
    if (lang === 'en') return '[UI language — highest priority]\n' + _optimizeOutputLanguageRule(lang);
    if (lang === 'ko') return '[UI 언어 — 최우선]\n' + _optimizeOutputLanguageRule(lang);
    return '【界面语言 — 最高优先级】\n' + _optimizeOutputLanguageRule(lang);
  }

  function _googlePrimerBlock(lang) {
    const primer =
      typeof window !== 'undefined' && window.TW_GOOGLE_PROMPT_PRIMER
        ? String(window.TW_GOOGLE_PROMPT_PRIMER).trim()
        : '';
    if (primer) {
      return lang === 'en'
        ? '[Prompt principles (Gemini for Workspace + prompt-engineering best practices, condensed)]\n' + primer
        : lang === 'ko'
          ? '[프롬프트 원칙 (Workspace Gemini + 일반 프롬프트 엔지니어링 요약)]\n' + primer
          : '【须遵循的提示工程原则（Google Workspace / Gemini 与通用提示工程要点）】\n' + primer;
    }
    return lang === 'en'
      ? '[Task] Polish the following using Persona / Task / Context / Format thinking (Gemini for Workspace style).'
      : lang === 'ko'
        ? '[작업] Workspace Gemini 스타일로 Persona·Task·Context·Format을 고려해 다듬기.'
        : '【任务】按 Google Workspace / Gemini 提示思路（角色、任务、上下文、格式）润色下文。';
  }

  function _polishTextSection(lang, rawText) {
    return lang === 'en'
      ? '[Text to polish]\n' + rawText
      : lang === 'ko'
        ? '[최적화할 본문]\n' + rawText
        : '【待优化正文】\n' + rawText;
  }

  function _polishOutputTail(lang) {
    return [
      lang === 'en'
        ? 'Output only the polished full text. No preamble or explanation.'
        : lang === 'ko'
          ? '최적화된 본문만 출력하세요. 설명 없이.'
          : '请只输出优化后的完整正文，不要前缀说明或解释。',
      _optimizeOutputLanguageRule(lang),
    ];
  }

  /** @returns {string} */
  function _personaPresetExtraBlock(lang, p) {
    const rk = p?.personaRoleKey;
    if (!rk || rk === 'custom' || typeof window.TW_PERSONA_ROLE_PRESETS === 'undefined') return '';
    const pr = window.TW_PERSONA_ROLE_PRESETS[rk];
    if (!pr) return '';
    const d =
      lang === 'en'
        ? pr.detailEn || pr.detailZh || ''
        : lang === 'ko'
          ? pr.detailKo || pr.detailEn || pr.detailZh || ''
          : pr.detailZh || '';
    const t = String(d || '').trim();
    if (!t) return '';
    const hdr =
      lang === 'en'
        ? '[Selected role preset — skills & quality bar]'
        : lang === 'ko'
          ? '[선택한 직무 프리셋 — 역량·품질 기준]'
          : '【所选职位角色模版 — 技能与质量标准】';
    return `${hdr}\n${t}`;
  }

  /** 所选职位下拉的一行显式标签（与 preset 长文互补） */
  function _personaRoleLabelLine(lang, p) {
    const rk = p?.personaRoleKey;
    if (!rk || rk === 'custom' || typeof window.TW_PERSONA_ROLE_PRESETS === 'undefined') return '';
    const pr = window.TW_PERSONA_ROLE_PRESETS[rk];
    if (!pr) return '';
    const label =
      lang === 'en'
        ? String(pr.labelEn || pr.labelZh || '').trim()
        : lang === 'ko'
          ? String(pr.labelKo || pr.labelEn || pr.labelZh || '').trim()
          : String(pr.labelZh || pr.labelEn || '').trim();
    if (!label) return '';
    const hdr =
      lang === 'en'
        ? '[Selected role]'
        : lang === 'ko'
          ? '[선택한 직무 역할]'
          : '【所选职位角色】';
    return `${hdr} ${label}`;
  }

  /** @returns {string|null} */
  function _getPersonaBlockBody() {
    const lang = _optimizeLang();
    const p = (_getState?.() || {}).aiUserProfile || {};
    const sep = lang === 'zh' ? '：' : ': ';
    const manual = [
      p.nickname && `${lang === 'en' ? 'Name' : lang === 'ko' ? '이름' : '称呼'}${sep}${p.nickname}`,
      p.jobTitle && `${lang === 'en' ? 'Role / industry' : lang === 'ko' ? '직무/업종' : '职位/行业'}${sep}${p.jobTitle}`,
      p.personality && `${lang === 'en' ? 'Personality & tone' : lang === 'ko' ? '성격/톤' : '性格与语气'}${sep}${p.personality}`,
      p.nationality && `${lang === 'en' ? 'Country / region' : lang === 'ko' ? '국가/지역' : '国籍/地区'}${sep}${p.nationality}`,
      p.speakLang && `${lang === 'en' ? 'Languages' : lang === 'ko' ? '언어' : '常用语言'}${sep}${p.speakLang}`,
      p.extra && `${lang === 'en' ? 'Notes' : lang === 'ko' ? '기타' : '其他'}${sep}${p.extra}`,
    ]
      .filter(Boolean)
      .join('\n');
    const summary = (p.aiSummary && String(p.aiSummary).trim()) || '';
    const roleLine = _personaRoleLabelLine(lang, p);
    const extra = _personaPresetExtraBlock(lang, p);

    const sections = [];
    if (roleLine) sections.push(roleLine);
    if (manual.trim()) {
      const mh =
        lang === 'en'
          ? '[Structured profile]'
          : lang === 'ko'
            ? '[구조화 프로필]'
            : '【结构化档案】';
      sections.push(`${mh}\n${manual}`);
    }
    if (summary) {
      const sh =
        lang === 'en'
          ? '[AI profile summary]'
          : lang === 'ko'
            ? '[AI 프로필 요약]'
            : '【AI 归纳档案】';
      sections.push(`${sh}\n${summary}`);
    }
    if (extra) sections.push(extra);

    const personaBlock = sections.join('\n\n');
    return String(personaBlock).trim() ? personaBlock : null;
  }

  function _personaSectionWithHeader(lang, personaBlock) {
    return lang === 'en'
      ? '[User persona / background — optimize the text as if this assistant is speaking]\n' + personaBlock
      : lang === 'ko'
        ? '[사용자 맞춤 배경 — 이 설정에 맞게 본문 다듬기]\n' + personaBlock
        : '【用户个性档案 — 请按此背景优化下文语气与立场】\n' + personaBlock;
  }

  function _mergePersonaAndPrimerInstruction(lang) {
    if (lang === 'en') {
      return '[Combined requirements]\n'
        + 'Apply both the prompt principles above and the user profile: clear structure, professional readability, and tone aligned with the profile. '
        + 'The polished text should clearly read as that role (word choice, register, and stated risk/quality boundaries) without adding facts not in the source. '
        + 'If they conflict, prioritize factual accuracy, clarity, and appropriate register — do not invent facts.';
    }
    if (lang === 'ko') {
      return '[통합 요구]\n'
        + '위 프롬프트 원칙과 사용자 프로필을 모두 반영하세요. 구조는 명확하고 전문적으로, 톤·어휘·품질/리스크 경계는 프로필이 드러나게. '
        + '원문에 없는 사실은 추가하지 마세요. 충돌 시 사실 정확성·명확성을 우선하세요.';
    }
    return '【合并要求】\n'
      + '须同时满足上方的提示工程原则与用户个性档案：结构清晰、专业可读，语气、措辞与职位预设中的风险/质量边界应能被读者感知到。'
      + '勿引入原文与档案中均未给出的新事实。若难以兼顾，以事实准确、表达清晰与得体为先。';
  }

  /** 「专业+个性」专用：要求专家自陈 + 覆盖预设要点 + 与语句尾标兼容 */
  function _bothExpertOutputContract(lang) {
    if (lang === 'en') {
      return '[Output structure — Pro + Profile]\n'
        + '1) First, write an explicit professional stance block as the selected-role expert (first person or detached expert voice is fine). It must substantively cover the themes in the profile above: role scope, key skills, quality bar, and tone/risk boundaries from the role preset text — not a single vague sentence; the reader should feel comparable depth to the preset bullets.\n'
        + '2) If the profile or role preset changes, the stance block must fully switch to the new role only — never mix wording from another role.\n'
        + '3) Then output the fully polished body from [Text to polish] below the stance block (you may separate the two parts with a blank line or a line containing only "---").\n'
        + '4) If the source ends with a trailing marker line such as "Content:" (or the Chinese/Korean equivalents used in this app), keep that exact marker as the final line after the polished body; do not delete or move it.';
    }
    if (lang === 'ko') {
      return '[출력 구조 — 전문+맞춤]\n'
        + '1) 먼저 선택된 직무 전문가 입장에서 전문 자기소개(역량·범위·품질 기준·톤/리스크 경계) 단락을 작성하세요. 위 프로필·프리셋 텍스트의 주제를 한두 문장으로 퉁치지 말고, 불릿 수준에 맞는 밀도로 실질적으로 반영하세요.\n'
        + '2) 프로필/프리셋이 바뀌면 이 단락은 새 역할만 사용하고, 이전 역할 표현을 섞지 마세요.\n'
        + '3) 그 다음 [최적화할 본문]을 완전히 다듬은 본문으로 출력하세요(단락 사이 빈 줄 또는 "---" 한 줄로 구분 가능).\n'
        + '4) 원문 맨끝에 앱에서 쓰는 꼬리표(예: 「내용:」 또는 "Content:" 등)가 있으면 다듬은 본문 뒤에 그대로 마지막 줄로 유지하세요. 삭제·이동 금지.';
    }
    return '【输出结构 — 专业+个性】\n'
      + '1）先写一段「专业身份自陈」：以当前所选职位/档案中的角色口吻，明确写出职能概览、常用技能、质量标准、语气边界等要点；须对上文职位预设中的各块主题做实质展开，禁止仅用一两句空泛「作为专家」带过，信息密度应接近读者能从预设原文中读到的层次。\n'
      + '2）若用户更换职位预设或档案，自陈须整体切换为新角色，不得混用旧角色的表述。\n'
      + '3）自陈之后，再输出对【待优化正文】的完整润色结果（两段之间可用空一行或单独一行「---」分隔）。\n'
      + '4）若待优化正文末尾已有界面用语尾标（中文常为「内容：」、英文常为「Content:」、韩文常为「내용:」），润色后须保留该尾标为全文最后一行，勿删除或挪到自陈段中。';
  }

  /** 「专业+个性」专用输出尾约束（与 _polishOutputTail 二选一用于 both） */
  function _polishOutputTailBoth(lang) {
    return [
      lang === 'en'
        ? 'Output exactly two logical parts in order: (A) expert stance block per structure rules above, (B) polished script body. No extra meta-commentary outside these parts. The stance block must be in the same UI language as the rest unless the user text clearly requires another language.'
        : lang === 'ko'
          ? '위 구조대로 (A) 전문가 입장 단락, (B) 다듬은 본문 순서로만 출력하세요. 그 밖의 메타 설명 금지. UI 언어와 본문 언어 규칙을 따르세요.'
          : '请严格按上文「输出结构」依次输出两段：（A）专业身份自陈，（B）润色后的完整正文；除这两段外不要附加说明性前言/后记。自陈与正文均须遵守界面语言优先级规则。',
      _optimizeOutputLanguageRule(lang),
    ];
  }

  /** 仅 Google Workspace 指南要点 + 待优化正文（不含用户个性档案） */
  function _buildOptimizeGoogleOnly(rawText) {
    const lang = _optimizeLang();
    const parts = [
      _optimizeUiLangPriorityHeader(lang),
      _googlePrimerBlock(lang),
      _polishTextSection(lang, rawText),
      ..._polishOutputTail(lang),
    ];
    return parts.join('\n\n---\n\n');
  }

  /**
   * 仅用户个性档案 + 待优化正文（不含 Google 指南块）
   * @returns {string|null} 无档案可展示时返回 null
   */
  function _buildOptimizePersonalizedOnly(rawText) {
    const lang = _optimizeLang();
    const personaBlock = _getPersonaBlockBody();
    if (personaBlock == null) return null;

    const parts = [
      _optimizeUiLangPriorityHeader(lang),
      _personaSectionWithHeader(lang, personaBlock),
      _polishTextSection(lang, rawText),
      ..._polishOutputTail(lang),
    ];
    return parts.join('\n\n---\n\n');
  }

  /**
   * Google 指南要点 + 用户个性档案 + 待优化正文
   * @returns {string|null} 无档案时返回 null
   */
  function _buildOptimizeBoth(rawText) {
    const lang = _optimizeLang();
    const personaBlock = _getPersonaBlockBody();
    if (personaBlock == null) return null;

    const parts = [
      _optimizeUiLangPriorityHeader(lang),
      _googlePrimerBlock(lang),
      _personaSectionWithHeader(lang, personaBlock),
      _mergePersonaAndPrimerInstruction(lang),
      _bothExpertOutputContract(lang),
      _polishTextSection(lang, rawText),
      ..._polishOutputTailBoth(lang),
    ];
    return parts.join('\n\n---\n\n');
  }

  function _needPersonaMsg(lang) {
    if (lang === 'en') return 'Please fill in AI Profile (Settings) first, or use ✨ AI Optimize (Google guide only).';
    if (lang === 'ko') return '먼저 AI 프로필을 입력하거나 「AI 최적화」만 사용하세요.';
    return '请先在「设置 → AI 个性档案」填写信息，或仅使用「AI优化」（仅 Google 指南）。';
  }

  /**
   * @param {Object} [opts]
   * @param {'google'|'personalized'|'both'} [opts.mode='google']  google=仅指南；personalized=仅用户档案；both=指南+档案
   */
  async function optimizeSnippet(snippetId, text, onDone, opts) {
    const cfg = _cfg();
    if (!cfg.apiKey) {
      alert(_needApiKeyMsg(cfg.lang));
      return;
    }

    const mode =
      opts?.mode === 'personalized'
        ? 'personalized'
        : opts?.mode === 'both'
          ? 'both'
          : 'google';
    // 「AI优化」只对脚本正文润色：不要套用 Agency 的 wrapSelection（会与指令包装冲突导致空输出）
    const augText = text;
    let wrapped;
    if (mode === 'personalized') {
      wrapped = _buildOptimizePersonalizedOnly(augText);
      if (wrapped == null) {
        alert(_needPersonaMsg(cfg.lang));
        return;
      }
    } else if (mode === 'both') {
      wrapped = _buildOptimizeBoth(augText);
      if (wrapped == null) {
        alert(_needPersonaMsg(cfg.lang));
        return;
      }
    } else {
      wrapped = _buildOptimizeGoogleOnly(augText);
    }

    _backupId = snippetId || 'temp';
    TwCommandLayer.backup(_backupId, text);

    const optCfg = { ...cfg, maxTokens: Math.max(Number(cfg.maxTokens) || 1500, 6144) };

    let full = '';
    try {
      for await (const chunk of TwCommandLayer.execute('rewrite', wrapped, optCfg)) {
        full += chunk;
      }
      if (!String(full).trim()) {
        const olang = _optimizeLang();
        const retryUser =
          mode === 'google'
            ? `${_optimizeUiLangPriorityHeader(olang)}\n\n---\n\n${text}`
            : wrapped;
        console.warn(
          '[TalkwebSour AI] 优化无增量，重试一次',
          { mode, retryKeepsPersona: mode !== 'google' },
        );
        full = '';
        for await (const chunk of TwCommandLayer.execute('rewrite', retryUser, optCfg)) {
          full += chunk;
        }
      }
      if (!String(full).trim()) {
        TwCommandLayer.clearBackup(_backupId);
        console.error('[TalkwebSour AI] optimize empty', {
          mode,
          provider: cfg.provider,
          model: cfg.model,
          apiUrl: cfg.apiUrl,
          hint: '打开 DevTools → Console/Network 查看 SSE 或接口报错；千问可尝试将 Base URL 改为 …/compatible-mode/v1',
        });
        alert(
          cfg.lang === 'en'
            ? 'AI returned empty text. Check Console for details. Try: another model, shorter text, or Qwen compatible-mode Base URL.'
            : cfg.lang === 'ko'
              ? 'AI 빈 응답. 콘솔 확인. 모델 변경·짧은 본문·Qwen compatible URL 시도.'
              : 'AI 返回内容为空（详见浏览器控制台 Console）。可尝试：换模型、缩短正文；千问可改用 …/compatible-mode/v1 兼容地址后重试。',
        );
        return;
      }
      onDone?.(full);
    } catch (err) {
      TwCommandLayer.clearBackup(_backupId);
      alert(_formatAIError(err, cfg));
    }
  }

  /**
   * 恢复 Snippet 编辑框的原始内容。
   * @param {string}   snippetId
   * @param {Function} onRestored  (originalText) → void
   */
  function restoreSnippet(snippetId, onRestored) {
    const id  = snippetId || 'temp';
    const ori = TwCommandLayer.restore(id);
    if (ori !== null) {
      onRestored?.(ori);
      TwCommandLayer.clearBackup(id);
    }
  }

  /**
   * 检查某 snippetId 是否有原文备份（用于控制「恢复」按钮的显示）。
   */
  function hasBackup(snippetId) {
    return TwCommandLayer.hasBackup(snippetId || 'temp');
  }

  /** 快速模式已打开时，用最新 snippets（含 useCount）刷新列表 */
  function refreshPaletteIfOpen() {
    try {
      const el = _root?.querySelector('#twar-overlay');
      if (!el?.classList.contains('open')) return;
      const cfg = _cfg();
      const snippets = _getState?.()?.snippets || [];
      const hasKey = !!cfg.apiKey;
      const cmds = hasKey
        ? _buildSmartPaletteItems(_pendingText || '', cfg)
        : _snippetsToPaletteItems(snippets);
      TwRenderLayer.setPaletteCommands?.(cmds);
      TwRenderLayer.refreshPaletteAgencyStrip?.();
    } catch (e) {
      console.warn('[TwAiRewrite] refreshPaletteIfOpen', e);
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  初始化
  // ─────────────────────────────────────────────────────────────
  /**
   * 由 content.js 的 init() 调用。
   * @param {ShadowRoot} shadowRoot  插件的 Shadow DOM root
   * @param {Function}   getStateFn () => state 访问器
   */
  function init(shadowRoot, getStateFn) {
    if (!shadowRoot || !getStateFn) {
      console.warn('[TwAiRewrite] init() 缺少参数，跳过初始化');
      return;
    }

    _root     = shadowRoot;
    _getState = getStateFn;

    if (window.TwAgencyCompose && typeof TwAgencyCompose.init === 'function') {
      TwAgencyCompose.init(getStateFn);
    }

    // 初始化 Render 层（注入 UI 到 Shadow DOM）
    TwRenderLayer.init(shadowRoot, {
      onCommand: _onCommand,
      onSelect:  _onSelect,   // 离线模式选中后展开编辑区
      onAccept:  _onAccept,
      onReject:  _onReject,
      onDiff:    _onDiff,
      onEditorAskAI: _runSnippetEditorAskAI,
      onEditorChatReset: _resetSnippetEditorChat,
      onPaletteAgencyChat: openPaletteAgencyChat,
      onHistoryRestore: _restorePaletteChatSession,
    });

    // 初始化 Trigger 层（监听页面事件）
    TwTriggerLayer.init({
      onTrigger: _onTrigger,
      onSelect:  (text) => { _pendingText = text; },
      getHotkeys: () => _getState?.()?.hotkeys,
    });

    console.info('[TwAiRewrite] 初始化完成 ✓');
  }

  // ─────────────────────────────────────────────────────────────
  //  从外部（侧边栏按钮）打开面板
  //  使用最后聚焦的输入框作为写回目标，不依赖快捷键触发
  // ─────────────────────────────────────────────────────────────
  /**
   * 由 background chrome.commands 调用：先同步选区再走与快捷键相同的逻辑。
   * @param {string} mode  'palette' | 'rewrite' | 'shorten' | 'translate' | ...
   */
  function triggerByMode(mode) {
    _source =
      (window.TwTriggerLayer?.getLastInputFocus && TwTriggerLayer.getLastInputFocus()) ||
      document.activeElement;
    let text = '';
    try {
      text = window.getSelection()?.toString()?.trim() || '';
    } catch (_) {}
    if (!text && window.TwTriggerLayer?.getSelectedText) {
      text = TwTriggerLayer.getSelectedText() || '';
    }
    _pendingText = text;
    _onTrigger(text, mode);
  }

  function openSearchPalette() {
    console.log('[TwAiRewrite] openSearchPalette 被调用');
    
    // 优先用 Trigger 层记录的最后输入焦点，其次用当前活动元素
    _source      = (window.TwTriggerLayer?.getLastInputFocus()) || document.activeElement;
    _pendingText = window.TwTriggerLayer?.getSelectedText() || '';

    const cfg = _cfg();
    console.log('[TwAiRewrite] API Key:', cfg.apiKey ? '已配置' : '未配置');

    const mode = _getState?.()?.aiPaletteMode || 'compact';

    if (!cfg.apiKey) {
      const snippets = _getState?.()?.snippets || [];
      console.log('[TwAiRewrite] 无 API Key，展示提示语列表（离线模式），数量:', snippets.length, 'mode:', mode);
      const items    = _snippetsToPaletteItems(snippets);
      TwRenderLayer.openPalette(items, cfg.lang, '', {
        placeholder: _uiMsg(cfg.lang, '输入 / 搜索提示语...', 'Type / to search snippets...', '스크립트 검색 / 입력…'),
        emptyHint: _uiMsg(
          cfg.lang,
          '还没有提示语，请先在侧边栏添加',
          'No snippets yet — add some in the sidebar first.',
          '스크립트가 없습니다. 사이드바에서 추가하세요.',
        ),
        isOfflineMode: true,
        mode: mode,  // 'compact' | 'full'
        labels: _paletteUiLabels(cfg),
      });
    } else {
      console.log('[TwAiRewrite] 有 API Key，展示 AI 指令面板（在线模式），mode:', mode);
      TwRenderLayer.openPalette(_buildSmartPaletteItems(_pendingText, cfg), cfg.lang, _pendingText, {
        isOfflineMode: false,
        mode: mode,
        showRecommendation: true,
        recommendationTitle: _uiMsg(cfg.lang, '推荐 script：', 'Recommended script:', '추천 스크립트:'),
        labels: _paletteUiLabels(cfg),
      });
    }
  }

  // ── 暴露到 window ─────────────────────────────────────────────
  return {
    init,
    optimizeSnippet,
    restoreSnippet,
    hasBackup,
    openSearchPalette,
    openPaletteAgencyChat,
    triggerByMode,
    refreshPaletteIfOpen,
  };
})();

// 挂载到 window，供 content.js 调用
window.TwAiRewrite = TwAiRewrite;
