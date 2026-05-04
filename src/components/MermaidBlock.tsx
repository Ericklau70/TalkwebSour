import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties } from "react";
import ReactFlow, {
  Background,
  Controls,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  MarkerType,
} from "reactflow";
import type { Connection, Edge, Node } from "reactflow";
import { toJpeg, toPng } from "html-to-image";
import type { Options as HtmlToImageOptions } from "html-to-image/lib/types";
import { mermaidToFlow } from "../utils/mermaidToFlow";
import {
  getMermaidBlockLabels,
  normalizeMermaidUiLang,
  type MermaidUiLang,
} from "../utils/mermaidBlockI18n";

type Mode = "view" | "edit" | "drag";
type DiagramSize = { w: number; h: number };
type MermaidTheme = "bright" | "dark" | "print";

/** Enterprise + 语义色；含标记行供「样式套件」去重检测 */
export const MERMAID_ENTERPRISE_MARKER = "TalkWebSour enterprise style kit";

/** 步骤编号：插入到图中供 AI 优化时对齐全文 */
const MERMAID_STEP_NUMBER_HINT = `%% TW_HINT: 请为主要流程步骤节点标题添加顺序编号（如 01、02 或 Step1），全文风格一致。`;

/** 部门与 emoji / class 映射，便于 AI 按部门着色 */
const MERMAID_DEPT_ICON_HINT = `%% TW_HINT — 部门图标参考：财务💰·class dept_fin · IT研发💻·dept_rd · 人力👥·dept_hr · 法务⚖️·dept_legal · 运营🔧·dept_ops · 高管📋·dept_exec`;

/** 全局样式套件 - 对应 mermaid-global-rules.zh.txt */
const MERMAID_STYLE_KIT = `%% ${MERMAID_ENTERPRISE_MARKER}
%% === Global + enterprise classes ===
classDef va fill:#052e16,stroke:#22c55e,color:#bbf7d0,stroke-width:2px;
classDef nva fill:#3f0d0d,stroke:#ef4444,color:#fecaca,stroke-width:2px;
classDef wait fill:#1e293b,stroke:#64748b,color:#cbd5f5,stroke-dasharray:5 5;
classDef decision fill:#1e293b,stroke:#facc15,color:#fef9c3,stroke-width:2px;
classDef bottleneck fill:#3b1d00,stroke:#f97316,color:#fed7aa,stroke-width:3px;
classDef dept_exec fill:#1e3a5f,stroke:#60a5fa,color:#e0f2fe,stroke-width:2px;
classDef dept_sales fill:#14532d,stroke:#22c55e,color:#dcfce7,stroke-width:2px;
classDef dept_rd fill:#3b0764,stroke:#c084fc,color:#fae8ff,stroke-width:2px;
classDef dept_ops fill:#431407,stroke:#ea580c,color:#ffedd5,stroke-width:2px;
classDef dept_fin fill:#422006,stroke:#eab308,color:#fef9c3,stroke-width:2px;
classDef dept_hr fill:#831843,stroke:#fb7185,color:#ffe4e6,stroke-width:2px;
classDef dept_legal fill:#164e63,stroke:#22d3ee,color:#cffafe,stroke-width:2px;
classDef dept_mkt fill:#4c0519,stroke:#f472b6,color:#fce7f3,stroke-width:2px;
classDef dept_product fill:#0c4a6e,stroke:#38bdf8,color:#e0f2fe,stroke-width:2px;
classDef dept_support fill:#134e4a,stroke:#2dd4bf,color:#ccfbf1,stroke-width:2px;
classDef dept_sec fill:#1c1917,stroke:#a8a29e,color:#f5f5f4,stroke-width:2px;
classDef lane_customer fill:#0f172a,stroke:#64748b,color:#e2e8f0,stroke-dasharray:4 3;
classDef lane_partner fill:#1e1b4b,stroke:#818cf8,color:#e0e7ff,stroke-dasharray:4 3;
%% === End ===`;

/** 主题初始化指令 */
const THEME_INIT: Record<MermaidTheme, string> = {
  bright: `%%{init:{'theme':'base','themeVariables':{'darkMode':false,'background':'#ffffff','fontFamily':'ui-sans-serif,system-ui,\"Segoe UI\",Roboto,\"Helvetica Neue\",Arial,sans-serif','fontSize':'13px','primaryColor':'#dbeafe','primaryTextColor':'#0f172a','primaryBorderColor':'#2563eb','secondaryColor':'#fef3c7','tertiaryColor':'#f1f5f9','edgeLabelBackground':'#ffffff','lineColor':'#334155','clusterBkg':'#f8fafc','clusterBorder':'#cbd5e1','nodeBorder':'#64748b','mainBkg':'#ffffff','titleColor':'#0f172a','nodeTextColor':'#0f172a','actorBkg':'#dbeafe','actorBorder':'#2563eb','actorTextColor':'#0f172a','signalColor':'#475569','signalTextColor':'#334155','labelBoxBkgColor':'#f8fafc','labelBoxBorderColor':'#cbd5e1','labelTextColor':'#1e293b','loopTextColor':'#475569'}}}}%%`,
  dark: `%%{init: {'theme':'dark','themeVariables':{'darkMode':true,'background':'#0f172a','primaryColor':'#1e3a5f','primaryTextColor':'#e2e8f0','primaryBorderColor':'#3b82f6','lineColor':'#94a3b8','secondaryColor':'#422006','tertiaryColor':'#1e293b','nodeTextColor':'#f1f5f9'}}}%%`,
  print: `%%{init: {'theme':'base','themeVariables':{'darkMode':false,'background':'#ffffff','primaryColor':'#ffffff','primaryTextColor':'#000000','primaryBorderColor':'#000000','lineColor':'#000000','secondaryColor':'#f5f5f5','tertiaryColor':'#fafafa','nodeTextColor':'#000000'}}}%%`,
};

/** 拖拽模式可选节点类型（需先插入样式套件内含 classDef） */
const NODE_STYLE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "— none —" },
  { value: "va", label: "va · value-add" },
  { value: "nva", label: "nva · non-value" },
  { value: "wait", label: "wait · wait" },
  { value: "decision", label: "decision · decision" },
  { value: "bottleneck", label: "bottleneck · bottleneck" },
  { value: "dept_exec", label: "dept_exec · Executive" },
  { value: "dept_sales", label: "dept_sales · Sales" },
  { value: "dept_rd", label: "dept_rd · R&D" },
  { value: "dept_ops", label: "dept_ops · Operations" },
  { value: "dept_fin", label: "dept_fin · Finance" },
  { value: "dept_hr", label: "dept_hr · HR" },
  { value: "dept_legal", label: "dept_legal · Legal" },
  { value: "dept_mkt", label: "dept_mkt · Marketing" },
  { value: "dept_product", label: "dept_product · Product" },
  { value: "dept_support", label: "dept_support · Support" },
  { value: "dept_sec", label: "dept_sec · Security" },
  { value: "lane_customer", label: "lane_customer · Customer lane" },
  { value: "lane_partner", label: "lane_partner · Partner lane" },
];

const QUICK_DEPT_CLASSES = [
  "dept_fin",
  "dept_sec",
  "dept_hr",
  "dept_ops",
  "dept_legal",
] as const;

const QUICK_EDGE_COLORS = [
  { key: "finance", color: "#ef4444" },
  { key: "it", color: "#22c55e" },
  { key: "hr", color: "#f472b6" },
  { key: "ops", color: "#f59e0b" },
  { key: "legal", color: "#06b6d4" },
] as const;

const COLOR_PRESET_OPTIONS = [
  { value: "", label: "Default" },
  { value: "#dbeafe", label: "Blue-100" },
  { value: "#dcfce7", label: "Green-100" },
  { value: "#fef3c7", label: "Amber-100" },
  { value: "#fee2e2", label: "Red-100" },
  { value: "#ede9fe", label: "Violet-100" },
  { value: "#e0f2fe", label: "Sky-100" },
  { value: "#f5f5f4", label: "Stone-100" },
] as const;

const COLOR_TEXT_OPTIONS = [
  { value: "", label: "Default" },
  { value: "#0f172a", label: "Slate-900" },
  { value: "#1e293b", label: "Slate-800" },
  { value: "#334155", label: "Slate-700" },
  { value: "#ffffff", label: "White" },
] as const;

const COLOR_BORDER_OPTIONS = [
  { value: "", label: "Default" },
  { value: "#2563eb", label: "Blue-600" },
  { value: "#16a34a", label: "Green-600" },
  { value: "#d97706", label: "Amber-600" },
  { value: "#dc2626", label: "Red-600" },
  { value: "#9333ea", label: "Purple-600" },
  { value: "#0f766e", label: "Teal-700" },
  { value: "#475569", label: "Slate-600" },
] as const;

