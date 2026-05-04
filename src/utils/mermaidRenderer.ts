import mermaid from "mermaid";

/** 高对比浅色主题：便于在暗色面板内阅读，且导出 PNG/JPEG 时线条与文字清晰 */
mermaid.initialize({
  startOnLoad: false,
  securityLevel: "loose",
  theme: "base",
  themeVariables: {
    /** 略大于默认，快速模式窄栏内可读性更好；布局仍由横向滚动承担，不撑宽面板外框 */
    fontSize: "16px",
    darkMode: false,
    background: "#ffffff",
    primaryColor: "#dbeafe",
    primaryTextColor: "#0f172a",
    primaryBorderColor: "#1d4ed8",
    lineColor: "#1e293b",
    secondaryColor: "#fef9c3",
    secondaryTextColor: "#422006",
    tertiaryColor: "#f8fafc",
    mainBkg: "#ffffff",
    secondBkg: "#f1f5f9",
    textColor: "#0f172a",
    clusterBkg: "#f1f5f9",
    titleColor: "#0f172a",
    edgeLabelBackground: "#ffffff",
    nodeTextColor: "#0f172a",
    actorBkg: "#ffffff",
    actorBorder: "#1d4ed8",
    actorTextColor: "#0f172a",
    signalColor: "#0f172a",
    sequenceNumberColor: "#ffffff",
    labelTextColor: "#0f172a",
    loopTextColor: "#0f172a",
    noteBkgColor: "#fffbeb",
    noteTextColor: "#422006",
    noteBorderColor: "#ca8a04",
  },
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 将 AI 常误写的图类型首行改为 Mermaid 11 实际识别的关键字（与官方 detector 一致）。
 * 例如雷达图须写 radar-beta，单独写 radar 会报 No diagram type detected。
 */
function normalizeMermaidDiagramHeaders(code: string): string {
  const lines = code.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trim();
    if (!t || t.startsWith("%%")) continue;

    if (/^radar\b/i.test(t) && !/^radar-beta\b/i.test(t)) {
      lines[i] = raw.replace(/^\s*radar\b/i, (s) => s.replace(/radar/i, "radar-beta"));
    } else if (/^treeView\b/i.test(t) && !/^treeView-beta\b/i.test(t)) {
      lines[i] = raw.replace(/^\s*treeView\b/i, (s) => s.replace(/treeView/i, "treeView-beta"));
    } else if (/^venn\b/i.test(t) && !/^venn-beta\b/i.test(t)) {
      lines[i] = raw.replace(/^\s*venn\b/i, (s) => s.replace(/venn/i, "venn-beta"));
    }
    break;
  }
  return lines.join("\n");
}

/**
 * AI 常把雷达曲线写成 YAML 风格 `"名称": [1,2,3]`；官方须用 curve 关键字，见
 * https://mermaid.js.org/syntax/radar.html
 */
function rewriteRadarLegacyCurveLines(code: string): string {
  if (!/^\s*radar-beta\b/im.test(code)) return code;
  let n = 0;
  return code
    .split(/\r?\n/)
    .map((line) => {
      const m =
        line.match(/^(\s*)"([^"]+)"\s*:\s*\[([\d\s.,]+)\]\s*$/) ??
        line.match(/^(\s*)'([^']+)'\s*:\s*\[([\d\s.,]+)\]\s*$/);
      if (!m) return line;
      n += 1;
      const indent = m[1];
      const label = m[2];
      const nums = m[3].replace(/\s/g, "");
      const id = `twR${n}`;
      return `${indent}curve ${id}["${label.replace(/\\/g, "\\\\").replace(/"/g, "'")}"]{${nums}}`;
    })
    .join("\n");
}

