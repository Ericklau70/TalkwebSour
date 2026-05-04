// TalkwebSour V3.1 — 个性档案「职位角色」下拉预设（图标 + 技能/标准，供个性化优化注入）
(function () {
  /** @typedef {{ icon: string, labelZh: string, labelEn: string, labelKo: string, detailZh: string, detailEn: string, detailKo: string }} TwPersonaRolePreset */

  /** @type {Record<string, TwPersonaRolePreset>} */
  var PRESETS = {
    custom: {
      icon: '✏️',
      labelZh: '自定义（手动填写职位）',
      labelEn: 'Custom (type your role)',
      labelKo: '사용자 정의(직무 직접 입력)',
      detailZh: '',
      detailEn: '',
      detailKo: '',
    },
    workplace: {
      icon: '💼',
      labelZh: '职场白领 / 综合管理',
      labelEn: 'Office professional / general management',
      labelKo: '오피스 전문가 / 일반 관리',
      detailZh:
        '【职能概览】跨部门协调、书面与口头汇报、会议纪要、邮件与即时沟通。\n【常用技能】结构化表达（金字塔/SBAR）、时间管理、优先级排序、Stakeholder 管理。\n【质量标准】称呼得体、结论先行、数据与事实支撑观点、可追溯的行动项（负责人/时间）。\n【语气边界】商务中性偏积极；不对未证实信息下定论。',
      detailEn:
        '[Scope] Cross-functional coordination, meetings, email/IM.\n[Skills] Pyramid/SBAR, prioritization, stakeholder alignment.\n[Quality] Clear ownership and deadlines; facts over speculation.',
      detailKo:
        '[범위] 부서 간 조율, 회의·메일.\n[역량] 우선순위·이해관계자 정렬.\n[품질] 실행 책임·기한 명확, 추측 금지.',
    },
    developer: {
      icon: '💻',
      labelZh: '开发者 / 软件工程',
      labelEn: 'Developer / software engineering',
      labelKo: '개발자 / 소프트웨어 엔지니어링',
      detailZh:
        '【职能概览】需求拆解、接口与模块设计、编码与重构、代码评审、缺陷定位与复盘。\n【常用技能】主流语言生态、Git 协作、单元/集成测试、日志与排障、API 文档化。\n【质量标准】可读性优于炫技；边界条件与错误路径写清；安全默认（最小权限、输入校验）。\n【语气边界】技术判断需给出依据（栈、版本、约束）；不臆造依赖版本或未公开 API。',
      detailEn:
        '[Scope] Implementation, reviews, debugging, docs.\n[Skills] Git, testing, observability, secure defaults.\n[Quality] Prefer clarity; document edge cases—no invented APIs/versions.',
      detailKo:
        '[범위] 구현·리뷰·디버깅.\n[기술] Git·테스트·관측.\n[품질] 명확성·경계 조건 명시.',
    },
    student: {
      icon: '🎓',
      labelZh: '学生 / 研究员',
      labelEn: 'Student / researcher',
      labelKo: '학생 / 연구원',
      detailZh:
        '【职能概览】文献检索与综述、方法论述、实验/调研设计、数据分析与图表规范、学术写作与答辩表达。\n【常用技能】引用规范（GB/APA 等按场景）、批判性阅读、可复现描述、术语一致性。\n【质量标准】论点—证据链完整； Limitation 诚实陈述；不夸大因果。\n【语气边界】区分「学界共识 / 本文结果 / 推测」。',
      detailEn:
        '[Scope] Literature review, methods, reproducibility.\n[Skills] Citation styles, consistent terminology.\n[Quality] Claim–evidence discipline; honest limitations.',
      detailKo:
        '[범위] 문헌·방법·재현성.\n[품질] 주장-근거·한계 명시.',
    },
    creator: {
      icon: '✍️',
      labelZh: '内容创作者 / 新媒体',
      labelEn: 'Content creator / digital media',
      labelKo: '콘텐츠 크리에이터',
      detailZh:
        '【职能概览】选题、叙事结构、标题与开篇钩子、平台适配（篇幅/格式）、SEO 与可读性平衡。\n【常用技能】受众画像、风格指南、版权与引用、数据复盘（阅读/转化）。\n【质量标准】真实不标题党；敏感话题标注立场与信息来源；广告/合作透明披露。\n【语气边界】不编造引用、销量或平台规则。',
      detailEn:
        '[Scope] Hooks, structure, channel fit, SEO ethics.\n[Quality] No fabricated quotes/metrics; disclose sponsorships.',
      detailKo:
        '[범위] 훅·구조·채널 맞춤.\n[품질] 허위 인용·지표 금지.',
    },
    architect: {
      icon: '🏗️',
      labelZh: '软件架构师',
      labelEn: 'Software architect',
      labelKo: '소프트웨어 아키텍트',
      detailZh:
        '【职能概览】系统分解、质量属性（可用/安全/成本/演进）、接口与契约、技术与组织约束下的权衡。\n【常用技能】ADR、C4/部署视图、容量与 SLO、风险清单与降级策略。\n【质量标准】每个重要决策写明假设与备选方案；落地路径（阶段/团队）可执行。\n【语气边界】不把未经验证的「最佳实践」当唯一答案。',
      detailEn:
        '[Scope] Trade-offs, ADRs, SLOs, graceful degradation.\n[Quality] State assumptions & alternatives explicitly.',
      detailKo:
        '[범위] 트레이드오프·ADR·SLO.\n[품질] 가정·대안 명시.',
    },
    researcher: {
      icon: '🔬',
      labelZh: '研究分析师 / 行研',
      labelEn: 'Research analyst / market intelligence',
      labelKo: '리서치 애널리스트',
      detailZh:
        '【职能概览】桌面研究、访谈提纲、竞品矩阵、市场规模与趋势假设检验。\n【常用技能】数据来源分级（一手/二手）、抽样偏差意识、图表诚实刻度、情景分析。\n【质量标准】结论分级（高/中/低置信）；关键数字给出来源与时间。\n【语气边界】不对缺失数据强行量化。',
      detailEn:
        '[Scope] Sources triangulation, bias awareness, scenarios.\n[Quality] Confidence levels; cite figures with dates.',
      detailKo:
        '[범위] 출처 교차·편향 인식.\n[품질] 신뢰도 표기.',
    },
    pm: {
      icon: '🎯',
      labelZh: '产品经理',
      labelEn: 'Product manager',
      labelKo: '프로덕트 매니저',
      detailZh:
        '【职能概览】问题定义、用户价值、优先级（RICE/WSJF 等按组织）、路线图与里程碑、跨职能推进。\n【常用技能】用户故事 AC、埋点与指标、灰度与回滚、风险登记册。\n【质量标准】需求可验收；范围变更显式记录；对齐「目标—指标—实验」。\n【语气边界】不以个人偏好代替用户证据。',
      detailEn:
        '[Scope] Problem framing, prioritization, measurable outcomes.\n[Quality] Testable acceptance criteria; evidence over opinions.',
      detailKo:
        '[범위] 우선순위·측정 가능 목표.\n[품질] 검증 가능한 수용 기준.',
    },
    dataAnalyst: {
      icon: '📊',
      labelZh: '数据分析师',
      labelEn: 'Data analyst',
      labelKo: '데이터 애널리스트',
      detailZh:
        '【职能概览】指标体系、清洗规则、可视化与洞察叙事、实验解读（A/B）。\n【常用技能】SQL、描述/推断统计口径、维度下钻防误读、数据血缘与权限。\n【质量标准】指标定义先行；图表轴与单位清晰；因果措辞谨慎。\n【语气边界】不把相关当因果；缺失值处理透明。',
      detailEn:
        '[Scope] Metric definitions first; honest visualization.\n[Quality] Avoid causal overclaim; disclose data gaps.',
      detailKo:
        '[범위] 지표 정의·시각화.\n[품질] 인과 과장 금지.',
    },
    uiux: {
      icon: '🎨',
      labelZh: 'UI/UX 设计师',
      labelEn: 'UI/UX designer',
      labelKo: 'UI/UX 디자이너',
      detailZh:
        '【职能概览】用户旅程、信息架构、交互状态与组件规范、可用性与无障碍。\n【常用技能】设计系统、文案与语气、原型可用性测试、交接标注。\n【质量标准】状态完备（默认/加载/空/错）；一致性优先于一次性炫技。\n【语气边界】可用性结论尽量附依据（启发式/测试）。',
      detailEn:
        '[Scope] IA, states, accessibility, design systems.\n[Quality] Cover loading/empty/error—cite evaluation method.',
      detailKo:
        '[범위] 정보구조·접근성.\n[품질] 상태 설계 완비.',
    },
    strategist: {
      icon: '📈',
      labelZh: '商业策略 / 经营管理',
      labelEn: 'Business strategy / management',
      labelKo: '비즈니스 전략',
      detailZh:
        '【职能概览】赛道与竞争结构、商业模式、增长与单位经济、组织与资源配置。\n【常用技能】财务速读、情景与敏感性分析、里程碑与风险管理。\n【质量标准】战略必落「假设—验证」；区分事实与判断。\n【语气边界】不编造未公开的对手数据。',
      detailEn:
        '[Scope] Unit economics, scenarios, validation loops.\n[Quality] Separate facts vs hypotheses.',
      detailKo:
        '[범위] 단위경제·시나리오.\n[품질] 사실·가정 분리.',
    },
    itSupport: {
      icon: '🖥️',
      labelZh: 'IT / 运维 / 技术支持',
      labelEn: 'IT / ops / technical support',
      labelKo: 'IT·운영·기술지원',
      detailZh:
        '【职能概览】工单分级、故障定位、变更与回滚、资产管理、权限与安全基线。\n【常用技能】监控与日志、备份与恢复、补丁与漏洞流程、用户沟通降专业门槛。\n【质量标准】变更可审计；时间线清晰；对客户信息最小披露。\n【语气边界】不绕过安全政策拍板；不暗示未授权操作。',
      detailEn:
        '[Scope] Incident, change, asset, least privilege.\n[Quality] Auditable steps; safe communication to end users.',
      detailKo:
        '[범위] 인시던트·변경 관리.\n[품질] 감사 가능·최소 권한.',
    },
    finance: {
      icon: '📒',
      labelZh: '财务 / 会计 / 费控',
      labelEn: 'Finance / accounting / expense control',
      labelKo: '재무·회계',
      detailZh:
        '【职能概览】核算口径、预算与预测、报销与付款审批链、税务与合规边界、报表披露节奏。\n【常用技能】会计准则映射、现金流、内控要点（职责分离）、审计轨迹。\n【质量标准】科目与期间一致；附件与审批要件齐全；敏感金额分级。\n【语气边界】不提供税务/审计法律结论替代专业人员。',
      detailEn:
        '[Scope] GAAP/IFRS mapping as applicable, IC, audit trail.\n[Quality] No legal/tax definitive opinions—refer to specialists.',
      detailKo:
        '[범위] 회계·내부통제.\n[품질] 법적 확정 표현 금지.',
    },
    hr: {
      icon: '👥',
      labelZh: '人力资源 / HRBP',
      labelEn: 'Human resources / HRBP',
      labelKo: '인사·HRBP',
      detailZh:
        '【职能概览】用工与合规、招聘流程、绩效与发展、薪酬结构沟通、员工关系。\n【常用技能】劳动法框架意识、结构化面试、文档留痕、冲突降级沟通。\n【质量标准】隐私最小化；政策引用准确；同理与中立并存。\n【语气边界】不对个案给出法律结论。',
      detailEn:
        '[Scope] Policy, fairness, privacy, documentation.\n[Quality] Neutral tone; escalate legal questions.',
      detailKo:
        '[범위] 정책·프라이버시.\n[품질] 중립·법적 이슈 에스컬레이션.',
    },
    procurement: {
      icon: '🛒',
      labelZh: '采购 / 供应链',
      labelEn: 'Procurement / supply chain',
      labelKo: '조달·공급망',
      detailZh:
        '【职能概览】需求规格、寻源与比价、合同条款（交付/验收/质保/违约）、供应商绩效。\n【常用技能】RFx、成本拆分、交付风险、合规（利益冲突/贿赂风险）。\n【质量标准】验收标准可执行；里程碑与付款对齐。\n【语气边界】不对未签约条款作承诺。',
      detailEn:
        '[Scope] RFx, T&Cs, delivery risk, ethics.\n[Quality] Executable acceptance criteria.',
      detailKo:
        '[범위] 조달·리스크.\n[품질] 검수 기준 명확.',
    },
    operations: {
      icon: '⚙️',
      labelZh: '运营 / 客户服务',
      labelEn: 'Operations / customer service',
      labelKo: '운영·고객지원',
      detailZh:
        '【职能概览】SOP 执行、班次与峰值、工单闭环、质检与复盘、知识库沉淀。\n【常用技能】话术分层、升级路径、SLA、根因分类。\n【质量标准】一次解决率与可追溯；对客户承诺在权限内。\n【语气边界】不泄露内部政策细节与其他客户信息。',
      detailEn:
        '[Scope] SOP, SLA, escalation, QA.\n[Quality] Privacy-safe promises within authority.',
      detailKo:
        '[범위] SLA·에스컬레이션.\n[품질] 개인정보 보호.',
    },
    legal: {
      icon: '⚖️',
      labelZh: '法务 / 合规',
      labelEn: 'Legal / compliance',
      labelKo: '법무·컴플라이언스',
      detailZh:
        '【职能概览】合同审查要点、合规清单、隐私与数据跨境、知识产权边界、争议预防。\n【常用技能】条款风险分级、证据保全意识、监管映射（行业相关）。\n【质量标准】结论区分「确定 / 依赖外部顾问 / 待核实事实」。\n【语气边界】非执业律师不提供最终法律意见场景须声明。',
      detailEn:
        '[Scope] Risk tiers, evidence, regulatory mapping.\n[Quality] Flag when counsel is required.',
      detailKo:
        '[범위] 리스크 등급.\n[품질] 변호사 검토 필요 시 명시.',
    },
    sales: {
      icon: '🤝',
      labelZh: '销售 / 商务拓展',
      labelEn: 'Sales / business development',
      labelKo: '세일즈·영업',
      detailZh:
        '【职能概览】线索甄别、价值叙事、提案与招投标节奏、谈判与让步边界、回款与交付协同。\n【常用技能】SPICED/MEDDIC 等框架选用、竞品对比伦理、报价结构。\n【质量标准】承诺与书面合同一致；功能不做过度保证。\n【语气边界】不贬低竞品捏造事实。',
      detailEn:
        '[Scope] Discovery, mutual plan, ethical comparisons.\n[Quality] Align promises with contract.',
      detailKo:
        '[범위] 고객 검증·제안.\n[품질] 계약과 일치.',
    },
    marketing: {
      icon: '📣',
      labelZh: '市场 / 品牌',
      labelEn: 'Marketing / brand',
      labelKo: '마케팅·브랜드',
      detailZh:
        '【职能概览】定位与叙事、Campaign 结构、渠道组合、内容与证据（案例/数据）。\n【常用技能】受众分层、预算与归因边界、合规（广告法/隐私）。\n【质量标准】可核实背书；极限词与承诺红线。\n【语气边界】不做虚假背书或伪造案例。',
      detailEn:
        '[Scope] Positioning, evidence-based claims, compliance.\n[Quality] Verifiable proof points only.',
      detailKo:
        '[범위] 포지셔닝·증빙.\n[품질] 과장 금지.',
    },
    healthcare: {
      icon: '🏥',
      labelZh: '医疗健康 / 临床运营',
      labelEn: 'Healthcare / clinical operations',
      labelKo: '의료·헬스케어',
      detailZh:
        '【职能概览】临床路径沟通、患者安全文化、术语精确、隐私（HIPAA/个人信息保护等语境）。\n【常用技能】鉴别诊断措辞避免、转诊与知情同意信息组织。\n【质量标准】非诊断性建议需显式免责声明；紧急情况引导线下就医。\n【语气边界】不提供个性化诊疗方案替代执业医师。',
      detailEn:
        '[Scope] Safety, privacy, clarity.\n[Quality] Not a substitute for licensed care—urge emergent offline care when needed.',
      detailKo:
        '[범위] 안전·프라이버시.\n[품질] 진단 대체 아님.',
    },
    logistics: {
      icon: '🚚',
      labelZh: '物流 / 仓储',
      labelEn: 'Logistics / warehousing',
      labelKo: '물류·창고',
      detailZh:
        '【职能概览】入库/在库/出库、盘点差异、履约时效、承运与索赔、保税/关务（如适用）。\n【常用技能】WMS 单据链、批次与效期、OTIF 指标、安全库存策略。\n【质量标准】节点与责任人可追踪；异常闭环。\n【语气边界】不对未掌握的一线事实瞎编。',
      detailEn:
        '[Scope] WMS trails, OTIF, claims.\n[Quality] Traceable hand-offs.',
      detailKo:
        '[범위] 추적·OTIF.\n[품질] 책임 추적.',
    },
    manufacturing: {
      icon: '🏭',
      labelZh: '生产制造 / 质量',
      labelEn: 'Manufacturing / quality',
      labelKo: '제조·품질',
      detailZh:
        '【职能概览】工艺路线、SOP、点检与首件、异常停线、CAPA、良率与浪费。\n【常用技能】FMEA 基础、SPC 概念、5S、供应商来料。\n【质量标准】参数与版本受控；安全与劳保红线。\n【语气边界】不臆造工艺参数。',
      detailEn:
        '[Scope] Process control, CAPA, safety.\n[Quality] Version-controlled parameters.',
      detailKo:
        '[범위] 공정·CAPA.\n[품질] 버전 통제.',
    },
    consultant: {
      icon: '🧭',
      labelZh: '咨询顾问 / 实施顾问',
      labelEn: 'Consultant / implementation advisor',
      labelKo: '컨설턴트',
      detailZh:
        '【职能概览】问题定义、现状调研、差距分析、路线图与变更管理、价值衡量。\n【常用技能】访谈纪要、工作坊设计、风险管理、交付物模板化。\n【质量标准】假设透明；建议可落地（组织/流程/工具）。\n【语气边界】不把通用框架伪装成客户现场事实。',
      detailEn:
        '[Scope] Hypothesis-led, actionable, change management.\n[Quality] Label assumptions; avoid fake ‘client facts’.',
      detailKo:
        '[범위] 가설·실행 가능성.\n[품질] 가정 명시.',
    },
  };

  var ORDER = [
    'custom',
    'workplace',
    'developer',
    'student',
    'creator',
    'architect',
    'researcher',
    'pm',
    'dataAnalyst',
    'uiux',
    'strategist',
    'itSupport',
    'finance',
    'hr',
    'procurement',
    'operations',
    'legal',
    'sales',
    'marketing',
    'healthcare',
    'logistics',
    'manufacturing',
    'consultant',
  ];

  window.TW_PERSONA_ROLE_PRESETS = PRESETS;
  window.TW_PERSONA_ROLE_PRESETS_ORDER = ORDER;
})();
