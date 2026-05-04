/**
 * 图形模版 20 条：英文 / 韩文全文（与 zh _tw_zh_builtin 逐条对齐）
 * 由 scripts/build-en-ko.cjs 合并进 tw-builtin-en.json / tw-builtin-ko.json
 * Mermaid 渲染契约片段：scripts/mermaid-contract-i18n-fragments.cjs（可由 gen-mermaid-contract-fragments.cjs 从 zh 重生成）
 */
'use strict';

const { MERMAID_CONTRACT_EN, MERMAID_CONTRACT_KO } = require('./mermaid-contract-i18n-fragments.cjs');

const GRAPHIC_EN_BASE = [
  {
    "title": "📐 1️⃣ Standard flowchart (Flowchart)",
    "content": "1️⃣ Standard flowchart (Flowchart)\n\nPurpose: The most universal way to express a process\nFormat: Nodes + conditional branches\nAI script template:\n\nGenerate a standard flowchart (Flowchart):\nTopic: [Fill in topic]\n\nRequirements:\n- Include start and end nodes\n- Use decision nodes for conditional branches\n- Begin each step with a verb\n- Keep the flow direction top-to-bottom\n- Mermaid must follow https://mermaid.js.org/syntax/flowchart.html (ASCII node IDs; human text in bracket labels)\n\nOutput format:\n- Mermaid flowchart\n\n"
  },
  {
    "title": "📐 2️⃣ BPMN (business process modeling)",
    "content": "2️⃣ BPMN (business process modeling)\n\nPurpose: Enterprise-grade processes (more standard than swimlanes alone)\nNotes: Events / gateways / tasks\n\nAI script:\n\nDescribe the following process using BPMN 2.0:\nTopic: [Fill in]\n\nRequirements:\n- Include start and end events\n- Use gateways for decisions\n- Separate user tasks from system tasks\n- Label participating roles\n\nOutput:\n- BPMN XML or structured text\n\n"
  },
  {
    "title": "📐 3️⃣ State machine diagram (State Machine)",
    "content": "3️⃣ State machine diagram (State Machine)\n\nPurpose: State changes (orders / users / systems)\n\nAI script:\n\nGenerate a state machine diagram (State Machine):\nSubject: [e.g. order status]\n\nRequirements:\n- Define a clear initial state\n- Every state must have transition triggers\n- Label state transitions\n- Mermaid must follow https://mermaid.js.org/syntax/stateDiagram.html\n\nOutput:\n- Mermaid stateDiagram\n\n"
  },
  {
    "title": "📐 4️⃣ Activity diagram (Activity Diagram)",
    "content": "4️⃣ Activity diagram (Activity Diagram)\n\nPurpose: Similar to a flowchart but emphasizes execution logic\n\nAI script:\n\nGenerate a UML Activity Diagram:\nTopic: [Fill in]\n\nRequirements:\n- Show parallel flows (fork/join)\n- Use decision nodes\n- Show execution paths\n- If using Mermaid, prefer flowchart syntax https://mermaid.js.org/syntax/flowchart.html\n\nOutput:\n- Mermaid or PlantUML\n\n"
  },
  {
    "title": "📐 5️⃣ Tree diagram (Tree Diagram)",
    "content": "5️⃣ Tree diagram (Tree Diagram)\n\nPurpose: Hierarchical structures (organization / taxonomy)\n\nAI script:\n\nGenerate a tree structure diagram:\nTopic: [Fill in]\n\nRequirements:\n- At least three levels\n- Clear categories per level\n- Use indentation for hierarchy\n- If using Mermaid, prefer flowchart + subgraph, see https://mermaid.js.org/syntax/flowchart.html\n\nOutput:\n- Markdown tree / Mermaid\n\n"
  },
  {
    "title": "📐 6️⃣ Mind map (Mind Map)",
    "content": "6️⃣ Mind map (Mind Map)\n\nPurpose: Brainstorming and ideation\n\nAI script:\n\nGenerate a mind map:\nCentral topic: [Fill in]\n\nRequirements:\n- At most six first-level branches\n- Each branch has sub-nodes\n- Short keywords\n- Mermaid mindmap must follow https://mermaid.js.org/syntax/mindmap.html\n\nOutput:\n- Mermaid mindmap\n\n"
  },
  {
    "title": "📐 7️⃣ Org chart (Org Chart)",
    "content": "7️⃣ Org chart (Org Chart)\n\nPurpose: Company / role structure\n\nAI script:\n\nGenerate an org chart:\nCompany / team: [Fill in]\n\nRequirements:\n- Show reporting lines\n- Separate departments\n- Label role responsibilities\n- If using Mermaid, prefer flowchart TD/LR: https://mermaid.js.org/syntax/flowchart.html\n\nOutput:\n- Mermaid or hierarchical list\n\n"
  },
  {
    "title": "📐 8️⃣ Timeline (Timeline)",
    "content": "8️⃣ Timeline (Timeline)\n\nPurpose: Event order\n\nAI script:\n\nGenerate a timeline diagram:\nTopic: [Fill in]\n\nRequirements:\n- Sort chronologically\n- Each point includes an event description\n- May group by phase\n- Mermaid timeline must follow https://mermaid.js.org/syntax/timeline.html\n\nOutput:\n- Mermaid timeline\n\n"
  },
  {
    "title": "📐 9️⃣ Gantt chart (Gantt)",
    "content": "9️⃣ Gantt chart (Gantt)\n\nPurpose: Project management\n\nAI script:\n\nGenerate a Gantt chart:\nProject: [Fill in]\n\nRequirements:\n- Each task has a start time and duration\n- Show dependencies\n- Group by phase\n- Mermaid gantt must follow https://mermaid.js.org/syntax/gantt.html\n\nOutput:\n- Mermaid gantt\n\n"
  },
  {
    "title": "📐 🔟 Decision tree (Decision Tree)",
    "content": "🔟 Decision tree (Decision Tree)\n\nPurpose: Choice paths\n\nAI script:\n\nGenerate a decision tree:\nQuestion: [Fill in]\n\nRequirements:\n- Each node is a decision\n- Each branch has a condition\n- End with concrete conclusions\n- If using Mermaid, use flowchart: https://mermaid.js.org/syntax/flowchart.html\n\nOutput:\n- Tree structure / Mermaid\n\n"
  },
  {
    "title": "📐 1️⃣1️⃣ Fishbone diagram (cause–effect)",
    "content": "1️⃣1️⃣ Fishbone diagram (cause–effect)\n\nPurpose: Problem analysis\n\nAI script:\n\nGenerate a fishbone (cause-and-effect) diagram:\nProblem: [Fill in]\n\nRequirements:\n- Main spine = the problem\n- At least four cause categories (e.g. people / process / tools / environment)\n- At least two causes per category\n- If using Mermaid ishikawa, follow https://mermaid.js.org/syntax/ishikawa.html\n\nOutput:\n- Structured text (or Mermaid ishikawa)\n\n"
  },
  {
    "title": "📐 1️⃣2️⃣ Data flow diagram (DFD)",
    "content": "1️⃣2️⃣ Data flow diagram (DFD)\n\nPurpose: System data flow\n\nAI script:\n\nGenerate a data flow diagram (DFD):\nSystem: [Fill in]\n\nRequirements:\n- Include sources, processes, and data stores\n- Label data flow direction\n- Layered (Level 0 / Level 1)\n- MUST include a renderable Mermaid block in ```mermaid ... ```; start with flowchart TD or flowchart LR\n- Node IDs: ASCII letters/digits/underscore only; put human-readable text in brackets, e.g. P1[\"Order service\"]\n- Official flowchart syntax: https://mermaid.js.org/syntax/flowchart.html\n\nOutput:\n- Short explanation + ```mermaid ... ```\n\n"
  },
  {
    "title": "📐 1️⃣3️⃣ Architecture diagram (Architecture Diagram)",
    "content": "1️⃣3️⃣ Architecture diagram (Architecture Diagram)\n\nPurpose: System design\n\nAI script:\n\nGenerate a system architecture diagram:\nSystem: [Fill in]\n\nRequirements:\n- Front end / back end / data layer\n- Label component relationships\n- Show interface / API calls\n- Include ```mermaid ... ``` (flowchart TD/LR); ASCII node IDs, labels in [\"...\"]\n- Official flowchart syntax: https://mermaid.js.org/syntax/flowchart.html\n\nOutput:\n- Brief notes + Mermaid diagram\n\n"
  },
  {
    "title": "📐 1️⃣4️⃣ Sequence diagram (Sequence Diagram)",
    "content": "1️⃣4️⃣ Sequence diagram (Sequence Diagram)\n\nPurpose: Interaction flows (e.g. APIs)\n\nAI script:\n\nGenerate a sequence diagram:\nScenario: [Fill in]\n\nRequirements:\n- Clear participants\n- Chronological message order\n- Label requests and responses\n- Mermaid sequenceDiagram must follow https://mermaid.js.org/syntax/sequenceDiagram.html\n\nOutput:\n- Mermaid sequenceDiagram\n\n"
  },
  {
    "title": "📐 1️⃣5️⃣ SWOT",
    "content": "1️⃣5️⃣ SWOT\n\nPurpose: Strategic analysis\n\nAI script:\n\nGenerate a SWOT analysis:\nSubject: [Fill in]\n\nRequirements:\n- Strength / Weakness / Opportunity / Threat\n- At least three bullets per quadrant\n\nOutput:\n- Table\n\n"
  },
  {
    "title": "📐 1️⃣6️⃣ Comparison matrix (Comparison Matrix)",
    "content": "1️⃣6️⃣ Comparison matrix (Comparison Matrix)\n\nPurpose: Product comparison\n\nAI script:\n\nGenerate a comparison matrix:\nSubjects: [A vs B]\n\nRequirements:\n- At least five dimensions\n- Use a table\n- Provide scores or ratings\n\nOutput:\n- Markdown table\n\n"
  },
  {
    "title": "📐 1️⃣7️⃣ Radar chart (Radar Chart)",
    "content": "1️⃣7️⃣ Radar chart (Radar Chart)\n\nPurpose: Multi-axis comparison (spider / radar)\n\nAI script:\n\nGenerate a renderable Mermaid radar chart (strictly follow official v11.6+ syntax).\nOfficial docs: https://mermaid.js.org/syntax/radar.html\nSubject: [Fill in]\n\nHard requirements:\n- First line MUST be radar-beta (not standalone radar)\n- Define axes with axis, e.g. axis reach[\"24/7 reach\"], eff[\"Efficiency\"]\n- Each series MUST use curve, e.g. curve c1[\"As-is\"]{2,2,3,2,1}; value count matches axis order\n- Do NOT use YAML-style \"Name\": [1,2,3] or 'Name': [1,2,3]; always use curve\n- Optional: title / max / min / showLegend / ticks / graticule\n\nMinimal valid skeleton (adapt axes and numbers):\nradar-beta\n  title Example\n  axis A[\"Axis A\"], B[\"Axis B\"], C[\"Axis C\"]\n  curve s1[\"Series 1\"]{1, 2, 3}\n  curve s2[\"Series 2\"]{3, 2, 1}\n  max 5\n  min 0\n\nOutput:\n- Short notes + one ```mermaid ... ``` block that Mermaid 11 can render\n\n"
  },
  {
    "title": "📐 1️⃣8️⃣ Capability map (Capability Map)",
    "content": "1️⃣8️⃣ Capability map (Capability Map)\n\nPurpose: Map system capabilities\n\nAI script:\n\nGenerate a capability map:\nSystem: [Fill in]\n\nRequirements:\n- Layers (core vs supporting capabilities)\n- Modular grouping\n\nOutput:\n- Layered structure\n\n"
  },
  {
    "title": "📐 1️⃣9️⃣ User journey map (User Journey)",
    "content": "1️⃣9️⃣ User journey map (User Journey)\n\nPurpose: Experience across touchpoints\n\nAI script:\n\nGenerate a user journey map:\nUser: [Fill in]\n\nRequirements:\n- Stage breakdown\n- User actions + emotions\n- Pain points\n\nOutput:\n- Table\n\n"
  },
  {
    "title": "📐 2️⃣0️⃣ Value stream map (Value Stream Map)",
    "content": "2️⃣0️⃣ Value stream map (Value Stream Map)\n\nPurpose: Lean process visualization\n\nAI script:\n\nGenerate a value stream map:\nProcess: [Fill in]\n\nRequirements:\n- Time per step\n- Label value-added vs non-value-added\n\nOutput:\n- Process structure\n\n"
  }
];

