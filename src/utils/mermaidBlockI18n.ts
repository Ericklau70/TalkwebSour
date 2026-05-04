export type MermaidUiLang = "zh" | "en" | "ko";

export type MermaidBlockLabels = {
  view: string;
  edit: string;
  drag: string;
  png: string;
  jpeg: string;
  svg: string;
  del: string;
  sync: string;
  close: string;
  /** 嵌入模式下点击图表区域打开全屏查看页的提示 */
  clickFullscreenHint: string;
  /** 拖拽模式：非 flowchart 图（如 sequenceDiagram、radar-beta） */
  dragUnsupportedBody: string;
  /** 拖拽模式：flowchart 但未能解析出节点 */
  dragEmptyFlowchartBody: string;
  /** 插入样式套件 */
  insertStyles: string;
  /** 样式套用下拉（套件 / 步骤编号提示 / 部门图标提示） */
  styleApplyMenu: string;
  styleKitEnterprise: string;
  styleHintStepNumbers: string;
  styleHintDeptIcons: string;
  styleHintInserted: string;
  /** 插入片段下拉菜单 */
  insertSnippet: string;
  /** 主题切换 */
  themeBright: string;
  themeDark: string;
  themePrint: string;
  /** 片段名称 */
  snippetDecision: string;
  snippetSubgraph: string;
  snippetInfoFlow: string;
  snippetLoop: string;
  /** 样式已存在提示 */
  stylesAlreadyExist: string;
  stylesInserted: string;
  /** 预览标题 */
  previewTitle: string;
  /** 拖拽模式：节点样式面板 */
  nodeStyleHint: string;
  nodeStyleSelectNode: string;
  /** AI 优化 Mermaid（经扩展后台调用已保存 API） */
  aiRefineMermaid: string;
  aiRefinePlaceholder: string;
  aiRefineUndo: string;
  aiRefineOk: string;
  aiRefineBusy: string;
  aiRefineErrNoKey: string;
  aiRefineErrUnsupported: string;
  aiRefineErrHttp: string;
  aiRefineErrTimeout: string;
  aiRefineErrEmpty: string;
  aiRefineErrGeneric: string;
  aiRefineUndone: string;
  aiRepair: string;
  aiRepairHint: string;
  aiTranslate: string;
  aiTranslateBusy: string;
  aiTranslateOk: string;
  aiTranslateTargetEn: string;
  aiTranslateTargetKo: string;
  aiTranslateTargetJa: string;
  aiTranslateErr: string;
  deptColorQuick: string;
  deptFinance: string;
  deptIT: string;
  deptHR: string;
  deptOps: string;
  deptLegal: string;
  edgeColorQuick: string;
  edgeColorApplied: string;
  nodeColorApplied: string;
  renderValidateFailed: string;
  snippetParallel: string;
  snippetCrossLane: string;
  snippetHandoff: string;
  snippetBatchClass: string;
  snippetStepSkeleton: string;
  snippetDeptEmojiSample: string;
  snippetForkJoin: string;
  snippetExceptionPath: string;
  snippetBusinessApproval: string;
  snippetTechArchitecture: string;
  snippetProjectTimeline: string;
  snippetDataPipeline: string;
  snippetIncidentResponse: string;
  snippetAiOptimizeHint: string;
  nodeFillColor: string;
  nodeTextColor: string;
  nodeBorderColor: string;
  edgeColorDropdown: string;
  compactness: string;
  compactnessHint: string;
};

