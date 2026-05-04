/**
 * 从 src/_tw_zh_builtin.json 提取各图「Mermaid 渲染契约」块，生成
 * scripts/mermaid-contract-i18n-fragments.cjs（供 graphic-templates-i18n 引用）。
 * 修改 zh 契约后运行：node scripts/gen-mermaid-contract-fragments.cjs
 */
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const zhPath = path.join(root, "src", "_tw_zh_builtin.json");
const outPath = path.join(__dirname, "mermaid-contract-i18n-fragments.cjs");

const MARK = "【原始内容】：";
const HDR_ZH = "\n\n---\n## Mermaid 渲染契约（TalkWebSour）";

function extractContract(zhContent) {
  const s = String(zhContent ?? "");
  const i = s.indexOf(HDR_ZH);
  if (i === -1) return "";
  const j = s.indexOf(MARK, i);
  if (j === -1) return "";
  return s.slice(i, j);
}

const ZH_TO_EN = [
  ["Mermaid 11.x（与本扩展内置渲染器一致）", "Mermaid 11.x (same as this extension’s bundled renderer)"],
  ["Mermaid 11.x（radar-beta 与 curve 系列）", "Mermaid 11.x (radar-beta / curve syntax)"],
  ["Mermaid 11.x（ishikawa 图种建议 ≥11.12，与本项目依赖一致）", "Mermaid 11.x (ishikawa needs ≥11.12; matches this project)"],
  ["主交付物为 BPMN 2.0 XML 或结构化文本，非 Mermaid", "primary deliverable is BPMN 2.0 XML or structured text, not Mermaid"],
  ["本扩展内可渲染时须用 flowchart 表达 fork/join/并行", "when rendering inside this extension, express fork/join/parallelism with flowchart"],
  ["主输出可为 Markdown 树；若给 Mermaid 则用 flowchart + subgraph", "primary output may be a Markdown tree; if Mermaid is used, use flowchart + subgraph"],
  ["主交付为表格；可选附 Mermaid 四象限摘要", "primary deliverable is a table; optional Mermaid quadrant summary"],
  ["主交付为 Markdown 表；可选附对比摘要 flowchart", "primary deliverable is a Markdown table; optional comparison summary as flowchart"],
  ["主交付为表：阶段/行为/情绪/痛点；可选 timeline 或 flowchart 摘要", "primary deliverable is a table (stage / action / emotion / pain); optional timeline or flowchart summary"],
  ["分层结构用 flowchart + subgraph", "layered structure uses flowchart + subgraph"],
  ["步骤 + 耗时 + VA/NVA 标签", "steps + duration + VA/NVA labels"],
  ["去 ```mermaid 包裹与行首空白后，首条非空且非 `%%` 行须以之一开头，忽略大小写", "after stripping ```mermaid fences and leading spaces, the first non-empty non-`%%` line MUST start with one of these (case-insensitive)"],
  ["替换为你的主题与节点；ID 仅 ASCII", "replace with your topic and nodes; node IDs ASCII only"],
  ["仅当额外附「可渲染摘要图」时", "only when you also attach a renderable summary diagram"],
  ["可选附录；主输出仍为 BPMN", "optional appendix; primary output remains BPMN"],
  ["并行用多箭头表达；可再拆 subgraph", "parallelism via multiple arrows; you may split subgraphs further"],
  ["首行问题，后续缩进为类别/原因", "first line is the problem; following indentation encodes categories/causes"],
  ["仅附录 Mermaid 时", "only when a Mermaid appendix is included"],
  ["可选 timeline）", "optional timeline)"],
  ["可选）", "optional)"],
  ["（兼容旧写法）", "(legacy aliases)"],
  ["用中文/空格/特殊符号直接当节点 ID；未闭合的", "using CJK/spaces/special chars as raw node IDs; unbalanced"],
  ["等其他图种。", "or other diagram kinds as the first line."],
  ["把 BPMN 误写进 ```mermaid` 块且首行非法；在 Mermaid 块内使用 `@startuml`。", "invalid first line inside a ```mermaid` block; using `@startuml` inside Mermaid."],
  ["首行用 `flowchart` / `graph`；在状态名或事件名中未转义的特殊字符导致解析失败。", "first line is `flowchart`/`graph`; unescaped special chars in state/event names break parsing."],
  ["在 ```mermaid` 块内混用 PlantUML（`@startuml`）；首行使用非 flowchart 图种。", "mixing PlantUML (`@startuml`) inside ```mermaid`; first line is not a flowchart."],
  ["首行 `mindmap` 却混用 flowchart 连接符；subgraph 标题未加引号且含非法字符时不处理。", "first line is `mindmap` but uses flowchart edges; subgraph titles without quotes when needed."],
  ["首行 `flowchart`；在 mindmap 内使用 `-->` 流程边（mindmap 用缩进层级，不用箭头边）。", "first line is `flowchart`; using `-->` edges inside mindmap (mindmap uses indentation, not arrow edges)."],
  ["节点 ID 含中文或空格；汇报关系缺少箭头。", "node IDs contain CJK or spaces; missing reporting-line arrows."],
  ["首行 `gantt`；混用 flowchart 箭头语法。", "first line is `gantt`; mixing flowchart arrow syntax."],
  ["缺少 `dateFormat` 与 `title`（建议保留）；任务行格式随意导致解析失败；首行写成 `flowchart`。", "missing `dateFormat` and `title` (recommended); malformed task lines; first line is `flowchart`."],
  ["菱形判断未配两条及以上出边；叶节点无结论文本。", "decision diamonds without ≥2 outgoing edges; leaves without a conclusion label."],
  ["首行写成 `flowchart`；用 `fishbone` 关键字当首行（首行须为 `ishikawa`）；YAML 式键值描述原因。", "first line is `flowchart`; using `fishbone` as the first line (must be `ishikawa`); YAML-style cause lists."],
  ["节点 ID 含非 ASCII；无 ```mermaid` 闭合块。", "node IDs contain non-ASCII; missing a closed ```mermaid` fence."],
  ["组件 ID 用中文；缺少层级或连接关系。", "component IDs in CJK; missing layers or links."],
  ["参与者别名含未转义括号；消息行缺少冒号；首行错为 `flowchart`。", "participant aliases with unescaped parentheses; messages missing colons; wrong first line `flowchart`."],
  ["用非表格冒充 SWOT；Mermaid 块无四象限结构。", "non-table output posing as SWOT; Mermaid without four quadrants."],
  ["把评分表误写为 radar 或 gantt。", "turning a score matrix into radar or gantt by mistake."],
  ["首行单独 `radar`；YAML 式 `\"名称\": [1,2,3]`；缺少 `axis` 或 `curve`；curve 数值个数与 axis 数不一致。", "first line is bare `radar`; YAML `\"name\": [1,2,3]`; missing `axis` or `curve`; `curve` value count mismatches axes."],
  ["仅输出无序列表且用户需要可渲染图时无 ```mermaid`；子图无标题。", "only bullet lists when a renderable diagram is needed; subgraphs without titles."],
  ["timeline 与 flowchart 语法混在同一行。", "mixing timeline and flowchart syntax on one line."],
  ["无步骤顺序；未标注增值/非增值。", "no ordered steps; missing VA/NVA labels."],
];