const EDGE_COLOR_OPTIONS = [
  { value: "", label: "Default" },
  { value: "#2563eb", label: "Blue-600" },
  { value: "#16a34a", label: "Green-600" },
  { value: "#dc2626", label: "Red-600" },
  { value: "#9333ea", label: "Purple-600" },
  { value: "#d97706", label: "Amber-600" },
  { value: "#0f766e", label: "Teal-700" },
  { value: "#475569", label: "Slate-600" },
] as const;

function upsertNodeClassOnly(code: string, nodeId: string, nextClass: string): string {
  const lines = String(code || "").split(/\r?\n/);
  const classLine = /^\s*class\s+([A-Za-z0-9_,\s]+)\s+([A-Za-z0-9_]+)\s*$/i;
  const out: string[] = [];
  for (const line of lines) {
    const m = line.match(classLine);
    if (!m) {
      out.push(line);
      continue;
    }
    const ids = m[1]
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .filter((x) => x !== nodeId);
    if (ids.length) out.push(`class ${ids.join(",")} ${m[2]}`);
  }
  if (nextClass.trim()) out.push(`class ${nodeId} ${nextClass.trim()}`);
  return out.join("\n");
}

function upsertNodeInlineStyle(
  code: string,
  nodeId: string,
  patch: { fill?: string; color?: string; stroke?: string },
): string {
  const styleLine = new RegExp(`^\\s*style\\s+${nodeId}\\s+(.+)\\s*$`, "i");
  const lines = String(code || "").split(/\r?\n/);
  let current: Record<string, string> = {};
  const next = lines.filter((line) => {
    const m = line.match(styleLine);
    if (!m) return true;
    String(m[1] || "")
      .split(",")
      .forEach((part) => {
        const [kRaw, vRaw] = part.split(":");
        const k = String(kRaw || "").trim().toLowerCase();
        const v = String(vRaw || "").trim();
        if (k && v) current[k] = v;
      });
    return false;
  });
  if ("fill" in patch) {
    if (patch.fill) current.fill = patch.fill;
    else delete current.fill;
  }
  if ("color" in patch) {
    if (patch.color) current.color = patch.color;
    else delete current.color;
  }
  if ("stroke" in patch) {
    if (patch.stroke) {
      current.stroke = patch.stroke;
      current["stroke-width"] = "2px";
    } else {
      delete current.stroke;
      delete current["stroke-width"];
    }
  }
  const entries = Object.entries(current);
  if (entries.length) {
    next.push(`style ${nodeId} ${entries.map(([k, v]) => `${k}:${v}`).join(",")}`);
  }
  return next.join("\n");
}

function upsertLinkStyleStroke(code: string, edgeIndex: number, stroke: string): string {
  const lines = String(code || "").split(/\r?\n/);
  const reg = new RegExp(`^\\s*linkStyle\\s+${edgeIndex}\\s+(.+)\\s*$`, "i");
  const next = lines.filter((line) => !reg.test(line));
  if (stroke.trim()) {
    next.push(`linkStyle ${edgeIndex} stroke:${stroke.trim()},stroke-width:2.4px`);
  }
  return next.join("\n");
}

function withCompactnessHint(code: string, compactness: number): string {
  const c = Math.max(0, Math.min(100, compactness));
  const nodeSpacing = Math.max(18, Math.round(24 + (100 - c) * 1.1));
  const rankSpacing = Math.max(24, Math.round(36 + (100 - c) * 1.3));
  const raw = String(code || "");
  const marker = /^%%\s*TW_COMPACTNESS_INIT\s*\r?\n%%\{init:\s*\{'flowchart':\s*\{'nodeSpacing':\s*\d+,\s*'rankSpacing':\s*\d+,\s*'diagramPadding':\s*\d+\}\}\}%%\s*\r?\n?/gm;
  const cleaned = raw.replace(marker, "");
  const lines = cleaned.split(/\r?\n/);
  const insertAt = findMermaidBodyInsertLine(lines);
  lines.splice(
    insertAt,
    0,
    "%% TW_COMPACTNESS_INIT",
    `%%{init: {'flowchart': {'nodeSpacing': ${nodeSpacing}, 'rankSpacing': ${rankSpacing}, 'diagramPadding': 4}}}%%`,
  );
  return lines.join("\n");
}

function extractEdgeIndex(edgeId: string | null): number | null {
  if (!edgeId) return null;
  const m = /^e(\d+)-/.exec(edgeId);
  if (!m) return null;
  const idx = Number.parseInt(m[1], 10);
  return Number.isFinite(idx) ? idx : null;
}

/** 代码片段 */
const CODE_SNIPPETS = {
  decision: `    D{判断条件}
    D -->|是| E[处理A]
    D -->|否| F[处理B]
    class D decision`,
  subgraph: `    subgraph 模块名称
        S1[步骤1] --> S2[步骤2]
        S2 --> S3[步骤3]
    end`,
  infoFlow: `    A -.->|数据/反馈| B`,
  loop: `    L1[开始循环] --> L2[处理]
    L2 --> L3{继续?}
    L3 -->|是| L1
    L3 -->|否| L4[结束]`,
  parallel: `    P0[并行入口] --> P1[分支A]
    P0 --> P2[分支B]
    P1 --> P3[合并点]
    P2 --> P3`,
  crossLane: `    XA[泳道A步骤] -.->|同步/依赖| XB[泳道B步骤]`,
  handoff: `    H1[经办处理] -->|交接| H2[上级复核]
    class H1 dept_ops
    class H2 dept_exec`,
  batchClass: `    class 节点A,节点B dept_fin
    class 节点C dept_rd`,
  stepSkeleton: `    S01["01 需求采集"] --> S02["02 方案评审"]
    class S01 dept_product
    class S02 dept_exec`,
  deptEmojiSample: `    Fin["财务部 💰 复核"] --> IT["信息部 💻 开通账号"]
    class Fin dept_fin
    class IT dept_rd`,
  forkJoin: `    F0[并行起点] --> B1[分支A]
    F0 --> B2[分支B]
    B1 --> J[汇合]
    B2 --> J`,
  exceptionPath: `    N[业务步骤] --> Q{校验通过?}
    Q -->|否| R[退回修订]
    Q -->|是| M[下一步]`,
  businessApproval: `    subgraph Biz["业务审批链路"]
      B01["提交申请"] --> B02["部门初审"]
      B02 --> B03{"资料完整?"}
      B03 -->|"否"| B04["补齐资料"]
      B04 --> B02
      B03 -->|"是"| B05["财务复核"]
      B05 --> B06["主管审批"]
      B06 --> B07["结果通知"]
    end
    class B05 dept_fin
    class B06 dept_exec`,
  techArchitecture: `    subgraph Client["客户端层"]
      C1["Web App"] --> G1["API Gateway"]
      C2["Mobile App"] --> G1
    end
    subgraph Service["服务层"]
      G1 --> S1["Auth Service"]
      G1 --> S2["Order Service"]
      S2 --> S3["Inventory Service"]
    end
    subgraph Data["数据层"]
      S1 --> D1["User DB"]
      S2 --> D2["Order DB"]
      S3 --> D3["Cache"]
    end
    class S1,S2,S3 dept_rd
    class D1,D2,D3 dept_ops`,
  projectTimeline: `    subgraph Plan["项目阶段"]
      P01["需求冻结"] --> P02["技术方案评审"]
      P02 --> P03["开发迭代 Sprint"]
      P03 --> P04["联调测试"]
      P04 --> P05["上线准备"]
      P05 --> P06["灰度发布"]
      P06 --> P07["复盘优化"]
    end
    P03 -.-> R1["风险: 需求变更"]
    P04 -.-> R2["风险: 环境不一致"]
    class R1,R2 bottleneck`,
  dataPipeline: `    subgraph Ingest["采集层"]
      I1["埋点日志"] --> I3["Kafka"]
      I2["业务DB增量"] --> I3
    end
    subgraph Process["处理层"]
      I3 --> P1["清洗标准化"]
      P1 --> P2["维表关联"]
      P2 --> P3["质量校验"]
    end
    subgraph Serve["服务层"]
      P3 --> S1["数仓明细层"]
      S1 --> S2["指标层"]
      S2 --> S3["BI报表/告警"]
    end
    class P3 decision
    class S3 dept_exec`,
  incidentResponse: `    A1["监控告警触发"] --> A2["值班分诊"]
    A2 --> A3{"是否高优先级"}
    A3 -->|"是"| A4["应急群响应"]
    A3 -->|"否"| A5["排队处理"]
    A4 --> A6["回滚/降级"]
    A6 --> A7["根因分析"]
    A7 --> A8["修复发布"]
    A8 --> A9["复盘沉淀"]
    class A4 bottleneck
    class A6 dept_ops`,
  aiOptimizeHint: `%% TW_AI: 请在不改变业务含义的前提下优化排版、连线与 class 样式。`,
};