const TABLES: Record<MermaidUiLang, MermaidBlockLabels> = {
  zh: {
    view: "查看",
    edit: "编辑",
    drag: "拖拽",
    png: "PNG",
    jpeg: "JPEG",
    svg: "SVG",
    del: "删除",
    sync: "Mermaid（自动同步）",
    close: "关闭窗口",
    clickFullscreenHint: "点击图表全屏查看（新开 Chrome 窗口）",
    dragUnsupportedBody:
      "拖拽布局仅支持以 graph / flowchart 开头的流程图。当前图类型不在支持范围内，请在「编辑」中改为 flowchart，或改用「查看」模式。",
    dragEmptyFlowchartBody:
      "未能从当前代码解析出可拖拽的节点。请使用 flowchart TD/LR，并包含 A[标签] 独立行或 A-->B 连线后再试。",
    insertStyles: "样式套件",
    styleApplyMenu: "样式套用",
    styleKitEnterprise: "企业 classDef 套件",
    styleHintStepNumbers: "步骤编号提示（TW_HINT）",
    styleHintDeptIcons: "部门图标映射提示（TW_HINT）",
    styleHintInserted: "已插入样式提示",
    insertSnippet: "插入片段",
    themeBright: "明亮",
    themeDark: "暗色",
    themePrint: "打印",
    snippetDecision: "判断节点",
    snippetSubgraph: "子图分组",
    snippetInfoFlow: "信息流（虚线）",
    snippetLoop: "循环结构",
    stylesAlreadyExist: "样式定义已存在",
    stylesInserted: "已插入样式套件",
    previewTitle: "实时预览",
    nodeStyleHint: "节点样式（部门 / 类型）",
    nodeStyleSelectNode: "点击画布上的节点后选择样式",
    aiRefineMermaid: "AI 优化",
    aiRefinePlaceholder: "可选说明（如：合并样式、统一配色）",
    aiRefineUndo: "撤销 AI",
    aiRefineOk: "已应用 AI 结果",
    aiRefineBusy: "AI 处理中…",
    aiRefineErrNoKey: "请先在侧栏设置中填写 AI API Key",
    aiRefineErrUnsupported: "当前服务商暂不支持此功能，请换 OpenAI 兼容或 DeepSeek/Ollama",
    aiRefineErrHttp: "API 请求失败，请检查网络与 Base URL",
    aiRefineErrTimeout: "请求超时，请稍后再试",
    aiRefineErrEmpty: "模型未返回有效代码",
    aiRefineErrGeneric: "操作失败，请重试",
    aiRefineUndone: "已恢复 AI 应用前的版本",
    aiRepair: "AI 修复",
    aiRepairHint: "仅修复语法/样式冲突，不改业务内容",
    aiTranslate: "翻译文本",
    aiTranslateBusy: "翻译中…",
    aiTranslateOk: "翻译完成并通过渲染校验",
    aiTranslateTargetEn: "英文",
    aiTranslateTargetKo: "韩文",
    aiTranslateTargetJa: "日文",
    aiTranslateErr: "翻译后渲染失败，已回滚",
    deptColorQuick: "部门快捷配色",
    deptFinance: "财务",
    deptIT: "IT",
    deptHR: "人力",
    deptOps: "运营",
    deptLegal: "法务",
    edgeColorQuick: "连线颜色",
    edgeColorApplied: "已应用连线颜色",
    nodeColorApplied: "已应用节点部门色",
    renderValidateFailed: "渲染校验未通过，已恢复到变更前版本",
    snippetParallel: "并行分支",
    snippetCrossLane: "跨泳道",
    snippetHandoff: "交接/升级",
    snippetBatchClass: "批量 class 示例",
    snippetStepSkeleton: "顺序步骤示例（01/02）",
    snippetDeptEmojiSample: "部门 emoji + class 示例",
    snippetForkJoin: "分叉汇合",
    snippetExceptionPath: "校验/异常分支",
    snippetBusinessApproval: "业务审批链路",
    snippetTechArchitecture: "技术架构分层",
    snippetProjectTimeline: "项目里程碑与风险",
    snippetDataPipeline: "数据管道（采集到消费）",
    snippetIncidentResponse: "故障响应与回滚",
    snippetAiOptimizeHint: "AI 优化说明（注释）",
    nodeFillColor: "节点填充",
    nodeTextColor: "节点文字",
    nodeBorderColor: "节点边框",
    edgeColorDropdown: "连线下拉配色",
    compactness: "紧凑度",
    compactnessHint: "调节布局紧凑度（仅影响编辑预览）",
  },
  en: {
    view: "View",
    edit: "Edit",
    drag: "Drag",
    png: "PNG",
    jpeg: "JPEG",
    svg: "SVG",
    del: "Remove",
    sync: "Mermaid (live sync)",
    close: "Close window",
    clickFullscreenHint: "Click the diagram to open fullscreen in a new window",
    dragUnsupportedBody:
      "Drag mode only supports diagrams that start with graph / flowchart. This diagram type is not supported—switch to Edit and use a flowchart, or stay in View.",
    dragEmptyFlowchartBody:
      "No draggable nodes were parsed. Use flowchart TD/LR with lines like A[label] and/or A-->B, then try again.",
    insertStyles: "Style Kit",
    styleApplyMenu: "Style presets",
    styleKitEnterprise: "Enterprise classDef kit",
    styleHintStepNumbers: "Step-number hint (TW_HINT)",
    styleHintDeptIcons: "Dept icon mapping hint (TW_HINT)",
    styleHintInserted: "Style hint inserted",
    insertSnippet: "Snippets",
    themeBright: "Bright",
    themeDark: "Dark",
    themePrint: "Print",
    snippetDecision: "Decision Node",
    snippetSubgraph: "Subgraph",
    snippetInfoFlow: "Info Flow (dashed)",
    snippetLoop: "Loop",
    stylesAlreadyExist: "Style definitions already exist",
    stylesInserted: "Style kit inserted",
    previewTitle: "Live Preview",
    nodeStyleHint: "Node style (dept / type)",
    nodeStyleSelectNode: "Click a node, then pick a class",
    aiRefineMermaid: "AI refine",
    aiRefinePlaceholder: "Optional note (e.g. merge styles, fix colors)",
    aiRefineUndo: "Undo AI",
    aiRefineOk: "Applied AI result",
    aiRefineBusy: "AI working…",
    aiRefineErrNoKey: "Add an API key in the sidebar settings first",
    aiRefineErrUnsupported: "This provider is not supported here; use OpenAI-compatible, DeepSeek, or Ollama",
    aiRefineErrHttp: "API request failed — check network and Base URL",
    aiRefineErrTimeout: "Request timed out",
    aiRefineErrEmpty: "Model returned no usable code",
    aiRefineErrGeneric: "Something went wrong — try again",
    aiRefineUndone: "Restored the version before AI",
    aiRepair: "AI repair",
    aiRepairHint: "Fix syntax/style only, keep business content",
    aiTranslate: "Translate text",
    aiTranslateBusy: "Translating…",
    aiTranslateOk: "Translated and render check passed",
    aiTranslateTargetEn: "English",
    aiTranslateTargetKo: "Korean",
    aiTranslateTargetJa: "Japanese",
    aiTranslateErr: "Render failed after translation, rolled back",
    deptColorQuick: "Department color presets",
    deptFinance: "Finance",
    deptIT: "IT",
    deptHR: "HR",
    deptOps: "Operations",
    deptLegal: "Legal",
    edgeColorQuick: "Edge color",
    edgeColorApplied: "Edge color applied",
    nodeColorApplied: "Node department color applied",
    renderValidateFailed: "Render validation failed, restored previous version",
    snippetParallel: "Parallel paths",
    snippetCrossLane: "Cross-lane link",
    snippetHandoff: "Handoff / escalation",
    snippetBatchClass: "Batch class example",
    snippetStepSkeleton: "Step index sample (01/02)",
    snippetDeptEmojiSample: "Dept emoji + class sample",
    snippetForkJoin: "Fork / join",
    snippetExceptionPath: "Validation / exception path",
    snippetBusinessApproval: "Business approval flow",
    snippetTechArchitecture: "Layered tech architecture",
    snippetProjectTimeline: "Project milestones + risks",
    snippetDataPipeline: "Data pipeline",
    snippetIncidentResponse: "Incident response + rollback",
    snippetAiOptimizeHint: "AI optimize note (comment)",
    nodeFillColor: "Node fill",
    nodeTextColor: "Node text",
    nodeBorderColor: "Node border",
    edgeColorDropdown: "Edge color dropdown",
    compactness: "Compactness",
    compactnessHint: "Adjust layout compactness (preview only)",
  },
  ko: {
    view: "보기",
    edit: "편집",
    drag: "드래그",
    png: "PNG",
    jpeg: "JPEG",
    svg: "SVG",
    del: "삭제",
    sync: "Mermaid (동기화)",
    close: "창 닫기",
    clickFullscreenHint: "도표를 클릭하면 새 창에서 전체 화면으로 열립니다",
    dragUnsupportedBody:
      "드래그 편집은 graph / flowchart 로 시작하는 흐름도만 지원합니다. 다른 다이어그램은 「편집」에서 flowchart 로 바꾸거나 「보기」를 사용하세요.",
    dragEmptyFlowchartBody:
      "드래그할 노드를 찾지 못했습니다. flowchart TD/LR 과 A[라벨] 단독 줄 또는 A-->B 연결을 사용한 뒤 다시 시도하세요.",
    insertStyles: "스타일 키트",
    styleApplyMenu: "스타일 적용",
    styleKitEnterprise: "엔터프라이즈 classDef 키트",
    styleHintStepNumbers: "단계 번호 힌트 (TW_HINT)",
    styleHintDeptIcons: "부서 아이콘 매핑 힌트 (TW_HINT)",
    styleHintInserted: "스타일 힌트 삽입됨",
    insertSnippet: "스니펫 삽입",
    themeBright: "밝게",
    themeDark: "어둡게",
    themePrint: "인쇄",
    snippetDecision: "판단 노드",
    snippetSubgraph: "서브그래프",
    snippetInfoFlow: "정보 흐름 (점선)",
    snippetLoop: "루프 구조",
    stylesAlreadyExist: "스타일 정의가 이미 존재합니다",
    stylesInserted: "스타일 키트가 삽입되었습니다",
    previewTitle: "실시간 미리보기",
    nodeStyleHint: "노드 스타일 (부서/유형)",
    nodeStyleSelectNode: "노드를 클릭한 뒤 스타일 선택",
    aiRefineMermaid: "AI 다듬기",
    aiRefinePlaceholder: "추가 요청 (스타일 병합 등)",
    aiRefineUndo: "AI 실행 취소",
    aiRefineOk: "AI 결과 적용됨",
    aiRefineBusy: "AI 처리 중…",
    aiRefineErrNoKey: "사이드바 설정에서 API 키를 입력하세요",
    aiRefineErrUnsupported: "이 제공자는 여기서 미지원입니다. OpenAI 호환·DeepSeek·Ollama를 사용하세요",
    aiRefineErrHttp: "API 요청 실패 — 네트워크와 Base URL 확인",
    aiRefineErrTimeout: "시간 초과",
    aiRefineErrEmpty: "모델이 코드를 반환하지 않았습니다",
    aiRefineErrGeneric: "실패했습니다. 다시 시도하세요",
    aiRefineUndone: "AI 적용 이전 버전으로 복원했습니다",
    aiRepair: "AI 복구",
    aiRepairHint: "문법/스타일만 복구, 업무 내용은 유지",
    aiTranslate: "텍스트 번역",
    aiTranslateBusy: "번역 중…",
    aiTranslateOk: "번역 완료 및 렌더 검증 통과",
    aiTranslateTargetEn: "영어",
    aiTranslateTargetKo: "한국어",
    aiTranslateTargetJa: "일본어",
    aiTranslateErr: "번역 후 렌더 실패, 이전 버전으로 복원",
    deptColorQuick: "부서 빠른 색상",
    deptFinance: "재무",
    deptIT: "IT",
    deptHR: "인사",
    deptOps: "운영",
    deptLegal: "법무",
    edgeColorQuick: "연결선 색상",
    edgeColorApplied: "연결선 색상 적용됨",
    nodeColorApplied: "노드 부서 색상 적용됨",
    renderValidateFailed: "렌더 검증 실패로 이전 버전 복원",
    snippetParallel: "병렬 분기",
    snippetCrossLane: "레인 간 연결",
    snippetHandoff: "인수인계/에스컬레이션",
    snippetBatchClass: "일괄 class 예시",
    snippetStepSkeleton: "순서 단계 예시 (01/02)",
    snippetDeptEmojiSample: "부서 이모지 + class 예시",
    snippetForkJoin: "분기/합류",
    snippetExceptionPath: "검증/예외 분기",
    snippetBusinessApproval: "업무 승인 흐름",
    snippetTechArchitecture: "기술 아키텍처 계층",
    snippetProjectTimeline: "프로젝트 마일스톤/리스크",
    snippetDataPipeline: "데이터 파이프라인",
    snippetIncidentResponse: "장애 대응/롤백",
    snippetAiOptimizeHint: "AI 최적화 안내 (주석)",
    nodeFillColor: "노드 채우기",
    nodeTextColor: "노드 텍스트",
    nodeBorderColor: "노드 테두리",
    edgeColorDropdown: "연결선 드롭다운 색상",
    compactness: "밀집도",
    compactnessHint: "레이아웃 밀집도 조절 (편집 미리보기 전용)",
  },
};

export function normalizeMermaidUiLang(raw: string | undefined): MermaidUiLang {
  const l = String(raw || "zh").toLowerCase();
  if (l === "ko") return "ko";
  if (l === "en") return "en";
  return "zh";
}

export function getMermaidBlockLabels(lang: string | undefined): MermaidBlockLabels {
  return TABLES[normalizeMermaidUiLang(lang)] ?? TABLES.zh;
}