function applyMap(s, pairs) {
  let o = s;
  for (const [a, b] of pairs) {
    o = o.split(a).join(b);
  }
  return o;
}

function zhBlockToEn(block) {
  let o = block;
  o = o.replace(/## Mermaid 渲染契约（TalkWebSour）/g, "## Mermaid render contract (TalkWebSour)");
  o = o.replace(/\*\*目标运行时\*\*/g, "**Target runtime**");
  o = o.replace(/\*\*allowedFirstLines\*\*/g, "**allowedFirstLines**");
  o = o.replace(/\*\*forbiddenPatterns\*\*/g, "**forbiddenPatterns**");
  o = o.replace(/\*\*minimalExample\*\*/g, "**minimalExample**");
  o = o.replace(/\*\*diagramType\*\*/g, "**diagramType**");
  o = applyMap(o, ZH_TO_EN);
  o = o.replace(/；首行写成/g, "; first line must not be");
  o = o.replace(/；/g, "; ");
  o = o.replace(/（/g, "(").replace(/）/g, ")").replace(/：/g, ":");
  o = o.replace(/\n{3,}/g, "\n\n");
  return o;
}

function zhBlockToKo(block) {
  const en = zhBlockToEn(block);
  return en
    .replace(/## Mermaid render contract \(TalkWebSour\)/g, "## Mermaid 렌더링 규약 (TalkWebSour)")
    .replace(/\*\*Target runtime\*\*/g, "**대상 런타임**");
}

function polishEnKo(s) {
  let o = s;
  o = o.replace(/\*\*allowedFirstLines\*\*\(/g, "**allowedFirstLines** (");
  o = o.replace(/\*\*minimalExample\*\*\(/g, "**minimalExample** (");
  o = o.replace(/\| `graph LR`\(legacy/g, "| `graph LR` (legacy");
  o = o.replace(/diagramType\*\*: bpmn_20\(/g, "diagramType**: bpmn_20 (");
  o = o.replace(/diagramType\*\*: flowchart_activity_style\(/g, "diagramType**: flowchart_activity_style (");
  o = o.replace(/diagramType\*\*: flowchart_tree\(/g, "diagramType**: flowchart_tree (");
  o = o.replace(/diagramType\*\*: swot_markdown_primary\(/g, "diagramType**: swot_markdown_primary (");
  o = o.replace(/diagramType\*\*: comparison_markdown_primary\(/g, "diagramType**: comparison_markdown_primary (");
  o = o.replace(/diagramType\*\*: flowchart_capability_map\(/g, "diagramType**: flowchart_capability_map (");
  o = o.replace(/diagramType\*\*: journey_markdown_primary\(/g, "diagramType**: journey_markdown_primary (");
  o = o.replace(/\*\*allowedFirstLines\*\*\(only when/g, "**allowedFirstLines** (only when");
  o = o.replace(/\*\*minimalExample\*\*\(optional\)\:\:/g, "**minimalExample** (optional):\n");
  o = o.replace(/\*\*minimalExample\*\*\(optional timeline\)\:\:/g, "**minimalExample** (optional timeline):\n");
  // 修复「**字段（说明）**:」被全角括号替换后丢失闭合 ** 的情况
  o = o.replace(
    /\*\*allowedFirstLines\(only when you also attach a renderable summary diagram\)\*\*:/g,
    "**allowedFirstLines** (only when you also attach a renderable summary diagram):",
  );
  o = o.replace(
    /\*\*minimalExample\(optional appendix; primary output remains BPMN\)\*\*:/g,
    "**minimalExample** (optional appendix; primary output remains BPMN):",
  );
  o = o.replace(/\*\*allowedFirstLines\(only when a Mermaid appendix is included\)\*\*:/g, "**allowedFirstLines** (only when a Mermaid appendix is included):");
  o = o.replace(/\*\*minimalExample\(optional\)\*\*:/g, "**minimalExample** (optional):");
  o = o.replace(/\*\*minimalExample\(optional timeline\)\*\*:/g, "**minimalExample** (optional timeline):");
  return o;
}

function main() {
  const zh = JSON.parse(fs.readFileSync(zhPath, "utf8"));
  const list = zh.graphicTemplates || [];
  const enFr = list.map((t) => polishEnKo(zhBlockToEn(extractContract(t.content))));
  const koFr = list.map((t) => polishEnKo(zhBlockToKo(extractContract(t.content))));
  if (enFr.some((x) => !x)) {
    throw new Error("Missing contract in some zh templates");
  }
  const esc = (arr) =>
    "[\n" +
    arr
      .map((s) => `  ${JSON.stringify(s)}`)
      .join(",\n") +
    "\n]";
  const file = `/**
 * 自动生成：node scripts/gen-mermaid-contract-fragments.cjs
 * 供 scripts/graphic-templates-i18n.cjs require
 */
'use strict';

module.exports.MERMAID_CONTRACT_EN = ${esc(enFr)};

module.exports.MERMAID_CONTRACT_KO = ${esc(koFr)};
`;
  fs.writeFileSync(outPath, file, "utf8");
  console.log("Wrote", outPath);
}

main();
