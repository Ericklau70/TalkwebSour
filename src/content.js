// TalkwebSour V3.5 — Groups + zh/en/ko i18n + Shadow DOM + Agency / SuperStar
(function () {
  'use strict';

  /** 运行在 Chrome Side Panel（扩展页 sidepanel.html）内为 true；网页内注入的 content script 为 false */
  const TW_IS_SIDE_PANEL =
    typeof location !== 'undefined' &&
    location.protocol === 'chrome-extension:' &&
    /\/sidepanel\.html(\?.*)?$/.test(location.pathname || '');

  /** 同一标签页、同一站点内记住侧栏是否应显示（Gemini 等 SPA 换 URL 后 content 会重跑，用 sessionStorage 恢复意图） */
  const TW_SIDEBAR_INTENT_KEY = 'tw_talkweb_sidebar_intent';

  // If already injected, sync visibility from session intent and stop（避免重复绑定）
  if (!TW_IS_SIDE_PANEL) {
    const _existingHost = document.getElementById('talkweb-sour-host');
    if (_existingHost) {
      const _sr = _existingHost.shadowRoot;
      if (_sr) {
        const _sb = _sr.getElementById('sb');
        if (_sb) {
          try {
            if (sessionStorage.getItem(TW_SIDEBAR_INTENT_KEY) === '1') _sb.classList.remove('hidden');
            else _sb.classList.add('hidden');
            const open = !_sb.classList.contains('hidden');
            const cs = getComputedStyle(_sb);
            const rPx = parseFloat(cs.right) || 0;
            const wPx = _sb.getBoundingClientRect().width || 320;
            const gutter = Math.min(window.innerWidth, Math.round(wPx + rPx));
            document.documentElement.style.paddingRight = open ? `${gutter}px` : '';
          } catch (_) {}
        }
      }
      return;
    }
  }

  /**
   * 基于 Google《Gemini for Google Workspace Prompt Guide》（公开 PDF）与
   * Google Cloud 公开「提示工程」介绍、社区 prompts.chat 用法的思路整理；非原文转载。
   * PDF：https://services.google.com/fh/files/misc/gemini_for_workspace_prompt_guide_october_2024_digital_final.pdf
   */
  const TW_GEMINI_WORKSPACE_GUIDE = {
    zh: [
      { title: '⚡ 三种 AI 润色', content: '编辑语句时：\n• 「✨ AI优化」→ 仅按公开指南要点（Workspace + 通用提示工程思路）润色，不含个性档案。\n• 「个性化优化」→ 仅按「AI 个性档案」润色，不含指南块。\n• 「专业+个性」→ 指南与档案同时生效（需已填写档案）。\n\n设置里「AI 归纳档案」在已配置 API 时，会结合公开提示工程要点，确认你的填写并强化「职位+性格」合一的专业人设；归纳填入下方文本框后可编辑再保存。\n\nWorkspace 指南 PDF：\nhttps://services.google.com/fh/files/misc/gemini_for_workspace_prompt_guide_october_2024_digital_final.pdf' },
      { title: '📘 Workspace 提示词四要素', content: '（思路来源：Google Gemini for Workspace 公开指南）\n\n写提示时可按需组合四块：\n1) Persona 角色：你希望 AI 扮演谁（岗位、专业度、语气）。\n2) Task 任务：要完成的动作（写、改、总结、翻译、列提纲等）。\n3) Context 上下文：背景、受众、限制条件、已有材料要点。\n4) Format 格式：段落/要点/表格/邮件结构/字数上限等。\n\n不必四项全写，但多给几项通常更稳。用自然、完整的句子描述，像和同事交代工作一样。' },
      { title: '📗 提示工程速览（Google Cloud）', content: '公开资料中的通用要点（非全文转载）：\n• 提示格式：自然语言指令、直接命令或分字段结构，按任务选对清晰度。\n• 上下文与示例：补充背景、必要时用少样本（few-shot）稳定风格。\n• 复杂任务：可分步推理（Chain-of-Thought）再输出结论。\n• 多轮对话与迭代：短句多轮往往优于一次超长提示。\n\n延伸阅读：\nhttps://cloud.google.com/discover/what-is-prompt-engineering\nhttps://cloud.google.com/vertex-ai/generative-ai/docs/learn/introduction-prompt-design' },
      { title: '📚 社区提示库 prompts.chat', content: '可在「导入 Prompts」里一键拉取官方 prompts.csv（数据 CC0），与本扩展语句格式兼容。\n\n仓库：\nhttps://github.com/f/prompts.chat\n浏览：\nhttps://prompts.chat/prompts' },
      { title: '✳️ 四要素填空模板', content: '你是{{资深业务顾问:lang:角色}}。\n\n任务：{{用要点列出下一步行动:task:具体任务}}。\n\n背景与材料：\n（粘贴或概括关键信息）\n\n输出要求：\n- 格式：{{分条、每条不超过20字:format:格式}}\n- 受众：{{直属经理:task:读者}}\n- 其他限制：' },
      { title: '📧 工作邮件（四要素示例）', content: '你是{{熟悉商务邮件的项目经理:lang:角色}}。\n\n任务：根据下列要点写一封给{{客户方对接人:task:收件人}}的邮件，目的是{{确认需求并约定下周会议时间:task:目的}}。\n\n上下文：我们刚完成初版方案，对方希望压缩预算；需保持合作态度、语气专业克制。\n\n格式：主题行 + 简短正文（不超过{{180字:task:字数}}）+ 结尾致谢。' },
      { title: '🔁 迭代优化用语', content: '在得到初稿后，可继续用简短追问迭代，例如：\n- 「再具体一点：为每条建议补一个可执行的例子。」\n- 「缩短为三条要点，去掉形容词。」\n- 「把第二段改成更适合{{非技术背景的总监:task:受众}}的说法。」\n- 「按时间顺序重排，并标出依赖关系。」\n\n把 AI 当对话伙伴，多轮往往比一次超长提示更有效。' },
      { title: '✅ 发出提示前自检', content: '发送前快速检查：\n□ 角色（Persona）是否清楚\n□ 任务（Task）是否单一、可执行\n□ 是否给了足够上下文（Context）\n□ 输出版式/长度（Format）是否写明\n□ 若涉及事实或数据，是否注明「以所给材料为准」避免编造\n\n输出后务必人工核对事实与合规性，再用于正式场合。' },
    ],
    en: [
      { title: '⚡ Three polish modes', content: 'In the snippet editor:\n• ✨ AI polish — public guide only (Workspace + general prompt-engineering ideas), no profile.\n• Personalize — AI Profile only, no guide block.\n• Pro + Profile — both guide and profile (profile required).\n\nIn Settings, 「Summarize with AI」 (with API saved) confirms your fields and strengthens a fused professional + personal voice from role + tone; edit the summary box, then save.\n\nWorkspace guide PDF:\nhttps://services.google.com/fh/files/misc/gemini_for_workspace_prompt_guide_october_2024_digital_final.pdf' },
      { title: '📘 Workspace prompt framework', content: '(Based on Google’s public Gemini for Workspace Prompt Guide — ideas only, not a full reproduction.)\n\nCombine four building blocks as needed:\n1) Persona — who the model should be (role, expertise, tone).\n2) Task — the action (write, edit, summarize, translate, outline…).\n3) Context — audience, constraints, and key facts from your materials.\n4) Format — bullets, table, email structure, word limit, etc.\n\nUse clear, natural sentences; you do not need all four every time, but more detail usually helps.' },
      { title: '📗 Prompt engineering (Google Cloud)', content: 'Public-overview ideas (not a full copy):\n• Format: natural instructions, direct commands, or structured fields.\n• Context & examples: add background; few-shot can stabilize style.\n• Hard tasks: chain-of-thought style reasoning, then the final answer.\n• Multi-turn & iteration: short follow-ups often beat one giant prompt.\n\nRead more:\nhttps://cloud.google.com/discover/what-is-prompt-engineering\nhttps://cloud.google.com/vertex-ai/generative-ai/docs/learn/introduction-prompt-design' },
      { title: '📚 prompts.chat library', content: 'Use Import Prompts → fetch official prompts.csv (CC0 data), compatible with this extension.\n\nRepo:\nhttps://github.com/f/prompts.chat\nBrowse:\nhttps://prompts.chat/prompts' },
      { title: '✳️ Fill-in template', content: 'You are a {{senior product consultant:lang:role}}.\n\nTask: {{List the next actions as bullet points:task:task}}.\n\nContext:\n(paste or summarize key facts)\n\nOutput requirements:\n- Format: {{short bullets:format:format}}\n- Audience: {{my director:task:reader}}\n- Constraints:' },
      { title: '📧 Work email example', content: 'You are a {{PM who writes concise business emails:lang:role}}.\n\nTask: Draft an email to {{the client owner:task:recipient}} to {{confirm scope and propose two meeting slots next week:task:goal}}.\n\nContext: We delivered v1; they asked to cut budget; stay collaborative and professional.\n\nFormat: subject line + body under {{120 words:task:limit}} + brief closing.' },
      { title: '🔁 Iteration prompts', content: 'After a first draft, refine with short follow-ups, e.g.:\n- “Add one concrete example per recommendation.”\n- “Compress to three bullets; remove adjectives.”\n- “Rewrite paragraph 2 for a {{non-technical executive:task:audience}}.”\n\nTreat it as a conversation; multiple short turns often beat one giant prompt.' },
      { title: '✅ Pre-flight checklist', content: 'Before you send:\n□ Persona clear\n□ Task is single and actionable\n□ Enough context\n□ Format / length specified\n□ If facts matter, say “only use the provided material”\n\nAlways review outputs for accuracy before production use.' },
    ],
    ko: [
      { title: '⚡ AI 다듬기 세 가지', content: '편집창:\n• 「AI 다듬기」= 공개 가이드만.\n• 「맞춤 다듬기」= 프로필만.\n• 「전문+맞춤」= 가이드+프로필.\n설정에서 API 저장 후 「AI 요약」으로 입력 확인·직무+톤 융합 페르소나 강화; 아래 칸 편집 후 저장.\n\nPDF:\nhttps://services.google.com/fh/files/misc/gemini_for_workspace_prompt_guide_october_2024_digital_final.pdf' },
      { title: '📘 Workspace 프롬프트 프레임', content: '(Google Gemini for Workspace 공개 가이드의 구조를 참고한 요약, 전문 재인용 아님.)\n\n필요에 따라 네 가지를 조합: 1) 역할(Persona) 2) 작업(Task) 3) 맥락(Context) 4) 형식(Format). 자연스러운 문장으로 구체적으로 쓸수록 좋습니다.' },
      { title: '📗 프롬프트 엔지니어링(Google Cloud)', content: '공개 자료 요지: 형식·맥락·예시, few-shot, 복잡한 작업은 단계적 추론(CoT), 다회 대화·반복 개선.\nhttps://cloud.google.com/discover/what-is-prompt-engineering' },
      { title: '📚 prompts.chat 라이브러리', content: '가져오기에서 prompts.csv를 한 번에 받을 수 있습니다(CC0).\nhttps://github.com/f/prompts.chat · https://prompts.chat/prompts' },
      { title: '✳️ 빈칸 템플릿', content: '당신은 {{시니어 컨설턴트:lang:역할}}입니다.\n\n작업: {{다음 조치를 불릿으로:task:작업}}.\n\n맥락:\n(핵심 정보 요약)\n\n출력: {{짧은 불릿:format:형식}}, 독자는 {{팀장:task:독자}}.' },
      { title: '📧 업무 메일 예시', content: '역할: {{비즈니스 메일에 익숙한 PM:lang:역할}}.\n작업: {{고객 담당자:task:수신인}}에게 예산 조정 후속 메일 초안.\n맥락: 협력적이되 전문적인 톤.\n형식: 제목 + 본문 {{200단어:task:한도}} 이내.' },
      { title: '🔁 후속 질문', content: '예: 「더 구체적인 예시를 각 항목에」「세 줄 요약으로」「비전문가에게 맞게 두 번째 단락 수정」등 짧은 후속으로 다듬기.' },
      { title: '✅ 점검', content: '역할·작업·맥락·형식이 분명한지 확인. 사실이 중요하면「제공된 자료만 사용」을 명시. 배포 전 사람이 검토.' },
    ],
  };

  /** prompts.chat 官方 CSV（CC0）；导入弹窗一键拉取 */
  const TW_PROMPTS_CHAT_CSV_URL =
    'https://raw.githubusercontent.com/f/prompts.chat/main/prompts.csv';

  /** 注入「AI 优化」请求：Workspace 指南 + Google Cloud 公开「提示工程」思路（浓缩，非逐字引用） */
  const TW_GOOGLE_PROMPT_PRIMER = {
    zh:
      '润色时须体现以下结构意识（来源：Google《Gemini for Google Workspace Prompt Guide》公开 PDF 与 '
      + 'https://cloud.google.com/discover/what-is-prompt-engineering 等公开介绍中的通用思路，非逐字引用）：\n'
      + '1) Persona / Task / Context / Format：角色、单一可执行的任务、上下文与材料边界（勿编造）、输出格式与长度。\n'
      + '2) 复杂表述可先理清逻辑层次（类分步推理 / Chain-of-Thought），再落成最终正文；保持条理。\n'
      + '3) 需要稳定术语或风格时，可参考少样本（few-shot）思路：前后一致；无示例时不要臆造细节。\n'
      + '4) 多轮迭代优于一次含糊指令；本轮只输出优化后的正文。\n'
      + '用语自然、完整；输出仅保留优化后的正文。',
    en:
      'When polishing, apply ideas from the public Gemini for Workspace Prompt Guide and general prompt-engineering guidance '
      + '(e.g. Google Cloud “what is prompt engineering” — condensed, not quoted): '
      + '(1) Persona, Task, Context, Format; (2) for complex text, structure reasoning then finalize (CoT-style when helpful); '
      + '(3) few-shot consistency for terminology/tone when relevant — never invent details; '
      + '(4) iterative refinement beats one vague instruction. '
      + 'Output only the polished body text.',
    ko:
      '다듬을 때 Workspace용 Gemini 공개 가이드와 Google Cloud의 일반 프롬프트 엔지니어링 소개(요약·비전문 인용)를 반영하세요: '
      + '(1) 역할·작업·맥락·형식 (2) 복잡하면 단계적 사고 후 정리 (3) few-shot 일관성, 세부 사실 지어내기 금지 (4) 반복 개선. '
      + '최적화된 본문만 출력.',
  };

  // ── I18N ────────────────────────────────────────────────────
  const LANG = {
    zh: {
      opacity:'透明度', fontSizeLabel:'界面字体', fontSize1:'小', fontSize2:'标准', fontSize3:'大', fontSize4:'特大',
      search:'快速搜索...', addSnippet:'＋ 新建语句', addGroup:'＋ 新建分组',
      close:'关闭', noGroup:'未分组', emptyText:'没有找到匹配的语句',
      varBadge:'变量', varTitle:'⬡ 修改变量', varPreview:'预览结果',
      cancel:'取消', varCopy:'✓ 复制语句', customPlh:'自定义输入...',
      newSnippet:'新建语句片段', editSnippet:'编辑语句片段',
      newGroup:'新建分组', editGroup:'编辑分组名称',
      lTitle:'标题', lCat:'分类', lContent:'内容', lGroup:'所属分组', lGroupName:'分组名称',
      phTitle:'简短描述...', phContent:'输入语句，变量格式：{{默认值:lang:语言}}',
      varHint:'变量语法：{{默认值:类型:标签}} | lang 语言 · tone 语气 · task 任务',
      save:'保存', copied:'✓ 已复制', livePreview:'实时预览', kwTitle:'关键词高亮设置', kwAdd:'添加关键词', kwPlh:'输入关键词...', kwLang:'语言类', kwTone:'语气类', kwTask:'任务类', kwSave:'保存', kwEmpty:'暂无自定义关键词', kwManage:'⚙ 关键词', deleteGroup:'删除分组', importPrompts:'⬇ 导入 Prompts', importTitle:'导入外部 Agent Prompts', importUrl:'URL (GitHub Raw / 直链 JSON)', importPaste:'或粘贴 JSON', importBtn:'导入', importOk:'导入成功',       importErr:'导入失败', importHint:'支持：JSON 数组、换行纯文本，或 prompts.chat 的 prompts.csv（表头 act,prompt,...）', importPickFile:'选择 JSON / CSV 文件', importPromptsChat:'⬇ prompts.chat CSV', importPromptsChatHint:'数据来自 github.com/f/prompts.chat（CC0）。约上万条，导入时请稍候。',
      backupBtn:'⬆⬇ 备份与同步', backupTitle:'备份与同步', exportAll:'导出全部', importBackup:'导入备份',
      sidebarResizeVTitle:'向下拖动拉高主界面；双击恢复自动高度',
      exportOne:'导出', importOneHint:'粘贴单条 JSON（talkweb-snippet）后导入',
      importGroupHint:'粘贴分组 JSON（talkweb-group）', mergeImport:'合并到当前', replaceImport:'替换全部数据',
      replaceWarn:'将覆盖当前所有语句、分组与设置（谨慎）', downloadFile:'下载 JSON', applyImport:'执行导入',
      backupOk:'完成', backupErr:'格式错误', snippetJsonApply:'应用 JSON 到表单', snippetContentMarker:'内容：', exportGroup:'导出分组',
      includeSecrets:'导出中包含 API 密钥（谨慎）', versionLabel:'V3.5',
      agencyHubTip:'Agency·名人（可选增强提示词）',
      agencyModalTitle:'Agency · SuperStar',
      agencyTabBuiltin:'官方 Agent',
      agencyTabVoice:'说话风格',
      agencyVoiceBuiltinSection:'内置',
      agencyVoiceMineSection:'我的',
      agencyVoiceNoMatch:'无匹配项',
      agencyTabUAgent:'我的 Agent',
      agencySearchPh:'搜索 Agent…',
      agencyTaskLabel:'任务说明（可选）',
      agencyTaskHint:'不填时，将使用当前快捷指令作为「任务定义」层。',
      agencyChipsTitle:'当前选择',
      agencyChipStar:'风格 · ',
      agencyChipAgent:'Agent · ',
      agencyNoSel:'未选增强项（可直接用 ⚡ 指令）',
      agencyEmpty:'暂无索引，请在本机运行 npm run build:agency',
      agencyNoUserAgent:'暂无自定义 Agent',
      agencyNoUserStar:'暂无自定义风格',
      agencyNewAgentTitle:'标题',
      agencyNewAgentBody:'正文（规则与输出格式）',
      agencyNewStarName:'显示名称',
      agencyNewStarOne:'一句话人设',
      agencyNewStarVoice:'说话习惯',
      agencyAddBtn:'添加',
      agencyPrefetchLabel:'预载 Agency 索引（打开本面板时加载，加快选用）',
      agencyEnhanceLabel:'启用说话风格与 Agent（勾选后才会拼接到模型请求）',
      agencyEnhanceInjectSuffix:' · 未注入模型',
      paletteAgencyToggle:'拼接增强',
      paletteAgencyClearVoice:'去风格',
      paletteAgencyClearAgent:'去 Agent',
      paletteAgencyOpenHub:'Agency',
      paletteAgencyEmpty:'未选说话风格或 Agent',
      paletteAgencySkill:'技能摘要',
      paletteAgencyEnhanceOnHint:'✓ 已勾选：所选说话风格与 Agent 将拼入模型请求。',
      paletteAgencyEnhanceOffHint:'○ 未勾选「拼接增强」：请求中不带说话风格与 Agent。',
      paletteAgencyStripNeutral:'未选风格或 Agent 时，「拼接增强」对请求无影响。选好后请在此打勾才会注入模型。',
      paletteAgencyHubBtnTip:'打开 Agency 设置（说话风格 / 官方与我的 Agent）',
      agencyUserAgentSavedToast:'已保存到「我的 Agent」，可在列表中点选或点 📄 查看全文',
      agencyUserStarSavedToast:'已保存到「我的风格」，可在列表中点选或点 📄 查看全文',
      agencyDetailModalTitle:'正文预览',
      agencyDetailClose:'关闭',
      agencyDetailLoading:'加载中…',
      agencyDetailBtnTip:'查看完整正文（发送给模型的内容规模可能很大）',
      agencyAutoSaveHint:'选择会立即保存到本机，无需单独点「保存」。点选后已生效，「完成」仅用于关闭并提示；「关闭」直接关窗（同样已保存）。',
      agencyBuiltinLangNote:'分类名与官方 Agent 标题、摘要均随界面语言切换（内置 ui-l10n/zh、en、ko）。发送给模型的正文仍为上游仓库原始内容。',
      agencyClearSelBtn:'清除所选（风格+Agent）',
      agencyDoneBtn:'完成',
      agencySavedToast:'已同步到本机',
      agencyChipClearTitle:'移除此项',
      agencyAiLabel:'AI 生成说话风格（写入「我的风格」）',
      agencyAiPlaceholder:'例如：周润发风格、江湖口吻、电影感架构师…',
      agencyAiBtn:'AI化',
      agencyAiBusy:'生成中…',
      agencyAiNeedKey:'请先在设置中填写 AI API Key、接口地址与模型。',
      agencyAiPromptEmpty:'请先输入风格或人设描述。',
      agencyAiDoneToast:'已生成并选中「我的风格」',
      agencyStackPlus:' ＋ ',
      agencyCardEdit:'编辑',
      agencyCardDelete:'删除',
      agencyCardHide:'从列表隐藏',
      agencyCardRestore:'恢复显示',
      agencyCardFork:'复制为我的',
      agencyForkSuffix:'副本',
      agencyEditUserAgentTitle:'编辑我的 Agent',
      agencyEditUserStarTitle:'编辑我的风格',
      agencyEditSave:'保存',
      agencyEditCancel:'取消',
      agencyHiddenBuiltinBar:'已隐藏的内置项',
      agencyNoHidden:'无',
      agencyDevHint:'npm run generate:agency-l10n 可生成界面用语翻译文件（需联网）。开发改上游后：install.prefs 中 BUILD_AGENCY_AFTER_INSTALL=1 以重建索引。',
      shareSectionTitle:'协作与共享',
      shareSmbFtpNote:'说明：浏览器扩展无法直接挂载 SMB 或访问 FTP。请将「导出文件夹」或 JSON 备份保存到公司共享盘（如 \\\\服务器\\共享\\TalkWebSour），同事用同一扩展「从文件夹导入」即可。',
      mailRecipientsPh:'收件人（可选，逗号分隔，将打开系统默认邮件客户端）',
      packAndOpenMail:'打包并打开邮件',
      packMailHint:'先下载完整备份 JSON，再打开邮件（Apple 邮件、Outlook 等由系统决定）。mailto 无法自动附带附件，请在写信窗口中手动附加刚下载的文件。',
      smbPathLabel:'局域网路径备忘（仅本地保存，便于复制给同事）',
      copySmbGuide:'复制共享说明',
      smbGuideCopied:'已复制说明到剪贴板',
      webdavBlockTitle:'WebDAV 上传（NAS / Nextcloud / 坚果云 WebDAV 等）',
      webdavUrlPh:'https://example.com/remote.php/dav/files/用户名/TalkWebSour/backup.json',
      webdavUserPh:'用户名（可空）',
      webdavPassPh:'密码或应用专用密码',
      webdavUploadBtn:'上传当前备份 JSON',
      cloudPostTitle:'自定义云端（HTTPS POST）',
      cloudPostHint:'适用于自建接口、云函数、中间层等；需服务端允许扩展跨域或返回 CORS。阿里云 OSS / Google Drive 完整对接需各平台 OAuth，此处用通用 POST 由你方服务转发。',
      cloudPostUrlPh:'https://api.example.com/talkweb/backup',
      cloudPostTokenPh:'Bearer Token（可空）',
      cloudPostBtn:'POST 备份 JSON',
      shareSavePrefs:'保存协作设置',
      shareUploadOk:'上传成功',
      shareUploadErr:'上传失败',
      personaTitle:'🧩 AI 个性档案',
      personaIntro:'这些信息用于「你的专属 AI」语气与背景。填好 API 后：「AI 归纳档案」可强化人设；「生成可爱头像」会用当前模型生成 SVG 头像（失败则用插画头像），展示尺寸固定不影响排版。',
      personaNick:'称呼 / 昵称',
      personaJob:'职位 / 行业',
      personaRolePreset:'职位角色预设',
      personaRoleHintTitle:'角色要点预览（写入优化提示）',
      personaPersonality:'性格与语气',
      personaNationality:'国籍或地区',
      personaSpeakLang:'常用语言',
      personaExtra:'其他补充',
      personaGenAvatar:'生成可爱头像',
      personaGenAvatarBusy:'生成中…',
      personaAvatarAiFail:'AI 未返回可用头像，已改用插画头像。可重试或检查模型。',
      personaAiSum:'AI 归纳档案',
      personaSummaryLabel:'AI 归纳（可编辑后保存）',
      personaSave:'保存并完成',
      personaLater:'稍后再说',
      personaOpenSettings:'🧩 编辑 AI 个性档案',
      personaSettingsBlurb:'新建语句提示与「专业+个性」优化会参考此处。',
      snippetPersonaHint:'💡 「AI优化」= 仅公开指南；「专业+个性」= 指南 + AI 个性档案（含职位预设）。',
      aiOptimizeFootnote:'「AI优化」：Workspace 与通用提示工程要点。「专业+个性」：在指南基础上叠加个性档案与职位预设（需先在设置中填写档案）。',
      personaSummaryPlaceholder:'点「AI 归纳档案」后，此处会填入「确认信息 + 专业人设 + 语气 + 边界」等要点；可编辑后再保存。',
      personaSummaryDone:'✓ 归纳已填入下方框内',
      personaSummaryFail:'AI 未返回归纳内容，可换模型或合并系统与用户的单次请求后重试。',
      snippetEscWarn:'已忽略 Esc：编辑内容未保存，请点「保存」或「取消」。',
      exportFolderBtn:'导出 TalkWebSour 文件夹',
      importFolderBtn:'从文件夹导入',
      folderExportHint:'与「导出全部」单文件备份内容一致，拆成三份 JSON：snippets.json、groups.json、extra.json（extra 含分组与语句以外的全部设置与协作偏好）。勾选「含 API 密钥」时 extra 中含密钥。',
      importFolderErr:'未找到有效的 snippets.json 与 groups.json（需使用本扩展「导出 TalkWebSour 文件夹」生成）。',
      settingsPersonaLink:'🧩 个性档案（语气/职位/头像）',
      confirmDel:'确认删除此分组？（语句不会被删除）',
      dragHint:'拖拽语句到此分组',
      sceneTitle:'🎭 选择你的场景',
      sceneSubtitle:'选择一个或多个场景，立即加载专业模板',
      sceneWorkplace:'💼 职场白领',
      sceneWorkplaceDesc:'邮件润色·会议纪要·向上汇报',
      sceneDeveloper:'💻 开发者',
      sceneDeveloperDesc:'代码审查·解释报错·API文档',
      sceneStudent:'🎓 学生/研究员',
      sceneStudentDesc:'论文润色·文献提炼·答辩预测',
      sceneCreator:'✍️ 内容创作者',
      sceneCreatorDesc:'爆款标题·社媒文案·SEO优化',
      sceneArchitect:'🏗️ 软件架构师',
      sceneArchitectDesc:'系统设计·技术选型·架构评审',
      sceneResearcher:'🔬 研究分析师',
      sceneResearcherDesc:'深度调研·数据分析·报告撰写',
      sceneProductManager:'🎯 产品经理',
      sceneProductManagerDesc:'需求文档·用户故事·产品规划',
      sceneDataAnalyst:'📊 数据分析师',
      sceneDataAnalystDesc:'数据清洗·可视化·洞察报告',
      sceneUIUXDesigner:'🎨 UI/UX设计师',
      sceneUIUXDesignerDesc:'用户体验·交互设计·设计评审',
      sceneBusinessStrategist:'💼 商业策略师',
      sceneBusinessStrategistDesc:'市场分析·商业模式·战略规划',
      sceneIntlTranslate:'🌐 翻译',
      sceneIntlTranslateDesc:'中译外职场/技术 · 单独分组',
      sceneIntlSop:'📑 企业标准化SOP',
      sceneIntlSopDesc:'通用流程文档 Markdown · 单独分组',
      sceneGraphicTemplates:'📐 图形模版',
      sceneGraphicTemplatesDesc:'流程/结构/时间/决策·Mermaid 等',
      sceneDesignWorkflow:'🎨 设计师级 AI 共创',
      sceneDesignWorkflowDesc:'蓝图先行·服装/插画/摄影/产品/视频',
      sceneLoad:'✓ 加载选中的模板',
      sceneSkip:'跳过，从空白开始',
      sceneBtn:'🎭 场景模板',
      sceneLoaded:'✓ 模板已加载',
      templateBtn:'📋 AI模版',
      templateTitle:'📋 创建AI助手模版',
      templateSubtitle:'填写以下信息生成专业的AI提示语',
      templateRole:'角色定位',
      templateRolePh:'例如：资深产品经理、技术专家、内容创作者...',
      templateWork:'工作内容',
      templateWorkPh:'例如：撰写产品需求文档、代码审查、文章创作...',
      templateSkills:'特定技能',
      templateSkillsPh:'例如：数据分析、用户研究、技术写作...',
      templateContext:'应用场景',
      templateContextPh:'例如：互联网公司、教育行业、电商平台...',
      templateGenerate:'✨ 生成模版',
      templateUse:'使用此模版',
      templateExamples:'💡 示例模版',
      aiOptimize:'✨ AI优化',
      aiOptimizeBoth:'专业+个性',
      aiOptimizing:'优化中...',
      aiBothOptimizing:'专业+个性优化中...',
      aiRestore:'↩ 恢复原文',
      aiApiKey:'AI API密钥',
      aiApiKeyPh:'OpenAI/兼容服务 Key；千问请填百炼 sk- 开头 Key，401 时核对地域 Base URL',
      aiApiUrl:'API地址',
      aiApiUrlPh:'https://api.openai.com/v1 或其他兼容地址',
      aiBaseUrlPreset:'常用 Base URL',
      aiBaseUrlCustom:'— 自定义（在下方输入完整地址）—',
      aiBaseUrlModelHint:'以下地址适用于当前所选模型；不符时请选「自定义」。',
      aiQwenRegionLabel:'千问地域（与 API Key 创建地域一致）',
      aiQwenRegionHint:'通用百炼 Key（sk- 开头）最常见 401 原因：控制台右上角「地域」与下方 Base URL 不一致（例：新加坡创建的 Key 必须选「新加坡」地址）。另：若为 sk-sp- 开头才是 Coding Plan 专用 Key，需用套餐内的 Base URL。',
      settings:'设置',
      settingsModalTitle:'设置',
      settingsSectionApi:'API 密钥与模型',
      settingsSectionConn:'生效配置与连接测试',
      settingsSectionHotkeys:'快捷键',
      settingsSectionSnippets:'语句与排序',
      snippetSortByScoreLabel:'按使用次数排序（常用在前）',
      snippetSortByScoreHint:'开启后，同一分组内次数高的语句排在前面；关闭后顺序由拖拽与添加顺序决定。卡片与⚡快速模式旁显示次数。复制或插入到页面时计一次。',
      snippetDangerClearAllLabel:'同时删除全部 script 与分组（危险）',
      snippetResetCountsBtn:'清零全部使用次数',
      snippetResetCountsConfirm:'确认将所有语句的使用次数清零？',
      snippetDangerClearAllConfirm:'已勾选危险操作：将删除全部 script 与分组。确认继续？',
      snippetResetCountsDone:'✓ 使用次数已清零',
      snippetDangerClearAllDone:'✓ 已删除全部 script 与分组',
      snippetUseCountTitle:'使用次数',
      aiProviderLabel:'AI 服务商',
      aiModelLabel:'AI 模型',
      hkPlatform:'平台',
      hkPlatformMac:'Mac',
      hkPlatformWin:'Windows',
      hkPalette:'AI 面板（⚡）',
      hkRewrite:'润色重写',
      hkShorten:'精简压缩',
      hkTranslateLabel:'翻译',
      hkSet:'设置',
      aiCompatHint:'支持 OpenAI API 或兼容服务（如 Azure OpenAI、Claude API 等）。\n保存设置后即可在编辑语句时使用 AI 优化等功能。',
      hkCaptureHint:'点击「设置」后，按下需要的快捷键组合；按 Esc 取消。',
      hkPressCombo:'按下组合…',
      hkSaved:'✓ 快捷键已保存',
      aiSettings:'🤖 AI设置',
      aiSave:'保存设置',
      aiNoKey:'请先在「设置」中配置 API 密钥',
      aiEffectiveCfg:'生效配置',
      aiEffectiveHint:'随上方表单实时更新；留空 API 地址则保存时使用当前服务商默认地址。',
      aiSumProvider:'服务商',
      aiSumBase:'Base URL',
      aiSumModel:'模型 ID',
      aiSumGeminiPath:'Gemini 请求路径（密钥通过参数 key= 传递）',
      aiTestConn:'测试连接',
      aiTesting:'测试中…',
      aiTestOk:'连接成功',
      aiTestProbe:'正在向模型提问以确认身份…',
      aiTestReplyTitle:'模型自检回答',
      aiTestNeedKey:'请先填写 API Key',
      aiModuleNotReady:'AI 模块未加载。请先打开侧边栏（扩展图标或快捷键）后再试。',
      langSelTitle:'🌐 选择界面语言',
      langSelSubtitle:'请先选择你偏好的界面语言',
      langSelChinese:'中文（简体）',
      langSelEnglish:'English',
      langSelKorean:'한국어',
      langSelConfirm:'✓ 确认选择',
      langLabel:'语言', toneLabel:'语气', taskLabel:'任务',
      langOpts:['韩文','英文','日文','中文','法文','德文','西班牙文'],
      toneOpts:['平稳正式','轻松友好','学术严谨','简洁直接','温暖亲切','权威专业'],
      taskOpts:['修改语法和语序','润色文字','仅翻译','总结要点','扩写内容','缩写精简'],
      defaultSnippets:[], // Empty by default - user selects via onboarding
      // Scene templates (4 categories × 6 prompts each)
      sceneTemplates: {
        workplace: [
          {id:'wp1',title:'📧 邮件润色',content:'请将下面这封邮件润色，使其更{{专业礼貌:tone:语气}}、清晰易懂，保留核心信息，适合{{上级:task:对象}}阅读：\n\n',groupId:null},
          {id:'wp2',title:'🙅 委婉拒绝',content:'请帮我用{{温暖亲切:tone:语气}}的方式拒绝以下请求，同时提供替代方案或表达理解，控制在{{150字:task:字数}}以内：\n\n',groupId:null},
          {id:'wp3',title:'📝 会议纪要',content:'请将下面的会议记录整理成{{简洁直接:tone:语气}}的纪要，包含：决策事项、行动清单、负责人、截止时间：\n\n',groupId:null},
          {id:'wp4',title:'📊 向上汇报',content:'请将以下工作进展整理成{{权威专业:tone:语气}}的向上汇报，突出成果、数据和下一步计划，{{300字:task:字数}}左右：\n\n',groupId:null},
          {id:'wp5',title:'💡 提案撰写',content:'请帮我将这个想法扩写成完整的提案，包含：背景、目标、方案、预期收益，语气{{学术严谨:tone:语气}}：\n\n',groupId:null},
          {id:'wp6',title:'⭐ 绩效评语',content:'请为以下员工表现撰写绩效评语，语气{{平稳正式:tone:语气}}，包含亮点、改进方向和鼓励，{{200字:task:字数}}：\n\n',groupId:null},
        ],
        developer: [
          {id:'dev1',title:'🔍 代码审查',content:'请审查以下代码，指出：1) 潜在bug  2) 性能问题  3) 安全隐患  4) 可读性建议  5) 最佳实践改进：\n\n```\n\n```',groupId:null},
          {id:'dev2',title:'❌ 解释报错',content:'请用{{简洁直接:tone:语气}}的语言解释下面这个报错信息，说明：根本原因、可能的触发场景、3个解决方案（从简到难）：\n\n',groupId:null},
          {id:'dev3',title:'📝 写注释',content:'请为下面的代码补充{{学术严谨:tone:语气}}的注释，包含：功能说明、参数解释、返回值、边界情况、复杂度：\n\n```\n\n```',groupId:null},
          {id:'dev4',title:'⚖️ 技术方案对比',content:'请对比以下{{2:task:数量}}个技术方案，从性能、开发成本、维护性、扩展性四个维度给出分析和推荐：\n\n方案A：\n\n方案B：\n\n',groupId:null},
          {id:'dev5',title:'📚 写API文档',content:'请为下面的API生成{{简洁直接:tone:语气}}的文档，包含：功能描述、请求参数、响应格式、示例代码、错误码说明：\n\n',groupId:null},
          {id:'dev6',title:'🔧 重构建议',content:'这段代码可以工作，但感觉不够优雅。请给出重构建议，重点关注：代码结构、命名规范、设计模式、可测试性：\n\n```\n\n```',groupId:null},
        ],
        student: [
          {id:'stu1',title:'📄 论文润色',content:'请帮我润色以下{{学术严谨:tone:语气}}的论文段落，提升表达的准确性和流畅度，保持学术规范，翻译为{{英文:lang:语言}}：\n\n',groupId:null},
          {id:'stu2',title:'📖 文献提炼',content:'请用{{简洁直接:tone:语气}}提炼下面这篇文献的核心内容：研究问题、方法、主要发现、局限性、对我研究的启发（{{300字:task:字数}}）：\n\n',groupId:null},
          {id:'stu3',title:'💡 概念解释',content:'请用{{轻松友好:tone:语气}}、通俗易懂的语言解释以下概念，包含：定义、举例、应用场景、与相关概念的区别：\n\n',groupId:null},
          {id:'stu4',title:'🎤 答辩预测',content:'我的论文主题是：[在这里填写]。请从{{权威专业:tone:语气}}的评委角度，预测5个可能被问到的尖锐问题，并给出应对思路。',groupId:null},
          {id:'stu5',title:'📋 写作大纲',content:'请为以下主题生成{{学术严谨:tone:语气}}的论文大纲，包含：引言、文献综述、方法论、预期结果、讨论、结论六个部分：\n\n主题：',groupId:null},
          {id:'stu6',title:'🔎 批判性分析',content:'请对以下观点进行批判性分析，指出：论证的逻辑链条、证据的充分性、可能的反驳角度、改进方向：\n\n',groupId:null},
        ],
        creator: [
          {id:'cre1',title:'🔥 爆款标题',content:'请为以下内容生成{{10:task:数量}}个吸引眼球的标题，风格{{轻松友好:tone:语气}}，包含数字、疑问、对比等元素：\n\n内容简介：',groupId:null},
          {id:'cre2',title:'🎨 风格改写',content:'请将下面的文字用{{温暖亲切:tone:语气}}的风格改写，目标受众是{{年轻人:task:对象}}，增加共鸣感和画面感：\n\n',groupId:null},
          {id:'cre3',title:'🔍 SEO描述',content:'请为以下内容撰写SEO友好的{{简洁直接:tone:语气}}描述（{{160字:task:字数}}以内），自然融入关键词，吸引点击：\n\n关键词：\n内容：',groupId:null},
          {id:'cre4',title:'📱 社媒文案',content:'请为{{小红书:task:平台}}写一条{{轻松友好:tone:语气}}的文案，包含emoji、话题标签、互动钩子，控制在{{200字:task:字数}}：\n\n产品/话题：',groupId:null},
          {id:'cre5',title:'🎁 产品介绍',content:'请为以下产品撰写{{权威专业:tone:语气}}的介绍文案，结构：痛点-解决方案-核心卖点-使用场景-行动号召：\n\n产品：',groupId:null},
          {id:'cre6',title:'💬 回复差评',content:'请用{{温暖亲切:tone:语气}}回复以下差评，真诚致歉、解释原因、给出补偿方案，展现品牌温度（{{150字:task:字数}}）：\n\n差评内容：',groupId:null},
        ],
        architect: [
          {id:'arc1',title:'🏗️ 系统架构设计',content:'请为以下需求设计{{权威专业:tone:语气}}的系统架构，包含：技术栈选型、核心模块划分、数据流设计、扩展性考虑：\n\n需求描述：',groupId:null},
          {id:'arc2',title:'⚖️ 技术选型分析',content:'请对以下{{3:task:数量}}个技术方案进行{{学术严谨:tone:语气}}的对比分析，从性能、成本、生态、团队熟悉度四个维度评估：\n\n方案A：\n方案B：\n方案C：',groupId:null},
          {id:'arc3',title:'📋 架构评审清单',content:'请为以下架构设计生成{{简洁直接:tone:语气}}的评审清单，包含：可扩展性、可维护性、安全性、性能、成本五个维度：\n\n架构概述：',groupId:null},
          {id:'arc4',title:'🔄 重构方案设计',content:'现有系统存在以下问题，请设计{{权威专业:tone:语气}}的重构方案，包含：问题分析、目标架构、迁移策略、风险控制：\n\n问题描述：',groupId:null},
          {id:'arc5',title:'📊 性能优化方案',content:'请为以下性能瓶颈设计{{简洁直接:tone:语气}}的优化方案，从代码层、架构层、基础设施层三个角度分析：\n\n瓶颈描述：',groupId:null},
          {id:'arc6',title:'🛡️ 安全架构设计',content:'请为以下系统设计{{学术严谨:tone:语气}}的安全架构，包含：认证授权、数据加密、网络隔离、审计日志：\n\n系统描述：',groupId:null},
        ],
        researcher: [
          {id:'res1',title:'🔍 深度行业调研',content:'请对{{AI行业:task:领域}}进行{{学术严谨:tone:语气}}的深度调研，包含：市场规模、主要玩家、技术趋势、未来机会（{{500字:task:字数}}）：',groupId:null},
          {id:'res2',title:'📊 竞品分析报告',content:'请对以下{{3:task:数量}}个竞品进行{{权威专业:tone:语气}}的对比分析，从功能、定价、用户评价、市场策略四个维度展开：\n\n竞品列表：',groupId:null},
          {id:'res3',title:'📈 数据洞察提炼',content:'请从以下数据中提炼{{简洁直接:tone:语气}}的核心洞察，包含：关键趋势、异常点、业务建议、下一步行动：\n\n数据概述：',groupId:null},
          {id:'res4',title:'📝 研究报告撰写',content:'请将以下调研素材整理成{{学术严谨:tone:语气}}的研究报告，结构：执行摘要、背景、方法、发现、结论、建议：\n\n素材：',groupId:null},
          {id:'res5',title:'🎯 用户研究分析',content:'请分析以下用户访谈内容，用{{简洁直接:tone:语气}}提炼：核心痛点、需求优先级、潜在解决方案、待验证假设：\n\n访谈记录：',groupId:null},
          {id:'res6',title:'🌐 趋势预测报告',content:'请基于以下信息，用{{权威专业:tone:语气}}预测{{未来3年:task:时间}}的行业趋势，包含：驱动因素、关键变化、风险挑战：\n\n背景资料：',groupId:null},
        ],
        productManager: [
          {id:'pm1',title:'📋 PRD需求文档',content:'请将以下需求整理成{{简洁直接:tone:语气}}的PRD文档，包含：背景、目标、用户故事、功能清单、验收标准、排期建议：\n\n需求描述：',groupId:null},
          {id:'pm2',title:'👤 用户故事编写',content:'请为以下功能编写{{轻松友好:tone:语气}}的{{5:task:数量}}个用户故事，格式：作为[角色]，我想要[功能]，以便[价值]：\n\n功能描述：',groupId:null},
          {id:'pm3',title:'🎯 产品路线图',content:'请为以下产品规划设计{{权威专业:tone:语气}}的路线图，分为{{Q1-Q4:task:周期}}四个阶段，每个阶段包含：核心功能、成功指标、资源需求：\n\n产品方向：',groupId:null},
          {id:'pm4',title:'⚡ 需求优先级排序',content:'请用{{简洁直接:tone:语气}}的RICE模型（Reach·Impact·Confidence·Effort）对以下需求进行优先级排序：\n\n需求列表：',groupId:null},
          {id:'pm5',title:'📊 功能数据分析',content:'请分析以下功能的数据表现，用{{权威专业:tone:语气}}给出：核心指标解读、问题诊断、优化建议：\n\n数据概况：',groupId:null},
          {id:'pm6',title:'🚀 产品发布方案',content:'请为以下新功能设计{{简洁直接:tone:语气}}的发布方案，包含：灰度策略、用户通知、风险预案、回滚机制：\n\n功能介绍：',groupId:null},
        ],
        dataAnalyst: [
          {id:'da1',title:'📊 数据清洗方案',content:'请为以下数据集设计{{简洁直接:tone:语气}}的清洗方案，包含：缺失值处理、异常值检测、格式标准化、去重策略：\n\n数据描述：',groupId:null},
          {id:'da2',title:'📈 可视化建议',content:'请为以下数据推荐{{3:task:数量}}种{{轻松友好:tone:语气}}的可视化方式，说明每种图表适合展示的洞察和使用场景：\n\n数据维度：',groupId:null},
          {id:'da3',title:'🔍 指标体系设计',content:'请为{{电商平台:task:业务}}设计{{权威专业:tone:语气}}的数据指标体系，分为北极星指标、一级指标、二级指标三个层次：',groupId:null},
          {id:'da4',title:'📉 数据异常诊断',content:'以下数据出现异常波动，请用{{简洁直接:tone:语气}}分析：可能原因（至少3个）、验证方法、应对建议：\n\n异常描述：',groupId:null},
          {id:'da5',title:'💡 洞察报告撰写',content:'请将以下数据分析结果整理成{{权威专业:tone:语气}}的洞察报告，包含：核心发现、业务影响、行动建议、下一步分析方向：\n\n分析结果：',groupId:null},
          {id:'da6',title:'🎯 A/B测试设计',content:'请为以下实验设计{{学术严谨:tone:语气}}的A/B测试方案，包含：假设陈述、实验组设计、样本量计算、成功标准：\n\n实验目的：',groupId:null},
        ],
        uiuxDesigner: [
          {id:'ui1',title:'🎨 用户体验优化',content:'请对以下页面/功能进行{{轻松友好:tone:语气}}的体验优化建议，从易用性、一致性、反馈、美观性四个维度分析：\n\n页面描述：',groupId:null},
          {id:'ui2',title:'📐 交互设计方案',content:'请为以下功能设计{{简洁直接:tone:语气}}的交互流程，包含：用户触发路径、页面跳转、状态反馈、异常处理：\n\n功能需求：',groupId:null},
          {id:'ui3',title:'🖼️ 设计评审清单',content:'请生成一份{{权威专业:tone:语气}}的设计评审清单，包含：信息架构、视觉层级、交互逻辑、可访问性、响应式适配：',groupId:null},
          {id:'ui4',title:'🎭 用户画像设计',content:'请为{{在线教育产品:task:产品}}创建{{3:task:数量}}个{{轻松友好:tone:语气}}的用户画像，每个包含：基本信息、目标需求、痛点、使用场景：',groupId:null},
          {id:'ui5',title:'🔄 用户旅程地图',content:'请绘制以下场景的{{简洁直接:tone:语气}}用户旅程地图（文字描述），包含：接触点、用户行为、情绪曲线、优化机会：\n\n场景：',groupId:null},
          {id:'ui6',title:'💬 可用性测试报告',content:'请将以下可用性测试结果整理成{{权威专业:tone:语气}}的报告，包含：问题汇总、严重程度分级、优化建议、优先级排序：\n\n测试记录：',groupId:null},
        ],
        businessStrategist: [
          {id:'bs1',title:'📊 市场分析报告',content:'请对{{SaaS市场:task:市场}}进行{{权威专业:tone:语气}}的分析，包含：市场规模、增长趋势、竞争格局、进入壁垒、机会窗口：',groupId:null},
          {id:'bs2',title:'💡 商业模式设计',content:'请为以下产品设计{{简洁直接:tone:语气}}的商业模式，包含：价值主张、客户细分、收入来源、成本结构、关键资源：\n\n产品概述：',groupId:null},
          {id:'bs3',title:'🎯 战略规划方案',content:'请为以下公司制定{{权威专业:tone:语气}}的{{3年:task:周期}}战略规划，包含：愿景使命、战略目标、核心策略、关键举措、里程碑：\n\n公司现状：',groupId:null},
          {id:'bs4',title:'⚔️ 竞争策略分析',content:'请用波特五力模型对以下行业进行{{学术严谨:tone:语气}}的竞争分析，给出差异化竞争策略建议：\n\n行业背景：',groupId:null},
          {id:'bs5',title:'💰 定价策略设计',content:'请为以下产品设计{{简洁直接:tone:语气}}的定价策略，包含：定价模型、价格锚点、套餐设计、促销策略：\n\n产品介绍：',groupId:null},
          {id:'bs6',title:'📈 增长策略方案',content:'请为以下产品设计{{权威专业:tone:语气}}的增长策略，运用AARRR模型（获客·激活·留存·变现·推荐）制定具体策略：\n\n产品数据：',groupId:null},
        ],
      },
      defaultGroups:[
        {id:'g1',name:'翻译类'},
        {id:'g2',name:'写作类'},
      ],
      defaultKeywords:{
        lang:['韩文','英文','日文','中文','法文','德文','西班牙文','俄文','阿拉伯文','葡萄牙文'],
        tone:['正式','平稳正式','轻松友好','学术严谨','简洁直接','温暖亲切','权威专业','幽默风趣','专业礼貌'],
        task:['翻译','修改','润色','总结','扩写','缩写','审查','解释','改写','提炼要点','修改语法','语序调整'],
      },
    },
    en: {
      opacity:'Opacity', fontSizeLabel:'Font size', fontSize1:'S', fontSize2:'M', fontSize3:'L', fontSize4:'XL',
      search:'Quick search...', addSnippet:'＋ New Snippet', addGroup:'＋ New Group',
      close:'Close', noGroup:'Ungrouped', emptyText:'No snippets found',
      varBadge:'VAR', varTitle:'⬡ Edit Variables', varPreview:'Preview',
      cancel:'Cancel', varCopy:'✓ Copy', customPlh:'Custom value...',
      newSnippet:'New Snippet', editSnippet:'Edit Snippet',
      newGroup:'New Group', editGroup:'Rename Group',
      lTitle:'Title', lCat:'Category', lContent:'Content', lGroup:'Group', lGroupName:'Group Name',
      phTitle:'Short description...', phContent:'Enter prompt. Variable: {{default:lang:Language}}',
      varHint:'Syntax: {{default:type:label}} | lang · tone · task',
      save:'Save', copied:'✓ Copied', livePreview:'Live Preview', kwTitle:'Keyword Highlight Settings', kwAdd:'Add Keyword', kwPlh:'Enter keyword...', kwLang:'Language', kwTone:'Tone', kwTask:'Task', kwSave:'Save', kwEmpty:'No custom keywords yet', kwManage:'⚙ Keywords', deleteGroup:'Delete Group', importPrompts:'⬇ Import Prompts', importTitle:'Import External Agent Prompts', importUrl:'URL (GitHub Raw / Direct JSON link)', importPaste:'Or paste JSON / text', importBtn:'Import', importOk:'Imported!',       importErr:'Import failed', importHint:'Supports: JSON array, newline-separated text, or prompts.chat prompts.csv (act,prompt,…)', importPickFile:'Choose JSON / CSV file', importPromptsChat:'⬇ prompts.chat CSV', importPromptsChatHint:'Data from github.com/f/prompts.chat (CC0). Large file — import may take a moment.',
      backupBtn:'⬆⬇ Backup', backupTitle:'Backup & sync', exportAll:'Export all', importBackup:'Import backup',
      sidebarResizeVTitle:'Drag down to extend height · Double-click for auto height',
      exportOne:'Export', importOneHint:'Paste single snippet JSON (talkweb-snippet)',
      importGroupHint:'Paste group JSON (talkweb-group)', mergeImport:'Merge into current', replaceImport:'Replace all data',
      replaceWarn:'Overwrites all snippets, groups and settings', downloadFile:'Download JSON', applyImport:'Import',
      backupOk:'Done', backupErr:'Invalid format', snippetJsonApply:'Apply JSON to form', snippetContentMarker:'Content:', exportGroup:'Export group',
      includeSecrets:'Include API key in export', versionLabel:'V3.5',
      agencyHubTip:'Agency · voice (optional)',
      agencyModalTitle:'Agency · SuperStar',
      agencyTabBuiltin:'Official Agents',
      agencyTabVoice:'Voice styles',
      agencyVoiceBuiltinSection:'Built-in',
      agencyVoiceMineSection:'My voices',
      agencyVoiceNoMatch:'No matches',
      agencyTabUAgent:'My Agents',
      agencySearchPh:'Search agents…',
      agencyTaskLabel:'Task notes (optional)',
      agencyTaskHint:'If empty, the current palette command defines the task layer.',
      agencyChipsTitle:'Selection',
      agencyChipStar:'Voice · ',
      agencyChipAgent:'Agent · ',
      agencyNoSel:'No extras (palette commands still work)',
      agencyEmpty:'No index — run npm run build:agency locally',
      agencyNoUserAgent:'No custom agents yet',
      agencyNoUserStar:'No custom voices yet',
      agencyNewAgentTitle:'Title',
      agencyNewAgentBody:'Body (rules & output shape)',
      agencyNewStarName:'Display name',
      agencyNewStarOne:'One-line persona',
      agencyNewStarVoice:'Voice habits',
      agencyAddBtn:'Add',
      agencyPrefetchLabel:'Prefetch Agency index when opening this panel',
      agencyEnhanceLabel:'Apply voice style + Agent to API requests',
      agencyEnhanceInjectSuffix:' · not injected',
      paletteAgencyToggle:'Enhance',
      paletteAgencyClearVoice:'Clear voice',
      paletteAgencyClearAgent:'Clear agent',
      paletteAgencyOpenHub:'Agency',
      paletteAgencyEmpty:'No voice style or agent selected',
      paletteAgencySkill:'Skills',
      paletteAgencyEnhanceOnHint:'✓ On: voice style + Agent are prepended to API requests.',
      paletteAgencyEnhanceOffHint:'○ Off: requests omit voice style and Agent blocks.',
      paletteAgencyStripNeutral:'With no voice or agent selected, Enhance has no effect. After you pick one, check the box to inject into API calls.',
      paletteAgencyHubBtnTip:'Open Agency (voice styles & agents)',
      agencyUserAgentSavedToast:'Saved to My agents — select in the list or tap 📄 for full text',
      agencyUserStarSavedToast:'Saved to My voices — select in the list or tap 📄 for full text',
      agencyDetailModalTitle:'Full text preview',
      agencyDetailClose:'Close',
      agencyDetailLoading:'Loading…',
      agencyDetailBtnTip:'Open full prompt body',
      agencyAutoSaveHint:'Selections save to this device automatically (no separate Save). Done closes with a toast; Close just closes (already saved).',
      agencyBuiltinLangNote:'Category names and official agent titles/descriptions follow the UI language (bundled ui-l10n/zh, en, ko). Prompt bodies sent to the model remain the upstream originals.',
      agencyClearSelBtn:'Clear voice + agent',
      agencyDoneBtn:'Done',
      agencySavedToast:'Saved on this device',
      agencyChipClearTitle:'Remove',
      agencyAiLabel:'Generate voice style (My voices)',
      agencyAiPlaceholder:'e.g. noir detective tone, witty architect…',
      agencyAiBtn:'AI compose',
      agencyAiBusy:'Working…',
      agencyAiNeedKey:'Set AI API key, endpoint and model in Settings first.',
      agencyAiPromptEmpty:'Describe the persona or vibe first.',
      agencyAiDoneToast:'Saved to My voices and selected',
      agencyStackPlus:' + ',
      agencyCardEdit:'Edit',
      agencyCardDelete:'Delete',
      agencyCardHide:'Hide from list',
      agencyCardRestore:'Restore',
      agencyCardFork:'Save as mine',
      agencyForkSuffix:'copy',
      agencyEditUserAgentTitle:'Edit my Agent',
      agencyEditUserStarTitle:'Edit my voice',
      agencyEditSave:'Save',
      agencyEditCancel:'Cancel',
      agencyHiddenBuiltinBar:'Hidden built-in items',
      agencyNoHidden:'None',
      agencyDevHint:'Run npm run generate:agency-l10n to build UI translations (network). Dev: BUILD_AGENCY_AFTER_INSTALL=1 in install.prefs rebuilds index.',
      shareSectionTitle:'Share & collaborate',
      shareSmbFtpNote:'Note: extensions cannot mount SMB or FTP. Export the folder or JSON to a team share (e.g. \\\\server\\share\\TalkWebSour); colleagues import via “Import from folder”.',
      mailRecipientsPh:'Recipients (optional, comma-separated; opens your default mail app)',
      packAndOpenMail:'Download pack & open mail',
      packMailHint:'Downloads a full backup JSON, then opens your default mail client (Mail, Outlook, …). mailto cannot attach files—attach the downloaded file manually.',
      smbPathLabel:'LAN path note (saved locally, for sharing instructions)',
      copySmbGuide:'Copy sharing guide',
      smbGuideCopied:'Guide copied to clipboard',
      webdavBlockTitle:'WebDAV upload (NAS / Nextcloud / WebDAV providers)',
      webdavUrlPh:'https://example.com/remote.php/dav/files/you/TalkWebSour/backup.json',
      webdavUserPh:'Username (optional)',
      webdavPassPh:'Password or app password',
      webdavUploadBtn:'Upload backup JSON',
      cloudPostTitle:'Custom cloud (HTTPS POST)',
      cloudPostHint:'For your own API / worker; server must allow extension requests (CORS). Full Aliyun OSS or Google Drive needs each vendor’s OAuth—use POST via your backend if needed.',
      cloudPostUrlPh:'https://api.example.com/talkweb/backup',
      cloudPostTokenPh:'Bearer token (optional)',
      cloudPostBtn:'POST backup JSON',
      shareSavePrefs:'Save share settings',
      shareUploadOk:'Upload succeeded',
      shareUploadErr:'Upload failed',
      personaTitle:'🧩 AI profile',
      personaIntro:'Your assistant tone and background. With API: 「Summarize with AI」 builds your persona; 「Generate avatar」 uses your chat model to draw an SVG icon (fallback if needed), fixed display size.',
      personaNick:'Name / nickname',
      personaJob:'Role / industry',
      personaRolePreset:'Professional role preset',
      personaRoleHintTitle:'Role skills & quality bar (injected into optimization)',
      personaPersonality:'Personality & tone',
      personaNationality:'Country / region',
      personaSpeakLang:'Languages',
      personaExtra:'Notes',
      personaGenAvatar:'Generate avatar',
      personaGenAvatarBusy:'Generating…',
      personaAvatarAiFail:'No valid AI avatar; using illustrated fallback. Retry or switch model.',
      personaAiSum:'Summarize with AI',
      personaSummaryLabel:'AI summary (editable)',
      personaSave:'Save',
      personaLater:'Later',
      personaOpenSettings:'🧩 Edit AI profile',
      personaSettingsBlurb:'Used for new-snippet hints and 「Pro + Profile」 when editing.',
      snippetPersonaHint:'💡 「AI polish」 = guide only; 「Pro + Profile」 = guide + your AI profile (incl. role preset).',
      aiOptimizeFootnote:'「AI polish»: Workspace + general prompt-engineering ideas. 「Pro + Profile»: adds your AI profile and role preset on top (fill profile in Settings first).',
      personaSummaryPlaceholder:'After 「Summarize with AI」: confirmation, professional stance, voice, guardrails — edit then save.',
      personaSummaryDone:'✓ Summary filled below',
      personaSummaryFail:'AI returned no summary. Try another model.',
      snippetEscWarn:'Esc ignored while editing — use Save or Cancel.',
      exportFolderBtn:'Export TalkWebSour folder',
      importFolderBtn:'Import from folder',
      folderExportHint:'Same data as single-file “Export all”, split into snippets.json, groups.json, extra.json (extra = all settings incl. share/sync prefs; snippets/groups excluded). API key in extra when “Include API key” is checked.',
      importFolderErr:'Missing valid snippets.json / groups.json from this extension.',
      settingsPersonaLink:'🧩 AI profile (tone / role / avatar)',
      sceneTitle:'🎭 Choose Your Scenes',
      sceneSubtitle:'Select one or more scenes to load professional templates',
      sceneWorkplace:'💼 Workplace',
      sceneWorkplaceDesc:'Email polish·Meeting notes·Status reports',
      sceneDeveloper:'💻 Developer',
      sceneDeveloperDesc:'Code review·Error explanation·API docs',
      sceneStudent:'🎓 Student/Researcher',
      sceneStudentDesc:'Paper polish·Literature summary·Defense prep',
      sceneCreator:'✍️ Content Creator',
      sceneCreatorDesc:'Catchy headlines·Social posts·SEO',
      sceneArchitect:'🏗️ Software Architect',
      sceneArchitectDesc:'System design·Tech stack·Architecture review',
      sceneResearcher:'🔬 Research Analyst',
      sceneResearcherDesc:'Deep research·Data analysis·Report writing',
      sceneProductManager:'🎯 Product Manager',
      sceneProductManagerDesc:'PRD·User stories·Product roadmap',
      sceneDataAnalyst:'📊 Data Analyst',
      sceneDataAnalystDesc:'Data cleaning·Visualization·Insights',
      sceneUIUXDesigner:'🎨 UI/UX Designer',
      sceneUIUXDesignerDesc:'User experience·Interaction design·Design review',
      sceneBusinessStrategist:'💼 Business Strategist',
      sceneBusinessStrategistDesc:'Market analysis·Business model·Strategy',
      sceneIntlTranslate:'🌐 Translation',
      sceneIntlTranslateDesc:'CN ↔ target language (work / tech) · own group',
      sceneIntlSop:'📑 Enterprise standard SOP',
      sceneIntlSopDesc:'Generic Markdown SOP · own group',
      sceneGraphicTemplates:'📐 Diagram templates',
      sceneGraphicTemplatesDesc:'Flow, structure, time, decision · Mermaid',
      sceneDesignWorkflow:'🎨 Pro design co-create',
      sceneDesignWorkflowDesc:'Blueprint first · fashion, art, photo, product, video',
      sceneLoad:'✓ Load Selected Templates',
      sceneSkip:'Skip, start fresh',
      sceneBtn:'🎭 Scene Templates',
      sceneLoaded:'✓ Templates Loaded',
      templateBtn:'📋 AI Template',
      templateTitle:'📋 Create AI Assistant Template',
      templateSubtitle:'Fill in the details below to generate a professional prompt',
      templateRole:'Role',
      templateRolePh:'e.g. Senior PM, Tech Lead, Content Creator...',
      templateWork:'Responsibilities',
      templateWorkPh:'e.g. Write PRD, review code, create articles...',
      templateSkills:'Key skills',
      templateSkillsPh:'e.g. Data analysis, user research, technical writing...',
      templateContext:'Context',
      templateContextPh:'e.g. Internet company, education, e‑commerce...',
      templateGenerate:'✨ Generate Template',
      templateUse:'Use this template',
      templateExamples:'💡 Example templates',
      aiOptimize:'✨ AI polish',
      aiOptimizeBoth:'Pro + Profile',
      aiOptimizing:'Optimizing...',
      aiBothOptimizing:'Pro + Profile…',
      aiRestore:'↩ Restore original',
      aiApiKey:'AI API key',
      aiApiKeyPh:'OpenAI key or compatible service key',
      aiApiUrl:'API base URL',
      aiApiUrlPh:'https://api.openai.com/v1 or compatible',
      aiBaseUrlPreset:'Common base URLs',
      aiBaseUrlCustom:'— Custom (type full URL below) —',
      aiBaseUrlModelHint:'Presets match the selected model when applicable.',
      aiQwenRegionLabel:'Qwen region (must match where the API Key was created)',
      aiQwenRegionHint:'Standard Bailian keys (sk-…) usually fail with 401 when the console region and Base URL don’t match. sk-sp-… keys are Coding Plan only and need that plan’s Base URL.',
      settings:'Settings',
      settingsModalTitle:'Settings',
      settingsSectionApi:'API key & model',
      settingsSectionConn:'Live config & connection test',
      settingsSectionHotkeys:'Keyboard shortcuts',
      settingsSectionSnippets:'Snippets & order',
      snippetSortByScoreLabel:'Sort by use count (most used first)',
      snippetSortByScoreHint:'When on, snippets with higher counts appear first within each group; when off, order follows drag-and-drop and creation order. Counts show on cards and in the ⚡ palette. +1 when you copy or insert.',
      snippetDangerClearAllLabel:'Also delete all scripts and groups (danger)',
      snippetResetCountsBtn:'Reset all use counts',
      snippetResetCountsConfirm:'Reset use counts for all snippets?',
      snippetDangerClearAllConfirm:'Danger mode is checked: this will delete all scripts and groups. Continue?',
      snippetResetCountsDone:'✓ Use counts reset',
      snippetDangerClearAllDone:'✓ All scripts and groups deleted',
      snippetUseCountTitle:'Use count',
      aiProviderLabel:'Provider',
      aiModelLabel:'Model',
      hkPlatform:'Platform',
      hkPlatformMac:'macOS',
      hkPlatformWin:'Windows',
      hkPalette:'AI palette (⚡)',
      hkRewrite:'Polish / rewrite',
      hkShorten:'Shorten',
      hkTranslateLabel:'Translate',
      hkSet:'Set',
      aiCompatHint:'Supports OpenAI and compatible APIs (Azure OpenAI, Claude-compatible, etc.).\nAfter saving, use AI polish and related features when editing snippets.',
      hkCaptureHint:'Click Set, press your shortcut combination; press Esc to cancel.',
      hkPressCombo:'Press keys…',
      hkSaved:'✓ Shortcut saved',
      aiSettings:'🤖 AI settings',
      aiSave:'Save',
      aiNoKey:'Please configure your API key in Settings first',
      aiEffectiveCfg:'Effective configuration',
      aiEffectiveHint:'Updates as you edit; if base URL is empty, the provider default is used when you save.',
      aiSumProvider:'Provider',
      aiSumBase:'Base URL',
      aiSumModel:'Model ID',
      aiSumGeminiPath:'Gemini path (API key passed as key=)',
      aiTestConn:'Test connection',
      aiTesting:'Testing…',
      aiTestOk:'Connection OK',
      aiTestProbe:'Asking the model to identify itself…',
      aiTestReplyTitle:'Model reply',
      aiTestNeedKey:'Please enter an API key first',
      aiModuleNotReady:'AI module not loaded. Open the sidebar once (toolbar icon or shortcut).',
      confirmDel:'Delete this group? (snippets will not be deleted)',
      dragHint:'Drag snippets here',
      langSelTitle:'🌐 Select Interface Language',
      langSelSubtitle:'Please choose your preferred interface language',
      langSelChinese:'中文（简体）',
      langSelEnglish:'English',
      langSelKorean:'한국어',
      langSelConfirm:'✓ Confirm Selection',
      langLabel:'Language', toneLabel:'Tone', taskLabel:'Task',
      langOpts:['Korean','English','Japanese','Chinese','French','German','Spanish'],
      toneOpts:['Formal','Casual','Academic','Concise','Warm','Authoritative'],
      taskOpts:['Fix grammar & flow','Polish writing','Translate only','Summarize','Expand','Condense'],
      defaultSnippets:[],
      sceneTemplates: {
        workplace: [
          {id:'wp1',title:'📧 Polish Email',content:'Please polish this email to sound more {{Professional:tone:Tone}} and clear, keeping core message intact, suitable for {{manager:task:Audience}}:\n\n',groupId:null},
          {id:'wp2',title:'🙅 Polite Decline',content:'Please help me decline the following request in a {{Warm:tone:Tone}} way, offering alternatives or showing understanding ({{150 words:task:Length}}):\n\n',groupId:null},
          {id:'wp3',title:'📝 Meeting Notes',content:'Please organize the following meeting notes into {{Concise:tone:Tone}} minutes, including: decisions, action items, owners, deadlines:\n\n',groupId:null},
          {id:'wp4',title:'📊 Status Report',content:'Please structure this progress update into a {{Authoritative:tone:Tone}} status report, highlighting achievements, metrics, next steps ({{300 words:task:Length}}):\n\n',groupId:null},
          {id:'wp5',title:'💡 Proposal Draft',content:'Please expand this idea into a complete proposal with {{Academic:tone:Tone}} tone, covering: background, goals, approach, expected outcomes:\n\n',groupId:null},
          {id:'wp6',title:'⭐ Performance Review',content:'Please write a performance review for the following, {{Formal:tone:Tone}} tone, covering strengths, growth areas, encouragement ({{200 words:task:Length}}):\n\n',groupId:null},
        ],
        developer: [
          {id:'dev1',title:'🔍 Code Review',content:'Please review this code for: 1) Potential bugs  2) Performance issues  3) Security concerns  4) Readability  5) Best practices:\n\n```\n\n```',groupId:null},
          {id:'dev2',title:'❌ Explain Error',content:'Please explain this error in {{Concise:tone:Tone}} terms: root cause, trigger scenarios, 3 solutions (simple to advanced):\n\n',groupId:null},
          {id:'dev3',title:'📝 Write Comments',content:'Please add {{Academic:tone:Tone}} comments to this code: function description, parameters, return value, edge cases, complexity:\n\n```\n\n```',groupId:null},
          {id:'dev4',title:'⚖️ Compare Solutions',content:'Please compare these {{2:task:Count}} technical solutions across performance, dev cost, maintainability, scalability:\n\nOption A:\n\nOption B:\n\n',groupId:null},
          {id:'dev5',title:'📚 API Documentation',content:'Please generate {{Concise:tone:Tone}} API docs: description, request params, response format, code example, error codes:\n\n',groupId:null},
          {id:'dev6',title:'🔧 Refactor Suggestions',content:'This code works but feels messy. Please suggest refactoring for: structure, naming, design patterns, testability:\n\n```\n\n```',groupId:null},
        ],
        student: [
          {id:'stu1',title:'📄 Polish Paper',content:'Please polish this {{Academic:tone:Tone}} paper excerpt for accuracy and fluency, maintaining academic standards, translate to {{English:lang:Language}}:\n\n',groupId:null},
          {id:'stu2',title:'📖 Summarize Paper',content:'Please extract {{Concise:tone:Tone}} key points from this paper: research question, method, findings, limitations, insights for my work ({{300 words:task:Length}}):\n\n',groupId:null},
          {id:'stu3',title:'💡 Explain Concept',content:'Please explain this concept in {{Casual:tone:Tone}}, plain language: definition, examples, use cases, vs related concepts:\n\n',groupId:null},
          {id:'stu4',title:'🎤 Defense Q&A',content:'My thesis topic is: [fill here]. From an {{Authoritative:tone:Tone}} examiner perspective, predict 5 challenging questions and response strategies.',groupId:null},
          {id:'stu5',title:'📋 Paper Outline',content:'Please create an {{Academic:tone:Tone}} paper outline for this topic: intro, lit review, methodology, expected results, discussion, conclusion:\n\nTopic:',groupId:null},
          {id:'stu6',title:'🔎 Critical Analysis',content:'Please critically analyze this argument: logic chain, evidence sufficiency, counter-arguments, improvement directions:\n\n',groupId:null},
        ],
        creator: [
          {id:'cre1',title:'🔥 Catchy Headlines',content:'Please generate {{10:task:Count}} attention-grabbing headlines for this content, {{Casual:tone:Tone}} style, using numbers, questions, contrasts:\n\nContent:',groupId:null},
          {id:'cre2',title:'🎨 Rewrite Style',content:'Please rewrite this text in a {{Warm:tone:Tone}} style for {{young adults:task:Audience}}, adding relatability and vivid imagery:\n\n',groupId:null},
          {id:'cre3',title:'🔍 SEO Description',content:'Please write an SEO-friendly {{Concise:tone:Tone}} description (under {{160 chars:task:Length}}), naturally including keywords, click-worthy:\n\nKeywords:\nContent:',groupId:null},
          {id:'cre4',title:'📱 Social Post',content:'Please write a {{Casual:tone:Tone}} post for {{Instagram:task:Platform}} with emojis, hashtags, engagement hook ({{200 words:task:Length}}):\n\nTopic:',groupId:null},
          {id:'cre5',title:'🎁 Product Intro',content:'Please write {{Authoritative:tone:Tone}} product copy: pain point, solution, key benefits, use cases, call-to-action:\n\nProduct:',groupId:null},
          {id:'cre6',title:'💬 Reply to Review',content:'Please reply to this negative review in a {{Warm:tone:Tone}} way: sincere apology, explanation, compensation, brand warmth ({{150 words:task:Length}}):\n\nReview:',groupId:null},
        ],
        architect: [
          {id:'arc1',title:'🏗️ System Architecture',content:'Please design {{Authoritative:tone:Tone}} system architecture for these requirements, covering: tech stack, core modules, data flow, scalability:\n\nRequirements:',groupId:null},
          {id:'arc2',title:'⚖️ Tech Stack Comparison',content:'Please compare {{3:task:Count}} technical solutions in {{Academic:tone:Tone}} tone across performance, cost, ecosystem, team familiarity:\n\nOption A:\nOption B:\nOption C:',groupId:null},
          {id:'arc3',title:'📋 Architecture Review',content:'Please generate {{Concise:tone:Tone}} architecture review checklist covering: scalability, maintainability, security, performance, cost:\n\nArchitecture overview:',groupId:null},
          {id:'arc4',title:'🔄 Refactoring Plan',content:'Given these issues, design {{Authoritative:tone:Tone}} refactoring plan with: problem analysis, target architecture, migration strategy, risk mitigation:\n\nCurrent issues:',groupId:null},
          {id:'arc5',title:'📊 Performance Optimization',content:'Please design {{Concise:tone:Tone}} optimization plan for these bottlenecks, analyzing code, architecture, and infrastructure layers:\n\nBottleneck description:',groupId:null},
          {id:'arc6',title:'🛡️ Security Architecture',content:'Please design {{Academic:tone:Tone}} security architecture including: auth/authz, encryption, network isolation, audit logging:\n\nSystem description:',groupId:null},
        ],
        researcher: [
          {id:'res1',title:'🔍 Industry Research',content:'Please conduct {{Academic:tone:Tone}} deep research on {{AI industry:task:Field}}, covering: market size, key players, tech trends, opportunities ({{500 words:task:Length}}):',groupId:null},
          {id:'res2',title:'📊 Competitive Analysis',content:'Please analyze {{3:task:Count}} competitors in {{Authoritative:tone:Tone}} tone across features, pricing, user reviews, market strategy:\n\nCompetitors:',groupId:null},
          {id:'res3',title:'📈 Data Insights',content:'Please extract {{Concise:tone:Tone}} key insights from this data: key trends, anomalies, business recommendations, next actions:\n\nData overview:',groupId:null},
          {id:'res4',title:'📝 Research Report',content:'Please structure this research into {{Academic:tone:Tone}} report: executive summary, background, methodology, findings, conclusions, recommendations:\n\nResearch materials:',groupId:null},
          {id:'res5',title:'🎯 User Research',content:'Please analyze these interview transcripts in {{Concise:tone:Tone}} tone: core pain points, priority needs, potential solutions, hypotheses to test:\n\nInterview notes:',groupId:null},
          {id:'res6',title:'🌐 Trend Forecast',content:'Please predict {{Authoritative:tone:Tone}} industry trends for {{next 3 years:task:Timeline}} based on: driving factors, key changes, risks:\n\nBackground info:',groupId:null},
        ],
        productManager: [
          {id:'pm1',title:'📋 PRD Document',content:'Please structure this requirement into {{Concise:tone:Tone}} PRD: background, objectives, user stories, features, acceptance criteria, timeline:\n\nRequirement:',groupId:null},
          {id:'pm2',title:'👤 User Stories',content:'Please write {{5:task:Count}} user stories in {{Casual:tone:Tone}} format: As a [role], I want [feature], so that [value]:\n\nFeature description:',groupId:null},
          {id:'pm3',title:'🎯 Product Roadmap',content:'Please design {{Authoritative:tone:Tone}} roadmap for {{Q1-Q4:task:Period}}, each phase with: core features, success metrics, resources needed:\n\nProduct direction:',groupId:null},
          {id:'pm4',title:'⚡ Priority Ranking',content:'Please prioritize these requirements using {{Concise:tone:Tone}} RICE model (Reach·Impact·Confidence·Effort):\n\nRequirements list:',groupId:null},
          {id:'pm5',title:'📊 Feature Analysis',content:'Please analyze this feature data in {{Authoritative:tone:Tone}} tone: key metrics interpretation, issue diagnosis, optimization suggestions:\n\nData summary:',groupId:null},
          {id:'pm6',title:'🚀 Launch Plan',content:'Please design {{Concise:tone:Tone}} launch plan: rollout strategy, user communication, risk mitigation, rollback mechanism:\n\nFeature intro:',groupId:null},
        ],
        dataAnalyst: [
          {id:'da1',title:'📊 Data Cleaning',content:'Please design {{Concise:tone:Tone}} data cleaning plan: missing value handling, outlier detection, format standardization, deduplication:\n\nDataset description:',groupId:null},
          {id:'da2',title:'📈 Visualization Ideas',content:'Please recommend {{3:task:Count}} visualization types in {{Casual:tone:Tone}} tone, explaining insights each chart shows and use cases:\n\nData dimensions:',groupId:null},
          {id:'da3',title:'🔍 Metrics Framework',content:'Please design {{Authoritative:tone:Tone}} metrics framework for {{e-commerce:task:Business}}, with north star metric, tier-1, and tier-2 metrics:',groupId:null},
          {id:'da4',title:'📉 Anomaly Diagnosis',content:'This data shows anomalies. Please analyze in {{Concise:tone:Tone}} tone: possible causes (at least 3), validation methods, recommendations:\n\nAnomaly description:',groupId:null},
          {id:'da5',title:'💡 Insights Report',content:'Please structure analysis results into {{Authoritative:tone:Tone}} insights report: key findings, business impact, action items, next analysis:\n\nAnalysis results:',groupId:null},
          {id:'da6',title:'🎯 A/B Test Design',content:'Please design {{Academic:tone:Tone}} A/B test: hypothesis, test groups, sample size calculation, success criteria:\n\nTest objective:',groupId:null},
        ],
        uiuxDesigner: [
          {id:'ui1',title:'🎨 UX Optimization',content:'Please provide {{Casual:tone:Tone}} UX optimization suggestions for this page/feature across usability, consistency, feedback, aesthetics:\n\nPage description:',groupId:null},
          {id:'ui2',title:'📐 Interaction Design',content:'Please design {{Concise:tone:Tone}} interaction flow: user trigger paths, page navigation, status feedback, error handling:\n\nFeature requirements:',groupId:null},
          {id:'ui3',title:'🖼️ Design Review',content:'Please generate {{Authoritative:tone:Tone}} design review checklist: information architecture, visual hierarchy, interaction logic, accessibility, responsive design:',groupId:null},
          {id:'ui4',title:'🎭 User Personas',content:'Please create {{3:task:Count}} user personas in {{Casual:tone:Tone}} for {{online education:task:Product}}, each with: demographics, goals, pain points, scenarios:',groupId:null},
          {id:'ui5',title:'🔄 User Journey Map',content:'Please describe {{Concise:tone:Tone}} user journey for this scenario: touchpoints, user actions, emotional curve, optimization opportunities:\n\nScenario:',groupId:null},
          {id:'ui6',title:'💬 Usability Report',content:'Please structure usability test results into {{Authoritative:tone:Tone}} report: issue summary, severity ranking, improvement suggestions, priority order:\n\nTest notes:',groupId:null},
        ],
        businessStrategist: [
          {id:'bs1',title:'📊 Market Analysis',content:'Please analyze {{SaaS market:task:Market}} in {{Authoritative:tone:Tone}} tone: market size, growth trends, competitive landscape, entry barriers, opportunities:',groupId:null},
          {id:'bs2',title:'💡 Business Model',content:'Please design {{Concise:tone:Tone}} business model: value proposition, customer segments, revenue streams, cost structure, key resources:\n\nProduct overview:',groupId:null},
          {id:'bs3',title:'🎯 Strategic Plan',content:'Please create {{Authoritative:tone:Tone}} {{3-year:task:Period}} strategic plan: vision/mission, strategic goals, core strategies, key initiatives, milestones:\n\nCurrent situation:',groupId:null},
          {id:'bs4',title:'⚔️ Competitive Strategy',content:'Please use Porter\'s Five Forces to analyze this industry in {{Academic:tone:Tone}} tone and suggest differentiation strategy:\n\nIndustry background:',groupId:null},
          {id:'bs5',title:'💰 Pricing Strategy',content:'Please design {{Concise:tone:Tone}} pricing strategy: pricing model, price anchoring, package design, promotion tactics:\n\nProduct intro:',groupId:null},
          {id:'bs6',title:'📈 Growth Strategy',content:'Please design {{Authoritative:tone:Tone}} growth strategy using AARRR model (Acquisition·Activation·Retention·Revenue·Referral):\n\nProduct metrics:',groupId:null},
        ],
      },
      defaultGroups:[
        {id:'g1',name:'Translation'},
        {id:'g2',name:'Writing'},
      ],
      defaultKeywords:{
        lang:['Korean','English','Japanese','Chinese','French','German','Spanish','Russian','Arabic','Portuguese'],
        tone:['Formal','Casual','Academic','Concise','Warm','Authoritative','Humorous','Professional','Friendly'],
        task:['Translate','Rewrite','Polish','Summarize','Expand','Condense','Review','Explain','Rephrase','Extract'],
      },
    },
    ko: {
      opacity:'투명도', fontSizeLabel:'글자 크기', fontSize1:'작게', fontSize2:'보통', fontSize3:'크게', fontSize4:'아주 크게',
      search:'빠른 검색...', addSnippet:'＋ 문장 추가', addGroup:'＋ 그룹 추가',
      close:'닫기', noGroup:'미분류', emptyText:'검색 결과 없음',
      varBadge:'변수', varTitle:'⬡ 변수 편집', varPreview:'미리보기',
      cancel:'취소', varCopy:'✓ 복사', customPlh:'직접 입력...',
      newSnippet:'새 문장', editSnippet:'문장 편집',
      newGroup:'새 그룹', editGroup:'그룹 이름 변경',
      lTitle:'제목', lCat:'카테고리', lContent:'내용', lGroup:'그룹', lGroupName:'그룹 이름',
      phTitle:'간단한 설명...', phContent:'문장 입력. 변수 형식: {{기본값:lang:언어}}',
      varHint:'변수 문법: {{기본값:유형:라벨}} | lang 언어 · tone 어조 · task 작업',
      save:'저장', copied:'✓ 복사됨', livePreview:'미리보기', kwTitle:'키워드 하이라이트 설정', kwAdd:'키워드 추가', kwPlh:'키워드 입력...', kwLang:'언어', kwTone:'어조', kwTask:'작업', kwSave:'저장', kwEmpty:'사용자 정의 키워드 없음', kwManage:'⚙ 키워드', deleteGroup:'그룹 삭제', importPrompts:'⬇ 가져오기', importTitle:'외부 Agent Prompts 가져오기', importUrl:'URL (GitHub Raw / 직접 링크)', importPaste:'또는 JSON 붙여넣기', importBtn:'가져오기', importOk:'가져오기 성공', importErr:'가져오기 실패', importHint:'JSON 배열, 줄 텍스트, prompts.chat prompts.csv(act,prompt,…) 지원', importPickFile:'JSON / CSV 파일 선택', importPromptsChat:'⬇ prompts.chat CSV', importPromptsChatHint:'github.com/f/prompts.chat 데이터(CC0). 항목이 많아 잠시 걸릴 수 있습니다.',
      backupBtn:'⬆⬇ 백업', backupTitle:'백업 및 동기화', exportAll:'전체보내기', importBackup:'백업 가져오기',
      sidebarResizeVTitle:'아래로 드래그해 높이 조절 · 더블클릭으로 자동 높이',
      exportOne:'보내기', importOneHint:'단일 스니펫 JSON 붙여넣기 (talkweb-snippet)',
      importGroupHint:'그룹 JSON 붙여넣기 (talkweb-group)', mergeImport:'현재와 병합', replaceImport:'전체 교체',
      replaceWarn:'모든 문장·그룹·설정을 덮어씁니다', downloadFile:'JSON 다운로드', applyImport:'가져오기',
      backupOk:'완료', backupErr:'형식 오류', snippetJsonApply:'JSON을 폼에 적용', snippetContentMarker:'내용:', exportGroup:'그룹보내기',
      includeSecrets:'API 키 포함보내기', versionLabel:'V3.5',
      agencyHubTip:'Agency·말투(선택)',
      agencyModalTitle:'Agency · SuperStar',
      agencyTabBuiltin:'공식 Agent',
      agencyTabVoice:'말투 스타일',
      agencyVoiceBuiltinSection:'기본',
      agencyVoiceMineSection:'내 스타일',
      agencyVoiceNoMatch:'일치 항목 없음',
      agencyTabUAgent:'내 Agent',
      agencySearchPh:'Agent 검색…',
      agencyTaskLabel:'작업 설명(선택)',
      agencyTaskHint:'비우면 현재 팔레트 명령이 작업 정의로 사용됩니다.',
      agencyChipsTitle:'현재 선택',
      agencyChipStar:'스타일 · ',
      agencyChipAgent:'Agent · ',
      agencyNoSel:'추가 없음(⚡ 명령만 사용 가능)',
      agencyEmpty:'인덱스 없음 — 로컬에서 npm run build:agency 실행',
      agencyNoUserAgent:'사용자 Agent 없음',
      agencyNoUserStar:'사용자 스타일 없음',
      agencyNewAgentTitle:'제목',
      agencyNewAgentBody:'본문(규칙·출력 형식)',
      agencyNewStarName:'표시 이름',
      agencyNewStarOne:'한 줄 페르소나',
      agencyNewStarVoice:'말투 습관',
      agencyAddBtn:'추가',
      agencyPrefetchLabel:'이 패널을 열 때 Agency 인덱스 미리 로드',
      agencyEnhanceLabel:'말투 스타일 + Agent를 모델 요청에 포함',
      agencyEnhanceInjectSuffix:' · 미포함',
      paletteAgencyToggle:'향상 적용',
      paletteAgencyClearVoice:'말투 해제',
      paletteAgencyClearAgent:'Agent 해제',
      paletteAgencyOpenHub:'Agency',
      paletteAgencyEmpty:'선택된 말투/Agent 없음',
      paletteAgencySkill:'요약',
      paletteAgencyEnhanceOnHint:'✓ 선택됨: 말투 스타일·Agent가 모델 요청에 포함됩니다.',
      paletteAgencyEnhanceOffHint:'○ 「향상 적용」 미선택: 말투·Agent 블록 없음.',
      paletteAgencyStripNeutral:'말투/Agent를 고르지 않으면 향상 적용이 변화를 주지 않습니다. 선택 후 체크하면 모델 요청에 포함됩니다.',
      paletteAgencyHubBtnTip:'Agency 열기(말투·에이전트)',
      agencyUserAgentSavedToast:'「내 Agent」에 저장됨 — 목록에서 선택하거나 📄로 전문 보기',
      agencyUserStarSavedToast:'「내 스타일」에 저장됨 — 목록에서 선택하거나 📄로 전문 보기',
      agencyDetailModalTitle:'본문 미리보기',
      agencyDetailClose:'닫기',
      agencyDetailLoading:'불러오는 중…',
      agencyDetailBtnTip:'전체 본문 보기',
      agencyAutoSaveHint:'선택은 즉시 이 기기에 저장됩니다. 별도 저장 버튼 없음. 「완료」는 닫으며 알림, 「닫기」는 바로 닫기(이미 저장됨).',
      agencyBuiltinLangNote:'분류명과 공식 Agent 제목·설명은 UI 언어를 따릅니다(내장 ui-l10n/zh·en·ko). 모델에 전달되는 본문은 상위 저장소 원문입니다.',
      agencyClearSelBtn:'선택 해제(말투+Agent)',
      agencyDoneBtn:'완료',
      agencySavedToast:'이 기기에 저장됨',
      agencyChipClearTitle:'항목 제거',
      agencyAiLabel:'AI로 말투 생성（내 스타일）',
      agencyAiPlaceholder:'예: 영화 같은 어조, 친근한 테크 코치…',
      agencyAiBtn:'AI 생성',
      agencyAiBusy:'생성 중…',
      agencyAiNeedKey:'설정에서 API 키·주소·모델을 먼저 입력하세요.',
      agencyAiPromptEmpty:'설명을 입력하세요.',
      agencyAiDoneToast:'내 스타일에 저장 및 선택됨',
      agencyStackPlus:' + ',
      agencyCardEdit:'편집',
      agencyCardDelete:'삭제',
      agencyCardHide:'목록에서 숨기기',
      agencyCardRestore:'다시 표시',
      agencyCardFork:'내 항목으로 복사',
      agencyForkSuffix:'복사본',
      agencyEditUserAgentTitle:'내 Agent 편집',
      agencyEditUserStarTitle:'내 스타일 편집',
      agencyEditSave:'저장',
      agencyEditCancel:'취소',
      agencyHiddenBuiltinBar:'숨긴 기본 항목',
      agencyNoHidden:'없음',
      agencyDevHint:'npm run generate:agency-l10n 으로 UI 번역 파일 생성(네트워크). 개발: install.prefs 에 BUILD_AGENCY_AFTER_INSTALL=1',
      shareSectionTitle:'공유·협업',
      shareSmbFtpNote:'안내: 확장 프로그램은 SMB/FTP에 직접 연결할 수 없습니다. 폴더 또는 JSON을 공유 폴더에 저장한 뒤 동료는「폴더에서 가져오기」를 사용하세요.',
      mailRecipientsPh:'수신자(선택, 쉼표 구분·기본 메일 앱 실행)',
      packAndOpenMail:'백업 받기 후 메일 열기',
      packMailHint:'전체 백업 JSON을 받은 뒤 시스템 기본 메일을 엽니다. mailto는 첨부가 불가하니 받은 파일을 직접 첨부하세요.',
      smbPathLabel:'LAN 경로 메모(로컬 저장)',
      copySmbGuide:'공유 안내 복사',
      smbGuideCopied:'클립보드에 복사됨',
      webdavBlockTitle:'WebDAV 업로드(NAS·Nextcloud 등)',
      webdavUrlPh:'https://example.com/.../backup.json',
      webdavUserPh:'사용자명(선택)',
      webdavPassPh:'비밀번호',
      webdavUploadBtn:'백업 JSON 업로드',
      cloudPostTitle:'사용자 지정 클라우드(HTTPS POST)',
      cloudPostHint:'자체 API·워커용. 서버 CORS 필요. OSS/Drive는 OAuth가 필요하며 백엔드 경유를 권장합니다.',
      cloudPostUrlPh:'https://api.example.com/talkweb/backup',
      cloudPostTokenPh:'Bearer 토큰(선택)',
      cloudPostBtn:'POST 백업 JSON',
      shareSavePrefs:'공유 설정 저장',
      shareUploadOk:'업로드 성공',
      shareUploadErr:'업로드 실패',
      personaTitle:'🧩 AI 프로필',
      personaIntro:'톤·역할·배경. API 저장 후 「AI 요약」으로 페르소나 정리; 「아바타 생성」은 현재 모델로 SVG 아이콘(실패 시 대체), 표시 크기 고정.',
      personaNick:'이름/닉네임',
      personaJob:'직무/업종',
      personaRolePreset:'직무 역할 프리셋',
      personaRoleHintTitle:'역할 요약 미리보기(최적화에 주입)',
      personaPersonality:'성격/톤',
      personaNationality:'국가/지역',
      personaSpeakLang:'언어',
      personaExtra:'기타',
      personaGenAvatar:'아바타 생성',
      personaGenAvatarBusy:'생성 중…',
      personaAvatarAiFail:'AI 아바타 실패, 일러스트로 대체했습니다. 모델을 확인하세요.',
      personaAiSum:'AI 요약',
      personaSummaryLabel:'AI 요약(편집 가능)',
      personaSave:'저장',
      personaLater:'나중에',
      personaOpenSettings:'🧩 AI 프로필 편집',
      personaSettingsBlurb:'새 스크립트 힌트·「전문+맞춤」에 사용.',
      snippetPersonaHint:'💡 「AI 다듬기」= 가이드만 · 「전문+맞춤」= 가이드 + AI 프로필(직무 프리셋 포함).',
      aiOptimizeFootnote:'「AI 다듬기」: Workspace 및 일반 프롬프트 엔지니어링 요점. 「전문+맞춤」: 프로필·직무 프리셋을 가이드에 더함(설정에서 프로필 작성 필요).',
      personaSummaryPlaceholder:'「AI 요약」 후 확인·전문 톤·가드레일 등이 채워집니다. 편집 후 저장하세요.',
      personaSummaryDone:'✓ 아래에 요약 입력됨',
      personaSummaryFail:'AI 요약 없음. 모델을 바꿔 보세요.',
      snippetEscWarn:'Esc 무시됨 — 저장 또는 취소를 누르세요.',
      exportFolderBtn:'TalkWebSour 폴더보내기',
      importFolderBtn:'폴더에서 가져오기',
      folderExportHint:'「전체 내보내기」단일 파일과 동일 내용을 세 파일로 분할(snippets/groups/extra). extra에 동기화 설정 포함. API 키는 체크 시 extra에 포함.',
      importFolderErr:'snippets.json / groups.json 형식이 맞지 않습니다.',
      settingsPersonaLink:'🧩 AI 프로필',
      sceneTitle:'🎭 시나리오 선택',
      sceneSubtitle:'하나 이상의 시나리오를 선택하여 전문 템플릿 로드',
      sceneWorkplace:'💼 직장인',
      sceneWorkplaceDesc:'이메일 다듬기·회의록·진행보고',
      sceneDeveloper:'💻 개발자',
      sceneDeveloperDesc:'코드 리뷰·오류 설명·API 문서',
      sceneStudent:'🎓 학생/연구원',
      sceneStudentDesc:'논문 다듬기·문헌 요약·논문 심사 준비',
      sceneCreator:'✍️ 콘텐츠 크리에이터',
      sceneCreatorDesc:'매력적인 제목·소셜 포스트·SEO',
      sceneArchitect:'🏗️ 소프트웨어 아키텍트',
      sceneArchitectDesc:'시스템 설계·기술 스택·아키텍처 리뷰',
      sceneResearcher:'🔬 리서치 분석가',
      sceneResearcherDesc:'심층 조사·데이터 분석·보고서 작성',
      sceneProductManager:'🎯 프로덕트 매니저',
      sceneProductManagerDesc:'PRD·사용자 스토리·제품 로드맵',
      sceneDataAnalyst:'📊 데이터 분석가',
      sceneDataAnalystDesc:'데이터 정제·시각화·인사이트',
      sceneUIUXDesigner:'🎨 UI/UX 디자이너',
      sceneUIUXDesignerDesc:'사용자 경험·인터랙션 디자인·디자인 리뷰',
      sceneBusinessStrategist:'💼 비즈니스 전략가',
      sceneBusinessStrategistDesc:'시장 분석·비즈니스 모델·전략 수립',
      sceneIntlTranslate:'🌐 번역',
      sceneIntlTranslateDesc:'중국어↔목표 언어(직장/기술) · 별도 그룹',
      sceneIntlSop:'📑 기업 표준화 SOP',
      sceneIntlSopDesc:'범용 Markdown SOP · 별도 그룹',
      sceneGraphicTemplates:'📐 도형 템플릿',
      sceneGraphicTemplatesDesc:'흐름·구조·시간·의사결정·Mermaid',
      sceneDesignWorkflow:'🎨 프로 디자인 공동창작',
      sceneDesignWorkflowDesc:'블루프린트 우선 · 패션/일러스트/사진/제품/영상',
      sceneLoad:'✓ 선택한 템플릿 로드',
      sceneSkip:'건너뛰기, 새로 시작',
      sceneBtn:'🎭 시나리오 템플릿',
      sceneLoaded:'✓ 템플릿 로드됨',
      templateBtn:'📋 AI 템플릿',
      templateTitle:'📋 AI 도우미 템플릿 만들기',
      templateSubtitle:'아래 정보를 채우면 전문적인 프롬프트가 생성됩니다',
      templateRole:'역할',
      templateRolePh:'예: 시니어 PM, 테크 리드, 콘텐츠 크리에이터...',
      templateWork:'주요 업무',
      templateWorkPh:'예: PRD 작성, 코드 리뷰, 글 작성...',
      templateSkills:'핵심 스킬',
      templateSkillsPh:'예: 데이터 분석, 사용자 조사, 기술 글쓰기...',
      templateContext:'활동 맥락',
      templateContextPh:'예: 인터넷 기업, 교육, 이커머스...',
      templateGenerate:'✨ 템플릿 생성',
      templateUse:'이 템플릿 사용',
      templateExamples:'💡 예시 템플릿',
      confirmDel:'이 그룹을 삭제하시겠습니까? (문장은 삭제되지 않습니다)',
      dragHint:'여기로 문장을 드래그하세요',
      aiOptimize:'✨ AI 다듬기',
      aiOptimizeBoth:'전문+맞춤',
      aiOptimizing:'처리 중...',
      aiBothOptimizing:'전문+맞춤 처리 중...',
      aiRestore:'↩ 원문 복원',
      aiApiKey:'AI API 키',
      aiApiKeyPh:'OpenAI 호환 API 키',
      aiApiUrl:'API 기본 URL',
      aiApiUrlPh:'https://api.openai.com/v1 또는 호환 주소',
      aiBaseUrlPreset:'자주 쓰는 Base URL',
      aiBaseUrlCustom:'— 사용자 지정(아래에 전체 URL) —',
      aiBaseUrlModelHint:'선택한 모델에 맞는 주소입니다.',
      aiQwenRegionLabel:'Qwen 리전(API Key 생성 리전과 일치)',
      aiQwenRegionHint:'일반 sk- Key는 콘솔 리전과 Base URL이 일치해야 합니다. sk-sp- 는 Coding Plan 전용입니다.',
      settings:'설정',
      settingsModalTitle:'설정',
      settingsSectionApi:'API 키 및 모델',
      settingsSectionConn:'적용 설정 및 연결 테스트',
      settingsSectionHotkeys:'키보드 단축키',
      settingsSectionSnippets:'스크립트·정렬',
      snippetSortByScoreLabel:'사용 횟수로 정렬(자주 쓰는 항목 우선)',
      snippetSortByScoreHint:'켜면 같은 그룹 안에서 횟수가 높은 스크립트가 위에 옵니다. 끄면 드래그·추가 순서를 따릅니다. 카드와⚡패널에 횟수가 표시됩니다. 복사 또는 페이지 삽입 시 1회 가산.',
      snippetDangerClearAllLabel:'모든 스크립트·그룹도 함께 삭제(위험)',
      snippetResetCountsBtn:'전체 사용 횟수 초기화',
      snippetResetCountsConfirm:'모든 스크립트의 사용 횟수를 0으로 초기화할까요?',
      snippetDangerClearAllConfirm:'위험 옵션이 켜져 있습니다. 모든 스크립트와 그룹을 삭제합니다. 계속할까요?',
      snippetResetCountsDone:'✓ 사용 횟수를 초기화했습니다',
      snippetDangerClearAllDone:'✓ 모든 스크립트와 그룹을 삭제했습니다',
      snippetUseCountTitle:'사용 횟수',
      aiProviderLabel:'AI 제공자',
      aiModelLabel:'AI 모델',
      hkPlatform:'플랫폼',
      hkPlatformMac:'Mac',
      hkPlatformWin:'Windows',
      hkPalette:'AI 팔레트（⚡）',
      hkRewrite:'다듬기·재작성',
      hkShorten:'축약',
      hkTranslateLabel:'번역',
      hkSet:'설정',
      aiCompatHint:'OpenAI API 및 호환 서비스(Azure OpenAI, Claude 호환 등)를 지원합니다.\n저장 후 문장 편집에서 AI 다듬기 등을 사용할 수 있습니다.',
      hkCaptureHint:'「설정」을 누른 뒤 원하는 단축키를 누르세요. Esc로 취소합니다.',
      hkPressCombo:'키 조합…',
      hkSaved:'✓ 단축키 저장됨',
      aiSettings:'🤖 AI 설정',
      aiSave:'저장',
      aiNoKey:'먼저 「설정」에서 API 키를 입력하세요',
      aiEffectiveCfg:'적용될 설정',
      aiEffectiveHint:'위 항목과 동기화됩니다. API 주소를 비우면 저장 시 해당 제공자 기본 주소가 사용됩니다.',
      aiSumProvider:'제공자',
      aiSumBase:'Base URL',
      aiSumModel:'모델 ID',
      aiSumGeminiPath:'Gemini 요청 경로(key= 쿼리로 키 전달)',
      aiTestConn:'연결 테스트',
      aiTesting:'테스트 중…',
      aiTestOk:'연결 성공',
      aiTestProbe:'모델에 식별 질문 중…',
      aiTestReplyTitle:'모델 응답',
      aiTestNeedKey:'API 키를 먼저 입력하세요',
      aiModuleNotReady:'AI 모듈이 로드되지 않았습니다. 도구 모음이나 단축키로 사이드바를 한 번 여세요.',
      sceneTitle:'🎭 시나리오 선택',
      sceneSubtitle:'하나 이상의 시나리오를 선택하여 전문 템플릿 로드',
      sceneWorkplace:'💼 직장인',
      sceneWorkplaceDesc:'이메일 다듬기·회의록·진행보고',
      sceneDeveloper:'💻 개발자',
      sceneDeveloperDesc:'코드 리뷰·오류 설명·API 문서',
      sceneStudent:'🎓 학생/연구원',
      sceneStudentDesc:'논문 다듬기·문헌 요약·논문 심사 준비',
      sceneCreator:'✍️ 콘텐츠 크리에이터',
      sceneCreatorDesc:'매력적인 제목·소셜 포스트·SEO',
      sceneArchitect:'🏗️ 소프트웨어 아키텍트',
      sceneArchitectDesc:'시스템 설계·기술 스택·아키텍처 리뷰',
      sceneResearcher:'🔬 리서치 분석가',
      sceneResearcherDesc:'심층 조사·데이터 분석·보고서 작성',
      sceneProductManager:'🎯 프로덕트 매니저',
      sceneProductManagerDesc:'PRD·사용자 스토리·제품 로드맵',
      sceneDataAnalyst:'📊 데이터 분석가',
      sceneDataAnalystDesc:'데이터 정제·시각화·인사이트',
      sceneUIUXDesigner:'🎨 UI/UX 디자이너',
      sceneUIUXDesignerDesc:'사용자 경험·인터랙션 디자인·디자인 리뷰',
      sceneBusinessStrategist:'💼 비즈니스 전략가',
      sceneBusinessStrategistDesc:'시장 분석·비즈니스 모델·전략 수립',
      sceneLoad:'✓ 선택한 템플릿 로드',
      sceneSkip:'건너뛰기, 새로 시작',
      sceneBtn:'🎭 시나리오 템플릿',
      sceneLoaded:'✓ 템플릿 로드됨',
      langSelTitle:'🌐 인터페이스 언어 선택',
      langSelSubtitle:'선호하는 인터페이스 언어를 선택하세요',
      langSelChinese:'中文（简体）',
      langSelEnglish:'English',
      langSelKorean:'한국어',
      langSelConfirm:'✓ 선택 확인',
      langLabel:'언어', toneLabel:'어조', taskLabel:'작업',
      langOpts:['한국어','영어','일본어','중국어','프랑스어','독일어','스페인어'],
      toneOpts:['공식적','친근한','학술적','간결한','따뜻한','권위있는'],
      taskOpts:['문법 교정','다듬기','번역만','요약','확장','축약'],
      defaultSnippets:[],
      sceneTemplates: {
        workplace: [
          {id:'wp1',title:'📧 이메일 다듬기',content:'다음 이메일을 {{전문적:tone:어조}}이고 명확하게 다듬어 주세요. 핵심 내용 유지, {{상사:task:대상}}가 읽기 적합하게:\n\n',groupId:null},
          {id:'wp2',title:'🙅 정중한 거절',content:'다음 요청을 {{따뜻한:tone:어조}} 방식으로 거절하되, 대안을 제시하거나 이해를 표현해 주세요 ({{150자:task:길이}}):\n\n',groupId:null},
          {id:'wp3',title:'📝 회의록 정리',content:'다음 회의 기록을 {{간결한:tone:어조}} 회의록으로 정리: 결정사항, 액션 아이템, 담당자, 마감일 포함:\n\n',groupId:null},
          {id:'wp4',title:'📊 진행상황 보고',content:'다음 진행 상황을 {{권위있는:tone:어조}} 보고서로 구성, 성과·수치·다음 단계 강조 ({{300자:task:길이}}):\n\n',groupId:null},
          {id:'wp5',title:'💡 제안서 작성',content:'이 아이디어를 {{학술적:tone:어조}} 완전한 제안서로 확장: 배경, 목표, 접근 방법, 예상 결과:\n\n',groupId:null},
          {id:'wp6',title:'⭐ 성과 평가',content:'다음 직원 성과에 대한 평가를 {{공식적:tone:어조}}으로 작성: 강점, 개선 영역, 격려 ({{200자:task:길이}}):\n\n',groupId:null},
        ],
        developer: [
          {id:'dev1',title:'🔍 코드 리뷰',content:'다음 코드 리뷰: 1) 잠재적 버그  2) 성능 문제  3) 보안 우려  4) 가독성  5) 모범 사례:\n\n```\n\n```',groupId:null},
          {id:'dev2',title:'❌ 오류 설명',content:'다음 오류를 {{간결한:tone:어조}}하게 설명: 근본 원인, 발생 시나리오, 3가지 해결책 (쉬운 것부터 고급까지):\n\n',groupId:null},
          {id:'dev3',title:'📝 주석 작성',content:'이 코드에 {{학술적:tone:어조}} 주석 추가: 기능 설명, 매개변수, 반환값, 엣지 케이스, 복잡도:\n\n```\n\n```',groupId:null},
          {id:'dev4',title:'⚖️ 솔루션 비교',content:'다음 {{2:task:개수}}개 기술 솔루션을 성능, 개발 비용, 유지보수성, 확장성 측면에서 비교:\n\n옵션 A:\n\n옵션 B:\n\n',groupId:null},
          {id:'dev5',title:'📚 API 문서',content:'{{간결한:tone:어조}} API 문서 생성: 설명, 요청 파라미터, 응답 형식, 코드 예제, 오류 코드:\n\n',groupId:null},
          {id:'dev6',title:'🔧 리팩토링 제안',content:'이 코드는 작동하지만 지저분합니다. 리팩토링 제안: 구조, 네이밍, 디자인 패턴, 테스트 가능성:\n\n```\n\n```',groupId:null},
        ],
        student: [
          {id:'stu1',title:'📄 논문 다듬기',content:'이 {{학술적:tone:어조}} 논문 단락을 정확성과 유창함을 위해 다듬어 주세요. 학술 표준 유지, {{영어:lang:언어}}로 번역:\n\n',groupId:null},
          {id:'stu2',title:'📖 논문 요약',content:'이 논문의 {{간결한:tone:어조}} 핵심 내용 추출: 연구 질문, 방법, 발견, 한계, 내 연구에 대한 통찰 ({{300자:task:길이}}):\n\n',groupId:null},
          {id:'stu3',title:'💡 개념 설명',content:'이 개념을 {{친근한:tone:어조}}, 평이한 언어로 설명: 정의, 예시, 사용 사례, 관련 개념과의 차이:\n\n',groupId:null},
          {id:'stu4',title:'🎤 논문 심사 Q&A',content:'내 논문 주제: [여기에 입력]. {{권위있는:tone:어조}} 심사위원 관점에서 5가지 까다로운 질문과 대응 전략을 예측해 주세요.',groupId:null},
          {id:'stu5',title:'📋 논문 개요',content:'이 주제에 대한 {{학술적:tone:어조}} 논문 개요 작성: 서론, 문헌 검토, 방법론, 예상 결과, 토론, 결론:\n\n주제:',groupId:null},
          {id:'stu6',title:'🔎 비판적 분석',content:'이 주장을 비판적으로 분석: 논리 체계, 증거 충분성, 반론, 개선 방향:\n\n',groupId:null},
        ],
        creator: [
          {id:'cre1',title:'🔥 매력적인 제목',content:'이 콘텐츠에 대한 {{10:task:개수}}개의 눈길을 끄는 제목 생성, {{친근한:tone:어조}} 스타일, 숫자, 질문, 대조 사용:\n\n콘텐츠:',groupId:null},
          {id:'cre2',title:'🎨 스타일 재작성',content:'이 텍스트를 {{따뜻한:tone:어조}} 스타일로 {{젊은 성인:task:대상}}을 위해 재작성, 공감과 생생한 이미지 추가:\n\n',groupId:null},
          {id:'cre3',title:'🔍 SEO 설명',content:'SEO 친화적인 {{간결한:tone:어조}} 설명 작성 ({{160자:task:길이}} 이하), 키워드 자연스럽게 포함, 클릭 유도:\n\n키워드:\n콘텐츠:',groupId:null},
          {id:'cre4',title:'📱 소셜 포스트',content:'{{인스타그램:task:플랫폼}}용 {{친근한:tone:어조}} 포스트 작성, 이모지, 해시태그, 참여 유도 포함 ({{200자:task:길이}}):\n\n주제:',groupId:null},
          {id:'cre5',title:'🎁 제품 소개',content:'{{권위있는:tone:어조}} 제품 카피 작성: 문제점, 솔루션, 주요 이점, 사용 사례, 행동 촉구:\n\n제품:',groupId:null},
          {id:'cre6',title:'💬 리뷰 답변',content:'이 부정적인 리뷰에 {{따뜻한:tone:어조}}로 답변: 진심 어린 사과, 설명, 보상, 브랜드 온정 ({{150자:task:길이}}):\n\n리뷰:',groupId:null},
        ],
        architect: [
          {id:'arc1',title:'🏗️ 시스템 아키텍처',content:'다음 요구사항에 대한 {{권위있는:tone:어조}} 시스템 아키텍처 설계: 기술 스택, 핵심 모듈, 데이터 흐름, 확장성:\n\n요구사항:',groupId:null},
          {id:'arc2',title:'⚖️ 기술 스택 비교',content:'{{3:task:개수}}개 기술 솔루션을 {{학술적:tone:어조}}으로 비교: 성능, 비용, 생태계, 팀 친숙도:\n\n옵션 A:\n옵션 B:\n옵션 C:',groupId:null},
          {id:'arc3',title:'📋 아키텍처 리뷰',content:'{{간결한:tone:어조}} 아키텍처 리뷰 체크리스트 생성: 확장성, 유지보수성, 보안, 성능, 비용:\n\n아키텍처 개요:',groupId:null},
          {id:'arc4',title:'🔄 리팩토링 계획',content:'다음 문제들에 대한 {{권위있는:tone:어조}} 리팩토링 계획: 문제 분석, 목표 아키텍처, 마이그레이션 전략, 리스크 관리:\n\n현재 문제:',groupId:null},
          {id:'arc5',title:'📊 성능 최적화',content:'다음 병목현상에 대한 {{간결한:tone:어조}} 최적화 방안: 코드 레이어, 아키텍처 레이어, 인프라 레이어:\n\n병목 설명:',groupId:null},
          {id:'arc6',title:'🛡️ 보안 아키텍처',content:'{{학술적:tone:어조}} 보안 아키텍처 설계: 인증/인가, 암호화, 네트워크 격리, 감사 로그:\n\n시스템 설명:',groupId:null},
        ],
        researcher: [
          {id:'res1',title:'🔍 산업 조사',content:'{{AI 산업:task:분야}}에 대한 {{학술적:tone:어조}} 심층 조사: 시장 규모, 주요 플레이어, 기술 트렌드, 기회 ({{500자:task:길이}}):',groupId:null},
          {id:'res2',title:'📊 경쟁사 분석',content:'{{3:task:개수}}개 경쟁사를 {{권위있는:tone:어조}}로 분석: 기능, 가격, 사용자 평가, 시장 전략:\n\n경쟁사:',groupId:null},
          {id:'res3',title:'📈 데이터 인사이트',content:'이 데이터에서 {{간결한:tone:어조}} 핵심 인사이트 추출: 주요 트렌드, 이상치, 비즈니스 권장사항, 다음 행동:\n\n데이터 개요:',groupId:null},
          {id:'res4',title:'📝 리서치 보고서',content:'조사 자료를 {{학술적:tone:어조}} 보고서로 구성: 요약, 배경, 방법론, 발견사항, 결론, 권장사항:\n\n조사 자료:',groupId:null},
          {id:'res5',title:'🎯 사용자 조사',content:'인터뷰 내용을 {{간결한:tone:어조}}로 분석: 핵심 pain points, 우선순위 니즈, 잠재 솔루션, 검증할 가설:\n\n인터뷰 노트:',groupId:null},
          {id:'res6',title:'🌐 트렌드 예측',content:'다음 정보를 바탕으로 {{권위있는:tone:어조}} {{향후 3년:task:기간}} 산업 트렌드 예측: 추진 요인, 주요 변화, 리스크:\n\n배경 정보:',groupId:null},
        ],
        productManager: [
          {id:'pm1',title:'📋 PRD 문서',content:'요구사항을 {{간결한:tone:어조}} PRD로 구성: 배경, 목표, 사용자 스토리, 기능, 승인 기준, 일정:\n\n요구사항:',groupId:null},
          {id:'pm2',title:'👤 사용자 스토리',content:'{{5:task:개수}}개 사용자 스토리를 {{친근한:tone:어조}}로 작성: [역할]로서, [기능]을 원한다, [가치]를 위해:\n\n기능 설명:',groupId:null},
          {id:'pm3',title:'🎯 제품 로드맵',content:'{{Q1-Q4:task:기간}}에 대한 {{권위있는:tone:어조}} 로드맵 설계, 각 단계: 핵심 기능, 성공 지표, 필요 자원:\n\n제품 방향:',groupId:null},
          {id:'pm4',title:'⚡ 우선순위 순위',content:'{{간결한:tone:어조}} RICE 모델 (Reach·Impact·Confidence·Effort)로 요구사항 우선순위 지정:\n\n요구사항 목록:',groupId:null},
          {id:'pm5',title:'📊 기능 분석',content:'기능 데이터를 {{권위있는:tone:어조}}로 분석: 주요 지표 해석, 문제 진단, 최적화 제안:\n\n데이터 요약:',groupId:null},
          {id:'pm6',title:'🚀 출시 계획',content:'{{간결한:tone:어조}} 출시 계획 설계: 롤아웃 전략, 사용자 커뮤니케이션, 리스크 완화, 롤백 메커니즘:\n\n기능 소개:',groupId:null},
        ],
        dataAnalyst: [
          {id:'da1',title:'📊 데이터 정제',content:'{{간결한:tone:어조}} 데이터 정제 계획 설계: 결측값 처리, 이상치 탐지, 형식 표준화, 중복 제거:\n\n데이터셋 설명:',groupId:null},
          {id:'da2',title:'📈 시각화 아이디어',content:'{{3:task:개수}}개 시각화 유형을 {{친근한:tone:어조}}로 추천, 각 차트가 보여주는 인사이트와 사용 사례 설명:\n\n데이터 차원:',groupId:null},
          {id:'da3',title:'🔍 지표 프레임워크',content:'{{커머스:task:비즈니스}}를 위한 {{권위있는:tone:어조}} 지표 프레임워크: 북극성 지표, 1급 지표, 2급 지표:',groupId:null},
          {id:'da4',title:'📉 이상 진단',content:'데이터 이상 발생. {{간결한:tone:어조}}로 분석: 가능한 원인 (최소 3개), 검증 방법, 권장사항:\n\n이상 설명:',groupId:null},
          {id:'da5',title:'💡 인사이트 보고서',content:'분석 결과를 {{권위있는:tone:어조}} 인사이트 보고서로 구성: 주요 발견, 비즈니스 영향, 행동 항목, 다음 분석:\n\n분석 결과:',groupId:null},
          {id:'da6',title:'🎯 A/B 테스트 설계',content:'{{학술적:tone:어조}} A/B 테스트 설계: 가설, 테스트 그룹, 샘플 크기 계산, 성공 기준:\n\n테스트 목적:',groupId:null},
        ],
        uiuxDesigner: [
          {id:'ui1',title:'🎨 UX 최적화',content:'페이지/기능에 대한 {{친근한:tone:어조}} UX 최적화 제안: 사용성, 일관성, 피드백, 미학:\n\n페이지 설명:',groupId:null},
          {id:'ui2',title:'📐 인터랙션 디자인',content:'{{간결한:tone:어조}} 인터랙션 흐름 설계: 사용자 트리거 경로, 페이지 탐색, 상태 피드백, 오류 처리:\n\n기능 요구사항:',groupId:null},
          {id:'ui3',title:'🖼️ 디자인 리뷰',content:'{{권위있는:tone:어조}} 디자인 리뷰 체크리스트: 정보 아키텍처, 시각적 계층, 인터랙션 논리, 접근성, 반응형 디자인:',groupId:null},
          {id:'ui4',title:'🎭 사용자 페르소나',content:'{{온라인 교육:task:제품}}을 위한 {{3:task:개수}}개 페르소나를 {{친근한:tone:어조}}로 생성: 인구통계, 목표, pain points, 시나리오:',groupId:null},
          {id:'ui5',title:'🔄 사용자 여정 맵',content:'시나리오에 대한 {{간결한:tone:어조}} 사용자 여정 설명: 접점, 사용자 행동, 감정 곡선, 최적화 기회:\n\n시나리오:',groupId:null},
          {id:'ui6',title:'💬 사용성 보고서',content:'사용성 테스트 결과를 {{권위있는:tone:어조}} 보고서로 구성: 문제 요약, 심각도 순위, 개선 제안, 우선순위:\n\n테스트 노트:',groupId:null},
        ],
        businessStrategist: [
          {id:'bs1',title:'📊 시장 분석',content:'{{SaaS 시장:task:시장}}을 {{권위있는:tone:어조}}로 분석: 시장 규모, 성장 추세, 경쟁 환경, 진입 장벽, 기회:',groupId:null},
          {id:'bs2',title:'💡 비즈니스 모델',content:'{{간결한:tone:어조}} 비즈니스 모델 설계: 가치 제안, 고객 세그먼트, 수익원, 비용 구조, 핵심 자원:\n\n제품 개요:',groupId:null},
          {id:'bs3',title:'🎯 전략 계획',content:'{{권위있는:tone:어조}} {{3년:task:기간}} 전략 계획: 비전/미션, 전략적 목표, 핵심 전략, 주요 이니셔티브, 마일스톤:\n\n현재 상황:',groupId:null},
          {id:'bs4',title:'⚔️ 경쟁 전략',content:'Porter의 5 Forces로 산업 분석, {{학술적:tone:어조}}로 차별화 전략 제안:\n\n산업 배경:',groupId:null},
          {id:'bs5',title:'💰 가격 전략',content:'{{간결한:tone:어조}} 가격 전략 설계: 가격 모델, 가격 앵커, 패키지 디자인, 프로모션 전략:\n\n제품 소개:',groupId:null},
          {id:'bs6',title:'📈 성장 전략',content:'{{권위있는:tone:어조}} AARRR 모델 (Acquisition·Activation·Retention·Revenue·Referral) 성장 전략:\n\n제품 지표:',groupId:null},
        ],
      },
      defaultGroups:[
        {id:'g1',name:'번역'},
        {id:'g2',name:'작문'},
      ],
      defaultKeywords:{
        lang:['한국어','영어','일본어','중국어','프랑스어','독일어','스페인어','러시아어','아랍어','포르투갈어'],
        tone:['공식적','친근한','학술적','간결한','따뜻한','권위있는','유머러스','전문적','정중한'],
        task:['번역','수정','다듬기','요약','확장','축약','검토','설명','바꿔쓰기','핵심추출'],
      },
    },
  };

  function getVarTypes(t) {
    return {
      lang:{label:t.langLabel,color:'#0C447C',bg:'#E6F1FB',border:'#378ADD',options:t.langOpts},
      tone:{label:t.toneLabel,color:'#3C3489',bg:'#EEEDFE',border:'#7F77DD',options:t.toneOpts},
      task:{label:t.taskLabel,color:'#085041',bg:'#E1F5EE',border:'#1D9E75',options:t.taskOpts},
    };
  }

  // ── VARIABLE HELPERS ────────────────────────────────────────
  const VR = /\{\{([^:}]+):([^:}]+):([^}]+)\}\}/g;
  function hasVars(c){VR.lastIndex=0;return VR.test(c);}
  function parseVars(c){const v=[],seen=new Set();let m;VR.lastIndex=0;while((m=VR.exec(c))!==null){const k=m[2]+':'+m[3];if(!seen.has(k)){seen.add(k);v.push({dv:m[1],type:m[2],label:m[3]});}}return v;}
  function resolve(c,vv){return c.replace(VR,(_,dv,type,label)=>{const k=type+':'+label;return(vv&&vv[k]!==undefined)?vv[k]:dv;});}
  function chips(c,vv,VT){return c.replace(VR,(_,dv,type,label)=>{const k=type+':'+label;const val=(vv&&vv[k])?vv[k]:dv;const vt=VT[type];if(!vt)return esc(val);return`<span class="tw-chip tw-chip-${type}" style="background:${vt.bg};color:${vt.color};border:1.5px solid ${vt.border}">${esc(val)}</span>`;});}
  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

  // ── STATE ────────────────────────────────────────────────────
  let state={
    snippets:[], groups:[], varValues:{}, varEditingId:null,
    customKeywords:{lang:[],tone:[],task:[]},
    lang:'', theme:'apple', sidebarWidth:320, opacity:0.92, fontSizeLevel:2, collapsed:false,
    searchQuery:'', editingSnippet:null, editingGroup:null,
    dragSnippetId:null, dragOverGroupId:null,
    hasSeenOnboarding:false, hasSelectedLang:false, selectedScenes:[],
    position:{x:0, y:0}, // x: 距视口右侧内缩(px)，0=贴齐右缘（类 Chrome 侧栏）；y: 距顶部
    sidebarFixedHeight:null, // 用户拖出的固定高度(px)；null 表示随内容+视口自动
    isDraggingSidebar:false, // 是否正在拖动侧边栏
    templates:[], // AI模版列表
    currentTemplate:null, // 当前编辑的模版
    aiApiKey:'', // AI API密钥
    aiApiUrl:'https://api.openai.com/v1', // AI API地址
    aiProvider:'openai', // AI 提供商
    aiModel:'gpt-4o-mini', // AI 模型
    aiPaletteMode:'compact', // AI面板模式：'compact'(缩小) | 'full'(完整)
    snippetSortByScore: true, // true：组内按使用次数优先；false：保持数组/拖拽顺序
    hotkeys:{
      // 供 Trigger 层匹配：以 e.code 为准
      mac:{
        palette:{code:'Slash', key:'/', modifiers:{meta:true,  ctrl:false, alt:false, shift:true}},
        rewrite:{code:'KeyR', key:'R', modifiers:{meta:false, ctrl:false, alt:true,  shift:true}},
        shorten:{code:'KeyS', key:'S', modifiers:{meta:false, ctrl:false, alt:true,  shift:true}},
        translate:{code:'KeyT', key:'T', modifiers:{meta:false, ctrl:false, alt:true,  shift:true}},
      },
      win:{
        palette:{code:'Slash', key:'/', modifiers:{meta:false, ctrl:true,  alt:false, shift:true}},
        rewrite:{code:'KeyR', key:'R', modifiers:{meta:false, ctrl:true,  alt:false, shift:true}},
        shorten:{code:'KeyS', key:'S', modifiers:{meta:false, ctrl:true,  alt:false, shift:true}},
        translate:{code:'KeyT', key:'T', modifiers:{meta:false, ctrl:true,  alt:false, shift:true}},
      },
    },
    originalContent:{}, // 存储原始内容，key为snippet id
    personaWizardDone: false,
    aiUserProfile: {
      nickname: '', jobTitle: '', personaRoleKey: 'custom', personality: '', nationality: '', speakLang: '', extra: '',
      aiSummary: '', avatarUrl: '',
    },
    sharePrefs: {
      mailTo: '',
      smbNote: '',
      webdavUrl: '',
      webdavUser: '',
      webdavPass: '',
      cloudPostUrl: '',
      cloudPostToken: '',
    },
    agencySelectedCeleb: null,
    agencySelectedAgent: null,
    agencyTaskContext: '',
    agencyPrefetchIndex: false,
    agencyEnhanceEnabled: false,
    userSuperstars: [],
    userAgencyAgents: [],
    /** 从 Agency 列表隐藏的内置 id（不删上游数据） */
    agencyHiddenBuiltinAgentIds: [],
    agencyHiddenBuiltinStarIds: [],
  };

  function defaultSharePrefs() {
    return {
      mailTo: '',
      smbNote: '',
      webdavUrl: '',
      webdavUser: '',
      webdavPass: '',
      cloudPostUrl: '',
      cloudPostToken: '',
    };
  }

  function defaultAiUserProfile() {
    return {
      nickname: '', jobTitle: '', personaRoleKey: 'custom', personality: '', nationality: '', speakLang: '', extra: '',
      aiSummary: '', avatarUrl: '',
    };
  }

  function refreshTwGooglePrimerOnWindow() {
    const lang = state.lang === 'en' ? 'en' : state.lang === 'ko' ? 'ko' : 'zh';
    window.TW_GOOGLE_PROMPT_PRIMER = TW_GOOGLE_PROMPT_PRIMER[lang] || TW_GOOGLE_PROMPT_PRIMER.zh;
  }

  function personaHasMeaningfulFields(p) {
    if (!p || typeof p !== 'object') return false;
    if (p.personaRoleKey && String(p.personaRoleKey) !== 'custom') return true;
    return ['nickname', 'jobTitle', 'personality', 'nationality', 'speakLang', 'extra', 'aiSummary'].some(
      (k) => String(p[k] || '').trim(),
    );
  }

  function updateHeaderPersonaAvatar() {
    const img = root?.querySelector('#tw-hdr-avatar');
    const fb = root?.querySelector('#tw-hdr-persona-fallback');
    if (!img) return;
    const url = state.aiUserProfile?.avatarUrl;
    const hasProfile = personaHasMeaningfulFields(state.aiUserProfile);
    const tip = t.personaOpenSettings || '';
    if (url) {
      img.src = url;
      img.style.display = 'block';
      img.title = tip;
      if (fb) fb.style.display = 'none';
    } else {
      img.removeAttribute('src');
      img.style.display = 'none';
      img.title = '';
      if (fb) {
        if (hasProfile) {
          const nick = String(state.aiUserProfile?.nickname || '').trim();
          fb.textContent = nick ? nick.slice(0, 1).toUpperCase() : '🧩';
          fb.style.display = 'inline-flex';
          fb.title = tip;
        } else {
          fb.style.display = 'none';
          fb.title = '';
        }
      }
    }
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = () => reject(r.error);
      r.readAsText(file);
    });
  }

  /** 与主界面「复制」一致：用已保存的变量值展开 {{默认值:类型:标签}}；供快速模式使用 */
  function twExpandSnippetContent(snippetId, rawContent) {
    const c = rawContent || '';
    const vv = state.varValues?.[snippetId] || {};
    return hasVars(c) ? resolve(c, vv) : c;
  }
  window.TwExpandSnippetContent = twExpandSnippetContent;

  let t=LANG.zh, VT=getVarTypes(t), root=null;
  let aiRewriteReady = false;

  /**
   * 界面字体四档：仅对侧栏根节点 #sb 使用 zoom。
   * 蒙层弹窗（.tw-ov）、AI 浮层（#twar-wrapper）与 #sb 同级，不受缩放，避免对话框/按钮被撑坏。
   */
  const FONT_SIZE_ZOOM = { 1: 0.86, 2: 1, 3: 1.14, 4: 1.28 };
  function clampFontSizeLevel(n) {
    const x = parseInt(n, 10);
    if (x >= 1 && x <= 4) return x;
    return 2;
  }
  function applyFontSizeLevel() {
    const level = clampFontSizeLevel(state.fontSizeLevel);
    state.fontSizeLevel = level;
    const zoom = FONT_SIZE_ZOOM[level] ?? 1;
    const host = document.getElementById('talkweb-sour-host');
    if (host) host.style.removeProperty('zoom');
    if (root) {
      const sb = root.querySelector('#sb');
      if (sb) {
        sb.style.removeProperty('font-size');
        sb.style.zoom = String(zoom);
      }
      const twar = root.querySelector('#twar-wrapper');
      if (twar) twar.style.removeProperty('zoom');
      root.querySelectorAll('.tw-fs-lvl').forEach((btn) => {
        const lv = parseInt(btn.dataset.level, 10);
        btn.classList.toggle('active', lv === level);
      });
    }
  }

  // ── STORAGE ─────────────────────────────────────────────────
  async function loadData(){
    return new Promise(resolve=>{
      chrome.storage.local.get(['tw_snippets','tw_groups','tw_varValues','tw_lang','tw_width','tw_opacity','tw_fontSizeLevel','tw_hasSeenOnboarding','tw_hasSelectedLang','tw_position','tw_sidebarFixedHeight','tw_aiApiKey','tw_aiApiUrl','tw_aiProvider','tw_aiModel','tw_aiPaletteMode','tw_snippetSortByScore','tw_originalContent','tw_hotkeys','tw_personaWizardDone','tw_aiUserProfile','tw_sharePrefs','tw_rightDockMigrated','tw_userAgencyAgents','tw_userSuperstars','tw_agencySelectedCeleb','tw_agencySelectedAgent','tw_agencyTaskContext','tw_agencyPrefetchIndex','tw_agencyEnhanceEnabled','tw_agencyHiddenBuiltinAgentIds','tw_agencyHiddenBuiltinStarIds'],r=>{
        state.lang    = r.tw_lang||'';
        state.hasSelectedLang = r.tw_hasSelectedLang || false;
        // Only set language if already selected
        if(state.lang){
          t = LANG[state.lang];
          VT = getVarTypes(t);
        }
        state.hasSeenOnboarding = r.tw_hasSeenOnboarding || false;
        state.snippets  = r.tw_snippets || [];
        state.groups    = r.tw_groups   || (state.lang ? t.defaultGroups.map(g=>({...g,collapsed:false})) : []);
        state.varValues = r.tw_varValues|| {};
        state.sidebarWidth = r.tw_width || 320;
        state.opacity   = r.tw_opacity  || 0.92;
        state.fontSizeLevel = clampFontSizeLevel(r.tw_fontSizeLevel);
        state.theme    = r.tw_theme    || 'apple';
        state.customKeywords = r.tw_kwcustom || {lang:[],tone:[],task:[]};
        state.position = r.tw_position || {x:0, y:0};
        if (!r.tw_rightDockMigrated) {
          state.position = { x: 0, y: typeof state.position.y === 'number' ? state.position.y : 0 };
          chrome.storage.local.set({ tw_rightDockMigrated: true, tw_position: state.position });
        }
        state.sidebarFixedHeight = (r.tw_sidebarFixedHeight != null && r.tw_sidebarFixedHeight > 0) ? r.tw_sidebarFixedHeight : null;
        state.aiApiKey = normalizeStoredApiKey(r.tw_aiApiKey || '');
        state.aiApiUrl = r.tw_aiApiUrl || 'https://api.openai.com/v1';
        state.aiProvider = r.tw_aiProvider || 'openai';
        state.aiModel = r.tw_aiModel || 'gpt-4o-mini';
        state.aiPaletteMode = r.tw_aiPaletteMode || 'compact'; // 默认缩小模式
        state.snippetSortByScore = r.tw_snippetSortByScore !== false; // 默认按次数优先
        if (r.tw_hotkeys) state.hotkeys = r.tw_hotkeys;
        state.originalContent = r.tw_originalContent || {};
        let pwd = r.tw_personaWizardDone;
        if (pwd === undefined && r.tw_hasSeenOnboarding) pwd = true;
        state.personaWizardDone = pwd === true;
        state.aiUserProfile = {
          ...defaultAiUserProfile(),
          ...(r.tw_aiUserProfile && typeof r.tw_aiUserProfile === 'object' ? r.tw_aiUserProfile : {}),
        };
        state.sharePrefs = {
          ...defaultSharePrefs(),
          ...(r.tw_sharePrefs && typeof r.tw_sharePrefs === 'object' ? r.tw_sharePrefs : {}),
        };
        state.userAgencyAgents = Array.isArray(r.tw_userAgencyAgents) ? r.tw_userAgencyAgents : [];
        state.userSuperstars = Array.isArray(r.tw_userSuperstars) ? r.tw_userSuperstars : [];
        state.agencySelectedCeleb = r.tw_agencySelectedCeleb || null;
        state.agencySelectedAgent = r.tw_agencySelectedAgent || null;
        state.agencyTaskContext = typeof r.tw_agencyTaskContext === 'string' ? r.tw_agencyTaskContext : '';
        state.agencyPrefetchIndex = r.tw_agencyPrefetchIndex === true;
        state.agencyEnhanceEnabled = r.tw_agencyEnhanceEnabled === true;
        state.agencyHiddenBuiltinAgentIds = Array.isArray(r.tw_agencyHiddenBuiltinAgentIds)
          ? r.tw_agencyHiddenBuiltinAgentIds.map(String)
          : [];
        state.agencyHiddenBuiltinStarIds = Array.isArray(r.tw_agencyHiddenBuiltinStarIds)
          ? r.tw_agencyHiddenBuiltinStarIds.map(String)
          : [];
        resolve();
      });
    });
  }
  function save(){
    chrome.storage.local.set({
      tw_snippets:state.snippets, tw_groups:state.groups,
      tw_varValues:state.varValues, tw_lang:state.lang,
      tw_width:state.sidebarWidth, tw_opacity:state.opacity, tw_fontSizeLevel:state.fontSizeLevel, tw_theme:state.theme, tw_kwcustom:state.customKeywords,
      tw_hasSeenOnboarding:state.hasSeenOnboarding, tw_hasSelectedLang:state.hasSelectedLang,
      tw_position:state.position, tw_sidebarFixedHeight:state.sidebarFixedHeight,
      tw_aiApiKey:state.aiApiKey, tw_aiApiUrl:state.aiApiUrl, tw_aiProvider:state.aiProvider, tw_aiModel:state.aiModel, tw_aiPaletteMode:state.aiPaletteMode,
      tw_snippetSortByScore: state.snippetSortByScore !== false,
      tw_originalContent:state.originalContent,
      tw_hotkeys:state.hotkeys,
      tw_personaWizardDone: state.personaWizardDone,
      tw_aiUserProfile: state.aiUserProfile,
      tw_sharePrefs: state.sharePrefs,
      tw_userAgencyAgents: state.userAgencyAgents,
      tw_userSuperstars: state.userSuperstars,
      tw_agencySelectedCeleb: state.agencySelectedCeleb,
      tw_agencySelectedAgent: state.agencySelectedAgent,
      tw_agencyTaskContext: state.agencyTaskContext,
      tw_agencyPrefetchIndex: state.agencyPrefetchIndex,
      tw_agencyEnhanceEnabled: state.agencyEnhanceEnabled === true,
      tw_agencyHiddenBuiltinAgentIds: state.agencyHiddenBuiltinAgentIds,
      tw_agencyHiddenBuiltinStarIds: state.agencyHiddenBuiltinStarIds,
    }, () => {
      if (chrome.runtime.lastError) {
        console.warn('TalkwebSour: Storage save error:', chrome.runtime.lastError.message);
      }
    });
  }
  function patchState(partial) {
    if (!partial || typeof partial !== 'object') return;
    Object.assign(state, partial);
    save();
    if (
      Object.keys(partial).some(
        (k) =>
          k.startsWith('agency') ||
          k === 'userAgencyAgents' ||
          k === 'userSuperstars',
      )
    ) {
      try {
        void window.TwAgencyUI?.refreshStack?.();
        void window.TwAiRewrite?.refreshPaletteIfOpen?.();
      } catch (_) {}
    }
  }

  /** 快速模式面板：Agency 开关 / 清除（供 render.js 调用） */
  function exposeAgencyPaletteBridge() {
    /** 网页桥接等场景下 TwAgencyUI.init 可能未执行，靠此读取 content 的 state 供快速条摘要 */
    window.__twGetExtensionState = () => state;
    window.TwPatchAgencyEnhance = (v) => patchState({ agencyEnhanceEnabled: !!v });
    window.TwPaletteAgencyClear = (which) => {
      if (which === 'celeb') patchState({ agencySelectedCeleb: null });
      else if (which === 'agent') patchState({ agencySelectedAgent: null });
    };
    /** 关闭 ⚡ 浮层后展开侧栏并打开 Agency（避免 Agency 落在不可点的 hidden 侧栏或 z-index 下层） */
    window.TwOpenAgencyModalFromPalette = () => {
      try {
        setMainSidebarOpen(true);
      } catch (_) {}
      requestAnimationFrame(() => {
        try {
          window.TwAgencyUI?.openModal?.();
        } catch (_) {}
      });
    };
  }
  function uid(){return 'id_'+Date.now()+'_'+Math.random().toString(36).substr(2,5);}

  const TW_SEED_GEMINI_GUIDE_KEY = 'tw_seededGeminiWorkspaceGuide';

  /** 首次安装/升级后注入 Google Workspace Gemini 提示指南脚本（仅一次） */
  async function seedGeminiWorkspaceGuideOnce() {
    const stored = await new Promise((res) => chrome.storage.local.get([TW_SEED_GEMINI_GUIDE_KEY], res));
    if (stored[TW_SEED_GEMINI_GUIDE_KEY]) return;

    const langKey = state.lang === 'en' ? 'en' : state.lang === 'ko' ? 'ko' : 'zh';
    const list = TW_GEMINI_WORKSPACE_GUIDE[langKey] || TW_GEMINI_WORKSPACE_GUIDE.zh;
    const gname =
      langKey === 'en'
        ? '📘 Gemini Workspace prompt guide (Google)'
        : langKey === 'ko'
          ? '📘 Gemini Workspace 프롬프트 (Google)'
          : '📘 Gemini Workspace 提示指南（Google 思路）';

    const gid = uid();
    state.groups.push({ id: gid, name: gname, collapsed: true });
    list.forEach((item) => {
      state.snippets.unshift({
        id: uid(),
        title: item.title,
        content: appendDefaultUserInputTail(item.content, langKey),
        groupId: gid,
        createdAt: Date.now(),
      });
    });
    await new Promise((res) => chrome.storage.local.set({ [TW_SEED_GEMINI_GUIDE_KEY]: true }, res));
    save();
  }

  // ── KEYWORD HIGHLIGHT ENGINE ─────────────────────────────────
  // Colors per type (same as existing VT chip colors)
  const KW_STYLE = {
    lang:{bg:'#E6F1FB',color:'#0C447C',border:'#378ADD'},
    tone:{bg:'#EEEDFE',color:'#3C3489',border:'#7F77DD'},
    task:{bg:'#E1F5EE',color:'#085041',border:'#1D9E75'},
  };
  // Get merged keyword map: {word -> type}
  function getKwMap() {
    const map = new Map();
    // default keywords from current lang
    const dk = t.defaultKeywords || {};
    ['lang','tone','task'].forEach(type => {
      (dk[type]||[]).forEach(w => map.set(w.toLowerCase(), type));
    });
    // custom keywords (override defaults)
    const ck = state.customKeywords || {};
    ['lang','tone','task'].forEach(type => {
      (ck[type]||[]).forEach(w => { if(w.trim()) map.set(w.trim().toLowerCase(), type); });
    });
    return map;
  }
  // Highlight keywords in plain text — returns HTML string
  function kwHighlight(text) {
    const map = getKwMap();
    if (!map.size) return esc(text);
    // Sort by length desc so longer matches win
    const words = [...map.keys()].sort((a,b) => b.length - a.length);
    const pattern = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
    if (!pattern) return esc(text);
    const re = new RegExp('(' + pattern + ')', 'gi');
    return text.replace(re, (match) => {
      const type = map.get(match.toLowerCase());
      const s = KW_STYLE[type] || KW_STYLE.lang;
      return `<span class="tw-chip" style="background:${s.bg};color:${s.color};border:1.5px solid ${s.border}">${esc(match)}</span>`;
    }).replace(/[^<>]+(?=[<>]|$)/g, seg => {
      // escape remaining plain text segments (not inside tags)
      return seg.replace(/&(?!amp;|lt;|gt;|quot;)/g,'&amp;');
    });
  }
  // Safe version: escape first then wrap keywords (avoids double-escaping)
  function kwHighlightSafe(text) {
    const map = getKwMap();
    if (!map.size) return esc(text);
    const words = [...map.keys()].sort((a,b) => b.length - a.length);
    const pattern = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
    if (!pattern) return esc(text);
    const re = new RegExp('(' + pattern + ')', 'gi');
    // Split text into segments, escape plain parts, wrap matched parts
    const parts = [];
    let last = 0;
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parts.push(esc(text.slice(last, m.index)));
      const type = map.get(m[1].toLowerCase());
      const s = KW_STYLE[type] || KW_STYLE.lang;
      parts.push(`<span class="tw-chip" style="background:${s.bg};color:${s.color};border:1.5px solid ${s.border}">${esc(m[1])}</span>`);
      last = m.index + m[1].length;
    }
    if (last < text.length) parts.push(esc(text.slice(last)));
    return parts.join('');
  }

  // ── THEMES ──────────────────────────────────────────────────
  const THEMES = {
    apple: {
      name:'🍎 Apple',
      '--tw-accent':'#0071e3', '--tw-accent2':'#2997ff',
      '--tw-accent-rgb':'0,113,227',
      '--tw-bg':'0,0,0', '--tw-card-bg':'39,39,41',
      '--tw-text':'#ffffff', '--tw-muted':'rgba(255,255,255,0.72)', '--tw-dim':'rgba(255,255,255,0.48)',
      '--tw-border':'rgba(255,255,255,0.12)',
    },
    cyber: {
      name:'🔵 Cyber',
      '--tw-accent':'#00d4ff', '--tw-accent2':'#7b4fff',
      '--tw-accent-rgb':'0,212,255',
      '--tw-bg':'8,12,24', '--tw-card-bg':'18,30,58',
      '--tw-text':'#e8f4ff', '--tw-muted':'#6a8aaa', '--tw-dim':'#3a5070',
      '--tw-border':'rgba(var(--tw-accent-rgb,0,212,255),0.15)',
    },
    forest: {
      name:'🟢 Forest',
      '--tw-accent':'#00e076', '--tw-accent2':'#00a854',
      '--tw-accent-rgb':'0,224,118',
      '--tw-bg':'6,18,12', '--tw-card-bg':'12,32,22',
      '--tw-text':'#e0f8ec', '--tw-muted':'#5a8a70', '--tw-dim':'#2a5040',
      '--tw-border':'rgba(0,224,118,0.15)',
    },
    amber: {
      name:'🟡 Amber',
      '--tw-accent':'#ffb800', '--tw-accent2':'#ff6a00',
      '--tw-accent-rgb':'255,184,0',
      '--tw-bg':'18,12,4', '--tw-card-bg':'36,24,8',
      '--tw-text':'#fff8e8', '--tw-muted':'#8a7050', '--tw-dim':'#5a4030',
      '--tw-border':'rgba(255,184,0,0.15)',
    },
    rose: {
      name:'🔴 Rose',
      '--tw-accent':'#ff4488', '--tw-accent2':'#c02060',
      '--tw-accent-rgb':'255,68,136',
      '--tw-bg':'20,6,12', '--tw-card-bg':'38,12,24',
      '--tw-text':'#ffe8f0', '--tw-muted':'#8a506a', '--tw-dim':'#5a2040',
      '--tw-border':'rgba(255,68,136,0.15)',
    },
    light: {
      name:'☀️ Light',
      '--tw-accent':'#0071e3', '--tw-accent2':'#0066cc',
      '--tw-accent-rgb':'0,113,227',
      '--tw-bg':'245,245,247', '--tw-card-bg':'255,255,255',
      '--tw-text':'#1d1d1f', '--tw-muted':'rgba(0,0,0,0.55)', '--tw-dim':'rgba(0,0,0,0.48)',
      '--tw-border':'rgba(0,0,0,0.08)',
    },
    mono: {
      name:'⬛ Mono',
      '--tw-accent':'#cccccc', '--tw-accent2':'#888888',
      '--tw-accent-rgb':'204,204,204',
      '--tw-bg':'10,10,10', '--tw-card-bg':'22,22,22',
      '--tw-text':'#eeeeee', '--tw-muted':'#666666', '--tw-dim':'#444444',
      '--tw-border':'rgba(180,180,180,0.15)',
    },
  };
  function applyTheme(name) {
    const th = THEMES[name] || THEMES.apple;
    const sb = $('#sb'); if (!sb) return;
    Object.entries(th).forEach(([k,v]) => { if(k.startsWith('--')) sb.style.setProperty(k, v); });
    sb.dataset.twTheme = name;
    const opVal = state.opacity;
    sb.style.background = `rgba(${th['--tw-bg']},${opVal})`;
    state.theme = name;
  }

  // ── CSS ─────────────────────────────────────────────────────
  function css(){return `
:host{all:initial;}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
#sb{
  position:fixed;
  right:var(--tw-x,0px);
  left:auto;
  top:var(--tw-y,0px);
  height:auto;
  max-height:calc(100vh - var(--tw-y,0px));
  width:var(--tw-w,320px);
  display:flex;flex-direction:column;
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display","Helvetica Neue",Helvetica,Arial,sans-serif;
  font-size:13px;letter-spacing:-0.22px;color:var(--tw-text,#e8f4ff);
  background:rgba(var(--tw-bg,8,12,24),0.92);
  backdrop-filter:saturate(180%) blur(20px);-webkit-backdrop-filter:saturate(180%) blur(20px);
  border:1px solid var(--tw-border,rgba(var(--tw-accent-rgb,0,212,255),0.15));
  border-radius:12px;
  box-shadow:rgba(0,0,0,0.22) -4px 5px 28px 0px;
  transition:opacity 0.3s;
  overflow:hidden;z-index:2147483647;
}
#sb.tw-dock-flush{
  border-radius:12px 0 0 12px;
  border-right-color:transparent;
  box-shadow:rgba(0,0,0,0.2) -6px 0 24px 0px;
}
#sb.tw-in-side-panel{
  position:absolute!important;
  left:0!important;right:0!important;top:0!important;
  width:100%!important;height:100%!important;
  max-height:none!important;border-radius:0!important;
  box-shadow:none!important;
}
#sb.tw-in-side-panel #tw-resize,#sb.tw-in-side-panel #tw-tab,#sb.tw-in-side-panel #tw-close{display:none!important;}
#sb.tw-in-side-panel.collapsed{opacity:1!important;pointer-events:auto!important;}
#sb::before{content:'';position:absolute;inset:0;pointer-events:none;
  background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(var(--tw-accent-rgb,0,212,255),0.018) 2px,rgba(var(--tw-accent-rgb,0,212,255),0.018) 4px);}
#sb[data-tw-theme="apple"]::before{opacity:0!important;visibility:hidden;}
#sb.collapsed{opacity:0.3;pointer-events:none;}
#sb.hidden{opacity:0;pointer-events:none;}

#tw-resize{position:absolute;left:-4px;right:auto;top:0;width:8px;height:100%;cursor:ew-resize;z-index:10;}
#tw-resize:hover,#tw-resize.dragging{background:linear-gradient(270deg,transparent,rgba(var(--tw-accent-rgb,0,212,255),0.3));}
#tw-resize-v{
  flex-shrink:0;height:10px;margin:0 6px 6px;border-radius:0 0 10px 10px;cursor:ns-resize;z-index:5;
  background:linear-gradient(180deg,transparent,rgba(var(--tw-accent-rgb,0,212,255),0.14));
  border:1px solid rgba(var(--tw-accent-rgb,0,212,255),0.12);border-top:none;
  display:flex;align-items:center;justify-content:center;
}
#tw-resize-v::after{
  content:'';
  width:36px;height:3px;border-radius:3px;background:rgba(var(--tw-accent-rgb,0,212,255),0.35);
}
#tw-resize-v:hover{background:linear-gradient(180deg,transparent,rgba(var(--tw-accent-rgb,0,212,255),0.22));}
#tw-resize-v.dragging{background:linear-gradient(180deg,transparent,rgba(var(--tw-accent-rgb,0,212,255),0.3));}

#tw-tab{
  position:absolute;left:-28px;right:auto;top:50%;transform:translateY(-50%);
  width:28px;height:72px;background:rgba(var(--tw-bg,8,12,24),0.92);
  border:1px solid var(--tw-border,rgba(var(--tw-accent-rgb,0,212,255),0.15));border-right:none;border-radius:8px 0 0 8px;
  cursor:pointer;display:flex;align-items:center;justify-content:center;
  color:var(--tw-accent,#00d4ff);font-size:14px;box-shadow:-3px 0 12px rgba(0,0,0,0.4);transition:all 0.2s;
}
#tw-tab:hover{background:rgba(var(--tw-card-bg,18,30,58),0.85);}

#tw-toast{
  position:absolute;top:8px;left:50%;transform:translateX(-50%) translateY(-40px);
  background:var(--tw-accent,#0071e3);color:#fff;
  font-size:11px;font-weight:700;padding:6px 14px;border-radius:20px;
  letter-spacing:1px;opacity:0;transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1);
  pointer-events:none;z-index:100;white-space:nowrap;
}
#tw-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}

/* header */
#tw-hdr{position:relative;z-index:1;padding:12px 14px 10px;flex-shrink:0;
  border-bottom:1px solid rgba(var(--tw-accent-rgb,0,212,255),0.15);
  background:linear-gradient(180deg,rgba(var(--tw-accent-rgb,0,212,255),0.06) 0%,transparent 100%);
  cursor:move;user-select:none;}
#tw-hdr:active{cursor:grabbing;}
.tw-logo-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}
.tw-logo{display:flex;align-items:center;gap:8px;}
.tw-logo-icon{width:26px;height:26px;background:var(--tw-accent,#0071e3);
  border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:13px;}
.tw-logo-text{font-size:13px;font-weight:700;color:var(--tw-text,#e8f4ff);letter-spacing:1px;display:flex;align-items:baseline;flex-wrap:wrap;gap:4px;}
.tw-logo-text span:first-of-type{color:var(--tw-accent);}
.tw-logo-text .tw-ver{font-size:9px;color:var(--tw-muted,#6a8aaa);font-weight:600;letter-spacing:0;}
.tw-bak-modal{max-width:540px;max-height:90vh;overflow-y:auto;}
.tw-hdr-acts{display:flex;gap:5px;align-items:center;}
.tw-ib{width:26px;height:26px;border:1px solid rgba(var(--tw-accent-rgb,0,212,255),0.15);border-radius:6px;
  background:rgba(var(--tw-card-bg,18,30,58),0.75);color:var(--tw-muted,#6a8aaa);cursor:pointer!important;
  display:flex;align-items:center;justify-content:center;font-size:12px;
  font-family:inherit;transition:all 0.2s;padding:0;}
.tw-ib:hover{border-color:var(--tw-accent);color:var(--tw-accent);background:rgba(var(--tw-accent-rgb,0,212,255),0.1);}
.tw-lang-cycle{font-size:9px;font-weight:700;letter-spacing:0.5px;min-width:26px;}
.tw-op-row{display:flex;align-items:center;gap:8px;padding:0 2px 10px;}
.tw-op-label{font-size:10px;color:var(--tw-dim,#3a5070);letter-spacing:1px;min-width:38px;}
.tw-op-val{font-size:10px;color:var(--tw-accent);min-width:30px;text-align:right;}
.tw-fs-row{display:flex;align-items:center;gap:8px;padding:0 2px 10px;flex-wrap:wrap;}
.tw-fs-lvls{display:flex;gap:4px;flex:1;justify-content:flex-end;flex-wrap:wrap;}
.tw-fs-lvl{
  min-width:28px;padding:4px 7px;border-radius:6px;border:1px solid rgba(var(--tw-accent-rgb,0,212,255),0.28);
  background:rgba(var(--tw-card-bg,18,30,58),0.45);color:var(--tw-muted,#6a8aaa);font-size:10px;font-weight:600;
  cursor:pointer;font-family:inherit;line-height:1.2;transition:all 0.15s;
}
.tw-fs-lvl:hover{color:var(--tw-text,#e8f4ff);border-color:rgba(var(--tw-accent-rgb,0,212,255),0.45);}
.tw-fs-lvl.active{
  border-color:var(--tw-accent,#00d4ff);color:var(--tw-accent,#00d4ff);
  box-shadow:0 0 10px rgba(var(--tw-accent-rgb,0,212,255),0.22);
  background:rgba(var(--tw-accent-rgb,0,212,255),0.08);
}
input[type=range]{flex:1;-webkit-appearance:none;height:3px;background:rgba(var(--tw-accent-rgb,0,212,255),0.15);border-radius:2px;outline:none;cursor:pointer!important;}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:var(--tw-accent);cursor:pointer!important;}
.tw-search-wrap{position:relative;}
.tw-si{position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--tw-dim,#3a5070);font-size:13px;pointer-events:none;}
.tw-sc{position:absolute;right:7px;top:50%;transform:translateY(-50%);color:var(--tw-dim,#3a5070);cursor:pointer;font-size:13px;display:none;}
.tw-sc:hover{color:#ff4466;}
#tw-search{width:100%;padding:7px 26px 7px 28px;background:rgba(var(--tw-card-bg,18,30,58),0.75);
  border:1px solid rgba(var(--tw-accent-rgb,0,212,255),0.15);border-radius:8px;color:var(--tw-text,#e8f4ff);
  font-family:inherit;font-size:12px;outline:none;transition:all 0.2s;box-sizing:border-box;cursor:text!important;}
#tw-search::placeholder{color:var(--tw-dim,#3a5070);}
#tw-search:focus{border-color:var(--tw-accent,#00d4ff);box-shadow:0 0 10px rgba(var(--tw-accent-rgb,0,212,255),0.1);}

/* content area */
#tw-body{position:relative;z-index:1;flex:1;overflow-y:auto;overflow-x:hidden;padding:8px 10px;
  min-height:0;
  scrollbar-width:thin;scrollbar-color:rgba(var(--tw-accent-rgb,0,212,255),0.15) transparent;}
#tw-body::-webkit-scrollbar{width:4px;}
#tw-body::-webkit-scrollbar-thumb{background:rgba(var(--tw-accent-rgb,0,212,255),0.15);border-radius:2px;}

/* group header */
.tw-grp{margin-bottom:10px;}
.tw-grp-hdr{
  display:flex;align-items:center;gap:6px;padding:5px 6px;
  border-radius:8px;cursor:pointer;transition:all 0.15s;
  border:1px solid transparent;
  background:rgba(var(--tw-accent-rgb,0,212,255),0.04);
}
.tw-grp-hdr:hover{background:rgba(var(--tw-accent-rgb,0,212,255),0.08);border-color:rgba(var(--tw-accent-rgb,0,212,255),0.15);}
.tw-grp-hdr.drag-over{border-color:var(--tw-accent);background:rgba(var(--tw-accent-rgb,0,212,255),0.12);box-shadow:0 0 12px rgba(var(--tw-accent-rgb,0,212,255),0.2);}
.tw-grp-arrow{font-size:10px;color:var(--tw-dim,#3a5070);transition:transform 0.2s;flex-shrink:0;}
.tw-grp-arrow.open{transform:rotate(90deg);}
.tw-grp-name{font-size:11px;font-weight:600;color:var(--tw-muted,#6a8aaa);letter-spacing:1px;text-transform:uppercase;flex:1;}
.tw-grp-count{font-size:10px;color:var(--tw-dim,#3a5070);background:rgba(var(--tw-accent-rgb,0,212,255),0.08);
  padding:1px 6px;border-radius:10px;border:1px solid rgba(var(--tw-accent-rgb,0,212,255),0.1);}
.tw-grp-acts{display:none;gap:3px;}
.tw-grp-hdr:hover .tw-grp-acts{display:flex;}
.tw-grp-act{width:20px;height:20px;border:1px solid rgba(var(--tw-accent-rgb,0,212,255),0.15);border-radius:4px;
  background:rgba(var(--tw-card-bg,18,30,58),0.75);color:var(--tw-muted,#6a8aaa);cursor:pointer;
  display:flex;align-items:center;justify-content:center;font-size:11px;
  font-family:inherit;transition:all 0.15s;padding:0;}
.tw-grp-act:hover{border-color:var(--tw-accent);color:var(--tw-accent);}
.tw-grp-act.del:hover{border-color:#ff4466;color:#ff4466;}
.tw-grp-body{padding-left:0;margin-top:4px;}
.tw-grp-body.collapsed-grp{display:none;}
.tw-grp-drop-hint{
  display:none;padding:8px;border:1.5px dashed rgba(var(--tw-accent-rgb,0,212,255),0.2);border-radius:8px;
  text-align:center;font-size:11px;color:var(--tw-dim,#3a5070);margin:4px 0;transition:all 0.2s;
}
.tw-grp-body.drag-active .tw-grp-drop-hint{display:block;}
.tw-grp-body.drag-active.drag-over-body .tw-grp-drop-hint{border-color:var(--tw-accent);color:var(--tw-accent);background:rgba(var(--tw-accent-rgb,0,212,255),0.05);}

/* ungrouped section */
.tw-ung-label{font-size:10px;color:var(--tw-dim,#3a5070);letter-spacing:2px;text-transform:uppercase;
  padding:4px 4px 6px;display:flex;align-items:center;gap:8px;}
.tw-ung-label::after{content:'';flex:1;height:1px;background:rgba(var(--tw-accent-rgb,0,212,255),0.1);}

/* snippet card */
.tw-card{position:relative;padding:9px 11px;margin-bottom:5px;
  background:rgba(var(--tw-card-bg,18,30,58),0.75);border:1px solid rgba(var(--tw-accent-rgb,0,212,255),0.15);
  border-radius:8px;cursor:grab;transition:all 0.2s;overflow:hidden;}
.tw-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;
  background:var(--tw-accent,#0071e3);opacity:0;transition:opacity 0.2s;}
.tw-card:hover{background:rgba(var(--tw-card-bg,18,30,58),0.85);border-color:var(--tw-accent);transform:translateX(2px);box-shadow:0 0 14px rgba(var(--tw-accent-rgb,0,212,255),0.2);}
.tw-card:hover::before{opacity:1;}
.tw-card.dragging{opacity:0.4;cursor:grabbing;transform:scale(0.97);}
.tw-card.copied{border-color:#00ffaa;box-shadow:0 0 14px rgba(0,255,170,0.3);}
.tw-use-count{font-size:9px;font-weight:700;color:var(--tw-dim,rgba(255,255,255,0.42));margin-left:6px;vertical-align:1px;}
.tw-card-title{font-size:12px;font-weight:600;color:var(--tw-text,#e8f4ff);margin-bottom:3px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.tw-card-prev{font-size:11px;color:var(--tw-muted,#6a8aaa);line-height:1.6;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.tw-card-acts{position:absolute;right:7px;top:50%;transform:translateY(-50%);display:none;gap:3px;}
.tw-card:hover .tw-card-acts{display:flex;}
.tw-act{width:22px;height:22px;border:1px solid rgba(var(--tw-accent-rgb,0,212,255),0.15);border-radius:4px;
  background:rgba(var(--tw-card-bg,18,30,58),0.88);color:var(--tw-muted,#6a8aaa);cursor:pointer;
  display:flex;align-items:center;justify-content:center;font-size:11px;
  font-family:inherit;transition:all 0.15s;padding:0;}
.tw-act:hover{border-color:var(--tw-accent);color:var(--tw-accent);}
.tw-act.del:hover{border-color:#ff4466;color:#ff4466;}
.tw-vbadge{display:inline-block;padding:1px 5px;border-radius:10px;font-size:9px;
  letter-spacing:1px;text-transform:uppercase;background:rgba(var(--tw-accent-rgb,0,212,255),0.12);
  color:var(--tw-accent);border:1px solid rgba(var(--tw-accent-rgb,0,212,255),0.3);margin-left:5px;vertical-align:middle;}
.tw-chip{display:inline-block;padding:1px 7px 2px;border-radius:12px;
  font-size:11px;font-weight:600;cursor:pointer;vertical-align:middle;margin:0 2px;white-space:nowrap;}
.tw-chip:hover{opacity:0.8;transform:scale(1.05);}
.tw-highlight{background:rgba(var(--tw-accent-rgb,0,212,255),0.25);color:var(--tw-accent);border-radius:2px;}
.tw-empty{text-align:center;padding:36px 16px;color:var(--tw-dim,#3a5070);}
.tw-empty-icon{font-size:28px;margin-bottom:10px;opacity:0.5;}
.tw-empty-text{font-size:12px;}

/* footer */
#tw-ftr{position:relative;z-index:1;padding:8px 10px;flex-shrink:0;
  border-top:1px solid rgba(var(--tw-accent-rgb,0,212,255),0.15);display:flex;gap:6px;}
#tw-ftr2{position:relative;z-index:1;flex-shrink:0;
  display:grid;
  grid-template-columns:repeat(3, minmax(0, 1fr));
  gap:6px;
  align-items:stretch;}
@media (max-width: 380px){
  #tw-ftr2{grid-template-columns:repeat(2, minmax(0, 1fr));}
}
.tw-ftr-btn{flex:1;padding:8px 10px;
  background:rgba(255,255,255,0.06);
  border:1px solid var(--tw-border,rgba(var(--tw-accent-rgb,0,212,255),0.15));border-radius:8px;
  color:var(--tw-muted);font-family:inherit;font-size:11px;font-weight:500;
  letter-spacing:-0.12px;cursor:pointer;transition:all 0.2s;}
.tw-ftr-btn:hover{border-color:var(--tw-accent);color:var(--tw-text);}

/* ── MODALS ─────────────────────────────────────────────── */
.tw-ov{position:fixed;inset:0;background:rgba(0,0,0,0.72);backdrop-filter:blur(4px);
  z-index:2147483648;display:none;align-items:center;justify-content:center;}
.tw-ov.open{display:flex;}
/* Agency / 正文预览：盖住 ⚡ 快速面板（同 z-index 时需叠在上层） */
#tw-agency-modal.tw-ov{z-index:2147483651;}
#tw-agency-detail-ov.tw-ov{z-index:2147483652;}
#tw-agency-edit-ov.tw-ov{z-index:2147483653;}
.tw-agency-card{
  display:flex;flex-wrap:wrap;align-items:stretch;gap:8px;margin-bottom:10px;padding:10px 10px 10px 12px;
  background:rgba(0,0,0,0.22);border-radius:12px;border:1px solid rgba(var(--tw-accent-rgb,0,212,255),0.18);
}
.tw-agency-card-main{
  flex:1 1 160px;min-width:0;text-align:left;cursor:pointer;border:none;background:transparent;padding:0;
  font-size:11px;color:var(--tw-body,#eaf4ff);font-family:inherit;
}
.tw-agency-card-title{font-weight:600;margin-bottom:4px;color:var(--tw-accent,#00d4ff);}
.tw-agency-card-desc{font-size:9px;color:rgba(255,255,255,0.52);line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.tw-agency-card-actions{display:flex;flex-wrap:wrap;gap:6px;align-items:center;flex:0 0 auto;}
.tw-agency-icon-btn{
  min-width:34px;padding:6px 8px;font-size:11px;border-radius:8px;border:1px solid rgba(var(--tw-accent-rgb,0,212,255),0.35);
  background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.88);cursor:pointer;font-family:inherit;line-height:1.2;
}
.tw-agency-icon-btn:hover{background:rgba(var(--tw-accent-rgb,0,212,255),0.14);}
.tw-agency-icon-btn.danger{border-color:rgba(255,107,107,0.45);color:#ffaaa8;}
.tw-agency-icon-btn.danger:hover{background:rgba(255,80,80,0.15);}
.tw-agency-hidden-strip{margin-top:10px;padding:8px 10px;font-size:10px;color:rgba(255,255,255,0.55);border-radius:8px;
  background:rgba(0,0,0,0.25);border:1px dashed rgba(255,255,255,0.12);}
.tw-agency-hidden-strip button{margin-left:8px;font-size:10px;padding:4px 8px;border-radius:6px;cursor:pointer;border:1px solid rgba(255,255,255,0.2);
  background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.85);font-family:inherit;}
.tw-agency-hidden-strip button:hover{background:rgba(255,255,255,0.1);}
.tw-modal{width:440px;max-width:92vw;max-height:min(90vh,720px);overflow-y:auto;box-sizing:border-box;
  background:rgba(var(--tw-bg,8,12,24),0.97);
  border:1px solid color-mix(in srgb, var(--tw-accent,#00d4ff) 40%, transparent);border-radius:12px;padding:22px;
  box-shadow:0 0 60px rgba(var(--tw-accent-rgb,0,212,255),0.15),0 40px 80px rgba(0,0,0,0.6);
  animation:min 0.25s cubic-bezier(0.34,1.56,0.64,1);}
@keyframes min{from{opacity:0;transform:scale(0.9) translateY(16px)}to{opacity:1;transform:scale(1) translateY(0)}}
.tw-modal.wide{width:480px;}
.tw-mt{font-size:14px;font-weight:700;color:var(--tw-accent,#00d4ff);margin-bottom:16px;letter-spacing:1px;}
.tw-fg{margin-bottom:12px;}
.tw-fl{display:block;font-size:10px;color:var(--tw-dim,#3a5070);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px;}
.tw-fi,.tw-ft,.tw-fs{width:100%;padding:8px 11px;background:rgba(var(--tw-card-bg,18,30,58),0.75);
  border:1px solid rgba(var(--tw-accent-rgb,0,212,255),0.2);border-radius:8px;
  color:var(--tw-text,#e8f4ff);font-family:inherit;font-size:12px;outline:none;transition:all 0.2s;box-sizing:border-box;}
.tw-ft{min-height:80px;resize:vertical;line-height:1.6;}
.tw-fi:focus,.tw-ft:focus,.tw-fs:focus{border-color:var(--tw-accent,#00d4ff);box-shadow:0 0 10px rgba(var(--tw-accent-rgb,0,212,255),0.1);}
.tw-fi.err{border-color:#ff4466;}
.tw-fs option{background:rgba(var(--tw-card-bg,18,30,58),0.95);color:var(--tw-text,#e8f4ff);}
.tw-vh{margin-top:7px;font-size:10px;color:var(--tw-dim,#3a5070);line-height:1.6;
  padding:6px 9px;background:rgba(var(--tw-accent-rgb,0,212,255),0.04);border:1px solid rgba(var(--tw-accent-rgb,0,212,255),0.1);border-radius:6px;}
.tw-vh code{background:rgba(var(--tw-accent-rgb,0,212,255),0.12);color:var(--tw-accent);padding:1px 4px;border-radius:4px;font-size:10px;font-family:inherit;}
.tw-ma{display:flex;gap:8px;margin-top:18px;flex-shrink:0;}
/* 新建/编辑语句：第一行两枚 AI；第二行取消/保存；恢复独占一行 */
#tw-sm .tw-sm-actions{
  display:grid;
  grid-template-columns:repeat(2, minmax(0, 1fr));
  gap:10px;
  width:100%;
  margin-top:18px;
  flex-shrink:0;
  box-sizing:border-box;
}
#tw-sm .tw-sm-actions .tw-sm-btn{
  width:100%;
  min-width:0;
  height:38px;
  margin:0;
  padding:0 10px;
  box-sizing:border-box;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  font-size:11px;
  font-weight:600;
  line-height:1.2;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
  flex:none !important;
}
#tw-sm .tw-sm-actions #tw-sm-restore{
  grid-column:1 / -1;
}
/* 新建/编辑语句：中间区域可滚动，底部按钮栏始终可见 */
#tw-sm .tw-modal.tw-snippet-modal{
  width:min(440px, 94vw);
  max-height:min(88vh, 680px);
  display:flex;
  flex-direction:column;
  padding:18px 20px 16px;
  overflow:hidden;
  box-sizing:border-box;
}
#tw-sm .tw-snippet-scroll{
  flex:1;
  min-height:0;
  overflow-y:auto;
  overflow-x:hidden;
  padding-right:6px;
  margin-right:-4px;
  scrollbar-width:thin;
}
#tw-sm .tw-snippet-scroll::-webkit-scrollbar{width:6px;}
#tw-sm .tw-snippet-scroll::-webkit-scrollbar-thumb{
  background:rgba(var(--tw-accent-rgb,0,212,255),0.25);border-radius:4px;}
#tw-sm .tw-modal.tw-snippet-modal > .tw-snippet-scroll > .tw-mt:first-child{margin-top:0;}
/* 设置弹窗：可滚动 + 分区折叠，避免顶部 API 输入被挤出可视区 */
.tw-modal.tw-settings-modal{
  width:min(440px, 94vw);max-height:min(88vh, 620px);display:flex;flex-direction:column;padding:18px 20px 20px;}
.tw-modal.tw-settings-modal > .tw-mt{flex-shrink:0;margin-bottom:12px;}
.tw-settings-scroll{
  flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding-right:6px;margin-right:-4px;
  scrollbar-width:thin;}
.tw-settings-scroll::-webkit-scrollbar{width:6px;}
.tw-settings-scroll::-webkit-scrollbar-thumb{background:rgba(var(--tw-accent-rgb,0,212,255),0.25);border-radius:4px;}
.tw-details{
  border:1px solid rgba(var(--tw-accent-rgb,0,212,255),0.22);border-radius:10px;margin-bottom:10px;
  background:rgba(0,0,0,0.14);}
.tw-details > summary{
  cursor:pointer;list-style:none;user-select:none;
  font-size:11px;font-weight:700;color:var(--tw-text,#e8f4ff);
  padding:9px 12px;letter-spacing:0.4px;
  display:flex;align-items:center;gap:6px;}
.tw-details > summary::-webkit-details-marker{display:none;}
.tw-details > summary::before{
  content:'▸';font-size:10px;color:var(--tw-accent,#00d4ff);opacity:0.85;width:1em;}
.tw-details[open] > summary::before{content:'▾';}
.tw-details[open] > summary{border-bottom:1px solid rgba(var(--tw-accent-rgb,0,212,255),0.12);}
.tw-details .tw-details-inner{padding:6px 12px 12px;}
.tw-details .tw-details-inner .tw-fg:last-child{margin-bottom:0;}
.tw-bp{flex:1;padding:10px;background:var(--tw-accent,#0071e3);
  border:none;border-radius:8px;color:#fff;font-family:inherit;
  font-size:12px;font-weight:700;letter-spacing:1px;cursor:pointer;transition:all 0.2s;}
.tw-bp:hover{opacity:0.92;filter:brightness(1.06);box-shadow:0 0 18px rgba(var(--tw-accent-rgb,0,212,255),0.35);transform:translateY(-1px);}
.tw-bs{padding:10px 16px;background:rgba(var(--tw-card-bg,18,30,58),0.75);border:1px solid rgba(var(--tw-accent-rgb,0,212,255),0.15);
  border-radius:8px;color:var(--tw-muted,#6a8aaa);font-family:inherit;font-size:12px;cursor:pointer;transition:all 0.2s;}
.tw-bs:hover{border-color:var(--tw-accent);color:var(--tw-accent);}

/* keyword chip tags in modal */
.tw-kw-tag{display:inline-flex;align-items:center;gap:4px;padding:3px 8px 3px 10px;
  border-radius:14px;font-size:11px;margin:3px;cursor:default;}
.tw-kw-tag-del{background:none;border:none;cursor:pointer;font-size:11px;
  padding:0 0 0 2px;opacity:0.6;line-height:1;}
.tw-kw-tag-del:hover{opacity:1;}
.tw-kw-empty{color:var(--tw-dim,#3a5070);font-size:11px;padding:10px 4px;}
/* theme selector */
.tw-theme-row{display:flex;gap:5px;padding:6px 0 2px;flex-wrap:wrap;}
.tw-hdr-avatar{width:20px;height:20px;min-width:20px;min-height:20px;max-width:20px;max-height:20px;border-radius:50%;object-fit:cover;object-position:center;flex-shrink:0;display:none;box-sizing:border-box;
  border:2px solid rgba(var(--tw-accent-rgb,0,212,255),0.35);cursor:pointer;box-sizing:border-box;background:rgba(var(--tw-accent-rgb,0,212,255),0.06);}
.tw-hdr-avatar:hover{border-color:var(--tw-accent,#00d4ff);}
.tw-hdr-persona-fallback{
  display:none;width:20px;height:20px;border-radius:50%;flex-shrink:0;box-sizing:border-box;
  border:2px solid rgba(var(--tw-accent-rgb,0,212,255),0.35);background:rgba(var(--tw-accent-rgb,0,212,255),0.1);color:var(--tw-accent,#00d4ff);
  font-size:11px;font-weight:700;font-family:inherit;line-height:1;cursor:pointer;
  align-items:center;justify-content:center;padding:0;}
.tw-hdr-persona-fallback:hover{border-color:var(--tw-accent,#00d4ff);background:rgba(var(--tw-accent-rgb,0,212,255),0.16);}
.tw-th-dot{width:20px;height:20px;border-radius:50%;cursor:pointer!important;border:2px solid transparent;
  transition:all 0.2s;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px;}
.tw-th-dot:hover{transform:scale(1.2);}
.tw-th-dot.active{border-color:var(--tw-text,#e8f4ff);box-shadow:0 0 8px currentColor;}
/* import modal */
/* var modal */
.tw-vf{margin-bottom:12px;}
.tw-vfl{display:flex;align-items:center;gap:6px;font-size:10px;color:var(--tw-dim,#3a5070);
  letter-spacing:1.5px;text-transform:uppercase;margin-bottom:7px;}
.tw-vdot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.tw-vopts{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:7px;}
.tw-vo{padding:4px 11px;border-radius:20px;font-size:11px;font-family:inherit;
  cursor:pointer;border:1.5px solid rgba(var(--tw-accent-rgb,0,212,255),0.15);background:rgba(var(--tw-card-bg,18,30,58),0.75);
  color:var(--tw-muted,#6a8aaa);transition:all 0.15s;white-space:nowrap;}
.tw-vo:hover{border-color:var(--tw-accent);color:var(--tw-text,#e8f4ff);}
.tw-vc{width:100%;padding:6px 11px;background:rgba(var(--tw-card-bg,18,30,58),0.75);
  border:1px solid rgba(var(--tw-accent-rgb,0,212,255),0.15);border-radius:8px;
  color:var(--tw-text,#e8f4ff);font-family:inherit;font-size:12px;outline:none;box-sizing:border-box;transition:all 0.2s;}
.tw-vc:focus{border-color:var(--tw-accent);}
.tw-vc::placeholder{color:var(--tw-dim,#3a5070);}
.tw-pvl{font-size:10px;color:var(--tw-dim,#3a5070);letter-spacing:1.5px;text-transform:uppercase;margin:12px 0 5px;}
.tw-pv{background:rgba(var(--tw-card-bg,18,30,58),0.88);border:1px solid rgba(var(--tw-accent-rgb,0,212,255),0.15);
  border-radius:8px;padding:9px 12px;font-size:12px;line-height:1.7;color:var(--tw-text,#e8f4ff);
  word-break:break-word;min-height:40px;}
/* scene modal */
.tw-scene-modal{width:580px;max-height:85vh;overflow-y:auto;}
.tw-persona-modal{width:min(480px,94vw);max-height:86vh;overflow-y:auto;}
.tw-persona-role-hint-wrap{margin:-4px 0 10px;padding:8px 10px;border-radius:8px;border:1px solid rgba(var(--tw-accent-rgb,0,212,255),0.12);
  background:rgba(var(--tw-card-bg,18,30,58),0.55);display:none;}
.tw-persona-role-hint-wrap.show{display:block;}
.tw-persona-role-hint-title{font-size:10px;color:var(--tw-muted,#6a8aaa);margin-bottom:6px;letter-spacing:0.3px;}
.tw-persona-role-hint{margin:0;font-family:inherit;font-size:10px;line-height:1.55;color:var(--tw-text,#e8f4ff);white-space:pre-wrap;word-break:break-word;
  max-height:140px;overflow-y:auto;}
.tw-persona-avatar-wrap{display:flex;gap:12px;align-items:center;margin-bottom:12px;flex-wrap:wrap;}
#tw-persona-avatar{width:72px;height:72px;min-width:72px;min-height:72px;max-width:72px;max-height:72px;flex-shrink:0;border-radius:14px;background:rgba(var(--tw-accent-rgb,0,212,255),0.08);border:1px solid rgba(var(--tw-accent-rgb,0,212,255),0.2);object-fit:cover;object-position:center;display:none;box-sizing:border-box;}
.tw-snippet-persona-hint{font-size:10px;color:var(--tw-accent,#00d4ff);line-height:1.45;margin-bottom:8px;padding:8px 10px;border-radius:8px;border:1px solid rgba(var(--tw-accent-rgb,0,212,255),0.2);background:rgba(var(--tw-accent-rgb,0,212,255),0.06);display:none;}
.tw-ai-opt-hint{font-size:9px;color:var(--tw-muted,#6a8aaa);margin-top:6px;line-height:1.4;text-align:center;}
@keyframes twFlashRing{0%{box-shadow:0 0 0 2px rgba(var(--tw-accent-rgb,0,212,255),0.85)}100%{box-shadow:0 0 0 0 transparent}}
.tw-persona-summary-flash{animation:twFlashRing 1s ease-out;}
.tw-scene-subtitle{font-size:11px;color:var(--tw-muted,#6a8aaa);margin:-8px 0 18px;letter-spacing:0.5px;}
.tw-scene-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;max-height:500px;overflow-y:auto;padding-right:6px;}
.tw-scene-grid::-webkit-scrollbar{width:4px;}
.tw-scene-grid::-webkit-scrollbar-thumb{background:rgba(var(--tw-accent-rgb,0,212,255),0.15);border-radius:2px;}
.tw-scene-card{padding:14px 16px;border:2px solid rgba(var(--tw-accent-rgb,0,212,255),0.15);border-radius:10px;
  background:rgba(var(--tw-card-bg,18,30,58),0.75);cursor:pointer;transition:all 0.2s;
  position:relative;overflow:hidden;}
.tw-scene-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;
  background:var(--tw-accent,#0071e3);opacity:0;transition:opacity 0.2s;}
.tw-scene-card:hover{border-color:var(--tw-accent);background:rgba(var(--tw-card-bg,18,30,58),0.9);
  box-shadow:0 0 20px rgba(var(--tw-accent-rgb,0,212,255),0.15);}
.tw-scene-card.selected{border-color:var(--tw-accent);background:rgba(var(--tw-accent-rgb,0,212,255),0.08);
  box-shadow:0 0 20px rgba(var(--tw-accent-rgb,0,212,255),0.25);}
.tw-scene-card.selected::before{opacity:1;}
.tw-scene-icon{font-size:22px;margin-bottom:8px;}
.tw-scene-name{font-size:13px;font-weight:700;color:var(--tw-text,#e8f4ff);margin-bottom:4px;letter-spacing:0.5px;}
.tw-scene-desc{font-size:10px;color:var(--tw-muted,#6a8aaa);line-height:1.5;}
.tw-scene-check{position:absolute;top:10px;right:10px;width:20px;height:20px;
  border:2px solid rgba(var(--tw-accent-rgb,0,212,255),0.3);border-radius:50%;display:flex;
  align-items:center;justify-content:center;font-size:12px;color:var(--tw-accent);opacity:0;transition:all 0.2s;}
.tw-scene-card.selected .tw-scene-check{opacity:1;background:rgba(var(--tw-accent-rgb,0,212,255),0.15);}
.tw-scene-actions{display:flex;gap:8px;margin-top:20px;}
/* language selection modal */
.tw-lang-modal{width:400px;}
.tw-lang-subtitle{font-size:11px;color:var(--tw-muted,#6a8aaa);margin:-8px 0 20px;letter-spacing:0.5px;text-align:center;}
.tw-lang-options{display:flex;flex-direction:column;gap:12px;margin-bottom:20px;}
.tw-lang-option{padding:16px 20px;border:2px solid rgba(var(--tw-accent-rgb,0,212,255),0.15);border-radius:10px;
  background:rgba(var(--tw-card-bg,18,30,58),0.75);cursor:pointer;transition:all 0.2s;
  position:relative;text-align:center;}
.tw-lang-option:hover{border-color:var(--tw-accent);background:rgba(var(--tw-card-bg,18,30,58),0.9);
  box-shadow:0 0 20px rgba(var(--tw-accent-rgb,0,212,255),0.15);}
.tw-lang-option.selected{border-color:var(--tw-accent);background:rgba(var(--tw-accent-rgb,0,212,255),0.08);
  box-shadow:0 0 20px rgba(var(--tw-accent-rgb,0,212,255),0.25);}
.tw-lang-option-name{font-size:16px;font-weight:700;color:var(--tw-text,#e8f4ff);letter-spacing:0.5px;}
.tw-lang-check{position:absolute;top:16px;right:16px;width:20px;height:20px;
  border:2px solid rgba(var(--tw-accent-rgb,0,212,255),0.3);border-radius:50%;display:flex;
  align-items:center;justify-content:center;font-size:12px;color:var(--tw-accent);opacity:0;transition:all 0.2s;}
.tw-lang-option.selected .tw-lang-check{opacity:1;background:rgba(var(--tw-accent-rgb,0,212,255),0.15);}
.tw-agency-modal-css{width:min(460px,94vw);max-height:min(88vh,660px);overflow-y:auto;display:flex;flex-direction:column;}
.tw-agency-tabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;}
.tw-agency-tab{flex:1;min-width:76px;padding:7px 8px;font-size:10px;font-family:inherit;cursor:pointer;
  border-radius:8px;border:1px solid rgba(var(--tw-accent-rgb,0,212,255),0.22);background:rgba(var(--tw-card-bg,18,30,58),0.65);color:rgba(255,255,255,0.82);}
.tw-agency-tab.active{border-color:var(--tw-accent,#00d4ff);color:var(--tw-accent,#00d4ff);}
.tw-agency-tree{max-height:240px;overflow-y:auto;margin-bottom:8px;padding-right:4px;}
.tw-agency-item{display:block;width:100%;text-align:left;margin-bottom:7px;padding:9px 11px;font-size:11px;font-family:inherit;cursor:pointer;
  border-radius:10px;border:1px solid rgba(var(--tw-accent-rgb,0,212,255),0.18);background:rgba(var(--tw-card-bg,18,30,58),0.75);color:var(--tw-text,#e8f4ff);}
.tw-agency-item:hover{border-color:var(--tw-accent);}
.tw-agency-desc{display:block;font-size:9px;color:var(--tw-muted,#6a8aaa);margin-top:5px;line-height:1.45;}
.tw-agency-cat-name{font-size:10px;font-weight:700;margin:12px 0 6px;color:var(--tw-accent);}
.tw-agency-chips{margin-bottom:10px;line-height:1.6;}
.tw-agency-chip{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:14px;font-size:10px;margin:3px;border:1px solid rgba(var(--tw-accent-rgb,0,212,255),0.35);
  background:rgba(0,0,0,0.25);color:rgba(255,255,255,0.96);}
.tw-agency-chip button{background:none;border:none;color:rgba(255,255,255,0.72);cursor:pointer;padding:0;font-size:11px;line-height:1;}
.tw-agency-chip button:hover{color:rgba(255,255,255,1);}
.tw-agency-chips .tw-agency-empty{color:rgba(255,255,255,0.55);}
.tw-agency-voice-h{font-size:10px;font-weight:600;color:rgba(255,255,255,0.72);margin:12px 0 8px;letter-spacing:0.06em;text-transform:uppercase;}
.tw-agency-voice-h:first-child{margin-top:0;}
.tw-agency-row{display:flex;gap:6px;align-items:stretch;margin-bottom:6px;}
.tw-agency-item-grow{flex:1;}
.tw-agency-del{flex:0 0 34px;padding:6px!important;min-height:auto;}
.tw-agency-form{margin-top:10px;padding-top:12px;border-top:1px solid rgba(var(--tw-accent-rgb,0,212,255),0.14);}
.tw-agency-empty{font-size:10px;color:rgba(255,255,255,0.52);}
.tw-agency-preview-btn{flex:0 0 36px;min-height:38px;padding:4px!important;font-size:14px;line-height:1;
  border-radius:10px;border:1px solid rgba(var(--tw-accent-rgb,0,212,255),0.35);background:rgba(255,255,255,0.06);
  color:rgba(255,255,255,0.88);cursor:pointer;font-family:inherit;}
.tw-agency-preview-btn:hover{background:rgba(var(--tw-accent-rgb,0,212,255),0.15);}
.agency-agent-row{align-items:stretch;}
.tw-agency-detail-body{width:100%;max-height:min(68vh,540px);overflow:auto;margin:0;padding:12px;
  font-size:11px;line-height:1.55;white-space:pre-wrap;word-break:break-word;color:var(--tw-text,#eaf4ff);
  background:rgba(0,0,0,0.35);border-radius:10px;border:1px solid rgba(var(--tw-accent-rgb,0,212,255),0.14);
  box-sizing:border-box;font-family:ui-monospace,Menlo,Consolas,monospace;}
.tw-agency-detail-css{width:min(720px,96vw);max-height:min(88vh,720px);}
  `;}

  // ── BUILD HTML ───────────────────────────────────────────────
  function buildHTML(){return `
<style>${css()}</style>
<div id="sb">
  <div id="tw-resize"></div>
  <div id="tw-tab">▶</div>
  <div id="tw-toast">${t.copied}</div>
  <div id="tw-hdr">
    <div class="tw-logo-row">
      <div class="tw-logo">
        <div class="tw-logo-icon">⚡</div>
        <div class="tw-logo-text">Talk<span>Web</span><span class="tw-ver">${t.versionLabel}</span></div>
      </div>
      <div class="tw-hdr-acts">
        <button class="tw-ib tw-lang-cycle" id="tw-lang">${langLabel()}</button>
        <button class="tw-ib" id="tw-close">✕</button>
      </div>
    </div>
    <div id="tw-agency-stack" style="display:none;font-size:10px;line-height:1.38;padding:7px 10px;margin:0 0 8px;background:rgba(var(--tw-accent-rgb,0,212,255),0.09);border-radius:8px;border:1px solid rgba(var(--tw-accent-rgb,0,212,255),0.22);word-break:break-word;color:var(--tw-body,#eaf4ff)"></div>
    <div class="tw-op-row">
      <span class="tw-op-label">${t.opacity}</span>
      <input type="range" id="tw-op" min="0.3" max="1" step="0.05" value="${state.opacity}">
      <span class="tw-op-val" id="tw-op-val">${Math.round(state.opacity*100)}%</span>
    </div>
    <div class="tw-fs-row">
      <span class="tw-op-label">${t.fontSizeLabel}</span>
      <div class="tw-fs-lvls" role="group" aria-label="${t.fontSizeLabel}">
        ${[1, 2, 3, 4].map((n) => {
          const active = state.fontSizeLevel === n;
          const lab = t['fontSize' + n];
          return `<button type="button" class="tw-fs-lvl${active ? ' active' : ''}" data-level="${n}" title="${lab}">${lab}</button>`;
        }).join('')}
      </div>
    </div>
    <div class="tw-theme-row" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <button type="button" id="tw-hdr-persona-fallback" class="tw-hdr-persona-fallback" aria-label="AI profile"></button>
      <img id="tw-hdr-avatar" class="tw-hdr-avatar" alt="" />
      ${Object.entries(THEMES).map(([k,th])=>`<span class="tw-th-dot${state.theme===k?' active':''}" data-theme="${k}" style="background:${th['--tw-accent']};box-shadow:${state.theme===k?'0 0 6px '+th['--tw-accent']:'none'}" title="${th.name}"></span>`).join('')}
    </div>
    <div style="display:flex;gap:6px;align-items:center">
      <div class="tw-search-wrap" style="flex:1">
        <span class="tw-si">⌕</span>
        <input type="text" id="tw-search" placeholder="${t.search}" autocomplete="off">
        <span class="tw-sc" id="tw-sc">✕</span>
      </div>
      <button class="tw-ib" id="tw-agency-hub-btn" type="button" title="${t.agencyHubTip}" style="flex-shrink:0;font-size:14px;width:30px;height:30px">🎭</button>
      <button class="tw-ib" id="tw-ai-palette" title="${hotkeyPaletteTitle()}" style="flex-shrink:0;font-size:15px;width:30px;height:30px">⚡</button>
    </div>
  </div>
  <div id="tw-body"></div>
  <div id="tw-ftr">
    <button class="tw-ftr-btn" id="tw-add-s">${t.addSnippet}</button>
    <button class="tw-ftr-btn" id="tw-add-g">${t.addGroup}</button>
  </div>
  <div id="tw-ftr2" style="padding:0 10px 8px">
    <button class="tw-ftr-btn" id="tw-template-open" style="font-size:10px;padding:6px;flex:1.5">${t.templateBtn}</button>
    <button class="tw-ftr-btn" id="tw-ai-settings" style="font-size:10px;padding:6px;flex:1.5">${t.settings}</button>
    <button class="tw-ftr-btn" id="tw-scene-open" style="font-size:10px;padding:6px;flex:1.5">${t.sceneBtn}</button>
    <button class="tw-ftr-btn" id="tw-import" style="font-size:10px;padding:6px;flex:1.5">${t.importPrompts}</button>
    <button class="tw-ftr-btn" id="tw-backup-open" style="font-size:10px;padding:6px;flex:1.5">${t.backupBtn}</button>
    <button class="tw-ftr-btn" id="tw-kw-open" style="font-size:10px;padding:6px;flex:1">${t.kwManage}</button>
  </div>
  <div id="tw-resize-v" title="${t.sidebarResizeVTitle || ''}"></div>
</div>

<!-- Snippet Modal -->
<div class="tw-ov" id="tw-sm">
  <div class="tw-modal tw-snippet-modal">
    <div class="tw-snippet-scroll">
    <div class="tw-mt" id="tw-sm-title">${t.newSnippet}</div>
    <div class="tw-snippet-persona-hint" id="tw-sm-persona-hint">${t.snippetPersonaHint}</div>
    <div class="tw-fg"><label class="tw-fl">${t.lTitle}</label><input type="text" class="tw-fi" id="tw-s-title" placeholder="${t.phTitle}"></div>
    <div class="tw-fg"><label class="tw-fl">${t.lGroup}</label><select class="tw-fs" id="tw-s-group"></select></div>
    <div class="tw-fg"><label class="tw-fl">${t.lContent}</label><textarea class="tw-ft" id="tw-s-content" placeholder="${t.phContent}"></textarea>
      <div class="tw-vh">${t.varHint}</div>
      <div class="tw-fg" style="margin-top:8px">
        <label class="tw-fl">${t.importOneHint}</label>
        <textarea class="tw-ft" id="tw-s-json" style="min-height:48px" placeholder='{"title":"","content":""}'></textarea>
        <button type="button" class="tw-bs" id="tw-sm-json-apply" style="margin-top:6px">${t.snippetJsonApply}</button>
      </div>
      <div id="tw-s-prev-wrap" style="display:none;margin-top:8px">
        <div class="tw-fl" style="margin-bottom:4px">${t.livePreview}</div>
        <div id="tw-s-prev" class="tw-pv" style="min-height:32px;font-size:12px;line-height:1.6"></div>
      </div>
    </div>
    <div class="tw-ai-opt-hint" id="tw-sm-ai-hint">${t.aiOptimizeFootnote}</div>
    </div>
    <div class="tw-sm-actions">
      <button type="button" class="tw-bp tw-sm-btn" id="tw-sm-ai">${t.aiOptimize}</button>
      <button type="button" class="tw-bp tw-sm-btn" id="tw-sm-ai-both" title="${t.aiOptimizeBoth}">${t.aiOptimizeBoth}</button>
      <button type="button" class="tw-bs tw-sm-btn" id="tw-sm-cancel">${t.cancel}</button>
      <button type="button" class="tw-bp tw-sm-btn" id="tw-sm-save">${t.save}</button>
      <button type="button" class="tw-bs tw-sm-btn" id="tw-sm-restore" style="display:none">${t.aiRestore}</button>
    </div>
  </div>
</div>

<!-- Group Modal -->
<div class="tw-ov" id="tw-gm">
  <div class="tw-modal">
    <div class="tw-mt" id="tw-gm-title">${t.newGroup}</div>
    <div class="tw-fg"><label class="tw-fl">${t.lGroupName}</label><input type="text" class="tw-fi" id="tw-g-name" placeholder="${t.newGroup}..."></div>
    <div class="tw-ma">
      <button class="tw-bs" id="tw-gm-cancel">${t.cancel}</button>
      <button class="tw-bp" id="tw-gm-save">${t.save}</button>
    </div>
  </div>
</div>

<!-- Import Modal -->
<div class="tw-ov" id="tw-im">
  <div class="tw-modal">
    <div class="tw-mt">${t.importTitle}</div>
    <div class="tw-fg">
      <label class="tw-fl">${t.importUrl}</label>
      <input type="text" class="tw-fi" id="tw-i-url" placeholder="https://raw.githubusercontent.com/...">
    </div>
    <div class="tw-fg">
      <label class="tw-fl">选择文件</label>
      <div style="display:flex;gap:8px;align-items:center">
        <input type="file" id="tw-i-file" accept="application/json,.json,text/csv,.csv" style="display:none">
        <button class="tw-bp" id="tw-i-file-btn" type="button" style="flex:1;padding:10px 12px;white-space:nowrap">${t.importPickFile}</button>
        <span id="tw-i-file-name" style="font-size:10px;color:var(--tw-dim,#3a5070);white-space:nowrap;max-width:150px;overflow:hidden;text-overflow:ellipsis"></span>
      </div>
    </div>
    <div class="tw-fg">
      <label class="tw-fl">${t.importPaste}</label>
      <textarea class="tw-ft" id="tw-i-paste" placeholder='[{"title":"...","content":"..."}]' style="min-height:90px"></textarea>
    </div>
    <div class="tw-vh" style="margin-bottom:0">${t.importHint}</div>
    <div class="tw-vh" style="margin-top:6px;font-size:10px;opacity:.9">${t.importPromptsChatHint}</div>
    <div class="tw-ma">
      <button class="tw-bs" id="tw-im-cancel">${t.cancel}</button>
      <button class="tw-bp" id="tw-im-fetch">⬇ Fetch URL</button>
      <button class="tw-bp" id="tw-im-prompts-chat" type="button">${t.importPromptsChat}</button>
      <button class="tw-bp" id="tw-im-import">${t.importBtn}</button>
    </div>
  </div>
</div>

<!-- Backup / export-import Modal -->
<div class="tw-ov" id="tw-bak">
  <div class="tw-modal tw-bak-modal">
    <div class="tw-mt">${t.backupTitle}</div>
    <label class="tw-fl" style="display:flex;align-items:center;gap:8px;cursor:pointer">
      <input type="checkbox" id="tw-bak-secrets">
      <span>${t.includeSecrets}</span>
    </label>
    <div class="tw-ma" style="margin-top:10px;flex-wrap:wrap">
      <button class="tw-bp" id="tw-bak-export">${t.downloadFile}</button>
      <button class="tw-bs" id="tw-bak-export-folder" type="button" style="flex:1;min-width:120px">${t.exportFolderBtn}</button>
    </div>
    <div class="tw-vh" style="margin-top:6px;white-space:pre-line">${t.folderExportHint}</div>
    <input type="file" id="tw-bak-folder" webkitdirectory multiple style="display:none" />
    <div class="tw-fg" style="border-top:1px solid var(--tw-border);padding-top:12px;margin-top:10px">
      <div class="tw-mt" style="font-size:12px;margin-bottom:10px">${t.shareSectionTitle}</div>
      <div class="tw-vh" style="margin-bottom:10px;white-space:pre-line">${t.shareSmbFtpNote}</div>
      <label class="tw-fl">${t.mailRecipientsPh}</label>
      <input type="text" class="tw-fi" id="tw-bak-mail-to" autocomplete="off" />
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
        <button class="tw-bp" type="button" id="tw-bak-pack-mail" style="flex:1;min-width:140px">${t.packAndOpenMail}</button>
        <button class="tw-bs" type="button" id="tw-bak-copy-smb">${t.copySmbGuide}</button>
      </div>
      <div class="tw-vh" style="margin-top:8px;white-space:pre-line">${t.packMailHint}</div>
      <label class="tw-fl" style="margin-top:10px">${t.smbPathLabel}</label>
      <textarea class="tw-ft" id="tw-bak-smb-note" style="min-height:44px"></textarea>
      <label class="tw-fl" style="margin-top:10px">${t.webdavBlockTitle}</label>
      <input type="text" class="tw-fi" id="tw-bak-wd-url" placeholder="${t.webdavUrlPh}" />
      <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap">
        <input type="text" class="tw-fi" id="tw-bak-wd-user" placeholder="${t.webdavUserPh}" style="flex:1;min-width:120px" />
        <input type="password" class="tw-fi" id="tw-bak-wd-pass" placeholder="${t.webdavPassPh}" style="flex:1;min-width:120px" />
      </div>
      <button class="tw-bs" type="button" id="tw-bak-wd-upload" style="margin-top:8px;width:100%">${t.webdavUploadBtn}</button>
      <label class="tw-fl" style="margin-top:12px">${t.cloudPostTitle}</label>
      <div class="tw-vh" style="margin-bottom:8px;white-space:pre-line">${t.cloudPostHint}</div>
      <input type="text" class="tw-fi" id="tw-bak-cp-url" placeholder="${t.cloudPostUrlPh}" />
      <input type="password" class="tw-fi" id="tw-bak-cp-token" placeholder="${t.cloudPostTokenPh}" style="margin-top:6px" />
      <button class="tw-bs" type="button" id="tw-bak-cp-post" style="margin-top:8px;width:100%">${t.cloudPostBtn}</button>
      <button class="tw-bp" type="button" id="tw-bak-share-save" style="margin-top:12px;width:100%">${t.shareSavePrefs}</button>
    </div>
    <div class="tw-vh" style="margin-top:10px">${t.replaceWarn}</div>
    <div class="tw-fg">
      <label class="tw-fl">${t.importBackup}</label>
      <div style="display:flex;gap:14px;font-size:11px;margin-bottom:6px">
        <label style="cursor:pointer"><input type="radio" name="tw-bak-mode" value="merge" checked> ${t.mergeImport}</label>
        <label style="cursor:pointer"><input type="radio" name="tw-bak-mode" value="replace"> ${t.replaceImport}</label>
      </div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
        <input type="file" id="tw-bak-file" accept="application/json,.json" style="display:none">
        <button class="tw-bs" id="tw-bak-file-btn" type="button" style="flex:1;padding:10px 12px;white-space:nowrap;min-width:100px">JSON</button>
        <button class="tw-bs" id="tw-bak-folder-btn" type="button" style="flex:1;padding:10px 12px;white-space:nowrap;min-width:100px">${t.importFolderBtn}</button>
        <span id="tw-bak-file-name" style="font-size:10px;color:var(--tw-dim,#3a5070);white-space:nowrap;max-width:170px;overflow:hidden;text-overflow:ellipsis"></span>
      </div>
      <textarea class="tw-ft" id="tw-bak-paste" style="min-height:88px" placeholder='{"format":"talkweb-backup",...}'></textarea>
      <button class="tw-bp" id="tw-bak-import" style="margin-top:8px;width:100%">${t.applyImport}</button>
    </div>
    <div class="tw-fg" style="border-top:1px solid rgba(var(--tw-accent-rgb,0,212,255),0.12);padding-top:10px;margin-top:4px">
      <label class="tw-fl">${t.importOneHint}</label>
      <textarea class="tw-ft" id="tw-bak-one" style="min-height:52px"></textarea>
      <button class="tw-bs" id="tw-bak-one-btn" style="margin-top:6px">${t.applyImport}</button>
    </div>
    <div class="tw-fg">
      <label class="tw-fl">${t.importGroupHint}</label>
      <textarea class="tw-ft" id="tw-bak-grp" style="min-height:52px"></textarea>
      <button class="tw-bs" id="tw-bak-grp-btn" style="margin-top:6px">${t.applyImport}</button>
    </div>
    <div class="tw-ma">
      <button class="tw-bs" id="tw-bak-close">${t.cancel}</button>
    </div>
  </div>
</div>

<!-- Keyword Management Modal -->
<div class="tw-ov" id="tw-kwm">
  <div class="tw-modal">
    <div class="tw-mt">${t.kwTitle}</div>
    <div style="display:flex;gap:6px;margin-bottom:10px">
      <input type="text" class="tw-fi" id="tw-kw-input" placeholder="${t.kwPlh}" style="flex:1">
      <select class="tw-fs" id="tw-kw-type" style="width:90px">
        <option value="lang">${t.kwLang}</option>
        <option value="tone">${t.kwTone}</option>
        <option value="task">${t.kwTask}</option>
      </select>
      <button class="tw-bp" id="tw-kw-add" style="width:60px;padding:0">${t.kwAdd}</button>
    </div>
    <div id="tw-kw-list" style="min-height:60px;max-height:200px;overflow-y:auto"></div>
    <div class="tw-ma">
      <button class="tw-bs" id="tw-kwm-close">${t.cancel}</button>
    </div>
  </div>
</div>

<!-- AI Settings Modal -->
<div class="tw-ov" id="tw-ai-modal">
  <div class="tw-modal tw-settings-modal">
    <div class="tw-mt">${t.settingsModalTitle}</div>
    <div class="tw-settings-scroll">
      <details class="tw-details" id="tw-ai-details-api" open>
        <summary>${t.settingsSectionApi}</summary>
        <div class="tw-details-inner">
          <div class="tw-fg" style="margin-bottom:10px">
            <button type="button" class="tw-bp" id="tw-ai-open-persona" style="width:100%;margin:0">${t.personaOpenSettings}</button>
            <div class="tw-vh" style="margin-top:6px;white-space:pre-line">${t.personaSettingsBlurb}</div>
          </div>
          <div class="tw-fg">
            <label class="tw-fl">${t.aiApiKey}</label>
            <input type="password" class="tw-fi" id="tw-ai-key" placeholder="${t.aiApiKeyPh}" autocomplete="off">
          </div>
          <div class="tw-fg">
            <label class="tw-fl">${t.aiProviderLabel}</label>
            <select class="tw-fs" id="tw-ai-provider"></select>
          </div>
          <div class="tw-fg">
            <label class="tw-fl">${t.aiModelLabel}</label>
            <select class="tw-fs" id="tw-ai-model"></select>
          </div>
          <div class="tw-fg">
            <label class="tw-fl">${t.aiApiUrl}</label>
            <label class="tw-fl" style="margin-bottom:4px;font-size:9px;letter-spacing:0.4px;text-transform:none;color:var(--tw-muted,#6a8aaa)">${t.aiBaseUrlPreset}</label>
            <select class="tw-fs" id="tw-ai-base-preset" style="margin-bottom:6px"></select>
            <div class="tw-vh" id="tw-ai-base-preset-model-hint" style="display:none;margin-bottom:6px;font-size:10px">${t.aiBaseUrlModelHint}</div>
            <input type="text" class="tw-fi" id="tw-ai-url" placeholder="${t.aiApiUrlPh}" autocomplete="off">
            <div class="tw-vh" id="tw-ai-qwen-url-hint" style="display:none;margin-top:6px;white-space:pre-line;font-size:10px;line-height:1.45">${t.aiQwenRegionHint}</div>
          </div>
        </div>
      </details>
      <details class="tw-details" id="tw-ai-details-conn">
        <summary>${t.settingsSectionConn}</summary>
        <div class="tw-details-inner">
          <div class="tw-fg">
            <label class="tw-fl">${t.aiEffectiveCfg}</label>
            <div id="tw-ai-cfg-summary" class="tw-fi" style="white-space:pre-wrap;font-size:10px;line-height:1.45;min-height:52px;padding:8px;cursor:default;background:rgba(0,0,0,0.18);border:1px solid rgba(var(--tw-accent-rgb,0,212,255),0.2);color:var(--tw-text,#e8f4ff)"></div>
            <div class="tw-vh" style="margin-top:4px;white-space:pre-line">${t.aiEffectiveHint}</div>
          </div>
          <div class="tw-fg" style="display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap;margin-top:6px">
            <button type="button" class="tw-bp" id="tw-ai-test" style="flex:0 0 auto">${t.aiTestConn}</button>
            <span id="tw-ai-test-status" style="font-size:10px;flex:1;min-width:120px;word-break:break-all;color:var(--tw-muted,#6a8aaa)"></span>
          </div>
          <div class="tw-fg" style="margin-top:8px">
            <button type="button" class="tw-bs" id="tw-ai-open-persona-2" style="width:100%">${t.settingsPersonaLink}</button>
          </div>
          <div class="tw-vh" style="white-space:pre-line">${t.aiCompatHint}</div>
        </div>
      </details>
      <details class="tw-details" id="tw-ai-details-hk">
        <summary>${t.settingsSectionHotkeys}</summary>
        <div class="tw-details-inner">
          <div class="tw-fg" style="margin-bottom:10px">
            <label class="tw-fl">${t.hkPlatform}</label>
            <select class="tw-fs" id="tw-hk-platform" style="width:100%">
              <option value="mac">${t.hkPlatformMac}</option>
              <option value="win">${t.hkPlatformWin}</option>
            </select>
          </div>
          <div class="tw-fg">
            <label class="tw-fl">${t.hkPalette}</label>
            <div style="display:flex;gap:8px;align-items:center">
              <input class="tw-fi" id="tw-hk-palette" type="text" readonly style="flex:1">
              <button class="tw-bp" id="tw-hk-palette-set" type="button" style="flex:0 0 auto;white-space:nowrap;padding:8px 12px">${t.hkSet}</button>
            </div>
          </div>
          <div class="tw-fg">
            <label class="tw-fl">${t.hkRewrite}</label>
            <div style="display:flex;gap:8px;align-items:center">
              <input class="tw-fi" id="tw-hk-rewrite" type="text" readonly style="flex:1">
              <button class="tw-bp" id="tw-hk-rewrite-set" type="button" style="flex:0 0 auto;white-space:nowrap;padding:8px 12px">${t.hkSet}</button>
            </div>
          </div>
          <div class="tw-fg">
            <label class="tw-fl">${t.hkShorten}</label>
            <div style="display:flex;gap:8px;align-items:center">
              <input class="tw-fi" id="tw-hk-shorten" type="text" readonly style="flex:1">
              <button class="tw-bp" id="tw-hk-shorten-set" type="button" style="flex:0 0 auto;white-space:nowrap;padding:8px 12px">${t.hkSet}</button>
            </div>
          </div>
          <div class="tw-fg">
            <label class="tw-fl">${t.hkTranslateLabel}</label>
            <div style="display:flex;gap:8px;align-items:center">
              <input class="tw-fi" id="tw-hk-translate" type="text" readonly style="flex:1">
              <button class="tw-bp" id="tw-hk-translate-set" type="button" style="flex:0 0 auto;white-space:nowrap;padding:8px 12px">${t.hkSet}</button>
            </div>
          </div>
          <div class="tw-vh" style="margin-top:4px;white-space:pre-line">${t.hkCaptureHint}</div>
        </div>
      </details>
      <details class="tw-details" id="tw-details-snippets">
        <summary>${t.settingsSectionSnippets}</summary>
        <div class="tw-details-inner">
          <label class="tw-fg" style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;margin-bottom:4px">
            <input type="checkbox" id="tw-snippet-sort-score" style="margin-top:3px;flex-shrink:0" />
            <span style="font-size:12px;line-height:1.45">${t.snippetSortByScoreLabel}</span>
          </label>
          <div class="tw-vh" style="margin-top:2px;white-space:pre-line">${t.snippetSortByScoreHint}</div>
          <label class="tw-fg" style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;margin-top:10px;margin-bottom:4px">
            <input type="checkbox" id="tw-snippet-danger-clear-all" style="margin-top:3px;flex-shrink:0" />
            <span style="font-size:12px;line-height:1.45;color:#ff9ca8">${t.snippetDangerClearAllLabel}</span>
          </label>
          <div class="tw-fg" style="margin-top:10px">
            <button type="button" class="tw-bs" id="tw-snippet-reset-counts" style="width:100%">${t.snippetResetCountsBtn}</button>
          </div>
        </div>
      </details>
    </div>
    <div class="tw-ma">
      <button class="tw-bs" id="tw-ai-cancel">${t.cancel}</button>
      <button class="tw-bp" id="tw-ai-save">${t.aiSave}</button>
    </div>
  </div>
</div>

<!-- Agency · SuperStar Modal (V3.5) -->
<div class="tw-ov" id="tw-agency-modal">
  <div class="tw-modal tw-agency-modal-css">
    <div class="tw-mt">${t.agencyModalTitle}</div>
    <div class="tw-fl" style="font-size:10px;color:var(--tw-muted,#6a8aaa);margin-bottom:6px;line-height:1.5">${t.agencyAutoSaveHint}</div>
    <div class="tw-fl" style="font-size:9px;color:var(--tw-muted,#6a8aaa);margin-bottom:8px;line-height:1.45">${t.agencyBuiltinLangNote}</div>
    <div id="tw-agency-chips" class="tw-agency-chips"></div>
    <label class="tw-fg" style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;margin-bottom:10px;font-size:11px">
      <input type="checkbox" id="tw-agency-enhance-enable" style="margin-top:3px;flex-shrink:0" />
      <span>${t.agencyEnhanceLabel}</span>
    </label>
    <label class="tw-fl">${t.agencyTaskLabel}</label>
    <textarea class="tw-ft" id="tw-agency-task" style="min-height:52px;margin-bottom:8px" placeholder="${t.agencyTaskHint}"></textarea>
    <label class="tw-fg" style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;margin-bottom:10px;font-size:11px">
      <input type="checkbox" id="tw-agency-prefetch" style="margin-top:3px;flex-shrink:0" />
      <span>${t.agencyPrefetchLabel}</span>
    </label>
    <div class="tw-agency-tabs">
      <button type="button" class="tw-agency-tab active" id="tw-agency-tab-builtin">${t.agencyTabBuiltin}</button>
      <button type="button" class="tw-agency-tab" id="tw-agency-tab-voice">${t.agencyTabVoice}</button>
      <button type="button" class="tw-agency-tab" id="tw-agency-tab-uagent">${t.agencyTabUAgent}</button>
    </div>
    <input type="text" class="tw-fi" id="tw-agency-search" placeholder="${t.agencySearchPh}" style="margin-bottom:8px" />
    <div id="tw-agency-hidden-strip" class="tw-agency-hidden-strip" style="display:none;margin-bottom:8px"></div>
    <div id="tw-agency-panel-builtin" class="tw-agency-panel">
      <div id="tw-agency-tree" class="tw-agency-tree"></div>
    </div>
    <div id="tw-agency-panel-voice" class="tw-agency-panel" style="display:none">
      <div class="tw-agency-voice-h">${t.agencyVoiceBuiltinSection}</div>
      <div id="tw-agency-stars" class="tw-agency-tree"></div>
      <div class="tw-agency-voice-h">${t.agencyVoiceMineSection}</div>
      <div id="tw-agency-user-stars" class="tw-agency-tree"></div>
      <div class="tw-agency-form">
        <label class="tw-fl">${t.agencyNewStarName}</label>
        <input type="text" class="tw-fi" id="tw-us-name" />
        <label class="tw-fl">${t.agencyNewStarOne}</label>
        <input type="text" class="tw-fi" id="tw-us-one" />
        <label class="tw-fl">${t.agencyNewStarVoice}</label>
        <textarea class="tw-ft" id="tw-us-voice" style="min-height:44px"></textarea>
        <button type="button" class="tw-bp" id="tw-agency-add-us" style="width:100%;margin-top:6px">${t.agencyAddBtn}</button>
      </div>
    </div>
    <div id="tw-agency-panel-uagent" class="tw-agency-panel" style="display:none">
      <div id="tw-agency-user-agents" class="tw-agency-tree"></div>
      <div class="tw-agency-form">
        <label class="tw-fl">${t.agencyNewAgentTitle}</label>
        <input type="text" class="tw-fi" id="tw-ua-title" />
        <label class="tw-fl">${t.agencyNewAgentBody}</label>
        <textarea class="tw-ft" id="tw-ua-body" style="min-height:72px"></textarea>
        <button type="button" class="tw-bp" id="tw-agency-add-ua" style="width:100%;margin-top:6px">${t.agencyAddBtn}</button>
      </div>
    </div>
    <label class="tw-fl" style="margin-top:10px">${t.agencyAiLabel}</label>
    <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:8px">
      <input type="text" class="tw-fi" id="tw-agency-ai-prompt" placeholder="${t.agencyAiPlaceholder}" style="flex:1;min-width:160px;font-size:11px" />
      <button type="button" class="tw-bp" id="tw-agency-ai-gen">${t.agencyAiBtn}</button>
      <button type="button" class="tw-bs" id="tw-agency-clear-sel">${t.agencyClearSelBtn}</button>
    </div>
    <div class="tw-vh" style="margin-top:10px;font-size:10px;line-height:1.45;white-space:pre-wrap">${t.agencyDevHint}</div>
    <div class="tw-ma" style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;align-items:center">
      <button type="button" class="tw-bs" id="tw-agency-close">${t.close}</button>
      <button type="button" class="tw-bp" id="tw-agency-done">${t.agencyDoneBtn}</button>
    </div>
  </div>
</div>

<!-- Agency 正文预览（Markdown / Agent 全文） -->
<div class="tw-ov" id="tw-agency-detail-ov">
  <div class="tw-modal tw-agency-detail-css">
    <div class="tw-mt" id="tw-agency-detail-title">${t.agencyDetailModalTitle}</div>
    <div id="tw-agency-detail-body" class="tw-agency-detail-body"></div>
    <div class="tw-ma">
      <button type="button" class="tw-bp" id="tw-agency-detail-close">${t.agencyDetailClose}</button>
    </div>
  </div>
</div>

<!-- Agency 编辑用户 Agent / 风格 -->
<div class="tw-ov" id="tw-agency-edit-ov">
  <div class="tw-modal tw-agency-modal-css" style="max-width:min(520px,96vw)">
    <div class="tw-mt" id="tw-agency-edit-mt">${t.agencyEditUserAgentTitle}</div>
    <div id="tw-agency-edit-inner" style="margin-top:10px"></div>
    <div class="tw-ma" style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
      <button type="button" class="tw-bs" id="tw-agency-edit-cancel">${t.agencyEditCancel}</button>
      <button type="button" class="tw-bp" id="tw-agency-edit-save">${t.agencyEditSave}</button>
    </div>
  </div>
</div>

<!-- AI Template Modal -->
<div class="tw-ov" id="tw-template-modal">
  <div class="tw-modal" style="max-width:520px">
    <div class="tw-mt">${t.templateTitle}</div>
    <div class="tw-fl" style="font-size:10px;color:var(--tw-muted,#6a8aaa);margin-bottom:14px">${t.templateSubtitle}</div>
    
    <div class="tw-fg">
      <label class="tw-fl">${t.templateRole}</label>
      <input type="text" class="tw-fi" id="tw-tmpl-role" placeholder="${t.templateRolePh}">
    </div>
    
    <div class="tw-fg">
      <label class="tw-fl">${t.templateWork}</label>
      <input type="text" class="tw-fi" id="tw-tmpl-work" placeholder="${t.templateWorkPh}">
    </div>
    
    <div class="tw-fg">
      <label class="tw-fl">${t.templateSkills}</label>
      <input type="text" class="tw-fi" id="tw-tmpl-skills" placeholder="${t.templateSkillsPh}">
    </div>
    
    <div class="tw-fg">
      <label class="tw-fl">${t.templateContext}</label>
      <input type="text" class="tw-fi" id="tw-tmpl-context" placeholder="${t.templateContextPh}">
    </div>
    
    <div id="tw-tmpl-preview-wrap" style="display:none;margin-top:12px">
      <div class="tw-fl" style="margin-bottom:6px">${t.livePreview}</div>
      <div id="tw-tmpl-preview" class="tw-pv" style="min-height:80px;font-size:12px;line-height:1.6;white-space:pre-wrap"></div>
    </div>
    
    <div class="tw-ma" style="margin-top:18px">
      <button class="tw-bs" id="tw-tmpl-cancel">${t.cancel}</button>
      <button class="tw-bp" id="tw-tmpl-generate">${t.templateGenerate}</button>
      <button class="tw-bp" id="tw-tmpl-use" style="display:none">${t.templateUse}</button>
    </div>
    
    <div style="margin-top:16px;padding-top:12px;border-top:1px solid rgba(var(--tw-accent-rgb,0,212,255),0.15)">
      <div class="tw-fl" style="font-size:10px;margin-bottom:8px">${t.templateExamples}</div>
      <div id="tw-tmpl-examples" style="display:flex;flex-wrap:wrap;gap:6px"></div>
    </div>
  </div>
</div>

<!-- Variable Modal -->
<div class="tw-ov" id="tw-vm">
  <div class="tw-modal wide">
    <div class="tw-mt">${t.varTitle}</div>
    <div id="tw-vf-fields"></div>
    <div class="tw-pvl">${t.varPreview}</div>
    <div class="tw-pv" id="tw-vf-prev"></div>
    <div class="tw-ma">
      <button class="tw-bs" id="tw-vm-cancel">${t.cancel}</button>
      <button class="tw-bp" id="tw-vm-copy">${t.varCopy}</button>
    </div>
  </div>
</div>

<!-- Language Selection Modal -->
<div class="tw-ov" id="tw-lang-sel">
  <div class="tw-modal tw-lang-modal">
    <div class="tw-mt">${t.langSelTitle}</div>
    <div class="tw-lang-subtitle">${t.langSelSubtitle}</div>
    <div class="tw-lang-options">
      <div class="tw-lang-option" data-lang="zh">
        <div class="tw-lang-check">✓</div>
        <div class="tw-lang-option-name">${t.langSelChinese}</div>
      </div>
      <div class="tw-lang-option" data-lang="en">
        <div class="tw-lang-check">✓</div>
        <div class="tw-lang-option-name">${t.langSelEnglish}</div>
      </div>
      <div class="tw-lang-option" data-lang="ko">
        <div class="tw-lang-check">✓</div>
        <div class="tw-lang-option-name">${t.langSelKorean}</div>
      </div>
    </div>
    <div class="tw-ma" style="justify-content:center">
      <button class="tw-bp" id="tw-lang-confirm" style="min-width:180px">${t.langSelConfirm}</button>
    </div>
  </div>
</div>

<!-- Scene Selection Modal -->
<div class="tw-ov" id="tw-scene">
  <div class="tw-modal tw-scene-modal">
    <div class="tw-mt">${t.sceneTitle}</div>
    <div class="tw-scene-subtitle">${t.sceneSubtitle}</div>
    <div class="tw-scene-grid">
      <div class="tw-scene-card" data-scene="workplace">
        <div class="tw-scene-check">✓</div>
        <div class="tw-scene-icon">💼</div>
        <div class="tw-scene-name">${t.sceneWorkplace}</div>
        <div class="tw-scene-desc">${t.sceneWorkplaceDesc}</div>
      </div>
      <div class="tw-scene-card" data-scene="developer">
        <div class="tw-scene-check">✓</div>
        <div class="tw-scene-icon">💻</div>
        <div class="tw-scene-name">${t.sceneDeveloper}</div>
        <div class="tw-scene-desc">${t.sceneDeveloperDesc}</div>
      </div>
      <div class="tw-scene-card" data-scene="student">
        <div class="tw-scene-check">✓</div>
        <div class="tw-scene-icon">🎓</div>
        <div class="tw-scene-name">${t.sceneStudent}</div>
        <div class="tw-scene-desc">${t.sceneStudentDesc}</div>
      </div>
      <div class="tw-scene-card" data-scene="creator">
        <div class="tw-scene-check">✓</div>
        <div class="tw-scene-icon">✍️</div>
        <div class="tw-scene-name">${t.sceneCreator}</div>
        <div class="tw-scene-desc">${t.sceneCreatorDesc}</div>
      </div>
      <div class="tw-scene-card" data-scene="architect">
        <div class="tw-scene-check">✓</div>
        <div class="tw-scene-icon">🏗️</div>
        <div class="tw-scene-name">${t.sceneArchitect}</div>
        <div class="tw-scene-desc">${t.sceneArchitectDesc}</div>
      </div>
      <div class="tw-scene-card" data-scene="researcher">
        <div class="tw-scene-check">✓</div>
        <div class="tw-scene-icon">🔬</div>
        <div class="tw-scene-name">${t.sceneResearcher}</div>
        <div class="tw-scene-desc">${t.sceneResearcherDesc}</div>
      </div>
      <div class="tw-scene-card" data-scene="productManager">
        <div class="tw-scene-check">✓</div>
        <div class="tw-scene-icon">🎯</div>
        <div class="tw-scene-name">${t.sceneProductManager}</div>
        <div class="tw-scene-desc">${t.sceneProductManagerDesc}</div>
      </div>
      <div class="tw-scene-card" data-scene="dataAnalyst">
        <div class="tw-scene-check">✓</div>
        <div class="tw-scene-icon">📊</div>
        <div class="tw-scene-name">${t.sceneDataAnalyst}</div>
        <div class="tw-scene-desc">${t.sceneDataAnalystDesc}</div>
      </div>
      <div class="tw-scene-card" data-scene="uiuxDesigner">
        <div class="tw-scene-check">✓</div>
        <div class="tw-scene-icon">🎨</div>
        <div class="tw-scene-name">${t.sceneUIUXDesigner}</div>
        <div class="tw-scene-desc">${t.sceneUIUXDesignerDesc}</div>
      </div>
      <div class="tw-scene-card" data-scene="businessStrategist">
        <div class="tw-scene-check">✓</div>
        <div class="tw-scene-icon">💼</div>
        <div class="tw-scene-name">${t.sceneBusinessStrategist}</div>
        <div class="tw-scene-desc">${t.sceneBusinessStrategistDesc}</div>
      </div>
      <div class="tw-scene-card" data-scene="intlTranslate">
        <div class="tw-scene-check">✓</div>
        <div class="tw-scene-icon">🌐</div>
        <div class="tw-scene-name">${t.sceneIntlTranslate}</div>
        <div class="tw-scene-desc">${t.sceneIntlTranslateDesc}</div>
      </div>
      <div class="tw-scene-card" data-scene="intlSop">
        <div class="tw-scene-check">✓</div>
        <div class="tw-scene-icon">📑</div>
        <div class="tw-scene-name">${t.sceneIntlSop}</div>
        <div class="tw-scene-desc">${t.sceneIntlSopDesc}</div>
      </div>
      <div class="tw-scene-card" data-scene="graphicTemplates">
        <div class="tw-scene-check">✓</div>
        <div class="tw-scene-icon">📐</div>
        <div class="tw-scene-name">${t.sceneGraphicTemplates}</div>
        <div class="tw-scene-desc">${t.sceneGraphicTemplatesDesc}</div>
      </div>
      <div class="tw-scene-card" data-scene="designWorkflow">
        <div class="tw-scene-check">✓</div>
        <div class="tw-scene-icon">🎨</div>
        <div class="tw-scene-name">${t.sceneDesignWorkflow}</div>
        <div class="tw-scene-desc">${t.sceneDesignWorkflowDesc}</div>
      </div>
    </div>
    <div class="tw-ma">
      <button class="tw-bs" id="tw-scene-skip">${t.sceneSkip}</button>
      <button class="tw-bp" id="tw-scene-load">${t.sceneLoad}</button>
    </div>
  </div>
</div>

<div class="tw-ov" id="tw-persona-modal">
  <div class="tw-modal tw-persona-modal">
    <div class="tw-mt">${t.personaTitle}</div>
    <div class="tw-scene-subtitle">${t.personaIntro}</div>
    <div class="tw-persona-avatar-wrap">
      <img id="tw-persona-avatar" alt="" />
      <button type="button" class="tw-bs" id="tw-persona-gen-avatar">${t.personaGenAvatar}</button>
    </div>
    <div class="tw-fg"><label class="tw-fl">${t.personaNick}</label><input type="text" class="tw-fi" id="tw-persona-nick" autocomplete="off"></div>
    <div class="tw-fg"><label class="tw-fl">${t.personaRolePreset}</label><select class="tw-fi" id="tw-persona-role-preset"></select></div>
    <div class="tw-fg"><label class="tw-fl">${t.personaJob}</label><input type="text" class="tw-fi" id="tw-persona-job" autocomplete="off" placeholder=""></div>
    <div class="tw-persona-role-hint-wrap" id="tw-persona-role-hint-wrap"><div class="tw-persona-role-hint-title">${t.personaRoleHintTitle}</div><pre class="tw-persona-role-hint" id="tw-persona-role-hint"></pre></div>
    <div class="tw-fg"><label class="tw-fl">${t.personaPersonality}</label><input type="text" class="tw-fi" id="tw-persona-personality" autocomplete="off"></div>
    <div class="tw-fg"><label class="tw-fl">${t.personaNationality}</label><input type="text" class="tw-fi" id="tw-persona-nationality" autocomplete="off"></div>
    <div class="tw-fg"><label class="tw-fl">${t.personaSpeakLang}</label><input type="text" class="tw-fi" id="tw-persona-speaklang" autocomplete="off"></div>
    <div class="tw-fg"><label class="tw-fl">${t.personaExtra}</label><textarea class="tw-ft" id="tw-persona-extra" style="min-height:52px"></textarea></div>
    <div class="tw-fg"><label class="tw-fl">${t.personaSummaryLabel}</label><textarea class="tw-ft" id="tw-persona-summary" style="min-height:72px" placeholder="${t.personaSummaryPlaceholder}"></textarea></div>
    <div class="tw-ma" style="flex-wrap:wrap">
      <button type="button" class="tw-bs" id="tw-persona-later">${t.personaLater}</button>
      <button type="button" class="tw-bs" id="tw-persona-ai-sum">${t.personaAiSum}</button>
      <button type="button" class="tw-bp" id="tw-persona-save">${t.personaSave}</button>
    </div>
  </div>
</div>
`;}

  function langLabel(){
    return state.lang==='zh'?'EN|한':state.lang==='en'?'한|中':'中|EN';
  }

  // ── HOTKEYS HELPERS ──────────────────────────────────────────
  function isMacLike(){
    return /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  }

  function hotkeyKeyLabel(cfg){
    if (!cfg) return '';
    if (cfg.code === 'Slash') return '/';
    if (cfg.code === 'Space') return 'Space';
    if (cfg.code === 'Minus') return '-';
    if (cfg.code === 'Equal') return '=';
    if (cfg.code === 'Comma') return ',';
    if (cfg.code === 'Period') return '.';
    if (cfg.code?.startsWith('Key')) return cfg.code.slice(3);
    if (cfg.code?.startsWith('Digit')) return cfg.code.slice(5);
    return cfg.key || cfg.code || '';
  }

  function formatHotkey(cfg){
    if (!cfg) return '';
    const mods = cfg.modifiers || {};
    const parts = [];
    if (mods.meta) parts.push('Cmd');
    if (mods.ctrl) parts.push('Ctrl');
    if (mods.alt) parts.push('Alt');
    if (mods.shift) parts.push('Shift');
    const k = hotkeyKeyLabel(cfg);
    if (k) parts.push(k);
    return parts.join('+');
  }

  function hotkeyPaletteTitle(){
    const mac = formatHotkey(state.hotkeys?.mac?.palette);
    const win = formatHotkey(state.hotkeys?.win?.palette);
    const hint = (mac && win)
      ? `打开快速模式（Mac: ${mac}；Windows: ${win}）`
      : '打开快速模式';
    return hint;
  }

  // ── HELPERS ──────────────────────────────────────────────────
  function $(s){return root.querySelector(s);}

  function readSidebarIntentOpen() {
    try { return sessionStorage.getItem(TW_SIDEBAR_INTENT_KEY) === '1'; }
    catch (_) { return false; }
  }
  function writeSidebarIntentOpen(open) {
    try { sessionStorage.setItem(TW_SIDEBAR_INTENT_KEY, open ? '1' : '0'); }
    catch (_) {}
  }
  function applySidebarVisibilityFromIntent() {
    const sb = root?.querySelector('#sb');
    if (!sb) return;
    if (TW_IS_SIDE_PANEL) {
      sb.classList.remove('hidden');
      updatePageContentGutter();
      return;
    }
    if (readSidebarIntentOpen()) sb.classList.remove('hidden');
    else sb.classList.add('hidden');
    updatePageContentGutter();
  }
  /** persistIntent=false：仅临时隐藏（如打开 ⚡ 面板），不覆盖跨导航记忆 */
  function setMainSidebarOpen(open, persistIntent = true) {
    const sb = root?.querySelector('#sb');
    if (!sb) return;
    if (TW_IS_SIDE_PANEL) {
      if (!open) return;
      sb.classList.remove('hidden');
      if (persistIntent) writeSidebarIntentOpen(true);
      updatePageContentGutter();
      return;
    }
    if (open) sb.classList.remove('hidden');
    else sb.classList.add('hidden');
    if (persistIntent) writeSidebarIntentOpen(open);
    updatePageContentGutter();
  }
  function ensureAiRewriteReady(){
    if (aiRewriteReady) return true;
    if (!root) return false;
    if (!window.TwAiRewrite) return false;
    try {
      TwAiRewrite.init(root, () => state);
      aiRewriteReady = true;
      exposeAgencyPaletteBridge();
      return true;
    } catch (err) {
      console.warn('TalkwebSour: AI module init failed', err);
      return false;
    }
  }
  function applyOp(op){
    const sb=$('#sb');if(!sb)return;
    const th = THEMES[state.theme] || THEMES.cyber;
    sb.style.background=`rgba(${th['--tw-bg']},${op})`;
  }
  function hilite(text,q){
    if(!q.trim())return esc(text);
    const e=esc(text),qe=q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return e.replace(new RegExp(`(${qe})`,'gi'),'<span class="tw-highlight">$1</span>');
  }
  function toast(){
    const el=$('#tw-toast');if(!el)return;
    el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800);
  }
  function showAgencyNotify(msg) {
    const toastEl = $('#tw-toast');
    if (!toastEl || !msg) return;
    const old = toastEl.textContent;
    toastEl.textContent = msg;
    toast();
    setTimeout(() => { toastEl.textContent = old; }, 2200);
  }

  /** 同一分组内展示顺序：按使用次数或保持 storage 中的顺序 */
  function sortSnippetList(arr) {
    if (!state.snippetSortByScore) return arr.slice();
    return arr.slice().sort((a, b) => {
      const ua = Number(a.useCount) || 0;
      const ub = Number(b.useCount) || 0;
      if (ub !== ua) return ub - ua;
      return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
    });
  }

  function bumpSnippetUseCount(id) {
    if (!id) return;
    const s = state.snippets.find((x) => x.id === id);
    if (!s) return;
    s.useCount = (Number(s.useCount) || 0) + 1;
    save();
    render();
    try {
      if (window.TwAiRewrite && typeof TwAiRewrite.refreshPaletteIfOpen === 'function') {
        TwAiRewrite.refreshPaletteIfOpen();
      }
    } catch (_) {}
  }
  // 供快捷模式（网页桥接）与侧栏共用：脚本复制/插入时累计使用次数
  window.TwBumpSnippetUseCount = bumpSnippetUseCount;

  // ── RENDER ───────────────────────────────────────────────────
  function render(){
    const body=$('#tw-body');if(!body)return;
    const q=state.searchQuery.trim().toLowerCase();
    let snippets=state.snippets;
    if(q) snippets=snippets.filter(s=>s.title.toLowerCase().includes(q)||s.content.toLowerCase().includes(q));

    let html='';

    // Groups
    state.groups.forEach(g=>{
      const inGroup=sortSnippetList(snippets.filter(s=>s.groupId===g.id));
      if (q && inGroup.length === 0) return;
      const isOpen=!g.collapsed;
      html+=`<div class="tw-grp" data-gid="${g.id}">
        <div class="tw-grp-hdr" data-gid="${g.id}">
          <span class="tw-grp-arrow${isOpen?' open':''}">▶</span>
          <span class="tw-grp-name">${esc(g.name)}</span>
          <span class="tw-grp-count">${inGroup.length}</span>
          <div class="tw-grp-acts">
            <button class="tw-grp-act tw-grp-xp" data-gid="${g.id}" title="${t.exportGroup}">⤓</button>
            <button class="tw-grp-act tw-grp-edit" data-gid="${g.id}" title="rename">✎</button>
            <button class="tw-grp-act del tw-grp-del" data-gid="${g.id}" title="delete">✕</button>
          </div>
        </div>
        <div class="tw-grp-body${isOpen?'':' collapsed-grp'}" data-gid="${g.id}">
          <div class="tw-grp-drop-hint">${t.dragHint}</div>
          ${inGroup.map(s=>cardHTML(s,q)).join('')}
        </div>
      </div>`;
    });

    // Ungrouped
    const ungrouped=sortSnippetList(snippets.filter(s=>!s.groupId));
    if(ungrouped.length||!q){
      if(state.groups.length){
        html+=`<div class="tw-ung-label">${t.noGroup}</div>`;
      }
      html+=ungrouped.map(s=>cardHTML(s,q)).join('');
    }

    if(!snippets.length){
      html=`<div class="tw-empty"><div class="tw-empty-icon">⌀</div><div class="tw-empty-text">${t.emptyText}</div></div>`;
    }

    body.innerHTML=html;
    bindCards();
    bindGroups();
    bindDrag();
    try {
      void window.TwAgencyUI?.refreshStack?.();
    } catch (_) {}
  }

  /** 界面语言或依赖 t 的全局文案变化后重建侧栏（避免仅 render() 列表时顶栏、设置、Agency 等仍为旧语言） */
  function fullRebuildUiChrome() {
    root.innerHTML = buildHTML();
    bindAll();
    updateHeaderPersonaAvatar();
    applyOp(state.opacity);
    applyTheme(state.theme);
    syncSidebarBoxStyles();
    remountAiRewrite();
    applyFontSizeLevel();
    render();
    refreshTwGooglePrimerOnWindow();
    try {
      void window.TwAgencyUI?.renderAll?.();
      void window.TwAgencyUI?.refreshStack?.();
    } catch (_) {}
  }

  function cardHTML(s,q){
    const isV=hasVars(s.content);
    const vv=state.varValues[s.id]||{};
    const uc = Number(s.useCount) || 0;
    const ucTitle = esc((t.snippetUseCountTitle || '使用次数') + ': ' + uc);
    // Use keyword highlight for preview; fall back to search hilite if no keywords match
    const rawPrev=s.content.slice(0,140)+(s.content.length>140?'...':'');
    const prev=isV?chips(s.content,vv,VT):kwHighlightSafe(rawPrev);
    const drag = state.snippetSortByScore ? 'false' : 'true';
    return `<div class="tw-card" data-id="${s.id}" draggable="${drag}">
      <div class="tw-card-title">${hilite(s.title,q||'')}${isV?`<span class="tw-vbadge">${t.varBadge}</span>`:''}<span class="tw-use-count" title="${ucTitle}">${uc}</span></div>
      <div class="tw-card-prev">${prev}</div>
      <div class="tw-card-acts">
        ${isV?`<button class="tw-act tw-va" title="vars">⬡</button>`:''}
        <button class="tw-act tw-xp" title="${t.exportOne}">⤓</button>
        <button class="tw-act tw-ea" title="edit">✎</button>
        <button class="tw-act del tw-da" title="delete">✕</button>
      </div>
    </div>`;
  }

  function bindCards(){
    root.querySelectorAll('.tw-card').forEach(card=>{
      const id=card.dataset.id;
      const s=state.snippets.find(x=>x.id===id);
      card.addEventListener('click',e=>{
        // 点击按钮或变量芯片时不触发复制
        if(e.target.closest('.tw-act')||e.target.closest('.tw-chip'))return;
        // 点击卡片直接复制（如果有变量，使用当前变量值）
        copySnippet(id);
      });
      // 点击变量芯片打开变量编辑器
      card.querySelectorAll('.tw-chip').forEach(c=>c.addEventListener('click',e=>{e.stopPropagation();openVarModal(id);}));
      // 点击变量按钮打开变量编辑器
      card.querySelector('.tw-va')?.addEventListener('click',e=>{e.stopPropagation();openVarModal(id);});
      card.querySelector('.tw-xp')?.addEventListener('click',e=>{e.stopPropagation();exportSnippetFile(id);});
      // 点击编辑按钮打开编辑模态框
      card.querySelector('.tw-ea')?.addEventListener('click',e=>{e.stopPropagation();openSnippetModal(id);});
      // 点击删除按钮
      card.querySelector('.tw-da')?.addEventListener('click',e=>{e.stopPropagation();delSnippet(id,card);});
    });
  }

  function bindGroups(){
    root.querySelectorAll('.tw-grp-hdr').forEach(hdr=>{
      const gid=hdr.dataset.gid;
      hdr.addEventListener('click',e=>{
        if(e.target.closest('.tw-grp-act'))return;
        const g=state.groups.find(x=>x.id===gid);if(!g)return;
        g.collapsed=!g.collapsed;save();render();
      });
      hdr.querySelector('.tw-grp-xp')?.addEventListener('click',e=>{e.stopPropagation();exportGroupFile(gid);});
      hdr.querySelector('.tw-grp-edit')?.addEventListener('click',e=>{e.stopPropagation();openGroupModal(gid);});
      hdr.querySelector('.tw-grp-del')?.addEventListener('click',e=>{
        e.stopPropagation();
        // Confirm via simple approach — use our own confirm inside shadow
        showConfirm(t.confirmDel,()=>{
          state.snippets=state.snippets.map(s=>s.groupId===gid?{...s,groupId:null}:s);
          state.groups=state.groups.filter(g=>g.id!==gid);
          save();render();
        });
      });
    });
  }

  // ── DRAG & DROP ──────────────────────────────────────────────
  function bindDrag(){
    // Card drag start
    root.querySelectorAll('.tw-card').forEach(card=>{
      card.addEventListener('dragstart',e=>{
        state.dragSnippetId=card.dataset.id;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed='move';
        // Show drop hints
        root.querySelectorAll('.tw-grp-body').forEach(b=>b.classList.add('drag-active'));
      });
      card.addEventListener('dragend',()=>{
        state.dragSnippetId=null;
        card.classList.remove('dragging');
        root.querySelectorAll('.tw-grp-body').forEach(b=>{
          b.classList.remove('drag-active','drag-over-body');
        });
        root.querySelectorAll('.tw-grp-hdr').forEach(h=>h.classList.remove('drag-over'));
      });
    });

    // Group body drop zone
    root.querySelectorAll('.tw-grp-body').forEach(body=>{
      const gid=body.dataset.gid;
      body.addEventListener('dragover',e=>{
        e.preventDefault();e.dataTransfer.dropEffect='move';
        body.classList.add('drag-over-body');
        root.querySelector(`.tw-grp-hdr[data-gid="${gid}"]`)?.classList.add('drag-over');
      });
      body.addEventListener('dragleave',e=>{
        if(!body.contains(e.relatedTarget)){
          body.classList.remove('drag-over-body');
          root.querySelector(`.tw-grp-hdr[data-gid="${gid}"]`)?.classList.remove('drag-over');
        }
      });
      body.addEventListener('drop',e=>{
        e.preventDefault();
        const sid=state.dragSnippetId;
        if(!sid)return;
        const idx=state.snippets.findIndex(s=>s.id===sid);
        if(idx!==-1){state.snippets[idx]={...state.snippets[idx],groupId:gid};}
        // 需求：向分组内添加后不要自动展开，用户自己打开分组查看内容
        const g=state.groups.find(x=>x.id===gid);if(g)g.collapsed=true;
        save();render();
      });
    });

    // Drop onto ungrouped area (body itself outside groups)
    const bodyEl=$('#tw-body');
    bodyEl.addEventListener('dragover',e=>{e.preventDefault();});
    bodyEl.addEventListener('drop',e=>{
      // Only handle if dropped directly on body (not on a group)
      if(e.target.closest('.tw-grp'))return;
      const sid=state.dragSnippetId;if(!sid)return;
      const idx=state.snippets.findIndex(s=>s.id===sid);
      if(idx!==-1){state.snippets[idx]={...state.snippets[idx],groupId:null};}
      save();render();
    });
  }

  // ── COPY ─────────────────────────────────────────────────────
  function copySnippet(id){
    const s=state.snippets.find(x=>x.id===id);if(!s)return;
    const vv=state.varValues[id]||{};
    const text=hasVars(s.content)?resolve(s.content,vv):s.content;
    const done=()=>{
      bumpSnippetUseCount(id);
      toast();
      const card=root.querySelector(`.tw-card[data-id="${id}"]`);
      if(card){card.classList.add('copied');setTimeout(()=>card.classList.remove('copied'),1500);}
    };
    // Try clipboard API first; fallback for Windows Chrome / non-HTTPS
    const tryClipboard = async () => {
      try {
        await navigator.clipboard.writeText(text);
        done();
      } catch(e1) {
        try {
          // Fallback: use document.execCommand inside shadow DOM context
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none';
          (root.host || document.body).appendChild(ta);
          ta.focus();
          ta.select();
          const ok = document.execCommand('copy');
          ta.remove();
          if (ok) { done(); } else { throw new Error('execCommand failed'); }
        } catch(e2) {
          // Last resort: show text in prompt for manual copy
          window.prompt('Copy this text (Ctrl+C):', text);
          done();
        }
      }
    };
    tryClipboard();
  }

  // ── VAR MODAL ────────────────────────────────────────────────
  function openVarModal(snippetId){
    const s=state.snippets.find(x=>x.id===snippetId);if(!s)return;
    const vars=parseVars(s.content);if(!vars.length){copySnippet(snippetId);return;}
    state.varEditingId=snippetId;
    if(!state.varValues[snippetId])state.varValues[snippetId]={};
    const vv=state.varValues[snippetId];
    vars.forEach(v=>{const k=v.type+':'+v.label;if(vv[k]===undefined)vv[k]=v.dv;});

    const fields=$('#tw-vf-fields');
    fields.innerHTML=vars.map(v=>{
      const k=v.type+':'+v.label;
      const vt=VT[v.type]||{options:[],label:v.label,color:'#aaa',bg:'#222',border:'#444'};
      const cur=vv[k];const isCustom=!vt.options.includes(cur);
      return `<div class="tw-vf">
        <div class="tw-vfl"><span class="tw-vdot" style="background:${vt.border}"></span>${esc(vt.label||v.label)}</div>
        <div class="tw-vopts" data-key="${esc(k)}">
          ${vt.options.map(o=>{const sel=cur===o;
            return `<button class="tw-vo${sel?' tw-sel':''}" data-key="${esc(k)}" data-val="${esc(o)}"
              data-bg="${vt.bg}" data-color="${vt.color}" data-border="${vt.border}"
              style="${sel?`background:${vt.bg};color:${vt.color};border-color:${vt.border}`:''}">
              ${esc(o)}</button>`;}).join('')}
        </div>
        <input class="tw-vc" type="text" data-key="${esc(k)}" placeholder="${t.customPlh}" value="${isCustom?esc(cur):''}">
      </div>`;
    }).join('');

    updVarPrev(s,vv);
    $('#tw-vm').classList.add('open');

    fields.querySelectorAll('.tw-vo').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const k=btn.dataset.key;
        fields.querySelectorAll(`.tw-vopts[data-key="${k}"] .tw-vo`).forEach(b=>{b.classList.remove('tw-sel');b.style.cssText='';});
        btn.classList.add('tw-sel');
        btn.style.cssText=`background:${btn.dataset.bg};color:${btn.dataset.color};border-color:${btn.dataset.border}`;
        const inp=fields.querySelector(`.tw-vc[data-key="${k}"]`);if(inp)inp.value='';
        vv[k]=btn.dataset.val;state.varValues[snippetId]=vv;save();
        updVarPrev(s,vv);render();
      });
    });
    fields.querySelectorAll('.tw-vc').forEach(inp=>{
      inp.addEventListener('input',()=>{
        if(!inp.value.trim())return;
        const k=inp.dataset.key;
        fields.querySelectorAll(`.tw-vopts[data-key="${k}"] .tw-vo`).forEach(b=>{b.classList.remove('tw-sel');b.style.cssText='';});
        vv[k]=inp.value.trim();state.varValues[snippetId]=vv;save();
        updVarPrev(s,vv);render();
      });
    });
    $('#tw-vm-copy').onclick=()=>{copySnippet(snippetId);closeVarModal();};
    $('#tw-vm-cancel').onclick=closeVarModal;
    $('#tw-vm').onclick=e=>{if(e.target===e.currentTarget)closeVarModal();};
  }
  function updVarPrev(s,vv){const el=$('#tw-vf-prev');if(el)el.textContent=resolve(s.content,vv);}
  function closeVarModal(){$('#tw-vm')?.classList.remove('open');state.varEditingId=null;}

  // ── AI 个性档案（引导 + 设置）────────────────────────────────
  function offerPersonaWizardAfterScene() {
    if (state.personaWizardDone) return;
    setTimeout(() => openPersonaModal(true), 280);
  }

  function twPersonaPresetShortLabel(roleKey) {
    const id = roleKey || 'custom';
    const pr = typeof window.TW_PERSONA_ROLE_PRESETS !== 'undefined' ? window.TW_PERSONA_ROLE_PRESETS[id] : null;
    if (!pr) return '';
    const lang = state.lang === 'en' ? 'en' : state.lang === 'ko' ? 'ko' : 'zh';
    const raw =
      lang === 'en'
        ? pr.labelEn || pr.labelZh || ''
        : lang === 'ko'
          ? pr.labelKo || pr.labelEn || pr.labelZh || ''
          : pr.labelZh || '';
    const s = String(raw || '').trim();
    return pr.icon ? `${pr.icon} ${s}` : s;
  }

  function twInferPersonaRoleKeyFromJobTitle(jobTitle) {
    const j = String(jobTitle || '').trim();
    if (!j || typeof window.TW_PERSONA_ROLE_PRESETS === 'undefined') return '';
    const order = window.TW_PERSONA_ROLE_PRESETS_ORDER || Object.keys(window.TW_PERSONA_ROLE_PRESETS);
    for (let i = 0; i < order.length; i++) {
      const id = order[i];
      if (!id || id === 'custom') continue;
      const pr = window.TW_PERSONA_ROLE_PRESETS[id];
      if (!pr) continue;
      const cand = [pr.labelZh, pr.labelEn, pr.labelKo].filter(Boolean).map((x) => String(x).trim());
      if (cand.some((lab) => lab && j === lab)) return id;
      const iconPref = pr.icon ? `${pr.icon} ` : '';
      if (cand.some((lab) => lab && j === `${iconPref}${lab}`)) return id;
    }
    return '';
  }

  function populatePersonaRoleSelect() {
    const sel = $('#tw-persona-role-preset');
    if (!sel || typeof window.TW_PERSONA_ROLE_PRESETS === 'undefined') return;
    const order = Array.isArray(window.TW_PERSONA_ROLE_PRESETS_ORDER)
      ? window.TW_PERSONA_ROLE_PRESETS_ORDER
      : Object.keys(window.TW_PERSONA_ROLE_PRESETS);
    sel.innerHTML = order
      .map((id) => {
        const pr = window.TW_PERSONA_ROLE_PRESETS[id];
        if (!pr) return '';
        const lab = twPersonaPresetShortLabel(id);
        return `<option value="${esc(id)}">${esc(lab)}</option>`;
      })
      .join('');
    const p = { ...defaultAiUserProfile(), ...(state.aiUserProfile || {}) };
    let rk = p.personaRoleKey;
    if (!rk || !window.TW_PERSONA_ROLE_PRESETS[rk]) {
      const guess = twInferPersonaRoleKeyFromJobTitle(p.jobTitle);
      rk = guess || 'custom';
    }
    sel.value = window.TW_PERSONA_ROLE_PRESETS[rk] ? rk : 'custom';
  }

  function syncPersonaRoleHintDisplay() {
    const wrap = $('#tw-persona-role-hint-wrap');
    const hint = $('#tw-persona-role-hint');
    const sel = $('#tw-persona-role-preset');
    if (!hint || !sel || typeof window.TW_PERSONA_ROLE_PRESETS === 'undefined') return;
    const id = sel.value || 'custom';
    const pr = window.TW_PERSONA_ROLE_PRESETS[id];
    const lang = state.lang === 'en' ? 'en' : state.lang === 'ko' ? 'ko' : 'zh';
    const detail =
      id === 'custom' || !pr
        ? ''
        : lang === 'en'
          ? pr.detailEn || pr.detailZh || ''
          : lang === 'ko'
            ? pr.detailKo || pr.detailEn || pr.detailZh || ''
            : pr.detailZh || '';
    const t = String(detail || '').trim();
    if (wrap) wrap.classList.toggle('show', !!t);
    hint.textContent = t;
  }

  function onTwPersonaRolePresetChange(fromUser) {
    const sel = $('#tw-persona-role-preset');
    const job = $('#tw-persona-job');
    const id = sel?.value || 'custom';
    if (fromUser && job && id !== 'custom') {
      const plain =
        state.lang === 'en'
          ? window.TW_PERSONA_ROLE_PRESETS[id]?.labelEn
          : state.lang === 'ko'
            ? window.TW_PERSONA_ROLE_PRESETS[id]?.labelKo || window.TW_PERSONA_ROLE_PRESETS[id]?.labelEn
            : window.TW_PERSONA_ROLE_PRESETS[id]?.labelZh;
      job.value = plain || '';
    }
    syncPersonaRoleHintDisplay();
  }

  function readPersonaFormFromUI() {
    return {
      nickname: $('#tw-persona-nick')?.value?.trim() || '',
      jobTitle: $('#tw-persona-job')?.value?.trim() || '',
      personaRoleKey: $('#tw-persona-role-preset')?.value?.trim() || 'custom',
      personality: $('#tw-persona-personality')?.value?.trim() || '',
      nationality: $('#tw-persona-nationality')?.value?.trim() || '',
      speakLang: $('#tw-persona-speaklang')?.value?.trim() || '',
      extra: $('#tw-persona-extra')?.value?.trim() || '',
      aiSummary: $('#tw-persona-summary')?.value?.trim() || '',
    };
  }

  function twPrimerForPersonaSummarize(lang) {
    const k = lang === 'en' ? 'en' : lang === 'ko' ? 'ko' : 'zh';
    return String(TW_GOOGLE_PROMPT_PRIMER[k] || TW_GOOGLE_PROMPT_PRIMER.zh || '').trim();
  }

  /** 归纳档案时发给模型的用户填写项（按界面语言标注字段名） */
  function twPersonaRoleDetailForLang(f, lang) {
    const rk = f.personaRoleKey;
    if (!rk || rk === 'custom' || typeof window.TW_PERSONA_ROLE_PRESETS === 'undefined') return '';
    const pr = window.TW_PERSONA_ROLE_PRESETS[rk];
    if (!pr) return '';
    const raw =
      lang === 'en'
        ? pr.detailEn || pr.detailZh || ''
        : lang === 'ko'
          ? pr.detailKo || pr.detailEn || pr.detailZh || ''
          : pr.detailZh || '';
    return String(raw || '').trim();
  }

  function twPersonaRoleBlobLine(f, lang) {
    const d = twPersonaRoleDetailForLang(f, lang);
    if (!d) return '';
    if (lang === 'en') return `[Selected role preset — skills & quality bar]\n${d}`;
    if (lang === 'ko') return `[선택한 직무 프리셋 — 역량·품질 기준]\n${d}`;
    return `【所选职位角色模版 — 技能与质量标准】\n${d}`;
  }

  function buildPersonaBlobForAi(f, lang) {
    const roleBlob = twPersonaRoleBlobLine(f, lang);
    if (lang === 'en') {
      return [
        f.nickname && `Name / nickname: ${f.nickname}`,
        f.jobTitle && `Role / industry: ${f.jobTitle}`,
        roleBlob,
        f.personality && `Personality & tone: ${f.personality}`,
        f.nationality && `Country / region: ${f.nationality}`,
        f.speakLang && `Languages: ${f.speakLang}`,
        f.extra && `Notes: ${f.extra}`,
      ]
        .filter(Boolean)
        .join('\n');
    }
    if (lang === 'ko') {
      return [
        f.nickname && `이름/닉네임: ${f.nickname}`,
        f.jobTitle && `직무/업종: ${f.jobTitle}`,
        roleBlob,
        f.personality && `성격/톤: ${f.personality}`,
        f.nationality && `국가/지역: ${f.nationality}`,
        f.speakLang && `언어: ${f.speakLang}`,
        f.extra && `기타: ${f.extra}`,
      ]
        .filter(Boolean)
        .join('\n');
    }
    return [
      f.nickname && `称呼/昵称：${f.nickname}`,
      f.jobTitle && `职位/行业：${f.jobTitle}`,
      roleBlob,
      f.personality && `性格与语气：${f.personality}`,
      f.nationality && `国籍或地区：${f.nationality}`,
      f.speakLang && `常用语言：${f.speakLang}`,
      f.extra && `其他补充：${f.extra}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  function buildPersonaAiSummarizeSystem(lang, primer) {
    const primerSec =
      primer.length > 0
        ? lang === 'en'
          ? `\n\n[Align with these prompt-engineering ideas (condensed; not a verbatim quote)]\n${primer}`
          : lang === 'ko'
            ? `\n\n[다음 프롬프트 설계 요지에 맞출 것 (요약·비전문 인용)]\n${primer}`
            : `\n\n【与下列提示工程要点对齐（浓缩思路，非原文转载）】\n${primer}`
        : '';

    if (lang === 'en') {
      return (
        `You produce a persistent "AI user profile" block. It will be injected whenever the user runs 「Personalize」 or 「Pro + Profile」 to polish their snippets, so voice and professionalism must stay stable across sessions.${primerSec}\n\n`
        + `Tasks — do not invent concrete facts the user did not supply; mark educated guesses as "(inferred)".\n`
        + `1) 【Confirm】1–2 bullets restating provided fields (name, role/industry, personality/tone, region, languages, notes).\n`
        + `2) 【Professional persona】If BOTH role/industry AND personality/tone are provided, merge them: expertise depth, vocabulary level, and typical communication context when rewriting their scripts. If only one is present, still give a cautious professional angle tied to what they wrote.\n`
        + `3) 【Voice】Turn tone into actionable rules (e.g. formal vs casual, concise vs detailed) so every polish pass sounds like this user.\n`
        + `4) 【Audience / context (optional)】Only when justified from the text; otherwise say "not specified".\n`
        + `5) 【Guardrails】Never fabricate credentials, metrics, employers, or private facts; polishing improves expression and structure only.\n\n`
        + `Output: 6–12 short lines, each starting with "- " or "• ". You may use one-line headers like 【Confirm】. No preamble or sign-off.`
      );
    }
    if (lang === 'ko') {
      return (
        `사용자의 지속 페르소나 블록을 작성합니다. 「맞춤 다듬기」「전문+맞춤」에 주입되므로 톤과 전문성이 매번 일관되어야 합니다.${primerSec}\n\n`
        + `작업 — 사용자가 주지 않은 구체 사실을 지어내지 말 것; 추정은 「(추정)」으로 표시.\n`
        + `1) 【확인】입력된 항목을 1~2개 불릿으로 확인(이름, 직무/업종, 성격/톤, 지역, 언어, 기타).\n`
        + `2) 【전문 페르소나】직무/업종과 성격/톤이 모두 있으면 융합: 깊이, 용어 수준, 스크립트 다듬기 시 전형적 맥락. 하나만 있어도 보수적으로 전문 각도 제시.\n`
        + `3) 【톤】형식·캐주얼, 간결·상세 등 실행 가능한 규칙으로 정리.\n`
        + `4) 【독자/맥락(선택)】근거 있을 때만; 없으면 「미지정」.\n`
        + `5) 【경계】자격·수치·고용주·사생활 사실을 꾸며내지 말 것.\n\n`
        + `출력: 6~12줄, 각 줄은 "- " 또는 "• "로 시작. 【확인】 같은 한 줄 제목 가능. 서두/맺음말 없음.`
      );
    }
    return (
      `你正在为用户生成一段可长期保存的「AI 个性档案」正文。保存后会在每次「个性化优化」「专业+个性」润色语句时注入模型，因此人设的专业度与个人语气必须在多次使用中保持一致。${primerSec}\n\n`
      + `按下列任务执行（不得编造用户未提供的具体事实；合理推断须标注「（推断）」）。\n`
      + `1) 【确认】用 1～2 条要点复述用户已填写项（称呼、职位/行业、性格与语气、地区、语言、其他补充）。\n`
      + `2) 【专业人设】若用户同时填写了「职位/行业」与「性格与语气」，请将二者融合：说明润色其脚本时 AI 应具备的专业深度、术语层级、典型沟通场景；若只填了其中一项，也请结合已有信息给出谨慎、可执行的专业侧面描述。\n`
      + `3) 【性格与表达】把语气偏好写成可执行规则（如正式/轻松、简洁/细致），保证每次润色都像用户本人口吻。\n`
      + `4) 【受众与场景（可选）】仅从用户文字有据推断；若无依据写「未指定」。\n`
      + `5) 【边界】不臆造履历、公司、数据、隐私；润色只提升表达与结构。\n\n`
      + `输出格式：共 6～12 条短要点，每条一行，以「- 」或「• 」开头；可用单独一行小标题如「【确认】」。不要开场白与结束语。`
    );
  }

  function buildPersonaSummarizeUserContent(lang, blob, f) {
    const header =
      lang === 'en'
        ? '[Fields from the form — this session]'
        : lang === 'ko'
          ? '[이번 세션 폼 입력]'
          : '【用户本次在表单中填写的内容】';
    let u = `${header}\n${blob}`;
    const hasJob = !!(f.jobTitle && String(f.jobTitle).trim());
    const hasPers = !!(f.personality && String(f.personality).trim());
    if (hasJob && hasPers) {
      u +=
        lang === 'en'
          ? `\n\n[Priority] Both role/industry and personality/tone are filled: produce one fused "professional stance + personal voice" the assistant must follow on every future polish.`
          : lang === 'ko'
            ? `\n\n[우선] 직무/업종과 성격/톤이 모두 있음: 이후 모든 다듬기에 동일하게 적용할 「전문 태도+개인 톤」을 하나로 융합해 서술할 것.`
            : `\n\n【重点】用户已同时填写「职位/行业」与「性格与语气」：请写出一份「专业人设 + 个人语气」合一、且之后每次「个性化优化 / 专业+个性」都必须一致沿用的描述。`;
    }
    return u;
  }

  function fillPersonaFormFromState() {
    const p = { ...defaultAiUserProfile(), ...(state.aiUserProfile || {}) };
    const set = (id, v) => { const el = $(id); if (el) el.value = v || ''; };
    set('#tw-persona-nick', p.nickname);
    set('#tw-persona-job', p.jobTitle);
    set('#tw-persona-personality', p.personality);
    set('#tw-persona-nationality', p.nationality);
    set('#tw-persona-speaklang', p.speakLang);
    set('#tw-persona-extra', p.extra);
    set('#tw-persona-summary', p.aiSummary);
    const img = $('#tw-persona-avatar');
    if (img) {
      if (p.avatarUrl) {
        img.src = p.avatarUrl;
        img.style.display = 'block';
      } else {
        img.removeAttribute('src');
        img.style.display = 'none';
      }
    }
    populatePersonaRoleSelect();
    syncPersonaRoleHintDisplay();
  }

  function openPersonaModal(/* isWizard */) {
    const m = $('#tw-persona-modal');
    if (!m) return;
    fillPersonaFormFromState();
    m.classList.add('open');
  }

  function closePersonaModal() {
    $('#tw-persona-modal')?.classList.remove('open');
  }

  function twDicebearAvatarUrl(seed) {
    const s = encodeURIComponent(String(seed || 'talkweb').slice(0, 120));
    return `https://api.dicebear.com/9.x/lorelei/svg?seed=${s}`;
  }

  function twExtractSvgFromAiText(s) {
    let t = String(s || '').replace(/^\uFEFF/, '').trim();
    t = t.replace(/^```(?:svg|xml)?\s*/i, '');
    t = t.replace(/\s*```\s*$/i, '').trim();
    const m = t.match(/<svg[\s\S]*?<\/svg>/i);
    if (!m) return null;
    let svg = m[0].trim();
    if (!/\sxmlns\s*=/.test(svg)) svg = svg.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    return svg;
  }

  function twSvgToDataUrl(svg) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  function buildPersonaAvatarSvgSystem(lang) {
    if (lang === 'en') {
      return 'Output ONLY one compact SVG for a cute flat avatar (head and shoulders). No markdown fences, no commentary, no <?xml line.\n'
        + 'Root: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">. Use only simple shapes (circles, rounded rects), max ~14 elements, pastel/friendly colors, abstract style (not photorealistic). Subtly echo job/personality via palette or tiny symbols.';
    }
    if (lang === 'ko') {
      return '귀여운 플랫 아바타(머리~어깨) SVG 하나만 출력. 마크다운·설명·<?xml 금지.\n'
        + '루트: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">. 단순 도형만, 요소 ~14개 이하, 파스텔, 사실적 얼굴 금지. 직무·성격을 색/기호로 은유.';
    }
    return '只输出一个完整扁平可爱风头像 SVG（头肩像）。禁止 Markdown、禁止解释、禁止 <?xml 声明行。\n'
      + '根节点：<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">；仅用圆、圆角矩形等简单形状；约 14 个元素以内；柔和配色；抽象风、禁止照片级写实；可用颜色或小符号轻微呼应职位与性格。';
  }

  async function onPersonaGenAvatar() {
    const f = readPersonaFormFromUI();
    const seed = [f.nickname, f.jobTitle, f.personality, f.nationality, f.speakLang].filter(Boolean).join('|') || 'talkweb-user';
    const img = $('#tw-persona-avatar');
    const btn = $('#tw-persona-gen-avatar');
    const prevBtn = btn?.textContent;

    const applyAvatarUrl = (url) => {
      state.aiUserProfile = { ...defaultAiUserProfile(), ...(state.aiUserProfile || {}), ...f, avatarUrl: url };
      if (img) {
        img.src = url;
        img.style.display = 'block';
      }
      save();
      updateHeaderPersonaAvatar();
    };

    const key = normalizeStoredApiKey(state.aiApiKey);
    if (!key || !window.createAIClient) {
      applyAvatarUrl(twDicebearAvatarUrl(seed));
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = t.personaGenAvatarBusy || '…';
    }
    try {
      const lang = state.lang === 'en' ? 'en' : state.lang === 'ko' ? 'ko' : 'zh';
      const userBlob = buildPersonaBlobForAi(f, lang) || seed;
      const sys = buildPersonaAvatarSvgSystem(lang);
      const urlNorm = normalizeApiUrl(state.aiProvider, state.aiApiUrl) || state.aiApiUrl;
      const client = createAIClient({
        provider: state.aiProvider,
        apiKey: key,
        apiUrl: urlNorm,
        model: state.aiModel,
        maxTokens: 2800,
      });
      const res = await client.generateFull(
        [
          { role: 'system', content: sys },
          { role: 'user', content: `${userBlob}\n\n${lang === 'en' ? 'Generate the SVG now.' : lang === 'ko' ? '지금 SVG를 출력하세요.' : '请现在输出 SVG。'}` },
        ],
        { maxTokens: 2800, temperature: 0.55 },
      );
      const svg = twExtractSvgFromAiText(String(res.text || ''));
      if (!svg || svg.length > 24000) throw new Error('invalid svg');
      applyAvatarUrl(twSvgToDataUrl(svg));
    } catch (e) {
      console.warn('[TalkwebSour] persona AI avatar', e);
      applyAvatarUrl(twDicebearAvatarUrl(seed));
      const toastEl = $('#tw-toast');
      if (toastEl && t.personaAvatarAiFail) {
        const old = toastEl.textContent;
        toastEl.textContent = t.personaAvatarAiFail;
        toast();
        setTimeout(() => { toastEl.textContent = old; }, 3200);
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = prevBtn || t.personaGenAvatar;
      }
    }
  }

  async function onPersonaAiSummarize() {
    const f = readPersonaFormFromUI();
    const lang = state.lang === 'en' ? 'en' : state.lang === 'ko' ? 'ko' : 'zh';
    const blob = buildPersonaBlobForAi(f, lang);
    if (!blob.trim()) {
      alert(lang === 'en' ? 'Fill at least one field first.' : lang === 'ko' ? '한 항목 이상 입력하세요.' : '请先至少填写一项。');
      return;
    }
    if (!window.createAIClient) {
      alert(t.aiModuleNotReady);
      return;
    }
    const key = normalizeStoredApiKey(state.aiApiKey);
    if (!key) {
      alert(t.aiNoKey);
      return;
    }
    const ta = $('#tw-persona-summary');
    const btn = $('#tw-persona-ai-sum');
    const prev = btn?.textContent;
    if (btn) {
      btn.disabled = true;
      btn.textContent = '…';
    }
    const primer = twPrimerForPersonaSummarize(lang);
    const sys = buildPersonaAiSummarizeSystem(lang, primer);
    const userContent = buildPersonaSummarizeUserContent(lang, blob, f);
    const personaSumMaxTok = 4000;

    const runFull = async (messages) => {
      const urlNorm = normalizeApiUrl(state.aiProvider, state.aiApiUrl) || state.aiApiUrl;
      const client = createAIClient({
        provider: state.aiProvider,
        apiKey: key,
        apiUrl: urlNorm,
        model: state.aiModel,
        maxTokens: personaSumMaxTok,
      });
      return client.generateFull(messages, { maxTokens: personaSumMaxTok });
    };

    try {
      let res = await runFull([{ role: 'system', content: sys }, { role: 'user', content: userContent }]);
      let text = String(res.text || '').trim();
      if (!text) {
        console.warn('[TalkwebSour] 档案归纳：system+user 无输出，改用单条 user 重试');
        const merged =
          lang === 'en'
            ? `[Instructions for the model]\n${sys}\n\n${userContent}`
            : lang === 'ko'
              ? `[모델 지시]\n${sys}\n\n${userContent}`
              : `【给模型的说明】\n${sys}\n\n${userContent}`;
        res = await runFull([{ role: 'user', content: merged }]);
        text = String(res.text || '').trim();
      }
      if (!text) {
        console.error('[TalkwebSour] persona summarize empty', {
          provider: state.aiProvider,
          model: state.aiModel,
        });
        alert(t.personaSummaryFail || '归纳失败');
        return;
      }
      if (ta) {
        ta.value = text;
        try {
          ta.classList.remove('tw-persona-summary-flash');
          void ta.offsetWidth;
          ta.classList.add('tw-persona-summary-flash');
          setTimeout(() => ta.classList.remove('tw-persona-summary-flash'), 1100);
        } catch (_) {}
        try {
          ta.focus();
          ta.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } catch (_) {}
      }
      state.aiUserProfile = { ...defaultAiUserProfile(), ...(state.aiUserProfile || {}), ...f, aiSummary: text };
      save();
      updateHeaderPersonaAvatar();
      const toastEl = $('#tw-toast');
      if (toastEl) {
        const old = toastEl.textContent;
        toastEl.textContent = t.personaSummaryDone || '✓';
        toast();
        setTimeout(() => {
          toastEl.textContent = old;
        }, 2200);
      }
    } catch (e) {
      alert(String(e?.message || e));
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = prev || t.personaAiSum;
      }
    }
  }

  function savePersonaFromModal() {
    const f = readPersonaFormFromUI();
    const img = $('#tw-persona-avatar');
    const avatarUrl =
      img && img.style.display !== 'none' && img.getAttribute('src')
        ? img.src
        : (state.aiUserProfile && state.aiUserProfile.avatarUrl) || '';
    state.aiUserProfile = { ...defaultAiUserProfile(), ...(state.aiUserProfile || {}), ...f, avatarUrl };
    state.personaWizardDone = true;
    save();
    updateHeaderPersonaAvatar();
    closePersonaModal();
    toast();
  }

  function skipPersonaWizard() {
    state.personaWizardDone = true;
    save();
    closePersonaModal();
  }

  // ── SNIPPET MODAL ────────────────────────────────────────────
  function openSnippetModal(id){
    state.editingSnippet=id||null;
    const s=id?state.snippets.find(x=>x.id===id):null;
    const smTitle = $('#tw-sm-title');
    const sTitle = $('#tw-s-title');
    const sContent = $('#tw-s-content');
    const sm = $('#tw-sm');
    const gsel = $('#tw-s-group');
    if (!smTitle || !sTitle || !sContent || !sm || !gsel) return;

    smTitle.textContent=s?t.editSnippet:t.newSnippet;
    sTitle.value=s?s.title:'';
    sContent.value=s?s.content:'';
    sTitle.classList.remove('err');
    
    // 检查是否有保存的原内容，显示恢复按钮
    const snippetId = id || 'temp';
    const restoreBtn = $('#tw-sm-restore');
    if (restoreBtn) {
      const hasBk = window.TwAiRewrite?.hasBackup ? TwAiRewrite.hasBackup(snippetId) : !!state.originalContent[snippetId];
      restoreBtn.style.display = hasBk ? 'block' : 'none';
    }
    const ph = $('#tw-sm-persona-hint');
    if (ph) {
      const showHint =
        !id
        && !!(
          state.aiUserProfile
          && (
            state.aiUserProfile.aiSummary
            || state.aiUserProfile.jobTitle
            || state.aiUserProfile.personality
            || (state.aiUserProfile.personaRoleKey && state.aiUserProfile.personaRoleKey !== 'custom')
          )
        );
      ph.style.display = showHint ? 'block' : 'none';
    }
    
    // Populate group dropdown
    const noGroupLabel = t.noGroup || '— '+t.noGroup+' —';
    gsel.innerHTML=`<option value="">${noGroupLabel}</option>`
      +state.groups.map(g=>`<option value="${g.id}">${esc(g.name)}</option>`).join('');
    gsel.value = s ? (s.groupId||'') : '';
    const sj = $('#tw-s-json');
    if (sj) sj.value = '';
    sm.classList.add('open');
    setTimeout(()=>sTitle.focus(),100);
    // Wire live preview
    const contentTA = sContent;
    const prevWrap = $('#tw-s-prev-wrap');
    const prevEl = $('#tw-s-prev');
    if (!contentTA || !prevWrap || !prevEl) return;

    function updateLivePreview() {
      const txt = contentTA.value;
      prevWrap.style.display = txt.length > 0 ? 'block' : 'none';
      // Always show keyword highlights; also handle {{var}} syntax
      if (hasVars(txt)) {
        prevEl.innerHTML = chips(txt, {}, VT);
      } else {
        prevEl.innerHTML = kwHighlightSafe(txt.slice(0, 200) + (txt.length > 200 ? '...' : ''));
      }
    }
    contentTA.addEventListener('input', updateLivePreview);
    updateLivePreview();
  }
  function closeSnippetModal(reason) {
    const r = reason === undefined || reason === null ? 'unknown' : reason;
    if (r !== 'save' && r !== 'cancel') {
      console.warn('[TalkwebSour] 语句编辑窗关闭（非保存/取消）', 'reason=', r, new Error().stack);
    }
    $('#tw-sm')?.classList.remove('open');
  }
  function saveSnippet(){
    const title=$('#tw-s-title').value.trim();
    const content=$('#tw-s-content').value.trim();
    const groupId=$('#tw-s-group').value||null;
    if(!title){$('#tw-s-title').classList.add('err');setTimeout(()=>$('#tw-s-title').classList.remove('err'),1500);return;}
    if(!content)return;
    if(state.editingSnippet){
      const idx=state.snippets.findIndex(s=>s.id===state.editingSnippet);
      if(idx!==-1)state.snippets[idx]={...state.snippets[idx],title,content,groupId};
    }else{
      state.snippets.unshift({id:uid(),title,content,groupId,createdAt:Date.now()});
    }
    // 默认折叠所属分组：先看分组标题，用户自己展开查看内容
    if (groupId) {
      const g = state.groups.find(x => x.id === groupId);
      if (g) g.collapsed = true;
    }
    save();closeSnippetModal('save');render();
  }
  function delSnippet(id,card){
    card.style.cssText='opacity:0;transform:translateX(-20px);transition:all 0.2s;'+card.style.cssText;
    setTimeout(()=>{state.snippets=state.snippets.filter(s=>s.id!==id);save();render();},200);
  }

  // ── GROUP MODAL ──────────────────────────────────────────────
  function openGroupModal(id){
    state.editingGroup=id||null;
    const g=id?state.groups.find(x=>x.id===id):null;
    $('#tw-gm-title').textContent=g?t.editGroup:t.newGroup;
    $('#tw-g-name').value=g?g.name:'';
    $('#tw-gm').classList.add('open');
    setTimeout(()=>$('#tw-g-name').focus(),100);
  }
  function closeGroupModal(){$('#tw-gm')?.classList.remove('open');}
  function saveGroup(){
    const name=$('#tw-g-name').value.trim();if(!name)return;
    if(state.editingGroup){
      const g=state.groups.find(x=>x.id===state.editingGroup);if(g)g.name=name;
    }else{
      state.groups.push({id:uid(),name,collapsed:true});
    }
    save();closeGroupModal();render();
  }

  // ── CONFIRM DIALOG (inline) ──────────────────────────────────
  function showConfirm(msg,onOk){
    // Reuse group modal as confirm
    $('#tw-gm-title').textContent=msg;
    $('#tw-g-name').style.display='none';
    $('#tw-gm-save').textContent=t.deleteGroup;
    $('#tw-gm-save').style.background='#ff4466';
    $('#tw-gm').classList.add('open');
    $('#tw-gm-save').onclick=()=>{
      onOk();
      $('#tw-g-name').style.display='';
      $('#tw-gm-save').textContent=t.save;
      $('#tw-gm-save').style.background='';
      closeGroupModal();
      rebindGroupModal();
    };
  }
  function rebindGroupModal(){
    $('#tw-gm-save').onclick=saveGroup;
    $('#tw-gm-cancel').onclick=closeGroupModal;
    $('#tw-gm').onclick=e=>{if(e.target===e.currentTarget)closeGroupModal();};
  }

  // ── LANGUAGE CYCLE ───────────────────────────────────────────
  function cycleLang(){
    state.lang=state.lang==='zh'?'en':state.lang==='en'?'ko':'zh';
    t=LANG[state.lang];VT=getVarTypes(t);
    // Do NOT reset groups or snippets on language switch — preserve user data
    save();
    fullRebuildUiChrome();
  }

  // ── RESIZE ───────────────────────────────────────────────────
  function initResize(){
    const handle=$('#tw-resize'),sb=$('#sb');
    let sx,sw,drag=false;
    handle.addEventListener('mousedown',e=>{
      drag=true;sx=e.clientX;sw=parseInt(sb.style.width)||state.sidebarWidth;
      handle.classList.add('dragging');
      document.body.style.cursor='ew-resize';document.body.style.userSelect='none';
      e.preventDefault();
    });
    document.addEventListener('mousemove',e=>{
      if(!drag)return;
      const w=Math.min(600,Math.max(240,sw-(e.clientX-sx)));
      sb.style.width=w+'px';sb.style.setProperty('--tw-w',w+'px');state.sidebarWidth=w;
      updatePageContentGutter();
    });
    document.addEventListener('mouseup',()=>{
      if(!drag)return;drag=false;handle.classList.remove('dragging');
      document.body.style.cursor='';document.body.style.userSelect='';save();applySidebarLayout();updatePageContentGutter();
    });
  }

  // ── SIDEBAR HEIGHT（底部拖动条：向下拉伸可视区域）────────────
  let vResizeDrag = { active: false, startY: 0, startH: 0 };

  function applySidebarLayout() {
    const sb = $('#sb');
    if (!sb) return;
    const margin = 10;
    const y = state.position?.y ?? 0;
    const cap = Math.max(220, window.innerHeight - y - margin);
    const want = state.sidebarFixedHeight;
    if (want != null && want > 0) {
      const h = Math.max(220, Math.min(want, cap));
      state.sidebarFixedHeight = h;
      sb.style.height = h + 'px';
      sb.style.maxHeight = cap + 'px';
    } else {
      sb.style.height = '';
      sb.style.maxHeight = '';
    }
  }

  /** 为页面主内容让出右侧空间（类 Chrome sidePanel：侧栏 + 与右缘间距） */
  function updatePageContentGutter() {
    if (TW_IS_SIDE_PANEL) return;
    const sb = $('#sb');
    const open = sb && !sb.classList.contains('hidden');
    if (!open) {
      document.documentElement.style.paddingRight = '';
      return;
    }
    const R = state.position?.x ?? 0;
    const gutter = Math.min(window.innerWidth, Math.round(state.sidebarWidth + R));
    document.documentElement.style.paddingRight = gutter + 'px';
  }
  window.TwUpdatePageContentGutter = updatePageContentGutter;

  function clampSidebarRightInset() {
    if (TW_IS_SIDE_PANEL) return;
    const margin = 8;
    const maxR = Math.max(0, window.innerWidth - state.sidebarWidth - margin);
    if ((state.position?.x ?? 0) > maxR) state.position.x = maxR;
  }

  function syncSidebarBoxStyles() {
    const sb = $('#sb');
    if (!sb) return;
    clampSidebarRightInset();
    sb.style.width = state.sidebarWidth + 'px';
    sb.style.setProperty('--tw-w', state.sidebarWidth + 'px');
    sb.style.setProperty('--tw-x', state.position.x + 'px');
    sb.style.setProperty('--tw-y', state.position.y + 'px');
    sb.classList.toggle('tw-dock-flush', (state.position?.x ?? 0) === 0);
    if (TW_IS_SIDE_PANEL) {
      sb.classList.add('tw-in-side-panel');
      sb.dataset.twSidePanel = '1';
    } else {
      sb.classList.remove('tw-in-side-panel');
      delete sb.dataset.twSidePanel;
    }
    applySidebarLayout();
    updatePageContentGutter();
  }

  function initResizeVertical() {
    const grip = $('#tw-resize-v'), sb = $('#sb');
    if (!grip || !sb) return;
    grip.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      vResizeDrag.active = true;
      vResizeDrag.startY = e.clientY;
      const rect = sb.getBoundingClientRect();
      vResizeDrag.startH = rect.height;
      if (state.sidebarFixedHeight == null || state.sidebarFixedHeight <= 0) {
        state.sidebarFixedHeight = Math.round(rect.height);
      }
      grip.classList.add('dragging');
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    };
    grip.ondblclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      state.sidebarFixedHeight = null;
      applySidebarLayout();
      save();
    };
  }

  function remountAiRewrite() {
    aiRewriteReady = false;
    try {
      if (root && window.TwAgencyUI && typeof TwAgencyUI.init === 'function') {
        TwAgencyUI.init({
          root,
          getState: () => state,
          patchState,
          getLabels: () => t,
          onNotify: showAgencyNotify,
          force: true,
        });
      }
      ensureAiRewriteReady();
      exposeAgencyPaletteBridge();
    } catch (_) {}
  }

  // ── SIDEBAR DRAG (整个侧边栏拖动) ────────────────────────────
  let sidebarDragState = {isDragging: false, grabOffsetX: 0, startY: 0};
  let twWindowResizeBound = false;
  
  function initSidebarDrag(){
    const header = $('#tw-hdr'), sb = $('#sb');
    if(!header || !sb) return;
    
    // 移除旧的监听器（如果存在）
    header.onmousedown = null;
    
    header.onmousedown = (e) => {
      // 避免点击按钮、输入框等交互元素时触发拖动
      if(e.target.closest('.tw-ib')) return; // 按钮
      if(e.target.closest('input')) return; // 输入框
      if(e.target.closest('.tw-op')) return; // 透明度滑块
      if(e.target.closest('.tw-th-dot')) return; // 主题点
      if(e.target.closest('#tw-search')) return; // 搜索框
      
      sidebarDragState.isDragging = true;
      const R0 = state.position.x ?? 0;
      const panelLeft = window.innerWidth - state.sidebarWidth - R0;
      sidebarDragState.grabOffsetX = e.clientX - panelLeft;
      sidebarDragState.startY = e.clientY - state.position.y;
      
      // 添加视觉反馈
      sb.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
      
      e.preventDefault();
      e.stopPropagation();
    };
  }
  
  // 全局 mousemove / mouseup（只注册一次：顶栏移动 + 底边拉伸）
  document.addEventListener('mousemove', e => {
    if (vResizeDrag.active) {
      const sb = $('#sb');
      if (!sb) return;
      const margin = 10;
      const y = state.position?.y ?? 0;
      const cap = Math.max(220, window.innerHeight - y - margin);
      const delta = e.clientY - vResizeDrag.startY;
      const nh = Math.max(220, Math.min(vResizeDrag.startH + delta, cap));
      state.sidebarFixedHeight = Math.round(nh);
      applySidebarLayout();
      return;
    }

    if (!sidebarDragState.isDragging) return;

    const sb = $('#sb');
    if (!sb) return;

    const panelLeft = e.clientX - sidebarDragState.grabOffsetX;
    let newR = window.innerWidth - state.sidebarWidth - panelLeft;
    const marginX = 8;
    newR = Math.max(0, Math.min(newR, window.innerWidth - state.sidebarWidth - marginX));
    const margin = 10;
    const panelH = sb.getBoundingClientRect().height || sb.offsetHeight || 100;
    const maxY = Math.max(0, window.innerHeight - panelH - margin);
    const newY = Math.max(0, Math.min(maxY, e.clientY - sidebarDragState.startY));

    state.position.x = newR;
    state.position.y = newY;

    sb.style.setProperty('--tw-x', newR + 'px');
    sb.style.setProperty('--tw-y', newY + 'px');
    sb.classList.toggle('tw-dock-flush', newR === 0);
    applySidebarLayout();
    updatePageContentGutter();
  });

  document.addEventListener('mouseup', () => {
    if (vResizeDrag.active) {
      vResizeDrag.active = false;
      $('#tw-resize-v')?.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      save();
      return;
    }

    if (!sidebarDragState.isDragging) return;

    const sb = $('#sb');
    if (sb) {
      sb.style.cursor = '';
      sb.classList.toggle('tw-dock-flush', (state.position?.x ?? 0) === 0);
    }
    document.body.style.userSelect = '';

    sidebarDragState.isDragging = false;
    updatePageContentGutter();
    save();
  });

  // ── BIND ALL EVENTS ──────────────────────────────────────────
  function bindAll(){
    const sb=$('#sb');

    // Theme selector
    root.querySelectorAll('.tw-th-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        const name = dot.dataset.theme;
        applyTheme(name); save();
        // update active dots
        root.querySelectorAll('.tw-th-dot').forEach(d => {
          const th = THEMES[d.dataset.theme];
          d.classList.toggle('active', d.dataset.theme === name);
          d.style.boxShadow = d.dataset.theme === name ? '0 0 6px '+th['--tw-accent'] : 'none';
          d.style.borderColor = d.dataset.theme === name ? 'var(--tw-text,#e8f4ff)' : 'transparent';
        });
      });
    });

    // Opacity
    $('#tw-op')?.addEventListener('input',e=>{
      state.opacity=parseFloat(e.target.value);
      const v=$('#tw-op-val');if(v)v.textContent=Math.round(state.opacity*100)+'%';
      applyOp(state.opacity);save();
    });

    root.querySelectorAll('.tw-fs-lvl').forEach((btn) => {
      btn.addEventListener('click', () => {
        const n = parseInt(btn.dataset.level, 10);
        if (n >= 1 && n <= 4) {
          state.fontSizeLevel = n;
          applyFontSizeLevel();
          save();
        }
      });
    });

    // Search
    const si=$('#tw-search'),sc=$('#tw-sc');
    si?.addEventListener('input',()=>{
      state.searchQuery=si.value;
      sc.style.display=si.value?'block':'none';
      render();
    });
    sc?.addEventListener('click',()=>{si.value='';state.searchQuery='';sc.style.display='none';render();si.focus();});

    // Toggle collapse
    $('#tw-tab')?.addEventListener('click',()=>{
      state.collapsed=!state.collapsed;
      sb.classList.toggle('collapsed',state.collapsed);
      $('#tw-tab').textContent=state.collapsed?'◀':'▶';
    });

    // Close
    $('#tw-close')?.addEventListener('click',()=>setMainSidebarOpen(false, true));

    // Language
    $('#tw-lang')?.addEventListener('click',cycleLang);

    // Footer buttons
    $('#tw-add-s')?.addEventListener('click',()=>openSnippetModal(null));
    $('#tw-add-g')?.addEventListener('click',()=>openGroupModal(null));

    // Keyword modal
    $('#tw-kw-open')?.addEventListener('click', openKwModal);
    $('#tw-kwm-close')?.addEventListener('click', ()=>$('#tw-kwm')?.classList.remove('open'));
    $('#tw-kwm')?.addEventListener('click', e=>{ if(e.target===e.currentTarget) $('#tw-kwm').classList.remove('open'); });
    $('#tw-kw-add')?.addEventListener('click', addCustomKeyword);
    $('#tw-kw-input')?.addEventListener('keydown', e=>{ if(e.key==='Enter'){e.preventDefault();addCustomKeyword();} });

    // Template modal
    $('#tw-template-open')?.addEventListener('click', openTemplateModal);
    $('#tw-tmpl-cancel')?.addEventListener('click', closeTemplateModal);
    $('#tw-template-modal')?.addEventListener('click', e=>{ if(e.target===e.currentTarget) closeTemplateModal(); });
    $('#tw-tmpl-generate')?.addEventListener('click', generateTemplate);
    $('#tw-tmpl-use')?.addEventListener('click', useTemplate);

    // AI palette（⚡）：主界面在 Side Panel 时必须在「当前网页」上打开蒙层，不能在本面板 Shadow 内打开
    $('#tw-ai-palette')?.addEventListener('click', () => {
      void (async () => {
        try {
          const res = await chrome.runtime.sendMessage({ type: 'TW_OPEN_PALETTE_ON_ACTIVE_TAB' });
          if (res?.ok) return;
          const err = res?.error || '';
          let msg;
          if (state.lang === 'en') {
            if (err === 'not_http_page') {
              msg = 'Quick mode only works on normal http(s) pages (not chrome:// or the extension UI).';
            } else if (err === 'inject_failed') {
              msg = 'Could not inject into this page. Try refreshing the tab.';
            } else if (err === 'disabled') {
              msg = 'Extension is disabled.';
            } else if (err === 'message_failed') {
              msg = 'Could not open quick mode. Try refreshing the page.';
            } else if (err === 'no_tab') {
              msg = 'No active tab.';
            } else {
              msg = 'Could not open quick mode.' + (err ? ` (${err})` : '');
            }
          } else if (state.lang === 'ko') {
            if (err === 'not_http_page') {
              msg = '빠른 모드는 일반 http(s) 페이지에서만 사용할 수 있습니다.';
            } else if (err === 'inject_failed') {
              msg = '페이지에 주입할 수 없습니다. 탭을 새로고침하세요.';
            } else if (err === 'disabled') {
              msg = '확장이 비활성화되어 있습니다.';
            } else if (err === 'message_failed') {
              msg = '빠른 모드를 열 수 없습니다. 페이지를 새로고침하세요.';
            } else if (err === 'no_tab') {
              msg = '활성 탭이 없습니다.';
            } else {
              msg = '빠른 모드를 열 수 없습니다.' + (err ? ` (${err})` : '');
            }
          } else {
            if (err === 'not_http_page') {
              msg = '快速模式只能在普通网页（http/https）使用，无法在 chrome:// 或扩展页打开。';
            } else if (err === 'inject_failed') {
              msg = '无法在本页注入脚本，请刷新标签页后重试。';
            } else if (err === 'disabled') {
              msg = '扩展已禁用。';
            } else if (err === 'message_failed') {
              msg = '快捷面板未能打开，请刷新网页后重试。';
            } else if (err === 'no_tab') {
              msg = '没有可用的活动标签页。';
            } else {
              msg = '无法打开快速模式。' + (err ? `（${err}）` : '');
            }
          }
          alert(msg);
        } catch (e) {
          alert(state.lang === 'en' ? String(e?.message || e) : state.lang === 'ko' ? String(e?.message || e) : `打开失败：${e?.message || e}`);
        }
      })();
    });

    // AI settings modal
    $('#tw-ai-settings')?.addEventListener('click', openAiSettings);
    $('#tw-ai-cancel')?.addEventListener('click', closeAiSettings);
    $('#tw-ai-modal')?.addEventListener('click', e=>{ if(e.target===e.currentTarget) closeAiSettings(); });
    $('#tw-ai-save')?.addEventListener('click', saveAiSettings);
    $('#tw-snippet-reset-counts')?.addEventListener('click', resetAllSnippetUseCounts);
    $('#tw-ai-open-persona')?.addEventListener('click', () => {
      closeAiSettings();
      setTimeout(() => openPersonaModal(true), 80);
    });
    $('#tw-ai-open-persona-2')?.addEventListener('click', () => {
      closeAiSettings();
      setTimeout(() => openPersonaModal(true), 80);
    });
    $('#tw-hdr-avatar')?.addEventListener('click', () => openPersonaModal(true));
    $('#tw-hdr-persona-fallback')?.addEventListener('click', () => openPersonaModal(true));
    $('#tw-ai-provider')?.addEventListener('change', (e)=> {
      const providerId = e.target.value;
      const prevProviderId = _aiProviderAtOpen || state.aiProvider || 'openai';
      renderAiModelOptions(providerId);
      const providers = getProviderCatalog();
      const selected = providers.find(p => p.id === providerId);
      const urlEl = $('#tw-ai-url');
      if (urlEl && selected?.defaultApiUrl) {
        const cur = urlEl.value || '';
        if (_shouldAutofillApiUrlOnProviderChange(prevProviderId, providerId, cur)) {
          urlEl.value = selected.defaultApiUrl;
          _aiUrlTouched = false;
        }
      }
      _aiProviderAtOpen = providerId;
      refreshAiConfigSummary();
      fillAiBasePresetSelect();
    });
    $('#tw-ai-base-preset')?.addEventListener('change', onAiBasePresetChange);
    $('#tw-ai-url')?.addEventListener('input', () => {
      _aiUrlTouched = true;
      refreshAiConfigSummary();
      syncAiBasePresetFromUrl();
    });
    $('#tw-ai-model')?.addEventListener('change', () => {
      fillAiBasePresetSelect();
      refreshAiConfigSummary();
    });
    $('#tw-ai-test')?.addEventListener('click', () => { void testAiConnection(); });

    // Hotkeys settings (AI settings modal)
    $('#tw-hk-platform')?.addEventListener('change', ()=>renderHotkeysUI());
    $('#tw-hk-palette-set')?.addEventListener('click', ()=>startHotkeyCapture('palette'));
    $('#tw-hk-rewrite-set')?.addEventListener('click', ()=>startHotkeyCapture('rewrite'));
    $('#tw-hk-shorten-set')?.addEventListener('click', ()=>startHotkeyCapture('shorten'));
    $('#tw-hk-translate-set')?.addEventListener('click', ()=>startHotkeyCapture('translate'));

    // AI optimize in snippet modal
    $('#tw-sm-ai')?.addEventListener('click', () => optimizeWithAi('google'));
    $('#tw-sm-ai-both')?.addEventListener('click', () => optimizeWithAi('both'));
    $('#tw-sm-restore')?.addEventListener('click', restoreOriginalContent);

    // Live preview for snippet content
    $('#tw-s-content')?.addEventListener('input', updateSnippetPreview);

    // Language selection modal
    $('#tw-lang-confirm')?.addEventListener('click', () => { void confirmLanguage(); });
    $('#tw-lang-sel')?.addEventListener('click', e=>{ if(e.target===e.currentTarget) closeLangModal(); });
    
    // Language option selection (single select)
    root.querySelectorAll('.tw-lang-option').forEach(opt => {
      opt.addEventListener('click', () => {
        root.querySelectorAll('.tw-lang-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
      });
    });

    // Scene selection modal
    $('#tw-scene-open')?.addEventListener('click', openSceneModal);
    $('#tw-scene-skip')?.addEventListener('click', ()=>{
      state.hasSeenOnboarding = true;
      save();
      closeSceneModal();
      offerPersonaWizardAfterScene();
    });
    $('#tw-scene-load')?.addEventListener('click', loadSceneTemplates);
    $('#tw-scene')?.addEventListener('click', e=>{ if(e.target===e.currentTarget) closeSceneModal(); });
    $('#tw-persona-modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) closePersonaModal(); });
    $('#tw-persona-save')?.addEventListener('click', savePersonaFromModal);
    $('#tw-persona-later')?.addEventListener('click', skipPersonaWizard);
    $('#tw-persona-gen-avatar')?.addEventListener('click', () => { void onPersonaGenAvatar(); });
    $('#tw-persona-ai-sum')?.addEventListener('click', () => { void onPersonaAiSummarize(); });
    $('#tw-persona-role-preset')?.addEventListener('change', () => {
      onTwPersonaRolePresetChange(true);
    });

    // Scene card selection (multi-select)
    root.querySelectorAll('.tw-scene-card').forEach(card => {
      card.addEventListener('click', () => {
        const scene = card.dataset.scene;
        if(state.selectedScenes.includes(scene)){
          // Deselect
          state.selectedScenes = state.selectedScenes.filter(s => s !== scene);
          card.classList.remove('selected');
        } else {
          // Select
          state.selectedScenes.push(scene);
          card.classList.add('selected');
        }
      });
    });

    // Import modal
    $('#tw-import')?.addEventListener('click',openImportModal);
    $('#tw-im-cancel')?.addEventListener('click',closeImportModal);
    $('#tw-im').addEventListener?.('click',e=>{if(e.target===e.currentTarget)closeImportModal();});
    $('#tw-im-fetch')?.addEventListener('click', async ()=>{
      const url = $('#tw-i-url').value.trim();
      if (!url) return;
      const btn = $('#tw-im-fetch');
      btn.textContent = '...'; btn.disabled = true;
      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const text = await resp.text();
        $('#tw-i-paste').value = text;
        btn.textContent = '✓ Fetched';
      } catch(e) {
        btn.textContent = t.importErr;
        btn.style.background = '#ff4466';
      }
      setTimeout(()=>{btn.textContent='⬇ Fetch URL';btn.disabled=false;btn.style.background='';},2000);
    });
    $('#tw-im-prompts-chat')?.addEventListener('click', async () => {
      const btn = $('#tw-im-prompts-chat');
      const url = TW_PROMPTS_CHAT_CSV_URL;
      $('#tw-i-url').value = url;
      const prev = btn?.textContent || '';
      if (btn) {
        btn.disabled = true;
        btn.textContent = '...';
      }
      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const text = await resp.text();
        $('#tw-i-paste').value = text;
        if (btn) btn.textContent = '✓ OK';
      } catch (e) {
        if (btn) {
          btn.textContent = t.importErr;
          btn.style.background = '#ff4466';
        }
      }
      setTimeout(() => {
        if (btn) {
          btn.textContent = prev || t.importPromptsChat;
          btn.disabled = false;
          btn.style.background = '';
        }
      }, 2200);
    });

    // Import from local JSON file
    $('#tw-i-file-btn')?.addEventListener('click', () => {
      $('#tw-i-file')?.click();
    });
    $('#tw-i-file')?.addEventListener('change', (e) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      $('#tw-i-file-name').textContent = file.name || '';
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result || '');
        $('#tw-i-paste').value = text;
      };
      reader.readAsText(file);
    });
    $('#tw-im-import')?.addEventListener('click', ()=>doImport());

    $('#tw-backup-open')?.addEventListener('click', openBackupModal);
    $('#tw-bak-close')?.addEventListener('click', closeBackupModal);
    $('#tw-bak-file-btn')?.addEventListener('click', () => {
      $('#tw-bak-file')?.click();
    });
    $('#tw-bak-file')?.addEventListener('change', (e) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      $('#tw-bak-file-name').textContent = file.name || '';
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result || '');
        $('#tw-bak-paste').value = text;
      };
      reader.readAsText(file);
    });
    $('#tw-bak')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeBackupModal();
    });
    $('#tw-bak-export')?.addEventListener('click', () => {
      const inc = $('#tw-bak-secrets')?.checked;
      downloadJson(
        `talkweb-backup-${new Date().toISOString().slice(0, 10)}.json`,
        buildFullBackupPayload(!!inc),
      );
      toast();
    });
    $('#tw-bak-export-folder')?.addEventListener('click', () => {
      exportTalkWebSourFolderToDownloads();
    });
    $('#tw-bak-pack-mail')?.addEventListener('click', packDownloadAndOpenMail);
    $('#tw-bak-copy-smb')?.addEventListener('click', copySmbShareGuide);
    $('#tw-bak-wd-upload')?.addEventListener('click', uploadBackupViaWebdav);
    $('#tw-bak-cp-post')?.addEventListener('click', uploadBackupViaCloudPost);
    $('#tw-bak-share-save')?.addEventListener('click', () => {
      readSharePrefsFromInputs();
      save();
      toast();
    });
    $('#tw-bak-folder-btn')?.addEventListener('click', () => {
      $('#tw-bak-folder')?.click();
    });
    $('#tw-bak-folder')?.addEventListener('change', (e) => {
      const fl = e.target?.files;
      if (fl?.length) void importTalkWebSourFolderFromFiles(fl);
      e.target.value = '';
    });
    $('#tw-bak-import')?.addEventListener('click', () => {
      const raw = ($('#tw-bak-paste')?.value || '').replace(/^\uFEFF/, '').trim();
      const btn = $('#tw-bak-import');
      if (!raw) {
        flashBackupErr(btn);
        return;
      }
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        flashBackupErr(btn);
        return;
      }
      if (parsed.format === 'talkweb-snippet') {
        if (importNewSnippetFromPaste(JSON.stringify(parsed))) {
          closeBackupModal();
          toast();
        } else flashBackupErr(btn);
        return;
      }
      if (parsed.format === 'talkweb-group') {
        if (importGroupFromPaste(JSON.stringify(parsed))) {
          closeBackupModal();
          toast();
        } else flashBackupErr(btn);
        return;
      }
      if (!isTalkwebBackup(parsed)) {
        flashBackupErr(btn);
        return;
      }
      const mode = root.querySelector('input[name="tw-bak-mode"]:checked')?.value || 'merge';
      const ok = mode === 'replace' ? applyReplaceBackup(parsed) : mergeBackupPayload(parsed);
      if (!ok) {
        flashBackupErr(btn);
        return;
      }
      render();
      closeBackupModal();
      toast();
    });
    $('#tw-bak-one-btn')?.addEventListener('click', () => {
      const raw = $('#tw-bak-one')?.value?.trim();
      if (!importNewSnippetFromPaste(raw)) flashBackupErr($('#tw-bak-one-btn'));
      else {
        closeBackupModal();
        toast();
      }
    });
    $('#tw-bak-grp-btn')?.addEventListener('click', () => {
      const raw = $('#tw-bak-grp')?.value?.trim();
      if (!importGroupFromPaste(raw)) flashBackupErr($('#tw-bak-grp-btn'));
      else {
        closeBackupModal();
        toast();
      }
    });

    // Snippet modal
    $('#tw-sm-json-apply')?.addEventListener('click', () => applySnippetJsonToForm());
    $('#tw-sm-save')?.addEventListener('click',saveSnippet);
    $('#tw-sm-cancel')?.addEventListener('click', () => closeSnippetModal('cancel'));

    // Group modal
    rebindGroupModal();

    // Keyboard
    root.addEventListener('keydown',e=>{
      if(e.key==='Escape'){
        if ($('#tw-sm')?.classList.contains('open')) {
          e.preventDefault();
          console.warn('[TalkwebSour]', t.snippetEscWarn || 'Esc ignored while snippet editor open');
          return;
        }
        closeGroupModal();closeVarModal();closeBackupModal();
      }
      if((e.key==='Enter')&&(e.ctrlKey||e.metaKey)){
        if($('#tw-gm')?.classList.contains('open')){e.preventDefault();saveGroup();}
        if($('#tw-vm')?.classList.contains('open')&&state.varEditingId){copySnippet(state.varEditingId);closeVarModal();}
      }
    });

    initResize();
    initSidebarDrag();
    initResizeVertical();

    window.TwBumpSnippetUseCount = bumpSnippetUseCount;
  }

  // ── KEYWORD MANAGEMENT ─────────────────────────────────────
  function openKwModal() {
    renderKwList();
    $('#tw-kwm').classList.add('open');
    setTimeout(()=>$('#tw-kw-input').focus(), 100);
  }
  function renderKwList() {
    const list = $('#tw-kw-list'); if (!list) return;
    const ck = state.customKeywords;
    const allTags = [
      ...((ck.lang||[]).map(w=>({w,type:'lang'}))),
      ...((ck.tone||[]).map(w=>({w,type:'tone'}))),
      ...((ck.task||[]).map(w=>({w,type:'task'}))),
    ];
    if (!allTags.length) {
      list.innerHTML = `<div class="tw-kw-empty">${t.kwEmpty}</div>`;
      return;
    }
    list.innerHTML = allTags.map(({w,type}) => {
      const s = KW_STYLE[type];
      return `<span class="tw-kw-tag" style="background:${s.bg};color:${s.color};border:1.5px solid ${s.border}">
        ${esc(w)}
        <button class="tw-kw-tag-del" data-w="${esc(w)}" data-type="${type}" title="删除">✕</button>
      </span>`;
    }).join('');
    list.querySelectorAll('.tw-kw-tag-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const w = btn.dataset.w, type = btn.dataset.type;
        state.customKeywords[type] = (state.customKeywords[type]||[]).filter(x=>x!==w);
        save(); renderKwList(); render();
      });
    });
  }
  function addCustomKeyword() {
    const input = $('#tw-kw-input');
    const typeEl = $('#tw-kw-type');
    const w = input.value.trim();
    const type = typeEl.value;
    if (!w) return;
    if (!state.customKeywords[type]) state.customKeywords[type] = [];
    if (!state.customKeywords[type].includes(w)) {
      state.customKeywords[type].push(w);
      save(); render();
    }
    input.value = '';
    renderKwList();
    input.focus();
  }

  // ── TEMPLATE MANAGEMENT ─────────────────────────────────────
  const TEMPLATE_EXAMPLES = {
    zh: [
      {role:'产品经理', work:'撰写需求文档', skills:'用户研究、数据分析', context:'互联网公司'},
      {role:'技术专家', work:'代码审查和架构设计', skills:'系统设计、性能优化', context:'软件开发团队'},
      {role:'内容创作者', work:'撰写文章和视频脚本', skills:'SEO优化、用户增长', context:'自媒体平台'},
    ],
    en: [
      {role:'Product Manager', work:'Write requirements docs', skills:'User research, Data analysis', context:'Tech company'},
      {role:'Tech Expert', work:'Code review and architecture', skills:'System design, Performance', context:'Dev team'},
      {role:'Content Creator', work:'Write articles and scripts', skills:'SEO, Growth hacking', context:'Social media'},
    ],
    ko: [
      {role:'제품 관리자', work:'요구사항 문서 작성', skills:'사용자 조사, 데이터 분석', context:'IT 회사'},
      {role:'기술 전문가', work:'코드 검토 및 아키텍처', skills:'시스템 설계, 성능 최적화', context:'개발팀'},
      {role:'콘텐츠 제작자', work:'글쓰기 및 스크립트', skills:'SEO, 성장 전략', context:'소셜 미디어'},
    ]
  };

  function openTemplateModal() {
    renderTemplateExamples();
    $('#tw-template-modal').classList.add('open');
    $('#tw-tmpl-role').value = '';
    $('#tw-tmpl-work').value = '';
    $('#tw-tmpl-skills').value = '';
    $('#tw-tmpl-context').value = '';
    $('#tw-tmpl-preview-wrap').style.display = 'none';
    $('#tw-tmpl-use').style.display = 'none';
    setTimeout(() => $('#tw-tmpl-role').focus(), 100);
    
    // 监听输入变化，显示生成按钮
    ['#tw-tmpl-role', '#tw-tmpl-work', '#tw-tmpl-skills', '#tw-tmpl-context'].forEach(sel => {
      const el = $(sel);
      if (el) {
        el.oninput = () => {
          const hasInput = $('#tw-tmpl-role').value.trim() || $('#tw-tmpl-work').value.trim();
          $('#tw-tmpl-generate').style.display = hasInput ? 'block' : 'block';
        };
      }
    });
  }

  function closeTemplateModal() {
    $('#tw-template-modal')?.classList.remove('open');
  }

  function renderTemplateExamples() {
    const container = $('#tw-tmpl-examples');
    if (!container) return;
    
    const examples = TEMPLATE_EXAMPLES[state.lang] || TEMPLATE_EXAMPLES.zh;
    container.innerHTML = examples.map((ex, i) => `
      <button class="tw-var-opt" data-idx="${i}" style="font-size:10px;padding:4px 10px">
        ${esc(ex.role)}
      </button>
    `).join('');
    
    container.querySelectorAll('.tw-var-opt').forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.dataset.idx);
        const ex = examples[idx];
        $('#tw-tmpl-role').value = ex.role;
        $('#tw-tmpl-work').value = ex.work;
        $('#tw-tmpl-skills').value = ex.skills;
        $('#tw-tmpl-context').value = ex.context;
      };
    });
  }

  function generateTemplate() {
    const role = $('#tw-tmpl-role').value.trim();
    const work = $('#tw-tmpl-work').value.trim();
    const skills = $('#tw-tmpl-skills').value.trim();
    const context = $('#tw-tmpl-context').value.trim();
    
    if (!role && !work) {
      return;
    }
    
    let prompt = '';
    if (state.lang === 'zh') {
      prompt = `你是一位${role || '专业助手'}`;
      if (context) prompt += `，专注于${context}领域`;
      prompt += `。\n\n`;
      if (work) prompt += `主要工作内容：${work}\n`;
      if (skills) prompt += `核心技能：${skills}\n`;
      prompt += `\n请以专业、${role ? role : '专家'}的视角，`;
      if (work) prompt += `结合${work}的经验，`;
      prompt += `为我提供高质量的建议和解答。\n\n我的问题/需求是：\n`;
    } else if (state.lang === 'en') {
      prompt = `You are a ${role || 'professional assistant'}`;
      if (context) prompt += ` specializing in ${context}`;
      prompt += `.\n\n`;
      if (work) prompt += `Main responsibilities: ${work}\n`;
      if (skills) prompt += `Core skills: ${skills}\n`;
      prompt += `\nPlease provide high-quality advice from a professional ${role || 'expert'} perspective`;
      if (work) prompt += ` with experience in ${work}`;
      prompt += `.\n\nMy question/request:\n`;
    } else {
      prompt = `당신은 ${role || '전문 어시스턴트'}입니다`;
      if (context) prompt += `, ${context} 분야 전문`;
      prompt += `.\n\n`;
      if (work) prompt += `주요 업무: ${work}\n`;
      if (skills) prompt += `핵심 기술: ${skills}\n`;
      prompt += `\n전문 ${role || '전문가'}의 관점에서`;
      if (work) prompt += ` ${work} 경험을 바탕으로`;
      prompt += ` 고품질 조언을 제공해주세요.\n\n질문/요청:\n`;
    }
    
    $('#tw-tmpl-preview').textContent = prompt;
    $('#tw-tmpl-preview-wrap').style.display = 'block';
    $('#tw-tmpl-use').style.display = 'block';
    
    const tmplDefRole = state.lang === 'zh' ? '助手' : state.lang === 'ko' ? '어시스턴트' : 'Assistant';
    const tmplDefWork = state.lang === 'zh' ? '通用' : state.lang === 'ko' ? '일반' : 'General';
    state.currentTemplate = {
      title: `${role || tmplDefRole} - ${work || tmplDefWork}`,
      content: prompt,
      role, work, skills, context
    };
  }

  function useTemplate() {
    if (!state.currentTemplate) return;
    
    const snippet = {
      id: uid(),
      title: state.currentTemplate.title,
      content: state.currentTemplate.content,
      groupId: null,
      createdAt: Date.now(),
    };
    
    state.snippets.unshift(snippet);
    save();
    render();
    closeTemplateModal();
    toast();
  }

  // ── AI API INTEGRATION ──────────────────────────────────────
  function openAiSettings() {
    $('#tw-ai-key').value = state.aiApiKey;
    $('#tw-ai-url').value = state.aiApiUrl;
    renderAiProviderOptions();
    $('#tw-ai-provider').value = state.aiProvider || 'openai';
    renderAiModelOptions($('#tw-ai-provider').value);
    if (state.aiModel)     $('#tw-ai-model').value = state.aiModel;
    $('#tw-hk-platform') && ($('#tw-hk-platform').value = isMacLike() ? 'mac' : 'win');
    renderHotkeysUI();
    // 打开时重置「是否手动改过 API 地址」标记
    _aiProviderAtOpen = $('#tw-ai-provider')?.value || (state.aiProvider || 'openai');
    _aiUrlTouched = false;
    refreshAiConfigSummary();
    const _ts = $('#tw-ai-test-status');
    if (_ts) { _ts.textContent = ''; _ts.style.color = 'var(--tw-muted,#6a8aaa)'; }
    const _scroll = $('.tw-settings-scroll');
    if (_scroll) _scroll.scrollTop = 0;
    fillAiBasePresetSelect();
    const sortCb = $('#tw-snippet-sort-score');
    if (sortCb) sortCb.checked = state.snippetSortByScore !== false;
    const dangerCb = $('#tw-snippet-danger-clear-all');
    if (dangerCb) dangerCb.checked = false;
    $('#tw-ai-modal').classList.add('open');
    setTimeout(() => $('#tw-ai-key').focus(), 100);
  }

  function normalizeUrlForPresetMatch(u) {
    return String(u || '').trim().replace(/\/+$/g, '');
  }

  /** 按服务商（及模型）返回常用 Base URL，供下拉选择；最后一项为自定义由 UI 追加 */
  function getApiBaseUrlPresets(providerId, modelId) {
    const lang = state.lang || 'zh';
    const L = (a, b, c) => (lang === 'zh' ? a : lang === 'ko' ? c : b);
    const m = (id, url, label) => ({ id, url, label });
    const mid = String(modelId || '').toLowerCase();

    switch (providerId) {
      case 'qianwen': {
        let presets = [
          m('qw-bj-native', 'https://dashscope.aliyuncs.com/api/v1', L('北京 · 原生 api/v1', 'Beijing · native api/v1', '베이징 · 네이티브')),
          m('qw-bj-compat', 'https://dashscope.aliyuncs.com/compatible-mode/v1', L('北京 · OpenAI 兼容', 'Beijing · OpenAI-compatible', '베이징 · 호환')),
          m('qw-sg-native', 'https://dashscope-intl.aliyuncs.com/api/v1', L('新加坡 · 原生 api/v1', 'Singapore · native', '싱가포르 · 네이티브')),
          m('qw-sg-compat', 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', L('新加坡 · OpenAI 兼容', 'Singapore · OpenAI-compatible', '싱가포르 · 호환')),
          m('qw-us-native', 'https://dashscope-us.aliyuncs.com/api/v1', L('美国（弗吉尼亚）· 原生', 'US (Virginia) · native', '미국 · 네이티브')),
          m('qw-us-compat', 'https://dashscope-us.aliyuncs.com/compatible-mode/v1', L('美国 · OpenAI 兼容', 'US · OpenAI-compatible', '미국 · 호환')),
          m('qw-hk-native', 'https://cn-hongkong.dashscope.aliyuncs.com/api/v1', L('中国香港 · 原生', 'Hong Kong · native', '홍콩 · 네이티브')),
          m('qw-hk-compat', 'https://cn-hongkong.dashscope.aliyuncs.com/compatible-mode/v1', L('中国香港 · OpenAI 兼容', 'Hong Kong · OpenAI-compatible', '홍콩 · 호환')),
          m('qw-coding', 'https://coding.dashscope.aliyuncs.com/compatible-mode/v1', L('Coding 套餐 · 兼容模式', 'Coding plan · compatible', 'Coding 플랜 · 호환')),
        ];
        if (/coder|qwen.*code|code.*qwen|code-flash|code-turbo/i.test(mid)) {
          const coding = presets.find((p) => p.id === 'qw-coding');
          if (coding) presets = [coding, ...presets.filter((p) => p.id !== 'qw-coding')];
        }
        return presets;
      }
      case 'openai':
        return [
          m('oa-official', 'https://api.openai.com/v1', L('OpenAI 官方', 'OpenAI official', 'OpenAI 공식')),
          m('oa-azure-ph', 'https://YOUR_RESOURCE.openai.azure.com/openai/v1', L('Azure OpenAI（替换 YOUR_RESOURCE）', 'Azure OpenAI (replace YOUR_RESOURCE)', 'Azure(YOUR_RESOURCE 교체)')),
          m('oa-groq', 'https://api.groq.com/openai/v1', 'Groq'),
          m('oa-together', 'https://api.together.xyz/v1', 'Together AI'),
          m('oa-or', 'https://openrouter.ai/api/v1', 'OpenRouter'),
          m('oa-mistral', 'https://api.mistral.ai/v1', 'Mistral'),
          m('oa-deepinfra', 'https://api.deepinfra.com/v1/openai', 'DeepInfra'),
          m('oa-fireworks', 'https://api.fireworks.ai/inference/v1', 'Fireworks'),
          m('oa-xai', 'https://api.x.ai/v1', 'xAI (Grok)'),
          m('oa-perp', 'https://api.perplexity.ai', 'Perplexity'),
          m('oa-silicon', 'https://api.siliconflow.cn/v1', L('硅基流动 SiliconFlow', 'SiliconFlow', 'SiliconFlow')),
          m('oa-moonshot', 'https://api.moonshot.cn/v1', 'Moonshot (Kimi)'),
          m('oa-zhipu', 'https://open.bigmodel.cn/api/paas/v4', L('智谱 GLM（OpenAI 兼容）', 'Zhipu GLM (OpenAI-compat)', 'Zhipu GLM')),
          m('oa-novita', 'https://api.novita.ai/v1', 'Novita'),
          m('oa-nebius', 'https://api.studio.nebius.ai/v1', 'Nebius'),
          m('oa-cerebras', 'https://api.cerebras.ai/v1', 'Cerebras'),
          m('oa-lepton', 'https://api.lepton.ai/v1', 'Lepton'),
          m('oa-deepseek', 'https://api.deepseek.com/v1', L('DeepSeek（OpenAI 兼容入口）', 'DeepSeek (OpenAI-compat)', 'DeepSeek')),
        ];
      case 'gemini':
        return [
          m('gm-gl', 'https://generativelanguage.googleapis.com', L('Google AI Studio（generativelanguage）', 'Google AI Studio (generativelanguage)', 'Google AI Studio')),
          m('gm-vertex-ph', 'https://us-central1-aiplatform.googleapis.com', L('Vertex AI 示例根（需改地区/鉴权）', 'Vertex sample root (change region & auth)', 'Vertex 예시(지역·인증 수정)')),
        ];
      case 'claude':
        return [
          m('cl-official', 'https://api.anthropic.com', L('Anthropic 官方', 'Anthropic official', 'Anthropic 공식')),
          m('cl-or', 'https://openrouter.ai/api/v1', L('OpenRouter', 'OpenRouter', 'OpenRouter')),
        ];
      case 'deepseek':
        return [
          m('ds-official', 'https://api.deepseek.com/v1', L('DeepSeek 官方', 'DeepSeek official', 'DeepSeek 공식')),
          m('ds-silicon', 'https://api.siliconflow.cn/v1', L('SiliconFlow 等聚合', 'SiliconFlow / hub', 'SiliconFlow')),
        ];
      case 'ollama':
        return [
          m('ol-local', 'http://localhost:11434/v1', L('本机 localhost', 'Localhost', 'localhost')),
          m('ol-loop', 'http://127.0.0.1:11434/v1', '127.0.0.1'),
        ];
      default:
        return [];
    }
  }

  function collectAiBaseUrlPresets() {
    const pid = $('#tw-ai-provider')?.value || '';
    const modelId = $('#tw-ai-model')?.value || '';
    const lang = state.lang || 'zh';
    const L = (a, b, c) => (lang === 'zh' ? a : lang === 'ko' ? c : b);
    let presets = getApiBaseUrlPresets(pid, modelId);
    if (!presets.length) {
      const meta = getProviderMeta(pid);
      if (meta.defaultApiUrl) {
        presets = [{ id: 'catalog-default', url: meta.defaultApiUrl, label: L('服务商默认地址', 'Provider default URL', '공급자 기본 URL') }];
      }
    }
    return presets;
  }

  function fillAiBasePresetSelect() {
    const sel = $('#tw-ai-base-preset');
    if (!sel) return;
    const presets = collectAiBaseUrlPresets();
    const customLbl = t.aiBaseUrlCustom;
    sel.innerHTML = [
      ...presets.map((o) => `<option value="${esc(o.id)}">${esc(o.label)}</option>`),
      `<option value="__custom">${esc(customLbl)}</option>`,
    ].join('');
    syncAiBasePresetFromUrl();
    const qh = $('#tw-ai-qwen-url-hint');
    if (qh) qh.style.display = ($('#tw-ai-provider')?.value || '') === 'qianwen' ? '' : 'none';
    const mh = $('#tw-ai-base-preset-model-hint');
    if (mh) {
      const pid = $('#tw-ai-provider')?.value || '';
      const show = (pid === 'qianwen' || pid === 'openai' || pid === 'gemini') && presets.length > 1;
      mh.style.display = show ? '' : 'none';
      mh.textContent = t.aiBaseUrlModelHint;
    }
  }

  function syncAiBasePresetFromUrl() {
    const sel = $('#tw-ai-base-preset');
    if (!sel) return;
    const url = ($('#tw-ai-url')?.value || '').trim();
    const presets = collectAiBaseUrlPresets();
    const norm = normalizeUrlForPresetMatch(url);
    const hit = presets.find((o) => normalizeUrlForPresetMatch(o.url) === norm);
    sel.value = hit ? hit.id : '__custom';
  }

  function onAiBasePresetChange(e) {
    const id = e.target?.value;
    if (!id || id === '__custom') return;
    const presets = collectAiBaseUrlPresets();
    const hit = presets.find((o) => o.id === id);
    if (!hit) return;
    const urlEl = $('#tw-ai-url');
    if (urlEl) urlEl.value = hit.url;
    _aiUrlTouched = false;
    refreshAiConfigSummary();
  }

  function qianwen401ExtraHint() {
    if (state.lang === 'zh') {
      return '\n\n【千问 401 排查】（通用 sk- Key）\n'
        + '1) 百炼控制台右上角「地域」必须与 Base URL 一致：新加坡 Key 须选「新加坡」地址，北京 Key 须选「北京」地址。\n'
        + '2) 在设置里用「常用 Base URL」或手动修改地址，使地域与 Key 一致，保存后再测连接。\n'
        + '3) 确认使用控制台「API-Key」而非 RAM AccessKey；若 Key 启用了 IP 白名单，当前网络须在名单内。\n'
        + '4) 仅当 Key 为 sk-sp- 开头时才是 Coding Plan，需用套餐文档中的 Base URL（与通用 sk- 不同）。';
    }
    if (state.lang === 'ko') {
      return '\n\n【Qwen 401】일반 sk- 키\n'
        + '1) 콘솔 우상단「리전」과 Base URL이 일치해야 합니다(싱가포르 키 → 싱가포르 엔드포인트 등).\n'
        + '2) 설정에서 Base URL을 리전에 맞게 저장한 뒤 연결을 다시 테스트하세요.\n'
        + '3) RAM AccessKey가 아니라 콘솔「API-Key」를 사용하세요. IP 허용 목록이 있으면 현재 네트워크가 포함되어야 합니다.\n'
        + '4) sk-sp- 로 시작하면 Coding Plan 전용이며, 해당 플랜 문서의 Base URL을 써야 합니다(일반 sk- 와 다름).';
    }
    return '\n\n[Qwen 401] For standard sk- keys: match console region to Base URL (e.g. Singapore → dashscope-intl). Use console API-Key; check IP allowlist. sk-sp-* only: use Coding Plan base URL.';
  }

  function getProviderCatalog() {
    const fallback = [
      { id: 'openai', name: 'ChatGPT (OpenAI)', defaultApiUrl: 'https://api.openai.com/v1', models: ['gpt-5.2-mini', 'gpt-5-mini', 'gpt-4.1', 'gpt-4o', 'gpt-4o-mini', 'o4-mini', 'o3-mini', 'gpt-3.5-turbo'] },
      { id: 'gemini', name: 'Gemini', defaultApiUrl: 'https://generativelanguage.googleapis.com', models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
      { id: 'claude', name: 'Claude', defaultApiUrl: 'https://api.anthropic.com', models: ['claude-sonnet-4-20250514', 'claude-3-7-sonnet-latest', 'claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'] },
      { id: 'qianwen', name: '千问 (Qwen)', defaultApiUrl: 'https://dashscope.aliyuncs.com/api/v1', models: ['qwen3.6-plus', 'qwen3.6-flash', 'qwen3.5-plus', 'qwen3.5-flash', 'qwen3-max', 'qwen-max', 'qwen-plus', 'qwen-turbo'] },
      { id: 'deepseek', name: 'DeepSeek', defaultApiUrl: 'https://api.deepseek.com/v1', models: ['deepseek-chat', 'deepseek-reasoner'] },
      { id: 'ollama', name: 'Ollama (本地)', defaultApiUrl: 'http://localhost:11434/v1', models: ['llama3.3', 'llama3.2', 'qwen2.5', 'deepseek-r1'] },
    ];
    if (!window.createAIClient?.listProviders) return fallback;
    try {
      return createAIClient.listProviders().map(p => ({
        id: p.id,
        name: p.name,
        defaultApiUrl: p.defaultApiUrl || '',
        models: (p.models || []).map(m => m.id),
      }));
    } catch (_) {
      return fallback;
    }
  }

  function renderAiProviderOptions() {
    const sel = $('#tw-ai-provider');
    if (!sel) return;
    const providers = getProviderCatalog();
    sel.innerHTML = providers.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  }

  function renderAiModelOptions(providerId) {
    const modelSel = $('#tw-ai-model');
    if (!modelSel) return;
    const providers = getProviderCatalog();
    const provider = providers.find(p => p.id === providerId) || providers[0];
    const models = provider?.models || [];
    modelSel.innerHTML = models.map(mid => `<option value="${mid}">${esc(mid)}</option>`).join('');
  }

  function getProviderMeta(providerId) {
    if (window.createAIClient?.listProviders) {
      try {
        const p = createAIClient.listProviders().find(x => x.id === providerId);
        if (p) {
          const mid = p.models?.[0]?.id || p.defaultModel || '';
          return {
            name:           p.name || providerId,
            defaultApiUrl:  p.defaultApiUrl || '',
            defaultModel:   p.defaultModel || mid,
          };
        }
      } catch (_) {}
    }
    const cat = getProviderCatalog();
    const c = cat.find(x => x.id === providerId) || cat[0];
    return {
      name:           c?.name || providerId,
      defaultApiUrl:  c?.defaultApiUrl || '',
      defaultModel:   c?.models?.[0] || '',
    };
  }

  function defaultApiUrlForSavedProvider(providerId) {
    const u = getProviderMeta(providerId).defaultApiUrl;
    return u || 'https://api.openai.com/v1';
  }

  /** 保存/测试前统一去掉 BOM、首尾空白、误粘贴的 Bearer 前缀 */
  function normalizeStoredApiKey(key) {
    let s = String(key || '').replace(/^\uFEFF/, '');
    s = s.replace(/[\u200B-\u200D\uFEFF]/g, '');
    s = s.split(/\r?\n/)[0].trim();
    if (/^bearer\s+/i.test(s)) s = s.replace(/^bearer\s+/i, '').trim();
    return s;
  }

  function normalizeApiUrl(providerId, rawUrl) {
    const v = (rawUrl || '').trim();
    if (!v) return '';
    try {
      const u = new URL(v);
      // 去掉误粘贴的 /chat/completions，避免与客户端再次拼接成双路径
      let path = u.pathname.replace(/\/+$/g, '');
      if (/\/chat\/completions$/i.test(path)) {
        path = path.replace(/\/chat\/completions$/i, '') || '/';
      }
      if (providerId === 'qianwen' && /\/services\/aigc\//i.test(path)) {
        path = path.replace(/\/services\/aigc\/.*$/i, '') || '/';
      }
      // Gemini：这里应当只填“站点根”（不要带 /v1... 或具体方法路径）
      if (providerId === 'gemini') {
        return u.origin;
      }

      // OpenAI/兼容：允许用户粘贴完整 endpoint，自动归一到 /v1
      // 例如：https://api.openai.com/v1/chat/completions → https://api.openai.com/v1
      const m = path.match(/^(\/v\d+)(\/|$)/);
      if (m?.[1]) return `${u.origin}${m[1]}`;

      // 其他情况：保留 origin + pathname（去掉结尾 /），避免误删自定义网关前缀
      const p = path.replace(/\/+$/g, '');
      return `${u.origin}${p}`;
    } catch (_) {
      // 非标准 URL（比如用户填了 localhost 没协议等）就原样返回
      return v;
    }
  }

  // AI 设置弹窗内：用于判断 API 地址是否由用户手动修改过
  let _aiUrlTouched = false;
  let _aiProviderAtOpen = 'openai';

  function _shouldAutofillApiUrlOnProviderChange(prevProviderId, nextProviderId, currentUrl) {
    const cur = (currentUrl || '').trim();
    if (!cur) return true;
    if (!_aiUrlTouched) return true;
    // 若当前 URL 等于上一个服务商的默认 URL，则认为用户未锁定地址：自动切换到新默认
    const prevDefault = defaultApiUrlForSavedProvider(prevProviderId);
    if (cur === prevDefault) return true;
    // 兼容常见起步：从 OpenAI 默认切换到其他服务商时，通常希望自动替换
    if (prevProviderId === 'openai' && cur === 'https://api.openai.com/v1') return true;
    return false;
  }

  function refreshAiConfigSummary() {
    const el = $('#tw-ai-cfg-summary');
    if (!el) return;
    const pid = $('#tw-ai-provider')?.value || 'openai';
    const urlIn = ($('#tw-ai-url')?.value || '').trim();
    const modelIn = ($('#tw-ai-model')?.value || '').trim();
    const meta = getProviderMeta(pid);
    const apiUrlRaw = urlIn || meta.defaultApiUrl || defaultApiUrlForSavedProvider(pid);
    const apiUrl = normalizeApiUrl(pid, apiUrlRaw) || apiUrlRaw;
    const model = modelIn || meta.defaultModel || '';
    const lines = [
      `${t.aiSumProvider}: ${meta.name} (${pid})`,
      `${t.aiSumBase}: ${apiUrl}`,
      `${t.aiSumModel}: ${model}`,
    ];
    if (pid === 'gemini') {
      lines.push(`${t.aiSumGeminiPath}:\n${apiUrl}/v1beta/models/${model}:streamGenerateContent?key=***`);
    }
    el.textContent = lines.join('\n');
  }

  async function testAiConnection() {
    const btn = $('#tw-ai-test');
    const statusEl = $('#tw-ai-test-status');
    if (!window.createAIClient) {
      alert(t.aiModuleNotReady);
      return;
    }
    const key = normalizeStoredApiKey($('#tw-ai-key')?.value || '');
    if (!key) {
      alert(t.aiTestNeedKey);
      return;
    }
    const pid = $('#tw-ai-provider')?.value || 'openai';
    const urlRaw = ($('#tw-ai-url')?.value || '').trim();
    const modelRaw = ($('#tw-ai-model')?.value || '').trim();
    const urlNorm = normalizeApiUrl(pid, urlRaw);
    const prevBtn = btn?.textContent;
    if (btn) {
      btn.disabled = true;
      btn.textContent = t.aiTesting;
    }
    if (statusEl) {
      statusEl.textContent = '';
      statusEl.style.color = 'var(--tw-muted,#6a8aaa)';
    }
    try {
      const client = createAIClient({
        provider: pid,
        apiKey:   key,
        apiUrl:   urlNorm,
        model:    modelRaw,
      });
      const r = await client.generateFull('.', { maxTokens: 24 });
      const pingLine = state.lang === 'en'
        ? `${t.aiTestOk} (${r.elapsed_ms} ms · ${r.model})`
        : state.lang === 'ko'
          ? `${t.aiTestOk} (${r.elapsed_ms} ms · ${r.model})`
          : `${t.aiTestOk}（${r.elapsed_ms} ms · ${r.model}）`;
      if (statusEl) {
        statusEl.textContent = `${pingLine}\n${t.aiTestProbe}`;
        statusEl.style.color = 'var(--tw-muted,#6a8aaa)';
      }
      if (btn) btn.textContent = t.aiTestProbe;

      const probeLang = state.lang || 'zh';
      const probeMsg =
        probeLang === 'zh'
          ? '请用一两句话回答：你当前的模型名称或代号是什么？如实说明，不要编造。'
          : probeLang === 'ko'
            ? '한두 문장으로 답하세요: 사용 중인 모델의 공식 이름은 무엇인가요? 사실만 말하세요.'
            : 'In one or two short sentences, state your current model name as officially known. Be factual; do not invent.';

      const r2 = await client.generateFull(probeMsg, { maxTokens: 256 });
      const replyRaw = (r2.text || '').trim();
      const replyEmpty = probeLang === 'zh' ? '（无文本返回）' : probeLang === 'ko' ? '(응답 없음)' : '(No text returned)';
      const reply = replyRaw || replyEmpty;

      const okMsg = `${pingLine}\n${t.aiTestReplyTitle}:\n${reply}`;
      if (statusEl) {
        statusEl.textContent = okMsg;
        statusEl.style.color = '#00cc88';
      }
    } catch (e) {
      let detail = e?.message || String(e);
      if (e?.status != null) detail += ` [HTTP ${e.status}]`;
      if (e?.body) {
        const b = String(e.body).replace(/\s+/g, ' ').trim().slice(0, 600);
        if (b) detail += `\n${b}`;
      }
      if (pid === 'qianwen' && String(e?.body || '').includes('invalid_api_key')) {
        detail += qianwen401ExtraHint();
      }
      if (statusEl) {
        statusEl.textContent = detail;
        statusEl.style.color = '#ff6b6b';
      }
      alert(detail);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = prevBtn || t.aiTestConn;
      }
    }
  }

  let _hkCapturing = false;
  let _hkCaptureAction = null;
  let _hkCapturePlatform = null;
  function renderHotkeysUI() {
    const pf = $('#tw-hk-platform')?.value || (isMacLike() ? 'mac' : 'win');
    const hk = state.hotkeys?.[pf] || {};
    $('#tw-hk-palette') && ($('#tw-hk-palette').value = formatHotkey(hk.palette));
    $('#tw-hk-rewrite') && ($('#tw-hk-rewrite').value = formatHotkey(hk.rewrite));
    $('#tw-hk-shorten') && ($('#tw-hk-shorten').value = formatHotkey(hk.shorten));
    $('#tw-hk-translate') && ($('#tw-hk-translate').value = formatHotkey(hk.translate));

    // 立即刷新 ⚡ 按钮悬浮提示
    $('#tw-ai-palette')?.setAttribute('title', hotkeyPaletteTitle());
  }

  function startHotkeyCapture(action) {
    if (_hkCapturing) return;
    const pf = $('#tw-hk-platform')?.value || (isMacLike() ? 'mac' : 'win');
    if (!state.hotkeys?.[pf]) return;

    const input = action === 'palette'
      ? $('#tw-hk-palette')
      : action === 'rewrite'
        ? $('#tw-hk-rewrite')
        : action === 'shorten'
          ? $('#tw-hk-shorten')
          : $('#tw-hk-translate');

    _hkCapturing = true;
    _hkCaptureAction = action;
    _hkCapturePlatform = pf;
    window.__TW_HOTKEY_CAPTURING = true;

    const prevVal = input?.value || '';
    if (input) input.value = t.hkPressCombo || '…';
    const handler = (e) => {
      try {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      } catch (_) {}

      if (e.key === 'Escape') {
        if (input) input.value = prevVal;
        cleanup();
        return;
      }

      // 忽略单独的修饰键
      const onlyMods =
        (e.code === 'ShiftLeft' || e.code === 'ShiftRight') ||
        (e.code === 'AltLeft' || e.code === 'AltRight') ||
        (e.code === 'ControlLeft' || e.code === 'ControlRight') ||
        (e.code === 'MetaLeft' || e.code === 'MetaRight');
      if (onlyMods) return;

      state.hotkeys[_hkCapturePlatform][_hkCaptureAction] = {
        code: e.code,
        key: e.key,
        modifiers: {
          meta: !!e.metaKey,
          ctrl: !!e.ctrlKey,
          alt: !!e.altKey,
          shift: !!e.shiftKey,
        },
      };

      save();
      renderHotkeysUI();
      const toastEl = $('#tw-toast');
      if (toastEl) {
        const old = toastEl.textContent;
        toastEl.textContent = t.hkSaved || '✓';
        toast();
        setTimeout(() => { toastEl.textContent = old; }, 1900);
      } else {
        toast();
      }
      cleanup();
    };

    function cleanup() {
      _hkCapturing = false;
      _hkCaptureAction = null;
      _hkCapturePlatform = null;
      window.__TW_HOTKEY_CAPTURING = false;
      document.removeEventListener('keydown', handler, true);
    }

    document.addEventListener('keydown', handler, true);
  }

  function closeAiSettings() {
    $('#tw-ai-modal')?.classList.remove('open');
  }

  function saveAiSettings() {
    state.aiApiKey = normalizeStoredApiKey($('#tw-ai-key').value);
    state.aiProvider = $('#tw-ai-provider')?.value || 'openai';
    state.aiModel = $('#tw-ai-model')?.value || '';
    const urlTrim = $('#tw-ai-url').value.trim();
    const urlRaw = urlTrim || defaultApiUrlForSavedProvider(state.aiProvider);
    // 保存时一并归一化，避免把完整 endpoint 当成 baseUrl
    state.aiApiUrl = normalizeApiUrl(state.aiProvider, urlRaw) || urlRaw;
    state.snippetSortByScore = !!$('#tw-snippet-sort-score')?.checked;
    save();
    closeAiSettings();
    render();
    toast();
  }

  function resetAllSnippetUseCounts() {
    const clearAll = !!$('#tw-snippet-danger-clear-all')?.checked;
    const msg = clearAll
      ? (t.snippetDangerClearAllConfirm || '确认删除全部？')
      : (t.snippetResetCountsConfirm || '确认清零？');
    showConfirm(msg, () => {
      if (clearAll) {
        state.snippets = [];
        state.groups = [];
        state.varValues = {};
        state.originalContent = {};
      } else {
        state.snippets = state.snippets.map((s) => ({ ...s, useCount: 0 }));
      }
      save();
      render();
      try { window.TwAiRewrite?.refreshPaletteIfOpen?.(); } catch (_) {}
      const toastEl = $('#tw-toast');
      if (toastEl) {
        const prev = toastEl.textContent;
        toastEl.textContent = clearAll
          ? (t.snippetDangerClearAllDone || '✓ Done')
          : (t.snippetResetCountsDone || '✓ Done');
        toastEl.classList.add('show');
        setTimeout(() => {
          toastEl.classList.remove('show');
          toastEl.textContent = prev;
        }, 1600);
      } else {
        toast();
      }
    });
  }

  // 切换 AI 面板模式（供 render.js 调用）
  window.toggleAiPaletteMode = function() {
    state.aiPaletteMode = state.aiPaletteMode === 'compact' ? 'full' : 'compact';
    save();
    return state.aiPaletteMode;
  };

  /** 快速模式右上角「S」：常用网页快捷方式（存 chrome.storage.local） */
  const TW_DEFAULT_MERMAID_SHORTCUT =
    'https://www.processon.com/mermaid?gad_source=1&gad_campaignid=23455398370&gbraid=0AAAAA-PYQFZu1I3-Y1BquFNNiAQZYBsPI&gclid=CjwKCAjw14zPBhAuEiwAP3-Eb5C9bU_nIRWBO9_d7ND5Hkq1EZFDK5SSP8R9bEcmtr0m5n_kIY8x-xoCwC0QAvD_BwE';
  window.TwPaletteShortcutsApi = {
    defaultUrl() {
      return TW_DEFAULT_MERMAID_SHORTCUT;
    },
    load(done) {
      try {
        chrome.storage.local.get({ tw_palette_shortcuts: null }, (r) => {
          let list = r.tw_palette_shortcuts;
          if (!Array.isArray(list) || list.length === 0) {
            list = [{ label: 'ProcessOn · Mermaid', url: TW_DEFAULT_MERMAID_SHORTCUT }];
          } else {
            list = list
              .map((x) => ({
                label: String(x?.label || '').trim(),
                url: String(x?.url || '').trim(),
              }))
              .filter((x) => /^https?:\/\//i.test(x.url))
              .map((x) => ({
                label: x.label || _twHostLabelFromUrl(x.url),
                url: x.url,
              }));
          }
          if (!list.length) {
            list = [{ label: 'ProcessOn · Mermaid', url: TW_DEFAULT_MERMAID_SHORTCUT }];
          }
          done(list);
        });
      } catch (_) {
        done([{ label: 'ProcessOn · Mermaid', url: TW_DEFAULT_MERMAID_SHORTCUT }]);
      }
    },
    save(list, done) {
      const clean = (Array.isArray(list) ? list : [])
        .map((x) => ({
          label: String(x?.label || '').trim(),
          url: String(x?.url || '').trim(),
        }))
        .filter((x) => /^https?:\/\//i.test(x.url));
      chrome.storage.local.set({ tw_palette_shortcuts: clean }, () => {
        if (typeof done === 'function') done();
      });
    },
    openUrl(url) {
      const u = String(url || '').trim();
      if (!/^https?:\/\//i.test(u)) return;
      window.open(u, '_blank', 'noopener,noreferrer');
    },
  };
  function _twHostLabelFromUrl(u) {
    try {
      return new URL(u).hostname.replace(/^www\./, '') || u;
    } catch (_) {
      return u;
    }
  }

  async function optimizeWithAi(mode) {
    const contentEl  = $('#tw-s-content');
    const aiBtn      = $('#tw-sm-ai');
    const bothBtn    = $('#tw-sm-ai-both');
    const restoreBtn = $('#tw-sm-restore');
    const content    = (contentEl?.value ?? '').trim();
    if (!content) return;

    const snippetId = state.editingSnippet || 'temp';
    const optMode = mode === 'both' ? 'both' : 'google';

    // 如果新模块已加载，委托给它
    if (window.TwAiRewrite) {
      const modeToBtn = { google: aiBtn, both: bothBtn };
      const primary = modeToBtn[optMode] || aiBtn;
      const busyLabel =
        optMode === 'both' ? (t.aiBothOptimizing || '…') : (t.aiOptimizing || '…');
      const allBtns = [aiBtn, bothBtn].filter(Boolean);
      const prevBtnText = allBtns.map((b) => b.textContent);
      allBtns.forEach((b) => { b.disabled = true; });
      if (primary) primary.textContent = busyLabel;
      try {
        await TwAiRewrite.optimizeSnippet(
          snippetId,
          content,
          (optimized) => {
            const normalized = String(optimized || '').trim();
            const marker = (t.snippetContentMarker || '内容：').trim();
            const hasTailMarker = normalized.endsWith(marker);
            contentEl.value = normalized
              ? (hasTailMarker ? normalized : `${normalized}\n\n${marker}`)
              : marker;
            restoreBtn.style.display = 'block';
            updateSnippetPreview();
          },
          { mode: optMode },
        );
      } finally {
        allBtns.forEach((b, i) => {
          b.disabled = false;
          if (prevBtnText[i] != null) b.textContent = prevBtnText[i];
        });
      }
      return;
    }

    // 降级：无新模块时提示配置
    alert(t.aiNoKey || '请先配置AI API密钥');
  }

  function restoreOriginalContent() {
    const contentEl  = $('#tw-s-content');
    const restoreBtn = $('#tw-sm-restore');
    const snippetId  = state.editingSnippet || 'temp';

    // 优先使用新模块的 backup/restore
    if (window.TwAiRewrite) {
      TwAiRewrite.restoreSnippet(snippetId, (original) => {
        contentEl.value          = original;
        restoreBtn.style.display = 'none';
        updateSnippetPreview();
      });
      return;
    }

    // 降级：使用旧 state.originalContent
    if (state.originalContent[snippetId]) {
      contentEl.value          = state.originalContent[snippetId];
      restoreBtn.style.display = 'none';
      updateSnippetPreview();
      delete state.originalContent[snippetId];
      save();
    }
  }

  function updateSnippetPreview() {
    const content = $('#tw-s-content')?.value || '';
    const prev = $('#tw-s-prev');
    if (!prev) return;
    
    if (hasVars(content)) {
      prev.innerHTML = chips(content, state.varValues, VT);
      $('#tw-s-prev-wrap').style.display = 'block';
    } else {
      prev.textContent = content;
      if (content) {
        $('#tw-s-prev-wrap').style.display = 'block';
      }
    }
  }

  // ── LANGUAGE SELECTION ──────────────────────────────────────
  function openLangModal(){
    // Temporarily use Chinese for initial UI
    if(!state.lang) {
      state.lang = 'zh';
      t = LANG[state.lang];
      VT = getVarTypes(t);
    }
    // Reset selections
    root.querySelectorAll('.tw-lang-option').forEach(opt => {
      opt.classList.remove('selected');
    });
    $('#tw-lang-sel').classList.add('open');
  }
  function closeLangModal(){$('#tw-lang-sel')?.classList.remove('open');}
  async function confirmLanguage(){
    const selected = root.querySelector('.tw-lang-option.selected');
    if(!selected) return;
    
    const selectedLang = selected.dataset.lang;
    state.lang = selectedLang;
    state.hasSelectedLang = true;
    t = LANG[state.lang];
    VT = getVarTypes(t);

    try {
      await seedGeminiWorkspaceGuideOnce();
    } catch (e) {
      console.warn('TalkwebSour: seed Gemini guide failed', e);
    }
    save();
    closeLangModal();

    fullRebuildUiChrome();

    // Open scene selection after language selection
    setTimeout(() => { openSceneModal(); }, 200);
  }

  // ── SCENE SELECTION ─────────────────────────────────────────
  function openSceneModal(){
    state.selectedScenes = [];
    // Reset card selections
    root.querySelectorAll('.tw-scene-card').forEach(card => {
      card.classList.remove('selected');
    });
    $('#tw-scene').classList.add('open');
  }
  function closeSceneModal(){$('#tw-scene')?.classList.remove('open');}
  /** 内置场景（翻译 / SOP / 图形×20 / 设计）按界面语言取 zh|en|ko；兼容旧版扁平 TW_BUILTIN_SCENES */
  function resolveBuiltinScenesRoot() {
    const R = typeof TW_BUILTIN_SCENES === 'undefined' ? null : TW_BUILTIN_SCENES;
    if (!R) return null;
    if (R.zh && R.en && R.ko) return R;
    if (R.intlBiz) {
      const shim = {
        intlTranslate: Array.isArray(R.intlBiz) && R.intlBiz[0] ? [R.intlBiz[0]] : [],
        intlSop: Array.isArray(R.intlBiz) && R.intlBiz[1] ? [R.intlBiz[1]] : [],
        graphicTemplates: Array.isArray(R.graphicTemplates) ? R.graphicTemplates : [],
        designWorkflow: Array.isArray(R.designWorkflow) ? R.designWorkflow : [],
      };
      return { zh: shim, en: shim, ko: shim };
    }
    return null;
  }
  function templatesForScene(sceneName) {
    const fromLang = t.sceneTemplates[sceneName];
    const base = Array.isArray(fromLang) ? fromLang : [];
    const root = resolveBuiltinScenesRoot();
    if (!root || !['intlTranslate', 'intlSop', 'graphicTemplates', 'designWorkflow'].includes(sceneName)) return base;
    const lang = state.lang === 'en' ? 'en' : state.lang === 'ko' ? 'ko' : 'zh';
    const pack = root[lang] || root.zh;
    const arr = pack && pack[sceneName];
    const list = Array.isArray(arr) ? arr : base;
    if (sceneName !== 'graphicTemplates') return list;
    const header =
      lang === 'en'
        ? '# Final output must be a Mermaid diagram image'
        : lang === 'ko'
          ? '# 최종 결과는 Mermaid 다이어그램 이미지로 출력'
          : '# 最终以Mermaid图片输出';
    return list.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const content = String(item.content || '');
      const norm = content.replace(/^\s+/, '');
      if (norm.startsWith(header)) return item;
      return { ...item, content: `${header}\n\n${content}` };
    });
  }
  /** 与界面语言一致的「用户输入」占位尾标（场景模板 / 种子脚本统一追加） */
  function userInputTailForLang(lang) {
    const L = lang === 'en' ? 'en' : lang === 'ko' ? 'ko' : 'zh';
    if (L === 'en') return '\n\nUser input:\n';
    if (L === 'ko') return '\n\n사용자 입력:\n';
    return '\n\n用户输入：\n';
  }
  function stripTrailingUserInputMarkers(s) {
    let x = String(s || '');
    const ends = [
      /\n\n사용자 입력[：:]\s*$/u,
      /\n\nUser input:\s*$/i,
      /\n\n用户输入：\s*$/,
      /\n\n【原始内容】：\s*$/,
      /\n\nYour input:\s*$/i,
    ];
    for (const re of ends) x = x.replace(re, '');
    return x.trimEnd();
  }
  /** 去掉已追加的「按输入语言输出」规则行，避免重复加载 */
  function stripScriptLanguageRule(s) {
    return String(s || '')
      .replace(/\n\n【语言】[^\n]+/g, '')
      .replace(/\n\n\[Language\][^\n]+/g, '')
      .replace(/\n\n\[언어\][^\n]+/g, '');
  }
  /** 预设 script 统一语言规则（与界面语言 pack 无关：按用户本次输入的实际语言生成输出） */
  function scriptLanguageRuleForLang(lang) {
    const L = lang === 'en' ? 'en' : lang === 'ko' ? 'ko' : 'zh';
    if (L === 'en') {
      return '\n\n[Language] Produce output in the same language as the user’s actual input; if they explicitly specify another language, follow that specification.';
    }
    if (L === 'ko') {
      return '\n\n[언어] 사용자가 실제로 입력한 언어와 동일한 언어로 결과를 작성합니다. 다른 언어를 명시한 경우에는 그에 따릅니다.';
    }
    return '\n\n【语言】请根据用户实际使用的输入语言生成对应语种的输出；若用户明确指定其他语言，则从其指定。';
  }
  function appendDefaultUserInputTail(content, lang) {
    const base = stripScriptLanguageRule(stripTrailingUserInputMarkers(content));
    return base + scriptLanguageRuleForLang(lang) + userInputTailForLang(lang);
  }
  function loadSceneTemplates(){
    if(state.selectedScenes.length===0)return;
    
    // Collect templates from selected scenes
    const newSnippets = [];
    // 首次引导：用“场景自动分组”替代默认空分组，让界面更清晰
    if(!state.hasSeenOnboarding){
      state.groups = [];
    }
    const sceneGroupName = {
      workplace: t.sceneWorkplace,
      developer: t.sceneDeveloper,
      student: t.sceneStudent,
      creator: t.sceneCreator,
      architect: t.sceneArchitect,
      researcher: t.sceneResearcher,
      productManager: t.sceneProductManager,
      dataAnalyst: t.sceneDataAnalyst,
      uiuxDesigner: t.sceneUIUXDesigner,
      businessStrategist: t.sceneBusinessStrategist,
      intlTranslate: t.sceneIntlTranslate,
      intlSop: t.sceneIntlSop,
      graphicTemplates: t.sceneGraphicTemplates,
      designWorkflow: t.sceneDesignWorkflow,
    };
    function ensureGroupByName(name){
      if (!name) return null;
      const existing = state.groups.find(g => g && g.name === name);
      if (existing) return existing.id;
      const gid = uid();
      // 默认折叠：加载完先看分组，内容需要用户自己展开查看
      state.groups.push({ id: gid, name, collapsed: true });
      return gid;
    }
    state.selectedScenes.forEach(sceneName => {
      const templates = templatesForScene(sceneName);
      const gid = ensureGroupByName(sceneGroupName[sceneName] || sceneName);
      templates.forEach(tmpl => {
        // Create new snippet with unique ID
        newSnippets.push({
          ...tmpl,
          content: appendDefaultUserInputTail(tmpl.content, state.lang),
          id: uid(),
          groupId: gid,
          createdAt: Date.now(),
        });
      });
    });
    
    // If this is first onboarding, replace existing snippets
    // If user is adding more scenes, append to existing
    if(!state.hasSeenOnboarding){
      state.snippets = newSnippets;
      state.hasSeenOnboarding = true;
    } else {
      // Append new templates, avoiding duplicates by title
      const existingKeys = new Set(state.snippets.map(s => `${s.title}@@${s.content}`));
      const uniqueNew = newSnippets.filter(s => !existingKeys.has(`${s.title}@@${s.content}`));
      state.snippets = [...uniqueNew, ...state.snippets];
    }
    
    save();
    render();
    closeSceneModal();
    offerPersonaWizardAfterScene();
    
    // Show success toast
    const toastEl = $('#tw-toast');
    if(toastEl){
      toastEl.textContent = t.sceneLoaded;
      toastEl.classList.add('show');
      setTimeout(()=>toastEl.classList.remove('show'),1800);
    }
  }

  // ── BACKUP / EXPORT-IMPORT ───────────────────────────────────
  function downloadJson(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /** 与单文件备份 `data` 中除 snippets/groups 外的字段完全一致（供 extra.json / 对照校验） */
  function buildBackupSettingsPayload(includeSecrets) {
    const x = {
      varValues: state.varValues,
      customKeywords: state.customKeywords,
      lang: state.lang,
      theme: state.theme,
      sidebarWidth: state.sidebarWidth,
      opacity: state.opacity,
      fontSizeLevel: state.fontSizeLevel,
      position: state.position,
      sidebarFixedHeight: state.sidebarFixedHeight,
      hasSeenOnboarding: state.hasSeenOnboarding,
      hasSelectedLang: state.hasSelectedLang,
      aiProvider: state.aiProvider,
      aiModel: state.aiModel,
      aiPaletteMode: state.aiPaletteMode,
      snippetSortByScore: state.snippetSortByScore !== false,
      templates: state.templates,
      personaWizardDone: state.personaWizardDone,
      aiUserProfile: state.aiUserProfile,
      hotkeys: state.hotkeys,
      sharePrefs: state.sharePrefs,
      userAgencyAgents: state.userAgencyAgents,
      userSuperstars: state.userSuperstars,
      agencySelectedCeleb: state.agencySelectedCeleb,
      agencySelectedAgent: state.agencySelectedAgent,
      agencyTaskContext: state.agencyTaskContext,
      agencyPrefetchIndex: state.agencyPrefetchIndex === true,
      agencyEnhanceEnabled: state.agencyEnhanceEnabled === true,
      agencyHiddenBuiltinAgentIds: state.agencyHiddenBuiltinAgentIds,
      agencyHiddenBuiltinStarIds: state.agencyHiddenBuiltinStarIds,
    };
    if (includeSecrets) {
      x.aiApiKey = state.aiApiKey;
      x.aiApiUrl = state.aiApiUrl;
      x.originalContent = state.originalContent;
    }
    return x;
  }

  function mergeCustomKeywordSets(a, b) {
    const base = a && typeof a === 'object' ? a : { lang: [], tone: [], task: [] };
    const pb = b && typeof b === 'object' ? b : {};
    const out = {};
    ['lang', 'tone', 'task'].forEach((k) => {
      const m = new Set();
      const addArr = (arr) => {
        (Array.isArray(arr) ? arr : []).forEach((x) => {
          const s = String(x || '').trim();
          if (s) m.add(s);
        });
      };
      addArr(base[k]);
      addArr(pb[k]);
      out[k] = [...m];
    });
    return out;
  }

  /** 文件夹「合并导入」时将 extra.json 合并进当前 state（字段与 applyReplaceBackup 对齐） */
  function applyExtraMergePatch(patch) {
    if (!patch || typeof patch !== 'object') return;
    const langBeforeMerge = state.lang;
    if (patch.varValues && typeof patch.varValues === 'object') {
      state.varValues = { ...state.varValues, ...patch.varValues };
    }
    if (patch.customKeywords && typeof patch.customKeywords === 'object') {
      state.customKeywords = mergeCustomKeywordSets(state.customKeywords, patch.customKeywords);
    }
    if (patch.lang) state.lang = patch.lang;
    if (patch.theme) state.theme = patch.theme;
    if (patch.sidebarWidth != null) state.sidebarWidth = patch.sidebarWidth;
    if (patch.opacity != null) state.opacity = patch.opacity;
    if (patch.fontSizeLevel != null) state.fontSizeLevel = clampFontSizeLevel(patch.fontSizeLevel);
    if (patch.position && typeof patch.position === 'object') {
      state.position = { ...state.position, ...patch.position };
    }
    if (patch.sidebarFixedHeight !== undefined) {
      state.sidebarFixedHeight =
        patch.sidebarFixedHeight != null && patch.sidebarFixedHeight > 0 ? patch.sidebarFixedHeight : null;
    }
    if (patch.hasSeenOnboarding !== undefined) state.hasSeenOnboarding = patch.hasSeenOnboarding;
    if (patch.hasSelectedLang !== undefined) state.hasSelectedLang = patch.hasSelectedLang;
    if (patch.aiProvider) state.aiProvider = patch.aiProvider;
    if (patch.aiModel) state.aiModel = patch.aiModel;
    if (patch.aiPaletteMode) state.aiPaletteMode = patch.aiPaletteMode;
    if (patch.snippetSortByScore !== undefined) state.snippetSortByScore = !!patch.snippetSortByScore;
    if (patch.personaWizardDone !== undefined) state.personaWizardDone = !!patch.personaWizardDone;
    if (patch.aiUserProfile && typeof patch.aiUserProfile === 'object') {
      state.aiUserProfile = { ...defaultAiUserProfile(), ...state.aiUserProfile, ...patch.aiUserProfile };
    }
    if (patch.hotkeys && typeof patch.hotkeys === 'object') state.hotkeys = patch.hotkeys;
    if (patch.sharePrefs && typeof patch.sharePrefs === 'object') {
      state.sharePrefs = { ...defaultSharePrefs(), ...state.sharePrefs, ...patch.sharePrefs };
    }
    if (Array.isArray(patch.templates) && patch.templates.length) {
      const seen = new Set(state.templates.map((tm) => `${tm.title || ''}@@${tm.content || ''}`));
      patch.templates.forEach((tm) => {
        const k = `${tm.title || ''}@@${tm.content || ''}`;
        if (!seen.has(k)) {
          state.templates.unshift(tm);
          seen.add(k);
        }
      });
    }
    if (Array.isArray(patch.userAgencyAgents)) state.userAgencyAgents = patch.userAgencyAgents;
    if (Array.isArray(patch.userSuperstars)) state.userSuperstars = patch.userSuperstars;
    if (patch.agencySelectedCeleb !== undefined) state.agencySelectedCeleb = patch.agencySelectedCeleb;
    if (patch.agencySelectedAgent !== undefined) state.agencySelectedAgent = patch.agencySelectedAgent;
    if (typeof patch.agencyTaskContext === 'string') state.agencyTaskContext = patch.agencyTaskContext;
    if (patch.agencyPrefetchIndex !== undefined) state.agencyPrefetchIndex = patch.agencyPrefetchIndex === true;
    if (patch.agencyEnhanceEnabled !== undefined) state.agencyEnhanceEnabled = patch.agencyEnhanceEnabled === true;
    if (Array.isArray(patch.agencyHiddenBuiltinAgentIds)) {
      state.agencyHiddenBuiltinAgentIds = patch.agencyHiddenBuiltinAgentIds.map(String);
    }
    if (Array.isArray(patch.agencyHiddenBuiltinStarIds)) {
      state.agencyHiddenBuiltinStarIds = patch.agencyHiddenBuiltinStarIds.map(String);
    }
    if (patch.aiApiKey !== undefined && patch.aiApiKey !== '') {
      state.aiApiKey = normalizeStoredApiKey(patch.aiApiKey);
    }
    if (patch.aiApiUrl) state.aiApiUrl = patch.aiApiUrl;
    if (patch.originalContent && typeof patch.originalContent === 'object') {
      state.originalContent = { ...state.originalContent, ...patch.originalContent };
    }

    if (patch.lang != null && patch.lang !== langBeforeMerge && LANG[state.lang]) {
      t = LANG[state.lang];
      VT = getVarTypes(t);
      fullRebuildUiChrome();
    }
  }

  function extraFilePropsToBackupData(ex) {
    if (!ex || typeof ex !== 'object') return {};
    const skip = new Set(['format', 'schemaVersion', 'exportedAt']);
    const o = {};
    Object.keys(ex).forEach((k) => {
      if (!skip.has(k)) o[k] = ex[k];
    });
    return o;
  }

  function exportTalkWebSourFolderToDownloads() {
    const inc = !!$('#tw-bak-secrets')?.checked;
    const iso = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const base = `TalkWebSour/export-${iso}`;
    const snippets = {
      format: 'talkweb-snippets-file',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      snippets: state.snippets,
    };
    const groups = {
      format: 'talkweb-groups-file',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      groups: state.groups,
    };
    const extra = {
      format: 'talkweb-extra-file',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      ...buildBackupSettingsPayload(inc),
    };
    const files = [
      [`${base}/snippets.json`, snippets],
      [`${base}/groups.json`, groups],
      [`${base}/extra.json`, extra],
    ];
    const step = (i) => {
      if (i >= files.length) {
        toast();
        return;
      }
      const [name, obj] = files[i];
      const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      if (!chrome.downloads?.download) {
        const leaf = String(name).split('/').pop() || `part-${i}.json`;
        downloadJson(`TalkWebSour-${iso}-${leaf}`, obj);
        try {
          URL.revokeObjectURL(url);
        } catch (_) {}
        setTimeout(() => step(i + 1), 60);
        return;
      }
      chrome.downloads.download({ url, filename: name, saveAs: false }, () => {
        if (chrome.runtime.lastError) {
          console.error('[TalkwebSour] chrome.downloads', chrome.runtime.lastError.message);
          downloadJson(String(name).split('/').pop(), obj);
        }
        setTimeout(() => {
          try {
            URL.revokeObjectURL(url);
          } catch (_) {}
          setTimeout(() => step(i + 1), 200);
        }, 40);
      });
    };
    step(0);
  }

  async function importTalkWebSourFolderFromFiles(fileList) {
    if (!fileList?.length) return;
    const byLeaf = new Map();
    for (const f of fileList) {
      const leaf = (f.webkitRelativePath || f.name || '')
        .split(/[/\\]/)
        .filter(Boolean)
        .pop()
        ?.toLowerCase();
      if (leaf) byLeaf.set(leaf, f);
    }
    const loadJson = async (name) => {
      const file = byLeaf.get(name);
      if (!file) return null;
      try {
        return JSON.parse(await readFileAsText(file));
      } catch (e) {
        console.warn('[TalkwebSour] folder import', name, e);
        return null;
      }
    };
    const sn = await loadJson('snippets.json');
    const gr = await loadJson('groups.json');
    const ex = await loadJson('extra.json');
    if (!sn || sn.format !== 'talkweb-snippets-file' || !Array.isArray(sn.snippets)) {
      alert(t.importFolderErr);
      return;
    }
    if (!gr || gr.format !== 'talkweb-groups-file' || !Array.isArray(gr.groups)) {
      alert(t.importFolderErr);
      return;
    }
    const mode = root.querySelector('input[name="tw-bak-mode"]:checked')?.value || 'merge';
    if (mode === 'replace') {
      const data = {
        snippets: sn.snippets,
        groups: gr.groups,
        ...extraFilePropsToBackupData(ex),
      };
      applyReplaceBackup({ format: 'talkweb-backup', schemaVersion: 2, data });
    } else {
      const ok = mergeBackupPayload({
        format: 'talkweb-backup',
        data: { snippets: sn.snippets, groups: gr.groups },
      });
      if (!ok) {
        alert(t.importFolderErr);
        return;
      }
      if (ex && ex.format === 'talkweb-extra-file') {
        applyExtraMergePatch(extraFilePropsToBackupData(ex));
        save();
      }
    }
    applyFontSizeLevel();
    render();
    closeBackupModal();
    updateHeaderPersonaAvatar();
    refreshTwGooglePrimerOnWindow();
    toast();
  }
  function buildFullBackupPayload(includeSecrets) {
    return {
      format: 'talkweb-backup',
      schemaVersion: 2,
      appVersion: '3.5.0',
      exportedAt: new Date().toISOString(),
      data: {
        snippets: state.snippets,
        groups: state.groups,
        ...buildBackupSettingsPayload(includeSecrets),
      },
    };
  }
  function applyReplaceBackup(parsed) {
    const d = parsed.data;
    if (!d || typeof d !== 'object') return false;
    state.snippets = Array.isArray(d.snippets) ? d.snippets : [];
    state.groups = Array.isArray(d.groups) ? d.groups : [];
    state.varValues = d.varValues && typeof d.varValues === 'object' ? d.varValues : {};
    state.customKeywords = d.customKeywords && typeof d.customKeywords === 'object'
      ? d.customKeywords
      : { lang: [], tone: [], task: [] };
    if (d.lang) state.lang = d.lang;
    if (d.theme) state.theme = d.theme;
    if (d.sidebarWidth != null) state.sidebarWidth = d.sidebarWidth;
    if (d.opacity != null) state.opacity = d.opacity;
    if (d.fontSizeLevel != null) state.fontSizeLevel = clampFontSizeLevel(d.fontSizeLevel);
    state.position = d.position && typeof d.position === 'object' ? d.position : { x: 0, y: 0 };
    if (d.sidebarFixedHeight !== undefined) {
      state.sidebarFixedHeight = (d.sidebarFixedHeight != null && d.sidebarFixedHeight > 0) ? d.sidebarFixedHeight : null;
    }
    if (d.hasSeenOnboarding !== undefined) state.hasSeenOnboarding = d.hasSeenOnboarding;
    if (d.hasSelectedLang !== undefined) state.hasSelectedLang = d.hasSelectedLang;
    if (d.aiProvider) state.aiProvider = d.aiProvider;
    if (d.aiModel) state.aiModel = d.aiModel;
    if (d.aiPaletteMode) state.aiPaletteMode = d.aiPaletteMode;
    if (d.snippetSortByScore !== undefined) state.snippetSortByScore = !!d.snippetSortByScore;
    if (d.hotkeys && typeof d.hotkeys === 'object') state.hotkeys = d.hotkeys;
    if (d.aiApiKey !== undefined) state.aiApiKey = normalizeStoredApiKey(d.aiApiKey);
    if (d.aiApiUrl) state.aiApiUrl = d.aiApiUrl;
    if (d.personaWizardDone !== undefined) state.personaWizardDone = !!d.personaWizardDone;
    if (d.aiUserProfile && typeof d.aiUserProfile === 'object') {
      state.aiUserProfile = { ...defaultAiUserProfile(), ...d.aiUserProfile };
    }
    if (d.sharePrefs && typeof d.sharePrefs === 'object') {
      state.sharePrefs = { ...defaultSharePrefs(), ...d.sharePrefs };
    }
    if (Array.isArray(d.userAgencyAgents)) state.userAgencyAgents = d.userAgencyAgents;
    if (Array.isArray(d.userSuperstars)) state.userSuperstars = d.userSuperstars;
    if (d.agencySelectedCeleb !== undefined) state.agencySelectedCeleb = d.agencySelectedCeleb;
    if (d.agencySelectedAgent !== undefined) state.agencySelectedAgent = d.agencySelectedAgent;
    if (typeof d.agencyTaskContext === 'string') state.agencyTaskContext = d.agencyTaskContext;
    if (d.agencyPrefetchIndex !== undefined) state.agencyPrefetchIndex = d.agencyPrefetchIndex === true;
    if (d.agencyEnhanceEnabled !== undefined) state.agencyEnhanceEnabled = d.agencyEnhanceEnabled === true;
    if (Array.isArray(d.agencyHiddenBuiltinAgentIds)) {
      state.agencyHiddenBuiltinAgentIds = d.agencyHiddenBuiltinAgentIds.map(String);
    }
    if (Array.isArray(d.agencyHiddenBuiltinStarIds)) {
      state.agencyHiddenBuiltinStarIds = d.agencyHiddenBuiltinStarIds.map(String);
    }
    state.originalContent = d.originalContent && typeof d.originalContent === 'object' ? d.originalContent : {};
    state.templates = Array.isArray(d.templates) ? d.templates : [];
    if (state.lang && LANG[state.lang]) {
      t = LANG[state.lang];
      VT = getVarTypes(t);
    }
    save();
    fullRebuildUiChrome();
    return true;
  }
  function mergeBackupPayload(parsed) {
    const d = parsed.data;
    if (!d || !Array.isArray(d.snippets)) return false;
    const gidMap = new Map();
    (d.groups || []).forEach((g, i) => {
      if (!g || !g.name) return;
      const nid = uid();
      const oid = g.id != null ? g.id : `__imp_${i}`;
      gidMap.set(oid, nid);
      state.groups.push({ id: nid, name: g.name, collapsed: !!g.collapsed });
    });
    d.snippets.forEach((s) => {
      if (!s) return;
      const ng = s.groupId && gidMap.has(s.groupId) ? gidMap.get(s.groupId) : null;
      state.snippets.unshift({
        id: uid(),
        title: s.title || '',
        content: s.content || '',
        groupId: ng,
        createdAt: Date.now(),
      });
    });
    save();
    return true;
  }
  function isTalkwebBackup(obj) {
    return obj && obj.format === 'talkweb-backup' && obj.data && typeof obj.data === 'object';
  }
  function exportSnippetFile(id) {
    const s = state.snippets.find((x) => x.id === id);
    if (!s) return;
    const safe = (s.title || 'snippet').slice(0, 24).replace(/[^\w\u4e00-\u9fff\-]+/g, '_');
    downloadJson(`talkweb-snippet-${safe}.json`, {
      format: 'talkweb-snippet',
      schemaVersion: 1,
      snippet: { title: s.title, content: s.content, groupId: s.groupId },
    });
    toast();
  }
  function exportGroupFile(gid) {
    const g = state.groups.find((x) => x.id === gid);
    if (!g) return;
    const snippets = state.snippets
      .filter((s) => s.groupId === gid)
      .map(({ title, content }) => ({ title, content }));
    const safe = (g.name || 'group').slice(0, 24).replace(/[^\w\u4e00-\u9fff\-]+/g, '_');
    downloadJson(`talkweb-group-${safe}.json`, {
      format: 'talkweb-group',
      schemaVersion: 1,
      group: { name: g.name },
      snippets,
    });
    toast();
  }
  function applySnippetJsonToForm() {
    const raw = $('#tw-s-json')?.value?.trim();
    if (!raw) return;
    let o;
    try {
      o = JSON.parse(raw);
    } catch {
      return;
    }
    const sn = o.snippet || o;
    if (!sn || (sn.content == null && !sn.title)) return;
    $('#tw-s-title').value = sn.title || '';
    $('#tw-s-content').value = sn.content || '';
    const sel = $('#tw-s-group');
    if (sel && sn.groupId && state.groups.some((g) => g.id === sn.groupId)) {
      sel.value = sn.groupId;
    }
    $('#tw-s-content')?.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function importNewSnippetFromPaste(raw) {
    let o;
    try {
      o = JSON.parse(String(raw || '').replace(/^\uFEFF/, ''));
    } catch {
      return false;
    }
    const sn = o.format === 'talkweb-snippet' && o.snippet ? o.snippet : o.snippet || o;
    if (!sn || (sn.content == null && !sn.title)) return false;
    const gid = sn.groupId && state.groups.some((g) => g.id === sn.groupId) ? sn.groupId : null;
    state.snippets.unshift({
      id: uid(),
      title: sn.title || (String(sn.content || '').slice(0, 40) || '…'),
      content: sn.content || '',
      groupId: gid,
      createdAt: Date.now(),
    });
    if (gid) {
      const g = state.groups.find(x => x.id === gid);
      if (g) g.collapsed = true;
    }
    save();
    render();
    return true;
  }
  function importGroupFromPaste(raw) {
    let o;
    try {
      o = JSON.parse(String(raw || '').replace(/^\uFEFF/, ''));
    } catch {
      return false;
    }
    if (o.format !== 'talkweb-group' || !o.group) return false;
    const nid = uid();
    state.groups.push({ id: nid, name: o.group.name || 'Imported', collapsed: true });
    (o.snippets || []).forEach((s) => {
      state.snippets.unshift({
        id: uid(),
        title: s.title || '',
        content: s.content || '',
        groupId: nid,
        createdAt: Date.now(),
      });
    });
    save();
    render();
    return true;
  }

  function readSharePrefsFromInputs() {
    state.sharePrefs = {
      mailTo: ($('#tw-bak-mail-to')?.value || '').trim(),
      smbNote: ($('#tw-bak-smb-note')?.value || '').trim(),
      webdavUrl: ($('#tw-bak-wd-url')?.value || '').trim(),
      webdavUser: ($('#tw-bak-wd-user')?.value || '').trim(),
      webdavPass: ($('#tw-bak-wd-pass')?.value || '').trim(),
      cloudPostUrl: ($('#tw-bak-cp-url')?.value || '').trim(),
      cloudPostToken: ($('#tw-bak-cp-token')?.value || '').trim(),
    };
  }

  function writeSharePrefsToInputs() {
    const p = { ...defaultSharePrefs(), ...(state.sharePrefs || {}) };
    const set = (id, v) => {
      const el = $(id);
      if (el) el.value = v ?? '';
    };
    set('#tw-bak-mail-to', p.mailTo);
    set('#tw-bak-smb-note', p.smbNote);
    set('#tw-bak-wd-url', p.webdavUrl);
    set('#tw-bak-wd-user', p.webdavUser);
    set('#tw-bak-wd-pass', p.webdavPass);
    set('#tw-bak-cp-url', p.cloudPostUrl);
    set('#tw-bak-cp-token', p.cloudPostToken);
  }

  function packDownloadAndOpenMail() {
    readSharePrefsFromInputs();
    save();
    const inc = !!$('#tw-bak-secrets')?.checked;
    const fname = `talkweb-backup-${new Date().toISOString().slice(0, 10)}.json`;
    downloadJson(fname, buildFullBackupPayload(!!inc));
    toast();
    const rawTo = (state.sharePrefs.mailTo || '').replace(/\s/g, '');
    const to = encodeURIComponent(rawTo);
    const subj =
      state.lang === 'en'
        ? 'TalkWebSour backup'
        : state.lang === 'ko'
          ? 'TalkWebSour 백업'
          : 'TalkWebSour 数据备份';
    const bodyLines = `${t.packMailHint || ''}\n\n${
      state.lang === 'en' ? `File: ${fname}` : state.lang === 'ko' ? `파일: ${fname}` : `文件：${fname}`
    }`;
    const href = `mailto:${to}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(bodyLines)}`;
    try {
      window.open(href, '_blank', 'noopener,noreferrer');
    } catch (_) {
      window.location.href = href;
    }
  }

  function copySmbShareGuide() {
    readSharePrefsFromInputs();
    save();
    const pfx = (state.sharePrefs.smbNote || '').trim();
    const lines = [pfx, pfx ? '' : null, t.shareSmbFtpNote].filter((x) => x != null && x !== '').join('\n');
    navigator.clipboard.writeText(lines).then(() => toast(t.smbGuideCopied)).catch(() => {
      alert(lines);
    });
  }

  function uploadBackupViaWebdav() {
    readSharePrefsFromInputs();
    save();
    let url = (state.sharePrefs.webdavUrl || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      alert(t.shareUploadErr);
      return;
    }
    const inc = !!$('#tw-bak-secrets')?.checked;
    const jsonStr = JSON.stringify(buildFullBackupPayload(!!inc));
    const pathPart = url.split('?')[0];
    const needsName = !/\.json\s*$/i.test(pathPart);
    const finalUrl = needsName ? `${url.replace(/\/?$/, '/')}talkweb-backup-${new Date().toISOString().slice(0, 10)}.json` : url;
    chrome.runtime.sendMessage(
      {
        type: 'TW_BACKUP_PROXY',
        kind: 'webdav_put',
        url: finalUrl,
        user: state.sharePrefs.webdavUser,
        pass: state.sharePrefs.webdavPass,
        body: jsonStr,
      },
      (res) => {
        if (chrome.runtime.lastError) {
          alert(`${t.shareUploadErr}: ${chrome.runtime.lastError.message}`);
          return;
        }
        if (res && res.ok) toast(t.shareUploadOk);
        else alert(`${t.shareUploadErr} ${res?.status ?? ''} ${res?.text || res?.error || ''}`);
      },
    );
  }

  function uploadBackupViaCloudPost() {
    readSharePrefsFromInputs();
    save();
    const url = (state.sharePrefs.cloudPostUrl || '').trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      alert(t.shareUploadErr);
      return;
    }
    const inc = !!$('#tw-bak-secrets')?.checked;
    const jsonStr = JSON.stringify(buildFullBackupPayload(!!inc));
    chrome.runtime.sendMessage(
      {
        type: 'TW_BACKUP_PROXY',
        kind: 'http_post',
        url,
        token: state.sharePrefs.cloudPostToken,
        body: jsonStr,
      },
      (res) => {
        if (chrome.runtime.lastError) {
          alert(`${t.shareUploadErr}: ${chrome.runtime.lastError.message}`);
          return;
        }
        if (res && res.ok) toast(t.shareUploadOk);
        else alert(`${t.shareUploadErr} ${res?.status ?? ''} ${res?.text || res?.error || ''}`);
      },
    );
  }

  function openBackupModal() {
    $('#tw-bak-paste').value = '';
    $('#tw-bak-one').value = '';
    $('#tw-bak-grp').value = '';
    $('#tw-bak-file') && ($('#tw-bak-file').value = '');
    $('#tw-bak-folder') && ($('#tw-bak-folder').value = '');
    $('#tw-bak-file-name') && ($('#tw-bak-file-name').textContent = '');
    writeSharePrefsToInputs();
    $('#tw-bak')?.classList.add('open');
  }
  function closeBackupModal() {
    $('#tw-bak')?.classList.remove('open');
  }
  function flashBackupErr(btn) {
    if (!btn) return;
    const prev = btn.textContent;
    btn.textContent = t.backupErr;
    btn.style.background = '#ff4466';
    setTimeout(() => {
      btn.textContent = prev;
      btn.style.background = '';
    }, 1600);
  }

  // ── IMPORT (含 prompts.chat CSV) ────────────────────────────
  function twParseCsvRows(s) {
    const rows = [];
    let row = [];
    let field = '';
    let i = 0;
    let inQuotes = false;
    const str = String(s || '').replace(/^\uFEFF/, '');
    while (i < str.length) {
      const c = str[i];
      if (inQuotes) {
        if (c === '"') {
          if (str[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i++;
          continue;
        }
        field += c;
        i++;
        continue;
      }
      if (c === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (c === ',') {
        row.push(field);
        field = '';
        i++;
        continue;
      }
      if (c === '\r') {
        i++;
        continue;
      }
      if (c === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        i++;
        continue;
      }
      field += c;
      i++;
    }
    row.push(field);
    if (row.some((cell) => String(cell).length)) rows.push(row);
    return rows;
  }

  function twLooksLikePromptsChatCsv(raw) {
    const first =
      String(raw || '')
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/)
        .find((l) => l.trim()) || '';
    return /^act\s*,\s*prompt\s*,/i.test(first.trim());
  }

  /** prompts.chat prompts.csv → { title, content }[] */
  function twParsePromptsChatCsv(raw) {
    const rows = twParseCsvRows(raw);
    if (!rows.length) return [];
    let start = 0;
    const h0 = (rows[0][0] || '').trim().replace(/^\uFEFF/, '').toLowerCase();
    if (h0 === 'act') start = 1;
    const out = [];
    for (let r = start; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length < 2) continue;
      const act = String(row[0] ?? '').trim();
      const prompt = String(row[1] ?? '').trim();
      const forDevs = String(row[2] ?? '').toUpperCase() === 'TRUE';
      const typ = String(row[3] ?? '').trim();
      if (!act && !prompt) continue;
      let title = act || prompt.slice(0, 48);
      if (typ && typ.toUpperCase() !== 'TEXT') title = `[${typ}] ${title}`;
      else if (forDevs) title = `[Dev] ${title}`;
      out.push({ title, content: prompt || act });
    }
    return out;
  }

  function openImportModal(){
    $('#tw-i-url').value='';
    $('#tw-i-paste').value='';
    $('#tw-i-file') && ($('#tw-i-file').value='');
    $('#tw-i-file-name') && ($('#tw-i-file-name').textContent='');
    $('#tw-im').classList.add('open');
    setTimeout(()=>$('#tw-i-url').focus(),100);
  }
  function closeImportModal(){$('#tw-im')?.classList.remove('open');}
  function doImport(){
    const raw = ($('#tw-i-paste').value || '').replace(/^\uFEFF/, '').trim();
    if (!raw) return;
    let items = [];
    if (twLooksLikePromptsChatCsv(raw)) {
      const parsed = twParsePromptsChatCsv(raw);
      items = parsed.map((x) => ({
        id: uid(),
        title: x.title,
        content: x.content,
        groupId: null,
        createdAt: Date.now(),
      }));
    } else try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.format === 'talkweb-backup' && parsed.data && Array.isArray(parsed.data.snippets)) {
        const arr = parsed.data.snippets;
        items = arr.filter(x => x && (x.content || x.prompt || x.text)).map(x => ({
          id: uid(),
          title: x.title || x.name || (String(x.content || x.prompt || x.text).slice(0, 30) + '...'),
          content: x.content || x.prompt || x.text || '',
          groupId: null,
          createdAt: Date.now(),
        }));
      } else if (parsed && parsed.format === 'talkweb-snippet' && parsed.snippet) {
        const sn = parsed.snippet;
        if (sn && (sn.content != null || sn.title)) {
          items = [{
            id: uid(),
            title: sn.title || (String(sn.content || '').slice(0, 40) || '…'),
            content: sn.content || '',
            groupId: sn.groupId && state.groups.some((g) => g.id === sn.groupId) ? sn.groupId : null,
            createdAt: Date.now(),
          }];
        }
      } else if (parsed && parsed.format === 'talkweb-group' && Array.isArray(parsed.snippets)) {
        items = parsed.snippets.filter(x => x && (x.content || x.prompt || x.text)).map(x => ({
          id: uid(),
          title: x.title || x.name || (String(x.content || x.prompt || x.text).slice(0, 30) + '...'),
          content: x.content || x.prompt || x.text || '',
          groupId: null,
          createdAt: Date.now(),
        }));
      } else {
        const arr = Array.isArray(parsed) ? parsed : (parsed.prompts || parsed.snippets || Object.values(parsed));
        items = arr.filter(x => x && (x.content || x.prompt || x.text)).map(x => ({
          id: uid(),
          title: x.title || x.name || (String(x.content || x.prompt || x.text).slice(0, 30) + '...'),
          content: x.content || x.prompt || x.text || '',
          groupId: x.groupId || null,
          createdAt: Date.now(),
        }));
      }
    } catch(e) {
      // Fallback: treat as newline-separated plain text prompts
      items = raw.split('\n').map(line => line.trim()).filter(Boolean).map(line => ({
        id: uid(),
        title: line.slice(0, 40) + (line.length > 40 ? '...' : ''),
        content: line,
        groupId: null,
        createdAt: Date.now(),
      }));
    }
    if (!items.length) {
      const btn = $('#tw-im-import');
      btn.textContent = t.importErr; btn.style.background = '#ff4466';
      setTimeout(()=>{btn.textContent=t.importBtn;btn.style.background='';},1800);
      return;
    }
    // Merge: skip duplicates by content
    const existing = new Set(state.snippets.map(s=>s.content));
    const newItems = items.filter(x => !existing.has(x.content));
    state.snippets = [...newItems, ...state.snippets];
    save(); render(); closeImportModal();
    // Show success toast
    toast();
  }

  /** 网页内仅注入 AI 桥接 + runtime 消息（主界面在 Chrome Side Panel） */
  function registerTabBridgeRuntimeListener() {
    if (window.__twTalkwebRuntimeListener) return;
    window.__twTalkwebRuntimeListener = true;
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === 'TW_PING') {
        sendResponse({ ok: true });
        return true;
      }
      if (msg.type === 'TW_TOGGLE') {
        chrome.runtime.sendMessage({ type: 'TW_OPEN_SIDE_PANEL' });
      }
      if (msg.type === 'TW_SHOW') {
        chrome.runtime.sendMessage({ type: 'TW_OPEN_SIDE_PANEL' });
      }
      if (msg.type === 'TW_OPEN_PALETTE') {
        void (async () => {
          const t0 = Date.now();
          while (!window.TwAiRewrite && Date.now() - t0 < 3200) {
            await new Promise((r) => setTimeout(r, 30));
          }
          try {
            ensureAiRewriteReady();
            window.TwAiRewrite?.openSearchPalette?.();
          } catch (err) {
            console.warn('TalkwebSour: open palette', err);
          }
        })();
      }
      if (msg.type === 'TW_AI_TRIGGER' && msg.mode) {
        void (async () => {
          const t0 = Date.now();
          while (!window.TwAiRewrite && Date.now() - t0 < 3200) {
            await new Promise((r) => setTimeout(r, 30));
          }
          try {
            ensureAiRewriteReady();
            window.TwAiRewrite?.triggerByMode?.(msg.mode);
          } catch (err) {
            console.warn('TalkwebSour: AI trigger', err);
          }
        })();
      }
      sendResponse({ ok: true });
      return true;
    });
  }

  async function initPageBridge() {
    await loadData();
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (Object.keys(changes).some((k) => k.startsWith('tw_'))) {
        loadData()
          .then(() => {
            applyFontSizeLevel();
          })
          .catch(() => {});
      }
    });

    const host = document.createElement('div');
    host.id = 'talkweb-sour-host';
    host.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;z-index:2147483647;';
    document.documentElement.appendChild(host);
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>
#tw-toast{position:fixed;top:8px;left:50%;transform:translateX(-50%) translateY(-40px);z-index:2147483650;
font-size:11px;font-weight:700;padding:6px 14px;border-radius:20px;letter-spacing:1px;opacity:0;
transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1);pointer-events:none;white-space:nowrap;
background:#0071e3;color:#fff}
#tw-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
</style><div id="tw-toast"></div>`;

    applyFontSizeLevel();

    registerTabBridgeRuntimeListener();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          if (window.TwAiRewrite) {
            TwAiRewrite.init(root, () => state);
            aiRewriteReady = true;
            exposeAgencyPaletteBridge();
          }
        } catch (e) {
          console.warn('TalkwebSour: TwAiRewrite.init', e);
        }
      });
    });
  }

  // ── INIT ─────────────────────────────────────────────────────
  async function init(){
    await loadData();
    if (state.hasSelectedLang) {
      try {
        await seedGeminiWorkspaceGuideOnce();
      } catch (e) {
        console.warn('TalkwebSour: seed Gemini guide failed', e);
      }
    }
    
    // If no language selected yet, show language selection first
    if(!state.hasSelectedLang){
      // Use Chinese temporarily for initial render
      state.lang = 'zh';
      t = LANG[state.lang];
      VT = getVarTypes(t);
    }
    
    const host=document.createElement('div');
    host.id='talkweb-sour-host';
    if (TW_IS_SIDE_PANEL) {
      document.documentElement.style.height = '100%';
      document.body.style.cssText = 'margin:0;height:100%;overflow:hidden;position:relative';
      host.style.cssText =
        'position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:auto;overflow:hidden';
      document.body.appendChild(host);
    } else {
      host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;';
      document.documentElement.appendChild(host);
    }
    root=host.attachShadow({mode:'open'});
    root.innerHTML=buildHTML();
    bindAll();
    updateHeaderPersonaAvatar();
    applyOp(state.opacity);
    applyTheme(state.theme);
    applySidebarVisibilityFromIntent();
    syncSidebarBoxStyles();
    applyFontSizeLevel();
    render();
    refreshTwGooglePrimerOnWindow();

    if (!twWindowResizeBound) {
      twWindowResizeBound = true;
      window.addEventListener('resize', () => {
        clampSidebarRightInset();
        syncSidebarBoxStyles();
      });
    }

    // ── 接入 AI Rewrite：双帧延迟，避免首屏 shadow/样式未稳导致 ⚡ 无效 ──
    requestAnimationFrame(() => {
      requestAnimationFrame(() => remountAiRewrite());
    });
    
    // First-time onboarding flow:
    // 1. Show language selection if not selected
    // 2. Then show scene selection if no snippets
    if(!state.hasSelectedLang){
      setTimeout(()=>{
        openLangModal();
      }, 400);
    } else if(!state.hasSeenOnboarding && state.snippets.length === 0){
      setTimeout(()=>{
        openSceneModal();
      }, 400);
    }
  }

  if (TW_IS_SIDE_PANEL) {
    init();
  } else {
    initPageBridge();
  }
})();
