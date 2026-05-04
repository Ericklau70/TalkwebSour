import type { Edge, Node } from "reactflow";

export type MermaidFlowDirection = "TD" | "LR";

export type MermaidFlowData = {
  direction: MermaidFlowDirection;
  nodes: Node[];
  edges: Edge[];
};

const EDGE_LINE =
  /^(.*?)\s*(-->|---|==>|-\.->|==)\s*(?:\|([^|]*)\|\s*)?(.*)$/;

function extractNodeId(raw: string): string {
  const t = raw.trim();
  const m = /^([A-Za-z0-9_]+)/.exec(t);
  return m ? m[1] : t.split(/\s+/)[0]?.slice(0, 32) || "n";
}

function extractLabel(raw: string, id: string): string | null {
  const t = raw.trim();
  const br = new RegExp(`^${id}\\[([^\\]]*)\\]\\s*$`).exec(t);
  if (br) return br[1] || id;
  const par = new RegExp(`^${id}\\(([^)]*)\\)\\s*$`).exec(t);
  if (par) return par[1] || id;
  const curl = new RegExp(`^${id}\\{([^}]*)\\}\\s*$`).exec(t);
  if (curl) return curl[1] || id;
  return null;
}

function layoutGrid(
  ids: string[],
  direction: MermaidFlowDirection,
): Map<string, { x: number; y: number }> {
  const map = new Map<string, { x: number; y: number }>();
  const cols = Math.max(2, Math.ceil(Math.sqrt(ids.length + 1)));
  ids.forEach((id, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = direction === "LR" ? col * 220 : col * 200;
    const y = direction === "TD" ? row * 120 : row * 140;
    map.set(id, { x, y });
  });
  return map;
}

/**
 * 将常见 flowchart 语法（graph TD/LR + A-->B 等）转为 React Flow 数据。
 * 复杂 Mermaid（子图、样式等）未覆盖时仍可在「编辑」模式改 code。
 */
export function mermaidToFlow(code: string): MermaidFlowData {
  const lines = String(code || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("%%"));

  let direction: MermaidFlowDirection = "TD";
  const head = lines[0]?.toLowerCase() ?? "";
  if (/^graph\s+lr\b/.test(head) || /^flowchart\s+lr\b/.test(head)) {
    direction = "LR";
  }

  const pairs: { source: string; target: string; label?: string }[] = [];
  const labelById = new Map<string, string>();
  /** 仅声明、未出现在边上的节点，如 flowchart TD 下的 A[开始] 单独一行 */
  const STANDALONE_NODE =
    /^\s*([A-Za-z0-9_]+)\s*(\[[^\]]*\]|\([^)]*\)|\{[^}]*\})\s*$/;
  const ids = new Set<string>();

  for (const line of lines) {
    if (/^(graph|flowchart)\s+/i.test(line)) continue;
    if (/^subgraph\b/i.test(line) || /^end\b/i.test(line)) continue;

    const m = line.match(EDGE_LINE);
    if (m) {
      const left = m[1].trim();
      const right = m[4].trim();
      const label = m[3]?.trim();
      const sid = extractNodeId(left);
      const tid = extractNodeId(right);
      pairs.push({ source: sid, target: tid, label });

      const l1 = extractLabel(left, sid);
      const l2 = extractLabel(right, tid);
      if (l1) labelById.set(sid, l1);
      if (l2) labelById.set(tid, l2);
      continue;
    }

    const sm = line.match(STANDALONE_NODE);
    if (sm) {
      const id = sm[1];
      const lb = extractLabel(line, id);
      if (lb) labelById.set(id, lb);
      ids.add(id);
    }
  }

  pairs.forEach((p) => {
    ids.add(p.source);
    ids.add(p.target);
  });

  const classById = new Map<string, string>();
  const inlineStyleById = new Map<
    string,
    { fill?: string; color?: string; stroke?: string }
  >();
  const linkStrokeByIdx = new Map<number, string>();
  const CLASS_STMT = /^\s*class\s+([A-Za-z0-9_,\s]+)\s+(\w+)\s*$/i;
  const STYLE_STMT = /^\s*style\s+([A-Za-z0-9_]+)\s+(.+)\s*$/i;
  const LINK_STYLE_STMT = /^\s*linkStyle\s+(\d+)\s+(.+)\s*$/i;
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("%%")) continue;
    const cm = t.match(CLASS_STMT);
    if (cm) {
      const idPart = cm[1].trim();
      const cls = cm[2].trim();
      idPart
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((id) => classById.set(id, cls));
      continue;
    }
    const sm = t.match(STYLE_STMT);
    if (sm) {
      const id = sm[1];
      const styleRaw = sm[2] || "";
      const curr = inlineStyleById.get(id) || {};
      styleRaw.split(",").forEach((part) => {
        const [kRaw, vRaw] = part.split(":");
        const k = String(kRaw || "").trim().toLowerCase();
        const v = String(vRaw || "").trim();
        if (!v) return;
        if (k === "fill") curr.fill = v;
        if (k === "color") curr.color = v;
        if (k === "stroke") curr.stroke = v;
      });
      inlineStyleById.set(id, curr);
      continue;
    }
    const lm = t.match(LINK_STYLE_STMT);
    if (lm) {
      const idx = Number.parseInt(lm[1], 10);
      if (!Number.isFinite(idx)) continue;
      const styleRaw = lm[2] || "";
      styleRaw.split(",").forEach((part) => {
        const [kRaw, vRaw] = part.split(":");
        const k = String(kRaw || "").trim().toLowerCase();
        const v = String(vRaw || "").trim();
        if (k === "stroke" && v) linkStrokeByIdx.set(idx, v);
      });
    }
  }

  const idList = [...ids];
  const pos = layoutGrid(idList, direction);

  const nodes: Node[] = idList.map((id) => {
    const p = pos.get(id) ?? { x: 0, y: 0 };
    const lb = labelById.get(id) ?? id;
    const styleClass = classById.get(id);
    const custom = inlineStyleById.get(id) || {};
    const nodeStyle: Record<string, string | number> = {};
    if (custom.fill) nodeStyle.background = custom.fill;
    if (custom.color) nodeStyle.color = custom.color;
    if (custom.stroke) {
      nodeStyle.borderColor = custom.stroke;
      nodeStyle.borderWidth = 2;
      nodeStyle.borderStyle = "solid";
    }
    return {
      id,
      position: { x: p.x, y: p.y },
      data: {
        label: lb,
        ...(styleClass ? { styleClass } : {}),
        ...(custom.fill ? { customFill: custom.fill } : {}),
        ...(custom.color ? { customText: custom.color } : {}),
        ...(custom.stroke ? { customStroke: custom.stroke } : {}),
      },
      ...(Object.keys(nodeStyle).length ? { style: nodeStyle } : {}),
    };
  });

  const edges: Edge[] = pairs.map((e, i) => {
    const stroke = linkStrokeByIdx.get(i);
    return {
      id: `e${i}-${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      label: e.label,
      ...(stroke
        ? { style: { stroke, strokeWidth: 2.4 } }
        : {}),
    };
  });

  return { direction, nodes, edges };
}