const GRAPHIC_KO_BASE = [
  {
    "title": "📐 1️⃣ 표준 흐름도(Flowchart)",
    "content": "1️⃣ 표준 흐름도(Flowchart)\n\n용도: 가장 범용적인 프로세스 표현\n형식: 노드 + 조건 분기\nAI 스크립트 템플릿:\n\n다음 표준 흐름도(Flowchart)를 생성하세요:\n주제: [주제 입력]\n\n요구사항:\n- 시작/종료 노드 포함\n- 조건 분기는 판별 노드로 표현\n- 각 단계는 동사로 시작\n- 흐름은 위에서 아래로 유지\n- Mermaid는 공식 문법을 준수: https://mermaid.js.org/syntax/flowchart.html (노드 ID는 ASCII, 한글은 대괄호 라벨)\n\n출력 형식:\n- Mermaid flowchart\n\n"
  },
  {
    "title": "📐 2️⃣ BPMN(업무 프로세스 모델링)",
    "content": "2️⃣ BPMN(업무 프로세스 모델링)\n\n용도: 엔터프라이즈급 프로세스(스윔레인만으로는 부족할 때 표준화)\n특징: 이벤트 / 게이트웨이 / 작업\n\nAI 스크립트:\n\n다음 프로세스를 BPMN 2.0으로 기술하세요:\n주제: [입력]\n\n요구사항:\n- 시작·종료 이벤트 포함\n- 판단은 게이트웨이로 표현\n- 사용자 작업과 시스템 작업 구분\n- 참여 역할 표기\n\n출력:\n- BPMN XML 또는 구조화된 텍스트\n\n"
  },
  {
    "title": "📐 3️⃣ 상태 머신 다이어그램(State Machine)",
    "content": "3️⃣ 상태 머신 다이어그램(State Machine)\n\n용도: 상태 변화(주문 / 사용자 / 시스템)\n\nAI 스크립트:\n\n상태 머신 다이어그램(State Machine)을 생성하세요:\n대상: [예: 주문 상태]\n\n요구사항:\n- 초기 상태를 명확히\n- 각 상태마다 전이 조건\n- 상태 전이 표기\n- Mermaid 공식 문법: https://mermaid.js.org/syntax/stateDiagram.html\n\n출력:\n- Mermaid stateDiagram\n\n"
  },
  {
    "title": "📐 4️⃣ 활동도(Activity Diagram)",
    "content": "4️⃣ 활동도(Activity Diagram)\n\n용도: 흐름도와 유사하나 실행 논리 강조\n\nAI 스크립트:\n\nUML Activity Diagram을 생성하세요:\n주제: [입력]\n\n요구사항:\n- 병렬 흐름(fork/join) 표현\n- 판단 노드 사용\n- 실행 경로 표현\n- Mermaid 사용 시 flowchart 권장: https://mermaid.js.org/syntax/flowchart.html\n\n출력:\n- Mermaid 또는 PlantUML\n\n"
  },
  {
    "title": "📐 5️⃣ 트리 다이어그램(Tree Diagram)",
    "content": "5️⃣ 트리 다이어그램(Tree Diagram)\n\n용도: 계층 구조(조직 / 분류)\n\nAI 스크립트:\n\n트리 구조 다이어그램을 생성하세요:\n주제: [입력]\n\n요구사항:\n- 최소 3단계 계층\n- 각 층 분류 명확\n- 들여쓰기로 계층 표현\n- Mermaid 사용 시 flowchart+subgraph 권장: https://mermaid.js.org/syntax/flowchart.html\n\n출력:\n- Markdown 트리 / Mermaid\n\n"
  },
  {
    "title": "📐 6️⃣ 마인드맵(Mind Map)",
    "content": "6️⃣ 마인드맵(Mind Map)\n\n용도: 발산적 사고·아이디어 정리\n\nAI 스크립트:\n\n마인드맵을 생성하세요:\n중심 주제: [입력]\n\n요구사항:\n- 1차 가지 최대 6개\n- 각 가지에 하위 노드\n- 키워드는 짧게\n- Mermaid mindmap 공식 문법: https://mermaid.js.org/syntax/mindmap.html\n\n출력:\n- Mermaid mindmap\n\n"
  },
  {
    "title": "📐 7️⃣ 조직도(Org Chart)",
    "content": "7️⃣ 조직도(Org Chart)\n\n용도: 회사·역할 구조\n\nAI 스크립트:\n\n조직도를 생성하세요:\n회사/팀: [입력]\n\n요구사항:\n- 상하 보고 관계 표시\n- 부서 구분\n- 역할·책임 표기\n- Mermaid 사용 시 flowchart TD/LR 권장: https://mermaid.js.org/syntax/flowchart.html\n\n출력:\n- Mermaid 또는 계층 목록\n\n"
  },
  {
    "title": "📐 8️⃣ 타임라인(Timeline)",
    "content": "8️⃣ 타임라인(Timeline)\n\n용도: 사건 순서\n\nAI 스크립트:\n\n타임라인 다이어그램을 생성하세요:\n주제: [입력]\n\n요구사항:\n- 시간순 정렬\n- 각 시점에 사건 설명\n- 단계별 구분 가능\n- Mermaid timeline 공식 문법: https://mermaid.js.org/syntax/timeline.html\n\n출력:\n- Mermaid timeline\n\n"
  },
  {
    "title": "📐 9️⃣ 간트 차트(Gantt)",
    "content": "9️⃣ 간트 차트(Gantt)\n\n용도: 프로젝트 관리\n\nAI 스크립트:\n\n간트 차트를 생성하세요:\n프로젝트: [입력]\n\n요구사항:\n- 각 작업에 시작 시각·기간\n- 의존 관계 표기\n- 단계 구분\n- Mermaid gantt 공식 문법: https://mermaid.js.org/syntax/gantt.html\n\n출력:\n- Mermaid gantt\n\n"
  },
  {
    "title": "📐 🔟 의사결정 트리(Decision Tree)",
    "content": "🔟 의사결정 트리(Decision Tree)\n\n용도: 선택 경로\n\nAI 스크립트:\n\n의사결정 트리를 생성하세요:\n질문: [입력]\n\n요구사항:\n- 각 노드는 판단\n- 각 분기에 조건\n- 최종 결론 도출\n- Mermaid 사용 시 flowchart: https://mermaid.js.org/syntax/flowchart.html\n\n출력:\n- 트리 구조 / Mermaid\n\n"
  },
  {
    "title": "📐 1️⃣1️⃣ 어골선도(원인–결과)",
    "content": "1️⃣1️⃣ 어골선도(원인–결과)\n\n용도: 문제 원인 분석\n\nAI 스크립트:\n\n어골선도(원인–결과)를 생성하세요:\n문제: [입력]\n\n요구사항:\n- 주축은 문제\n- 원인 범주 최소 4개(인력/프로세스/도구/환경 등)\n- 범주당 원인 최소 2개\n- Mermaid ishikawa 사용 시: https://mermaid.js.org/syntax/ishikawa.html\n\n출력:\n- 구조화된 텍스트(또는 Mermaid ishikawa)\n\n"
  },
  {
    "title": "📐 1️⃣2️⃣ 자료흐름도(DFD)",
    "content": "1️⃣2️⃣ 자료흐름도(DFD)\n\n용도: 시스템 데이터 흐름\n\nAI 스크립트:\n\n자료흐름도(DFD)를 생성하세요:\n시스템: [입력]\n\n요구사항:\n- 데이터 출처, 처리, 저장소 포함\n- 데이터 흐름 방향 표기\n- 계층(Level 0 / Level 1)\n- 반드시 ```mermaid ... ``` 코드 블록으로 출력; 첫 줄은 flowchart TD 또는 flowchart LR\n- 노드 ID는 영문/숫자/밑줄만; 한글 설명은 대괄호 라벨에, 예: P1[\"주문 처리\"]\n- flowchart 공식 문법: https://mermaid.js.org/syntax/flowchart.html\n\n출력:\n- 간단 설명 + ```mermaid ... ```\n\n"
  },
  {
    "title": "📐 1️⃣3️⃣ 아키텍처 다이어그램",
    "content": "1️⃣3️⃣ 아키텍처 다이어그램\n\n용도: 시스템 설계\n\nAI 스크립트:\n\n시스템 아키텍처 다이어그램을 생성하세요:\n시스템: [입력]\n\n요구사항:\n- 프런트엔드 / 백엔드 / 데이터 계층\n- 컴포넌트 관계 표기\n- 인터페이스·API 호출 표시\n- 반드시 ```mermaid ... ```(flowchart TD/LR); 노드 ID는 ASCII, 한글은 [\"라벨\"]\n- flowchart 공식 문법: https://mermaid.js.org/syntax/flowchart.html\n\n출력:\n- 요약 + Mermaid 도표\n\n"
  },
  {
    "title": "📐 1️⃣4️⃣ 시퀀스 다이어그램",
    "content": "1️⃣4️⃣ 시퀀스 다이어그램\n\n용도: 상호작용 흐름(API 등)\n\nAI 스크립트:\n\n시퀀스 다이어그램을 생성하세요:\n시나리오: [입력]\n\n요구사항:\n- 참여자 명확히\n- 시간 순 메시지\n- 요청·응답 표기\n- Mermaid sequenceDiagram 공식 문법: https://mermaid.js.org/syntax/sequenceDiagram.html\n\n출력:\n- Mermaid sequenceDiagram\n\n"
  },
  {
    "title": "📐 1️⃣5️⃣ SWOT",
    "content": "1️⃣5️⃣ SWOT\n\n용도: 전략 분석\n\nAI 스크립트:\n\nSWOT 분석을 생성하세요:\n대상: [입력]\n\n요구사항:\n- 강점/약점/기회/위협\n- 각 사분면 최소 3항목\n\n출력:\n- 표\n\n"
  },
  {
    "title": "📐 1️⃣6️⃣ 비교 매트릭스",
    "content": "1️⃣6️⃣ 비교 매트릭스\n\n용도: 제품 비교\n\nAI 스크립트:\n\n비교 매트릭스를 생성하세요:\n대상: [A 대 B]\n\n요구사항:\n- 비교 축 최소 5개\n- 표 형식\n- 점수·등급 부여\n\n출력:\n- Markdown 표\n\n"
  },
  {
    "title": "📐 1️⃣7️⃣ 레이더 차트",
    "content": "1️⃣7️⃣ 레이더 차트\n\n용도: 다축 비교(스파이더/레이더)\n\nAI 스크립트:\n\nMermaid 11(v11.6+) 공식 문법으로 렌더 가능한 레이더 차트를 생성하세요.\n공식 문서: https://mermaid.js.org/syntax/radar.html\n대상: [입력]\n\n필수:\n- 첫 줄은 radar-beta(단독 radar 금지)\n- axis로 축 정의, 예: axis reach[\"24시간 대응\"], eff[\"효율\"]\n- 각 시리즈는 curve로, 예: curve c1[\"현황\"]{2,2,3,2,1}; 값 개수는 axis 순서와 일치\n- YAML 스타일 \"이름\": [1,2,3] 또는 '이름': [1,2,3] 금지; 반드시 curve 키워드\n- 선택: title / max / min / showLegend / ticks / graticule\n\n최소 예시(구조만 참고):\nradar-beta\n  title 예시\n  axis A[\"축A\"], B[\"축B\"], C[\"축C\"]\n  curve s1[\"시리즈1\"]{1, 2, 3}\n  curve s2[\"시리즈2\"]{3, 2, 1}\n  max 5\n  min 0\n\n출력:\n- 간단 설명 + Mermaid 11이 렌더 가능한 ```mermaid ... ``` 블록 하나\n\n"
  },
  {
    "title": "📐 1️⃣8️⃣ 역량 맵(Capability Map)",
    "content": "1️⃣8️⃣ 역량 맵(Capability Map)\n\n용도: 시스템 역량 구조화\n\nAI 스크립트:\n\n역량 맵을 생성하세요:\n시스템: [입력]\n\n요구사항:\n- 계층(핵심 역량 / 지원 역량)\n- 모듈화\n\n출력:\n- 계층 구조\n\n"
  },
  {
    "title": "📐 1️⃣9️⃣ 사용자 여정 맵",
    "content": "1️⃣9️⃣ 사용자 여정 맵\n\n용도: 접점별 경험\n\nAI 스크립트:\n\n사용자 여정 맵을 생성하세요:\n사용자: [입력]\n\n요구사항:\n- 단계 구분\n- 사용자 행동 + 감정\n- 페인포인트\n\n출력:\n- 표\n\n"
  },
  {
    "title": "📐 2️⃣0️⃣ 가치 흐름도",
    "content": "2️⃣0️⃣ 가치 흐름도\n\n용도: 린 프로세스 시각화\n\nAI 스크립트:\n\n가치 흐름도를 생성하세요:\n프로세스: [입력]\n\n요구사항:\n- 단계별 소요 시간\n- 가치 부가 / 비가치 부가 구분\n\n출력:\n- 프로세스 구조\n\n"
  }
];

function stitchGraphicBody(baseRow, contractFrag, sourceTail) {
  return String(baseRow.content).replace(/\s+$/, '') + contractFrag + sourceTail;
}

const GRAPHIC_EN = GRAPHIC_EN_BASE.map((row, i) => ({
  title: row.title,
  content: stitchGraphicBody(row, MERMAID_CONTRACT_EN[i], '\n\n[SOURCE TEXT]:\n'),
}));

const GRAPHIC_KO = GRAPHIC_KO_BASE.map((row, i) => ({
  title: row.title,
  content: stitchGraphicBody(row, MERMAID_CONTRACT_KO[i], '\n\n[원문]:\n'),
}));

module.exports = { GRAPHIC_EN, GRAPHIC_KO };