/** 根据代码 / 报错推测官方语法页，便于用户交给 AI 对照修正 */
function guessMermaidSyntaxDocUrl(code: string, errMsg: string): string {
  const head = code.slice(0, 500).toLowerCase();
  const e = errMsg.toLowerCase();
  if (/radar-beta|\bradar\b/.test(head) || /\bradar\b/.test(e)) {
    return "https://mermaid.js.org/syntax/radar.html";
  }
  if (/sequencediagram/.test(head)) return "https://mermaid.js.org/syntax/sequenceDiagram.html";
  if (/classdiagram/.test(head)) return "https://mermaid.js.org/syntax/classDiagram.html";
  if (/statediagram/.test(head)) return "https://mermaid.js.org/syntax/stateDiagram.html";
  if (/\bgantt\b/.test(head)) return "https://mermaid.js.org/syntax/gantt.html";
  if (/\bpie\b/.test(head)) return "https://mermaid.js.org/syntax/pie.html";
  if (/mindmap/.test(head)) return "https://mermaid.js.org/syntax/mindmap.html";
  if (/timeline/.test(head)) return "https://mermaid.js.org/syntax/timeline.html";
  if (/quadrantchart/.test(head)) return "https://mermaid.js.org/syntax/quadrantChart.html";
  if (/sankey/.test(head)) return "https://mermaid.js.org/syntax/sankey.html";
  if (/xychart/.test(head)) return "https://mermaid.js.org/syntax/xyChart.html";
  if (/packet/.test(head)) return "https://mermaid.js.org/syntax/packet.html";
  if (/kanban/.test(head)) return "https://mermaid.js.org/syntax/kanban.html";
  if (/architecture/.test(head)) return "https://mermaid.js.org/syntax/architecture.html";
  if (/treemap/.test(head)) return "https://mermaid.js.org/syntax/treemap.html";
  if (/venn-beta|\bvenn\b/.test(head)) return "https://mermaid.js.org/syntax/venn.html";
  if (/ishikawa/.test(head)) return "https://mermaid.js.org/syntax/ishikawa.html";
  if (/treeview-beta|\btreeview\b/.test(head)) return "https://mermaid.js.org/syntax/treeview.html";
  if (/gitgraph/.test(head)) return "https://mermaid.js.org/syntax/gitgraph.html";
  if (/erdiagram/.test(head)) return "https://mermaid.js.org/syntax/entityRelationshipDiagram.html";
  if (/journey/.test(head)) return "https://mermaid.js.org/syntax/userJourney.html";
  if (/block-beta|\bblock\b/.test(head)) return "https://mermaid.js.org/syntax/block.html";
  if (/flowchart|^\s*graph\s/.test(head) || /flowchart|flowchart-v2/.test(e)) {
    return "https://mermaid.js.org/syntax/flowchart.html";
  }
  return "https://mermaid.js.org/";
}

/** 空白或仅注释：不调用 mermaid，避免 “No diagram type detected” */
export async function renderMermaid(code: string): Promise<string> {
  const raw = String(code ?? "").trim();
  const toRender = raw
    .replace(/^\s*```(?:mermaid)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  if (!toRender) {
    return `<div class="tw-mermaid-hint" style="padding:12px;color:#64748b;font-size:13px;line-height:1.55;">
      暂无有效 Mermaid 代码（例如变量未填导致代码块为空）。<br/>
      <span style="font-size:11px;opacity:0.88">No valid Mermaid (e.g. empty placeholder). · 유효한 Mermaid 없음</span>
    </div>`;
  }
  const normalized = rewriteRadarLegacyCurveLines(normalizeMermaidDiagramHeaders(toRender));
  try {
    const id = "mermaid-" + Date.now();
    const { svg } = await mermaid.render(id, normalized);
    return svg;
  } catch (err) {
    console.error(err);
    const msg = err instanceof Error ? err.message : String(err);
    const short = escapeHtml(msg).slice(0, 420);
    const docUrl = guessMermaidSyntaxDocUrl(toRender, msg);
    const betaHint =
      /no diagram type detected/i.test(msg) || /\bradar\b/i.test(toRender.slice(0, 120))
        ? `<p style="margin:6px 0 0;font-size:11px;color:#475569;">提示：雷达图首行须为 <code style="background:#f1f5f9;padding:1px 4px;border-radius:4px">radar-beta</code>；曲线须用 <code style="background:#f1f5f9;padding:1px 4px;border-radius:4px">curve id["标签"]{1,2,3}</code>，勿用 <code style="background:#f1f5f9;padding:1px 4px;border-radius:4px">"标签": [1,2,3]</code>。树状视图、韦恩图须 <code style="background:#f1f5f9;padding:1px 4px;border-radius:4px">treeView-beta</code> / <code style="background:#f1f5f9;padding:1px 4px;border-radius:4px">venn-beta</code>。</p>`
        : "";
    const docEsc = escapeHtml(docUrl);
    return `<div class="tw-mermaid-hint" style="padding:10px;color:#b91c1c;font-size:12px;line-height:1.5;">
      <strong style="color:#991b1b">Mermaid 解析失败</strong><br/>
      <code style="font-size:11px;word-break:break-all;opacity:0.95">${short}</code>
      ${betaHint}
      <p style="margin:10px 0 0;font-size:11px;color:#334155;line-height:1.55;">
        请把本段 Mermaid 与下方<strong>官方语法（与本图类型对应）</strong>一并交给 AI，按文档改写后再粘贴：<br/>
        <a href="${docEsc}" style="color:#2563eb;word-break:break-all" target="_blank" rel="noopener noreferrer">${docEsc}</a>
      </p>
      <p style="margin:8px 0 0;font-size:11px;color:#475569;font-weight:500;">
        流程图类：节点 ID 用英文/数字/下划线；中文、韩文写在方括号标签内，例如 <code style="background:#f1f5f9;padding:1px 4px;border-radius:4px">A["订单服务"]</code>。
      </p>
    </div>`;
  }
}