/** 在首个非注释的 diagram 声明行之后插入（与样式套件逻辑一致） */
function findMermaidBodyInsertLine(lines: string[]): number {
  let insertIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t || t.startsWith("%%")) continue;
    if (
      /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|gantt|pie|mindmap|timeline|erDiagram|journey|gitGraph|radar-beta|block-beta)/i.test(
        t,
      )
    ) {
      insertIdx = i + 1;
    }
    break;
  }
  return insertIdx;
}

declare global {
  interface Window {
    TalkWebMermaid?: { renderMermaid: (c: string) => Promise<string> };
  }
}

/** html-to-image 内部 canvas 单边上限约 16384，预留余量避免被自动缩放压糊 */
const HTML_TO_IMAGE_CANVAS_SAFE = 16000;

/** 与 Mermaid viewBox 同量级，避免树状图 / 宽 flowchart 在窄面板被压窄后仍按小盒栅格化 */
const EXPORT_SVG_MAX_EDGE = 12000;

const IMAGE_EXPORT_BASE: Pick<
  HtmlToImageOptions,
  "cacheBust" | "backgroundColor"
> = {
  cacheBust: true,
  backgroundColor: "#ffffff",
};

type SvgExportBox = { x: number; y: number; w: number; h: number };

function readSvgExportBox(svg: SVGSVGElement): SvgExportBox | null {
  try {
    const b = svg.getBBox();
    if (b.width > 0 && b.height > 0) {
      return { x: b.x, y: b.y, w: b.width, h: b.height };
    }
  } catch {
    /* SVG 未就绪时 getBBox 可能抛错 */
  }
  const vb = svg.viewBox?.baseVal;
  if (vb && vb.width > 0 && vb.height > 0) {
    return { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
  }
  const aw = svg.getAttribute("width");
  const ah = svg.getAttribute("height");
  if (aw && ah) {
    const pw = parseFloat(aw);
    const ph = parseFloat(ah);
    if (Number.isFinite(pw) && Number.isFinite(ph) && pw > 0 && ph > 0) {
      return { x: 0, y: 0, w: pw, h: ph };
    }
  }
  return null;
}

function clampExportLogicalSize(w: number, h: number): { w: number; h: number } {
  const long = Math.max(w, h);
  if (long <= EXPORT_SVG_MAX_EDGE) {
    return { w: Math.round(w), h: Math.round(h) };
  }
  const s = EXPORT_SVG_MAX_EDGE / long;
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

function getExportPixelRatio(logicalW: number, logicalH: number): number {
  const long = Math.max(logicalW, logicalH);
  /** 目标长边像素（再乘 pixelRatio），放大后下载/放大查看更清晰 */
  const targetLongPx = 8192;
  const minPr = 4;
  const maxPr = 12;
  let pr = Math.ceil(targetLongPx / long);
  pr = Math.min(maxPr, Math.max(minPr, pr));
  const capW = Math.floor(HTML_TO_IMAGE_CANVAS_SAFE / logicalW);
  const capH = Math.floor(HTML_TO_IMAGE_CANVAS_SAFE / logicalH);
  const cap = Math.min(capW, capH);
  if (Number.isFinite(cap) && cap > 0 && cap < pr) {
    pr = Math.max(1, cap);
  }
  return pr;
}

/**
 * 非 SVG 场景（文本框/拖拽流图）继续走 html-to-image。
 * Mermaid-SVG 导出单独走 getBBox 裁切逻辑，避免“大画布里一个小图”。
 */
function getExportImageOptions(el: HTMLElement): HtmlToImageOptions {
  const domW = Math.max(1, Math.round(el.offsetWidth));
  const domH = Math.max(1, Math.round(el.offsetHeight));
  const capped = clampExportLogicalSize(domW, domH);
  const pr = getExportPixelRatio(capped.w, capped.h);
  return {
    ...IMAGE_EXPORT_BASE,
    pixelRatio: pr,
    width: capped.w,
    height: capped.h,
  };
}

function sanitizeSvgInlineStyle(svg: SVGSVGElement): void {
  const style = svg.getAttribute("style") || "";
  const cleaned = style.replace(/max-width\s*:[^;]+;?/gi, "").trim();
  svg.setAttribute("style", `${cleaned}${cleaned ? ";" : ""}background:#ffffff;`);
}

/**
 * Mermaid 常输出 width="100%" + style:max-width:xxx；在快速模式缩放容器里容易出现显示错位/空白。
 * 在字符串阶段标准化为固定像素宽高，避免后续 React 重渲染把运行时修正冲掉。
 */
function normalizeRenderedSvgMarkup(raw: string): string {
  const text = String(raw || "").trim();
  if (!text.startsWith("<svg")) return raw;
  try {
    const doc = new DOMParser().parseFromString(text, "image/svg+xml");
    const svg = doc.documentElement;
    if (!(svg instanceof SVGSVGElement)) return raw;
    const vb = svg.getAttribute("viewBox") || "";
    const parts = vb
      .split(/[,\s]+/)
      .map((x) => Number.parseFloat(x))
      .filter((n) => Number.isFinite(n));
    const w = parts.length >= 4 ? parts[2] : Number.NaN;
    const h = parts.length >= 4 ? parts[3] : Number.NaN;
    if (Number.isFinite(w) && w > 0) svg.setAttribute("width", String(w));
    if (Number.isFinite(h) && h > 0) svg.setAttribute("height", String(h));
    const style = svg.getAttribute("style") || "";
    const cleaned = style.replace(/max-width\s*:[^;]+;?/gi, "").trim();
    const fixedSize =
      Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0
        ? `width:${w}px;height:${h}px;`
        : "";
    svg.setAttribute(
      "style",
      `${cleaned}${cleaned ? ";" : ""}${fixedSize}max-width:none;display:block;`,
    );
    return svg.outerHTML;
  } catch {
    return raw;
  }
}

async function svgToDataUrl(
  svg: SVGSVGElement,
  mime: "image/png" | "image/jpeg",
  quality?: number,
): Promise<string> {
  const box = readSvgExportBox(svg);
  if (!box) throw new Error("SVG export box missing");
  const capped = clampExportLogicalSize(box.w, box.h);
  const pr = getExportPixelRatio(capped.w, capped.h);
  const cloned = svg.cloneNode(true);
  if (!(cloned instanceof SVGSVGElement)) throw new Error("SVG clone failed");
  sanitizeSvgInlineStyle(cloned);
  cloned.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  cloned.setAttribute("width", String(capped.w));
  cloned.setAttribute("height", String(capped.h));
  cloned.setAttribute("viewBox", `${box.x} ${box.y} ${box.w} ${box.h}`);
  const serialized = new XMLSerializer().serializeToString(cloned);
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.decoding = "async";
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(capped.w * pr));
  canvas.height = Math.max(1, Math.round(capped.h * pr));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(mime, quality);
}

function triggerDownload(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export function MermaidBlock({
  initialCode,
  onDelete,
  uiLang: uiLangProp,
  initialMode = "view",
  layoutVariant = "embedded",
}: {
  initialCode: string;
  onDelete?: () => void;
  uiLang?: string;
  initialMode?: Mode;
  layoutVariant?: "embedded" | "fullscreen";
}) {
  const uiLang: MermaidUiLang = normalizeMermaidUiLang(uiLangProp);
  const labels = useMemo(() => getMermaidBlockLabels(uiLang), [uiLang]);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [code, setCode] = useState(initialCode);
  const [svg, setSvg] = useState("");
  const [editPreviewSvg, setEditPreviewSvg] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const prevMode = useRef<Mode>("view");
  /** 仅绑定「实际要栅格化的块」，避免父级 width:100% 导致导出整页留白、图只占中间一小点 */
  const exportTargetRef = useRef<HTMLElement | null>(null);
  const viewCaptureRef = useRef<HTMLDivElement | null>(null);
  const editPreviewRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const codeRef = useRef(code);
  /** 最近一次 Mermaid 解析/渲染错误（供「AI 修复」传入后台） */
  const lastMermaidErrorRef = useRef<string>("");
  /** 编辑模式防抖渲染世代，丢弃过期回调对 ref 的写入 */
  const editPreviewGen = useRef(0);
  const isFullscreen = layoutVariant === "fullscreen";
  const [fitScale, setFitScale] = useState(1);
  const [viewScale, setViewScale] = useState(1);
  const [userScaled, setUserScaled] = useState(false);
  const [diagramSize, setDiagramSize] = useState<DiagramSize | null>(null);
  const [showSnippetMenu, setShowSnippetMenu] = useState(false);
  const [showStyleApplyMenu, setShowStyleApplyMenu] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [aiRefineNote, setAiRefineNote] = useState("");
  const [aiRefineBusy, setAiRefineBusy] = useState(false);
  const [codeBeforeAiRefine, setCodeBeforeAiRefine] = useState<string | null>(null);
  const [translateTarget, setTranslateTarget] = useState<"en" | "ko" | "ja">("en");
  const [aiTranslateBusy, setAiTranslateBusy] = useState(false);
  const [compactness, setCompactness] = useState(64);
  /** 拖拽模式下当前选中的 flowchart 节点（用于部门和类型着色） */
  const [selectedFlowNodeId, setSelectedFlowNodeId] = useState<string | null>(null);
  const [selectedFlowEdgeId, setSelectedFlowEdgeId] = useState<string | null>(null);
  const selectedFlowNode = useMemo(
    () => nodes.find((x) => x.id === selectedFlowNodeId) || null,
    [nodes, selectedFlowNodeId],
  );
  const selectedFlowEdge = useMemo(
    () => edges.find((x) => x.id === selectedFlowEdgeId) || null,
    [edges, selectedFlowEdgeId],
  );
  const renderCode = useMemo(
    () => (mode === "drag" ? code : withCompactnessHint(code, compactness)),
    [code, compactness, mode],
  );
  const editCompactScale = useMemo(() => {
    const c = Math.max(0, Math.min(100, compactness));
    return Number((1.14 - c * 0.0034).toFixed(3));
  }, [compactness]);

  const flowHeadInfo = useMemo(() => {
    const first =
      String(code || "")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .find((l) => l && !l.startsWith("%%")) ?? "";
    return { isFlowchart: /^(graph|flowchart)\b/i.test(first), firstLine: first };
  }, [code]);

  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  useEffect(() => {
    setCode(initialCode);
  }, [initialCode]);

  useEffect(() => {
    if (mode === "drag") return;
    let cancelled = false;
    (async () => {
      try {
        const fn = window.TalkWebMermaid?.renderMermaid;
        if (typeof fn !== "function") throw new Error("TalkWebMermaid missing");
        const s = await fn(renderCode);
        if (!cancelled) {
          lastMermaidErrorRef.current = "";
          setSvg(normalizeRenderedSvgMarkup(s));
          if (mode === "edit") {
            setEditPreviewSvg(normalizeRenderedSvgMarkup(s));
          }
        }
      } catch (e) {
        if (!cancelled) {
          lastMermaidErrorRef.current = String((e as Error)?.message || e).slice(0, 2000);
          setSvg("");
          if (mode === "edit") setEditPreviewSvg("");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, renderCode]);

  /** 编辑模式下防抖渲染预览 */
  useEffect(() => {
    if (mode !== "edit") return;
    const gen = ++editPreviewGen.current;
    const timer = window.setTimeout(async () => {
      try {
        const fn = window.TalkWebMermaid?.renderMermaid;
        if (typeof fn !== "function") return;
        const s = await fn(renderCode);
        if (gen !== editPreviewGen.current) return;
        lastMermaidErrorRef.current = "";
        setEditPreviewSvg(normalizeRenderedSvgMarkup(s));
      } catch (e) {
        if (gen !== editPreviewGen.current) return;
        lastMermaidErrorRef.current = String((e as Error)?.message || e).slice(0, 2000);
        setEditPreviewSvg("");
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [mode, renderCode]);

  useLayoutEffect(() => {
    if (mode !== "view" || !svg) return;
    const capture = viewCaptureRef.current;
    const host = exportTargetRef.current;
    if (!capture || !host) return;
    const svgEl = host.querySelector("svg");
    if (!(svgEl instanceof SVGSVGElement)) return;
    const box = readSvgExportBox(svgEl);
    if (!box || box.w <= 0 || box.h <= 0) return;
    setDiagramSize({ w: box.w, h: box.h });
    const availW = Math.max(120, capture.clientWidth - 24);
    const availH = Math.max(120, capture.clientHeight - 24);
    const fitByW = availW / box.w;
    const fitByH = availH / box.h;
    const raw = Math.min(fitByW, fitByH);
    const nextFit = Math.max(0.2, Math.min(4, Number.isFinite(raw) ? raw : 1));
    setFitScale(nextFit);
    if (!userScaled) {
      setViewScale(nextFit);
    }
  }, [mode, svg, userScaled]);

  useLayoutEffect(() => {
    if (mode === "drag" && prevMode.current !== "drag") {
      const p = mermaidToFlow(code);
      setNodes(p.nodes);
      setEdges(p.edges);
    }
    prevMode.current = mode;
  }, [mode, code, setNodes, setEdges]);

  useEffect(() => {
    if (mode !== "drag") {
      setSelectedFlowNodeId(null);
      setSelectedFlowEdgeId(null);
    }
  }, [mode]);

  const validateMermaidCode = useCallback(async (nextCode: string): Promise<boolean> => {
    try {
      const fn = window.TalkWebMermaid?.renderMermaid;
      if (typeof fn !== "function") return true;
      await fn(nextCode);
      return true;
    } catch {
      return false;
    }
  }, []);

  const applyFlowNodeStyleClass = useCallback(
    (cls: string) => {
      if (!selectedFlowNodeId) return;
      const nodeId = selectedFlowNodeId;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  styleClass: cls || undefined,
                },
              }
            : n,
        ),
      );
      setCode((prev) => upsertNodeClassOnly(prev, nodeId, cls));
    },
    [selectedFlowNodeId, setNodes],
  );

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            markerEnd: { type: MarkerType.ArrowClosed },
          },
          eds,
        ),
      ),
    [setEdges],
  );

  const openChromeFullscreen = useCallback(
    (targetMode: Mode) => {
      setMode(targetMode);
      if (layoutVariant === "fullscreen") return;
      const rt = typeof chrome !== "undefined" ? chrome.runtime : undefined;
      if (!rt?.sendMessage) {
        console.warn("[MermaidBlock] Fullscreen: chrome.runtime.sendMessage unavailable");
        return;
      }
      /** 由 background 写入 chrome.storage.session 再打开标签页，避免内容脚本里 session 写入失败或异步导致无法新开页 */
      rt.sendMessage(
        {
          type: "TW_OPEN_MERMAID_VIEWER",
          code:
            targetMode === "drag"
              ? codeRef.current
              : withCompactnessHint(codeRef.current, compactness),
          lang: uiLang,
          mode: targetMode,
        },
        () => void chrome.runtime.lastError,
      );
    },
    [compactness, uiLang, layoutVariant],
  );

  const downloadPng = useCallback(async () => {
    const el = exportTargetRef.current;
    if (!el) return;
    try {
      const svgEl = el.querySelector("svg");
      const dataUrl =
        svgEl instanceof SVGSVGElement
          ? await svgToDataUrl(svgEl, "image/png")
          : await toPng(el, getExportImageOptions(el));
      triggerDownload(dataUrl, "mermaid.png");
    } catch (e) {
      console.error(e);
    }
  }, []);

  const downloadJpeg = useCallback(async () => {
    const el = exportTargetRef.current;
    if (!el) return;
    try {
      const svgEl = el.querySelector("svg");
      const dataUrl =
        svgEl instanceof SVGSVGElement
          ? await svgToDataUrl(svgEl, "image/jpeg", 0.98)
          : await toJpeg(el, {
              ...getExportImageOptions(el),
              quality: 0.98,
            });
      triggerDownload(dataUrl, "mermaid.jpg");
    } catch (e) {
      console.error(e);
    }
  }, []);

  const zoomIn = useCallback(() => {
    setUserScaled(true);
    setViewScale((v) => Math.min(6, Number((v * 1.2).toFixed(3))));
  }, []);

  const zoomOut = useCallback(() => {
    setUserScaled(true);
    setViewScale((v) => Math.max(0.2, Number((v / 1.2).toFixed(3))));
  }, []);

  const resetZoom = useCallback(() => {
    setUserScaled(false);
    setViewScale(fitScale);
  }, [fitScale]);

  /** Toast 提示 */
  const showToast = useCallback((msg: string, ms = 2200) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(null), ms);
  }, []);

  const undoAiRefine = useCallback(() => {
    if (codeBeforeAiRefine == null) return;
    setCode(codeBeforeAiRefine);
    setCodeBeforeAiRefine(null);
    showToast(labels.aiRefineUndone);
  }, [codeBeforeAiRefine, labels.aiRefineUndone, showToast]);

  const runAiRefine = useCallback(async (refineMode: "refine" | "repair" = "refine") => {
    const rt = typeof chrome !== "undefined" ? chrome.runtime : undefined;
    if (!rt?.sendMessage) {
      showToast("chrome.runtime unavailable", 3200);
      return;
    }
    if (aiRefineBusy) return;
    setAiRefineBusy(true);
    const snapshotCode = codeRef.current;
    const snapshotNote = aiRefineNote.trim();
    setCodeBeforeAiRefine(snapshotCode);
    try {
      const resp = (await new Promise(
        (
          resolve: (v: {
            ok?: boolean;
            code?: string;
            error?: string;
            message?: string;
            status?: number;
            body?: string;
          }) => void,
        ) => {
          rt.sendMessage(
            {
              type: "TW_MERMAID_AI_REFINE",
              code: snapshotCode,
              userNote: snapshotNote,
              lang: uiLang,
              refineMode,
              mermaidError: refineMode === "repair" ? lastMermaidErrorRef.current : undefined,
            },
            (r: unknown) => {
              const le = chrome.runtime.lastError;
              if (le) {
                resolve({ ok: false, error: String(le.message || "message_failed") });
                return;
              }
              resolve((r || {}) as { ok?: boolean; code?: string; error?: string; message?: string; status?: number; body?: string });
            },
          );
        },
      )) as { ok?: boolean; code?: string; error?: string; message?: string; status?: number; body?: string };

      if (!resp?.ok) {
        const err = String(resp?.error || "unknown");
        let tip = labels.aiRefineErrGeneric;
        if (err === "no_api_key") tip = labels.aiRefineErrNoKey;
        else if (err === "unsupported_provider") tip = labels.aiRefineErrUnsupported;
        else if (err === "qianwen_compatible_url_required") tip = String(resp.message || labels.aiRefineErrHttp);
        else if (err === "timeout") tip = labels.aiRefineErrTimeout;
        else if (err === "http") tip = `${labels.aiRefineErrHttp} (${resp.status || "?"})`;
        else if (err === "empty_model_output") tip = labels.aiRefineErrEmpty;
        showToast(tip, 4200);
        setCodeBeforeAiRefine(null);
        return;
      }
      if (resp.code && String(resp.code).trim()) {
        const nextCode = String(resp.code);
        const valid = await validateMermaidCode(nextCode);
        if (!valid) {
          showToast(labels.renderValidateFailed, 4200);
          setCode(snapshotCode);
          setCodeBeforeAiRefine(null);
          return;
        }
        setCode(nextCode);
        showToast(refineMode === "repair" ? labels.aiRepair : labels.aiRefineOk);
      } else {
        showToast(labels.aiRefineErrEmpty, 3500);
        setCodeBeforeAiRefine(null);
      }
    } catch (e) {
      showToast(String((e as Error)?.message || e || labels.aiRefineErrHttp), 4000);
      setCodeBeforeAiRefine(null);
    } finally {
      setAiRefineBusy(false);
    }
  }, [aiRefineBusy, aiRefineNote, labels, showToast, uiLang, validateMermaidCode]);

  const runAiTranslate = useCallback(async () => {
    const rt = typeof chrome !== "undefined" ? chrome.runtime : undefined;
    if (!rt?.sendMessage) {
      showToast("chrome.runtime unavailable", 3200);
      return;
    }
    setAiTranslateBusy(true);
    const prevCode = codeRef.current;
    try {
      const resp = await new Promise<{
        ok?: boolean;
        code?: string;
        error?: string;
        message?: string;
        status?: number;
      }>((resolve) => {
        rt.sendMessage(
          {
            type: "TW_MERMAID_AI_TRANSLATE",
            code: prevCode,
            targetLang: translateTarget,
            lang: uiLang,
          },
          (r: unknown) => {
            const le = chrome.runtime.lastError;
            if (le) {
              resolve({ ok: false, error: String(le.message || "message_failed") });
              return;
            }
            resolve((r || {}) as { ok?: boolean; code?: string; error?: string; message?: string; status?: number });
          },
        );
      });
      if (!resp?.ok || !resp.code) {
        showToast(labels.aiTranslateErr, 3800);
        return;
      }
      const nextCode = String(resp.code);
      const valid = await validateMermaidCode(nextCode);
      if (!valid) {
        setCode(prevCode);
        showToast(labels.aiTranslateErr, 4200);
        return;
      }
      setCode(nextCode);
      showToast(labels.aiTranslateOk);
    } finally {
      setAiTranslateBusy(false);
    }
  }, [labels, showToast, translateTarget, uiLang, validateMermaidCode]);

  const applyQuickNodeClass = useCallback(
    (cls: (typeof QUICK_DEPT_CLASSES)[number]) => {
      if (!selectedFlowNodeId) return;
      applyFlowNodeStyleClass(cls);
      showToast(labels.nodeColorApplied);
    },
    [applyFlowNodeStyleClass, labels.nodeColorApplied, selectedFlowNodeId, showToast],
  );

  const applyQuickEdgeColor = useCallback(
    (color: string) => {
      if (!selectedFlowEdgeId) return;
      const edgeId = selectedFlowEdgeId;
      const edgeIdx = extractEdgeIndex(edgeId);
      setEdges((eds) =>
        eds.map((e) =>
          e.id === edgeId
            ? {
                ...e,
                style: { ...(e.style || {}), stroke: color, strokeWidth: 2.4 },
              }
            : e,
        ),
      );
      if (edgeIdx != null) {
        setCode((prev) => upsertLinkStyleStroke(prev, edgeIdx, color));
      }
      showToast(labels.edgeColorApplied);
    },
    [labels.edgeColorApplied, selectedFlowEdgeId, setEdges, showToast],
  );

  const applyNodeColorPreset = useCallback(
    (part: "fill" | "text" | "stroke", color: string) => {
      if (!selectedFlowNodeId) {
        showToast(labels.nodeStyleSelectNode, 2000);
        return;
      }
      const nodeId = selectedFlowNodeId;
      const val = color || undefined;
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n;
          const dataObj = (n.data || {}) as {
            customFill?: string;
            customText?: string;
            customStroke?: string;
          };
          const nextData = { ...dataObj };
          if (part === "fill") nextData.customFill = val;
          if (part === "text") nextData.customText = val;
          if (part === "stroke") nextData.customStroke = val;
          const nextStyle = {
            ...(n.style || {}),
            ...(part === "fill" ? { background: color || undefined } : {}),
            ...(part === "text" ? { color: color || undefined } : {}),
            ...(part === "stroke"
              ? {
                  borderColor: color || undefined,
                  borderWidth: color ? 2 : undefined,
                  borderStyle: color ? "solid" : undefined,
                }
              : {}),
          };
          return { ...n, data: nextData, style: nextStyle };
        }),
      );
      setCode((prev) =>
        upsertNodeInlineStyle(prev, nodeId, {
          ...(part === "fill" ? { fill: color } : {}),
          ...(part === "text" ? { color } : {}),
          ...(part === "stroke" ? { stroke: color } : {}),
        }),
      );
      showToast(labels.nodeColorApplied);
    },
    [labels.nodeColorApplied, labels.nodeStyleSelectNode, selectedFlowNodeId, setNodes, showToast],
  );

  const applyEdgeColorPreset = useCallback(
    (color: string) => {
      if (!selectedFlowEdgeId) {
        showToast(labels.edgeColorQuick, 2000);
        return;
      }
      const edgeId = selectedFlowEdgeId;
      const edgeIdx = extractEdgeIndex(edgeId);
      setEdges((eds) =>
        eds.map((e) =>
          e.id === edgeId
            ? {
                ...e,
                style: {
                  ...(e.style || {}),
                  stroke: color || undefined,
                  strokeWidth: color ? 2.4 : undefined,
                },
              }
            : e,
        ),
      );
      if (edgeIdx != null) {
        setCode((prev) => upsertLinkStyleStroke(prev, edgeIdx, color));
      }
      showToast(labels.edgeColorApplied);
    },
    [labels.edgeColorApplied, labels.edgeColorQuick, selectedFlowEdgeId, setEdges, showToast],
  );

  /** 插入样式套件 */
  const insertStyleKit = useCallback(() => {
    if (new RegExp(MERMAID_ENTERPRISE_MARKER, "i").test(code)) {
      showToast(labels.stylesAlreadyExist);
      return;
    }
    const lines = code.split(/\r?\n/);
    const insertIdx = findMermaidBodyInsertLine(lines);
    lines.splice(insertIdx, 0, MERMAID_STYLE_KIT);
    setCode(lines.join("\n"));
    showToast(labels.stylesInserted);
  }, [code, labels, showToast]);

  /** 插入步骤编号 / 部门图标 TW_HINT（供左侧注释 + AI 优化） */
  const insertStyleHintBlock = useCallback(
    (hintLine: string) => {
      const lines = code.split(/\r?\n/);
      const insertIdx = findMermaidBodyInsertLine(lines);
      lines.splice(insertIdx, 0, hintLine);
      setCode(lines.join("\n"));
      setShowStyleApplyMenu(false);
      showToast(labels.styleHintInserted);
    },
    [code, labels.styleHintInserted, showToast],
  );

  /** 插入代码片段 */
  const insertSnippet = useCallback((snippetKey: keyof typeof CODE_SNIPPETS) => {
    const snippet = CODE_SNIPPETS[snippetKey];
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = code.slice(0, start);
      const after = code.slice(end);
      const newCode = before + "\n" + snippet + "\n" + after;
      setCode(newCode);
      window.setTimeout(() => {
        textarea.focus();
        const newPos = start + snippet.length + 2;
        textarea.setSelectionRange(newPos, newPos);
      }, 10);
    } else {
      setCode(code + "\n" + snippet);
    }
    setShowSnippetMenu(false);
  }, [code]);

  /** 切换主题 */
  const applyTheme = useCallback((theme: MermaidTheme) => {
    const initRegex = /^%%\{init:.*\}%%\s*\n?/im;
    let newCode = code.replace(initRegex, "");
    newCode = THEME_INIT[theme] + "\n" + newCode.trimStart();
    setCode(newCode);
  }, [code]);

  /** 下载 SVG */
  const downloadSvg = useCallback(() => {
    const el = exportTargetRef.current;
    if (!el) return;
    const svgEl = el.querySelector("svg");
    if (!(svgEl instanceof SVGSVGElement)) return;
    try {
      const cloned = svgEl.cloneNode(true) as SVGSVGElement;
      sanitizeSvgInlineStyle(cloned);
      cloned.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const serialized = new XMLSerializer().serializeToString(cloned);
      const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      triggerDownload(url, "mermaid.svg");
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const dragHeight = isFullscreen ? "min(72vh, calc(100vh - 200px))" : 340;

  const toolbar = (
    <div
      className="tw-mb-toolbar"
      style={{
        position: "absolute",
        top: 8,
        left: 8,
        right: 8,
        zIndex: 20,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      }}
    >
      <div>
        {isFullscreen ? (
          <button
            type="button"
            className="tw-mb-btn"
            onClick={() => {
              try {
                window.close();
              } catch (_) {}
            }}
            style={btnStyle(false)}
          >
            {labels.close}
          </button>
        ) : null}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "flex-end", alignItems: "center" }}>
        <button
          type="button"
          className="tw-mb-btn"
          onClick={() => openChromeFullscreen("view")}
          style={btnStyle(mode === "view")}
        >
          {labels.view}
        </button>
        <button
          type="button"
          className="tw-mb-btn"
          onClick={() => openChromeFullscreen("edit")}
          style={btnStyle(mode === "edit")}
        >
          {labels.edit}
        </button>
        <button
          type="button"
          className="tw-mb-btn"
          onClick={() => openChromeFullscreen("drag")}
          style={btnStyle(mode === "drag")}
        >
          {labels.drag}
        </button>

        {/* 分隔符 */}
        <span style={{ width: 1, height: 16, background: "rgba(255,255,255,0.2)", margin: "0 4px" }} />

        {/* 编辑模式专用工具 */}
        {mode === "edit" && (
          <>
            {/* 样式套用：企业套件 / TW_HINT */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="tw-mb-btn"
                onClick={() => {
                  setShowStyleApplyMenu((v) => !v);
                  setShowSnippetMenu(false);
                }}
                style={btnStyle(showStyleApplyMenu)}
                title={labels.styleApplyMenu}
              >
                {labels.styleApplyMenu} ▾
              </button>
              {showStyleApplyMenu && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    marginTop: 4,
                    background: "rgba(15,23,42,0.95)",
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,0.15)",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                    minWidth: 200,
                    zIndex: 100,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      insertStyleKit();
                      setShowStyleApplyMenu(false);
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "8px 12px",
                      background: "transparent",
                      border: "none",
                      color: "#e2e8f0",
                      fontSize: 12,
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    {labels.styleKitEnterprise}
                  </button>
                  <button
                    type="button"
                    onClick={() => insertStyleHintBlock(MERMAID_STEP_NUMBER_HINT)}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "8px 12px",
                      background: "transparent",
                      border: "none",
                      color: "#e2e8f0",
                      fontSize: 12,
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    {labels.styleHintStepNumbers}
                  </button>
                  <button
                    type="button"
                    onClick={() => insertStyleHintBlock(MERMAID_DEPT_ICON_HINT)}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "8px 12px",
                      background: "transparent",
                      border: "none",
                      color: "#e2e8f0",
                      fontSize: 12,
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    {labels.styleHintDeptIcons}
                  </button>
                </div>
              )}
            </div>

            {/* 片段下拉菜单 */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="tw-mb-btn"
                onClick={() => {
                  setShowSnippetMenu((v) => !v);
                  setShowStyleApplyMenu(false);
                }}
                style={btnStyle(showSnippetMenu)}
              >
                {labels.insertSnippet} ▾
              </button>
              {showSnippetMenu && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    marginTop: 4,
                    background: "rgba(15,23,42,0.95)",
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,0.15)",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                    minWidth: 160,
                    zIndex: 100,
                  }}
                >
                  {(
                    [
                      ["decision", labels.snippetDecision],
                      ["subgraph", labels.snippetSubgraph],
                      ["infoFlow", labels.snippetInfoFlow],
                      ["loop", labels.snippetLoop],
                      ["parallel", labels.snippetParallel],
                      ["crossLane", labels.snippetCrossLane],
                      ["handoff", labels.snippetHandoff],
                      ["batchClass", labels.snippetBatchClass],
                      ["stepSkeleton", labels.snippetStepSkeleton],
                      ["deptEmojiSample", labels.snippetDeptEmojiSample],
                      ["forkJoin", labels.snippetForkJoin],
                      ["exceptionPath", labels.snippetExceptionPath],
                      ["businessApproval", labels.snippetBusinessApproval],
                      ["techArchitecture", labels.snippetTechArchitecture],
                      ["projectTimeline", labels.snippetProjectTimeline],
                      ["dataPipeline", labels.snippetDataPipeline],
                      ["incidentResponse", labels.snippetIncidentResponse],
                      ["aiOptimizeHint", labels.snippetAiOptimizeHint],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => insertSnippet(key)}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "8px 12px",
                        background: "transparent",
                        border: "none",
                        color: "#e2e8f0",
                        fontSize: 12,
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <input
              type="text"
              value={aiRefineNote}
              onChange={(e) => setAiRefineNote(e.target.value)}
              placeholder={labels.aiRefinePlaceholder}
              disabled={aiRefineBusy}
              aria-label={labels.aiRefinePlaceholder}
              style={{
                flex: 1,
                minWidth: 72,
                maxWidth: 220,
                height: 28,
                padding: "0 8px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(15,23,42,0.6)",
                color: "#e2e8f0",
                fontSize: 11,
                boxSizing: "border-box",
              }}
            />
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 28,
                padding: "0 8px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(15,23,42,0.45)",
                color: "#e2e8f0",
                fontSize: 11,
              }}
              title={labels.compactnessHint}
            >
              <span>{labels.compactness}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={compactness}
                onChange={(e) => setCompactness(Number(e.target.value || 0))}
                style={{ width: 110 }}
              />
              <span style={{ minWidth: 28, textAlign: "right" }}>{compactness}</span>
            </div>
            <button
              type="button"
              className="tw-mb-btn"
              disabled={aiRefineBusy}
              onClick={() => void runAiRefine()}
              style={btnStyle(false)}
              title={labels.aiRefineMermaid}
            >
              {aiRefineBusy ? labels.aiRefineBusy : labels.aiRefineMermaid}
            </button>
            <button
              type="button"
              className="tw-mb-btn"
              disabled={aiRefineBusy}
              onClick={() => void runAiRefine("repair")}
              style={btnStyle(false)}
              title={labels.aiRepairHint}
            >
              {labels.aiRepair}
            </button>
            {codeBeforeAiRefine != null ? (
              <button type="button" className="tw-mb-btn" onClick={undoAiRefine} style={btnStyle(false)}>
                {labels.aiRefineUndo}
              </button>
            ) : null}
            <select
              value={translateTarget}
              disabled={aiTranslateBusy}
              onChange={(e) => setTranslateTarget((e.target.value as "en" | "ko" | "ja") || "en")}
              style={{
                maxWidth: 94,
                height: 28,
                padding: "0 6px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(15,23,42,0.6)",
                color: "#e2e8f0",
                fontSize: 11,
              }}
            >
              <option value="en">{labels.aiTranslateTargetEn}</option>
              <option value="ko">{labels.aiTranslateTargetKo}</option>
              <option value="ja">{labels.aiTranslateTargetJa}</option>
            </select>
            <button
              type="button"
              className="tw-mb-btn"
              disabled={aiTranslateBusy}
              onClick={() => void runAiTranslate()}
              style={btnStyle(false)}
            >
              {aiTranslateBusy ? labels.aiTranslateBusy : labels.aiTranslate}
            </button>

            {/* 主题切换 */}
            <span style={{ width: 1, height: 16, background: "rgba(255,255,255,0.2)", margin: "0 2px" }} />
            <button
              type="button"
              className="tw-mb-btn"
              onClick={() => applyTheme("bright")}
              style={btnStyle(false)}
              title={labels.themeBright}
            >
              ☀
            </button>
            <button
              type="button"
              className="tw-mb-btn"
              onClick={() => applyTheme("dark")}
              style={btnStyle(false)}
              title={labels.themeDark}
            >
              🌙
            </button>
            <button
              type="button"
              className="tw-mb-btn"
              onClick={() => applyTheme("print")}
              style={btnStyle(false)}
              title={labels.themePrint}
            >
              🖨
            </button>
          </>
        )}

        {/* 分隔符 */}
        <span style={{ width: 1, height: 16, background: "rgba(255,255,255,0.2)", margin: "0 4px" }} />

        <button type="button" className="tw-mb-btn" onClick={downloadPng} style={btnStyle(false)}>
          {labels.png}
        </button>
        <button type="button" className="tw-mb-btn" onClick={downloadJpeg} style={btnStyle(false)}>
          {labels.jpeg}
        </button>
        <button type="button" className="tw-mb-btn" onClick={downloadSvg} style={btnStyle(false)}>
          {labels.svg}
        </button>

        {mode === "view" && (
          <>
            <span style={{ width: 1, height: 16, background: "rgba(255,255,255,0.2)", margin: "0 4px" }} />
            <button type="button" className="tw-mb-btn" onClick={zoomOut} style={btnStyle(false)}>
              -
            </button>
            <button type="button" className="tw-mb-btn" onClick={resetZoom} style={btnStyle(false)}>
              {Math.round(viewScale * 100)}%
            </button>
            <button type="button" className="tw-mb-btn" onClick={zoomIn} style={btnStyle(false)}>
              +
            </button>
          </>
        )}
        <button
          type="button"
          className="tw-mb-btn"
          onClick={() => onDelete?.()}
          style={{ ...btnStyle(false), color: "#ffb4b4" }}
        >
          {labels.del}
        </button>
      </div>
    </div>
  );

  const rootClass =
    "tw-mermaid-block-root" + (isFullscreen ? " tw-mb-layout-fullscreen" : "");

  return (
    <ReactFlowProvider>
      <div
        className={rootClass}
        style={{
          position: "relative",
          borderRadius: isFullscreen ? 0 : 10,
          overflow: "hidden",
          background: isFullscreen ? "#0b1020" : "rgba(0,0,0,0.28)",
          border: isFullscreen ? "none" : "1px solid rgba(0,212,255,0.2)",
          minHeight: isFullscreen ? "100vh" : undefined,
          display: isFullscreen ? "flex" : "block",
          flexDirection: isFullscreen ? "column" : undefined,
          boxSizing: "border-box",
        }}
      >
        {toolbar}

        <div
          className="tw-mb-export-area"
          style={{
            marginTop: 44,
            padding: 12,
            minHeight: isFullscreen ? 0 : 120,
            flex: isFullscreen ? "1 1 auto" : undefined,
            display: "flex",
            flexDirection: "column",
            overflow: isFullscreen ? "auto" : "visible",
          }}
        >
          <div
            className="tw-mb-export-capture"
            ref={viewCaptureRef}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: mode === "edit" ? "stretch" : "center",
              justifyContent: mode === "view" ? "center" : "flex-start",
              width: "100%",
              overflowX: "auto",
              flex: isFullscreen ? "1 1 auto" : undefined,
              minHeight:
                mode === "view" && !svg
                  ? 80
                  : mode === "drag" && nodes.length === 0
                    ? 220
                    : undefined,
              padding: 16,
              boxSizing: "border-box",
              background: "#ffffff",
            }}
          >
            {mode === "edit" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: isFullscreen ? "row" : "column",
                  gap: 12,
                  width: "100%",
                  flex: isFullscreen ? "1 1 auto" : undefined,
                  minHeight: isFullscreen ? 0 : undefined,
                }}
              >
                {/* 代码编辑区 */}
                <div
                  style={{
                    flex: isFullscreen ? "1 1 50%" : undefined,
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 0,
                  }}
                >
                  <textarea
                    ref={(node) => {
                      exportTargetRef.current = node;
                      textareaRef.current = node;
                    }}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    spellCheck={false}
                    style={{
                      width: "100%",
                      minHeight: isFullscreen ? "min(50vh, 420px)" : 180,
                      flex: isFullscreen ? "1 1 auto" : undefined,
                      boxSizing: "border-box",
                      padding: 12,
                      fontSize: 13,
                      lineHeight: 1.5,
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      color: "#0f172a",
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      resize: isFullscreen ? "none" : "vertical",
                    }}
                  />
                </div>

                {/* 实时预览区 */}
                <div
                  ref={editPreviewRef}
                  style={{
                    flex: isFullscreen ? "1 1 50%" : undefined,
                    minWidth: 0,
                    minHeight: isFullscreen ? 0 : 160,
                    maxHeight: isFullscreen ? undefined : 300,
                    overflow: "auto",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      position: "sticky",
                      top: 0,
                      left: 0,
                      right: 0,
                      padding: "6px 10px",
                      background: "rgba(241,245,249,0.95)",
                      borderBottom: "1px solid #e2e8f0",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#64748b",
                      zIndex: 1,
                    }}
                  >
                    {labels.previewTitle}
                  </div>
                  <div
                    style={{
                      padding: 12,
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "flex-start",
                    }}
                  >
                    {editPreviewSvg ? (
                      <div
                        className="mermaid-wrapper twar-mermaid-inner"
                        style={{
                          maxWidth: "100%",
                          overflow: "auto",
                          transform: `scale(${editCompactScale})`,
                          transformOrigin: "top center",
                        }}
                        // eslint-disable-next-line react/no-danger
                        dangerouslySetInnerHTML={{ __html: editPreviewSvg }}
                      />
                    ) : (
                      <div
                        style={{
                          padding: "20px 16px",
                          fontSize: 12,
                          color: "#94a3b8",
                          textAlign: "center",
                        }}
                      >
                        {code.trim()
                          ? "渲染中... / Rendering..."
                          : "输入 Mermaid 代码查看预览"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {mode === "view" &&
              (svg ? (
                <div
                  ref={(node) => {
                    exportTargetRef.current = node;
                  }}
                  className={
                    "tw-mb-light-canvas" +
                    (!isFullscreen ? " tw-mb-diagram-click-fs" : "")
                  }
                  style={{
                    width: "100%",
                    /* 勿用 100% 压扁 SVG：窄栏与全屏查看页均保持固有尺寸，由外层 overflow 滚动 */
                    maxWidth: "none",
                    marginLeft: "auto",
                    marginRight: "auto",
                    overflow: "auto",
                    display: "flex",
                    justifyContent: "center",
                  }}
                  title={!isFullscreen ? labels.clickFullscreenHint : undefined}
                  role={!isFullscreen ? "button" : undefined}
                  tabIndex={!isFullscreen ? 0 : undefined}
                  onClick={
                    !isFullscreen
                      ? () => {
                          openChromeFullscreen("view");
                        }
                      : undefined
                  }
                  onKeyDown={
                    !isFullscreen
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openChromeFullscreen("view");
                          }
                        }
                      : undefined
                  }
                >
                  <div
                    style={{
                      width: diagramSize
                        ? Math.max(1, Math.round(diagramSize.w * viewScale))
                        : "max-content",
                      height: diagramSize
                        ? Math.max(1, Math.round(diagramSize.h * viewScale))
                        : "auto",
                      display: "block",
                    }}
                  >
                    <div
                      className="mermaid-wrapper twar-mermaid-inner"
                      style={{
                        width: diagramSize ? `${diagramSize.w}px` : "max-content",
                        height: diagramSize ? `${diagramSize.h}px` : "auto",
                        transform: `scale(${viewScale})`,
                        transformOrigin: "top left",
                      }}
                      // eslint-disable-next-line react/no-danger
                      dangerouslySetInnerHTML={{ __html: svg }}
                    />
                  </div>
                </div>
              ) : (
                <pre
                  ref={(node) => {
                    exportTargetRef.current = node;
                  }}
                  className={
                    "tw-mb-light-canvas" +
                    (!isFullscreen && code.trim()
                      ? " tw-mb-diagram-click-fs"
                      : "")
                  }
                  title={
                    !isFullscreen && code.trim()
                      ? labels.clickFullscreenHint
                      : undefined
                  }
                  role={!isFullscreen && code.trim() ? "button" : undefined}
                  tabIndex={!isFullscreen && code.trim() ? 0 : undefined}
                  onClick={
                    !isFullscreen && code.trim()
                      ? () => openChromeFullscreen("view")
                      : undefined
                  }
                  onKeyDown={
                    !isFullscreen && code.trim()
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openChromeFullscreen("view");
                          }
                        }
                      : undefined
                  }
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: "#b91c1c",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    width: "max-content",
                    maxWidth: "100%",
                  }}
                >
                  {code}
                </pre>
              ))}

            {mode === "drag" &&
              (nodes.length === 0 ? (
                <div
                  ref={(node) => {
                    exportTargetRef.current = node;
                  }}
                  style={{
                    maxWidth: 520,
                    padding: "20px 16px",
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: "#475569",
                    textAlign: "center",
                    border: "1px dashed #cbd5e1",
                    borderRadius: 10,
                    background: "#f8fafc",
                  }}
                >
                  {flowHeadInfo.isFlowchart
                    ? labels.dragEmptyFlowchartBody
                    : labels.dragUnsupportedBody}
                </div>
              ) : (
                <div
                  ref={(node) => {
                    exportTargetRef.current = node;
                  }}
                  className="tw-mb-flow-shell"
                  style={{
                    height: dragHeight,
                    width: "100%",
                    maxWidth: 960,
                    minHeight: 280,
                    borderRadius: 8,
                    overflow: "hidden",
                    border: "1px solid #cbd5e1",
                    background: "#f8fafc",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {flowHeadInfo.isFlowchart ? (
                    <div
                      style={{
                        flexShrink: 0,
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 10px",
                        borderBottom: "1px solid #e2e8f0",
                        background: "#ffffff",
                        fontSize: 11,
                        color: "#334155",
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{labels.nodeStyleHint}</span>
                      {!selectedFlowNodeId ? (
                        <span style={{ opacity: 0.65 }}>
                          {labels.nodeStyleSelectNode}
                        </span>
                      ) : (
                        <>
                          <code style={{ fontSize: 11, color: "#0f172a" }}>
                            {selectedFlowNodeId}
                          </code>
                          <select
                            aria-label={labels.nodeStyleHint}
                            value={
                              (
                                nodes.find((x) => x.id === selectedFlowNodeId)?.data as {
                                  styleClass?: string;
                                }
                              )?.styleClass ?? ""
                            }
                            onChange={(e) =>
                              applyFlowNodeStyleClass(e.target.value)
                            }
                            style={{
                              maxWidth: 220,
                              padding: "4px 8px",
                              borderRadius: 6,
                              border: "1px solid #cbd5e1",
                              fontSize: 11,
                              background: "#fff",
                            }}
                          >
                            {NODE_STYLE_OPTIONS.map((o) => (
                              <option key={o.value || "__none"} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          <span style={{ marginLeft: 6, opacity: 0.75 }}>
                            {labels.deptColorQuick}:
                          </span>
                          <button type="button" className="tw-mb-btn" onClick={() => applyQuickNodeClass("dept_fin")} style={btnStyle(false)}>
                            {labels.deptFinance}
                          </button>
                          <button type="button" className="tw-mb-btn" onClick={() => applyQuickNodeClass("dept_sec")} style={btnStyle(false)}>
                            {labels.deptIT}
                          </button>
                          <button type="button" className="tw-mb-btn" onClick={() => applyQuickNodeClass("dept_hr")} style={btnStyle(false)}>
                            {labels.deptHR}
                          </button>
                          <button type="button" className="tw-mb-btn" onClick={() => applyQuickNodeClass("dept_ops")} style={btnStyle(false)}>
                            {labels.deptOps}
                          </button>
                          <button type="button" className="tw-mb-btn" onClick={() => applyQuickNodeClass("dept_legal")} style={btnStyle(false)}>
                            {labels.deptLegal}
                          </button>
                        </>
                      )}
                      {selectedFlowEdgeId ? (
                        <>
                          <span style={{ marginLeft: 8, opacity: 0.75 }}>{labels.edgeColorQuick}:</span>
                          {QUICK_EDGE_COLORS.map((c) => (
                            <button
                              key={c.key}
                              type="button"
                              onClick={() => applyQuickEdgeColor(c.color)}
                              title={c.color}
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: 999,
                                border: "1px solid #94a3b8",
                                background: c.color,
                                cursor: "pointer",
                              }}
                            />
                          ))}
                        </>
                      ) : null}
                      <span style={{ marginLeft: 10, opacity: 0.75 }}>
                        {labels.nodeFillColor}
                      </span>
                      <select
                        aria-label={labels.nodeFillColor}
                        disabled={!selectedFlowNodeId}
                        value={
                          ((selectedFlowNode?.data as { customFill?: string } | undefined)?.customFill) ??
                          ""
                        }
                        onChange={(e) => applyNodeColorPreset("fill", e.target.value)}
                        style={{
                          maxWidth: 120,
                          padding: "4px 6px",
                          borderRadius: 6,
                          border: "1px solid #cbd5e1",
                          fontSize: 11,
                          background: "#fff",
                        }}
                      >
                        {COLOR_PRESET_OPTIONS.map((o) => (
                          <option key={o.value || "__def_fill"} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <span style={{ opacity: 0.75 }}>{labels.nodeTextColor}</span>
                      <select
                        aria-label={labels.nodeTextColor}
                        disabled={!selectedFlowNodeId}
                        value={
                          ((selectedFlowNode?.data as { customText?: string } | undefined)?.customText) ??
                          ""
                        }
                        onChange={(e) => applyNodeColorPreset("text", e.target.value)}
                        style={{
                          maxWidth: 120,
                          padding: "4px 6px",
                          borderRadius: 6,
                          border: "1px solid #cbd5e1",
                          fontSize: 11,
                          background: "#fff",
                        }}
                      >
                        {COLOR_TEXT_OPTIONS.map((o) => (
                          <option key={o.value || "__def_text"} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <span style={{ opacity: 0.75 }}>{labels.nodeBorderColor}</span>
                      <select
                        aria-label={labels.nodeBorderColor}
                        disabled={!selectedFlowNodeId}
                        value={
                          ((selectedFlowNode?.data as { customStroke?: string } | undefined)?.customStroke) ??
                          ""
                        }
                        onChange={(e) => applyNodeColorPreset("stroke", e.target.value)}
                        style={{
                          maxWidth: 120,
                          padding: "4px 6px",
                          borderRadius: 6,
                          border: "1px solid #cbd5e1",
                          fontSize: 11,
                          background: "#fff",
                        }}
                      >
                        {COLOR_BORDER_OPTIONS.map((o) => (
                          <option key={o.value || "__def_border"} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <span style={{ opacity: 0.75 }}>{labels.edgeColorDropdown}</span>
                      <select
                        aria-label={labels.edgeColorDropdown}
                        disabled={!selectedFlowEdgeId}
                        value={String((selectedFlowEdge?.style as { stroke?: string } | undefined)?.stroke || "")}
                        onChange={(e) => applyEdgeColorPreset(e.target.value)}
                        style={{
                          maxWidth: 120,
                          padding: "4px 6px",
                          borderRadius: 6,
                          border: "1px solid #cbd5e1",
                          fontSize: 11,
                          background: "#fff",
                        }}
                      >
                        {EDGE_COLOR_OPTIONS.map((o) => (
                          <option key={o.value || "__def_edge"} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  <div
                    style={{
                      flex: 1,
                      minHeight: 0,
                      position: "relative",
                      width: "100%",
                    }}
                  >
                    <ReactFlow
                      nodes={nodes}
                      edges={edges}
                      onNodesChange={onNodesChange}
                      onEdgesChange={onEdgesChange}
                      onConnect={onConnect}
                      onNodeClick={(_, node) => {
                        setSelectedFlowNodeId(node.id);
                        setSelectedFlowEdgeId(null);
                      }}
                      onEdgeClick={(_, edge) => {
                        setSelectedFlowEdgeId(edge.id);
                      }}
                      onPaneClick={() => {
                        setSelectedFlowNodeId(null);
                        setSelectedFlowEdgeId(null);
                      }}
                      fitView
                      fitViewOptions={{ padding: 0.2 }}
                      nodesDraggable
                      nodesConnectable
                      elementsSelectable
                      proOptions={{ hideAttribution: true }}
                      style={{ width: "100%", height: "100%" }}
                    >
                      <Background color="#94a3b8" gap={16} />
                      <Controls />
                    </ReactFlow>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {mode === "drag" && (
          <div
            className="tw-mb-light-canvas"
            style={{
              margin: "0 12px 12px",
              padding: "8px 10px",
              fontSize: 11,
              color: "#334155",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {labels.sync}
            {"\n"}
            {code}
          </div>
        )}

        {/* Toast 提示 */}
        {toastMsg && (
          <div
            style={{
              position: "absolute",
              bottom: 20,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(15,23,42,0.9)",
              color: "#f1f5f9",
              padding: "8px 16px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
              zIndex: 100,
              animation: "tw-mb-toast-fade 0.2s ease-out",
            }}
          >
            {toastMsg}
          </div>
        )}

        {/* 点击空白处关闭下拉菜单 */}
        {showSnippetMenu && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 19,
            }}
            onClick={() => setShowSnippetMenu(false)}
          />
        )}
      </div>
    </ReactFlowProvider>
  );
}

function btnStyle(active: boolean): CSSProperties {
  return {
    border: "none",
    borderRadius: 6,
    padding: "4px 8px",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    background: active ? "rgba(0,212,255,0.35)" : "rgba(0,0,0,0.55)",
    color: "#fff",
  };
}
