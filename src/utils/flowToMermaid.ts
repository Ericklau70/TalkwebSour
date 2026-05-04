import type { Edge, Node } from "reactflow";
import type { MermaidFlowDirection } from "./mermaidToFlow";

function fmtNode(id: string, nodes: Node[]): string {
  const n = nodes.find((x) => x.id === id);
  if (!n) return id;
  const lab =
    n.data && typeof (n.data as { label?: unknown }).label === "string"
      ? String((n.data as { label: string }).label)
      : "";
  if (lab && lab !== n.id) return `${n.id}[${lab}]`;
  return n.id;
}

/**
 * 将当前 Flow 状态导出为 Mermaid flowchart（graph TD/LR + --> 边）。
 */
export function flowToMermaid(
  direction: MermaidFlowDirection,
  nodes: Node[],
  edges: Edge[],
): string {
  const lines: string[] = [`flowchart ${direction}`];
  const seen = new Set<string>();

  for (const e of edges) {
    const a = fmtNode(e.source, nodes);
    const b = fmtNode(e.target, nodes);
    const mid =
      e.label && String(e.label).trim()
        ? `-->|${String(e.label).replace(/\|/g, " ")}|`
        : "-->";
    lines.push(`${a}${mid}${b}`);
    seen.add(e.source);
    seen.add(e.target);
  }

  for (const n of nodes) {
    if (seen.has(n.id)) continue;
    lines.push(fmtNode(n.id, nodes));
  }

  const classMap = new Map<string, string[]>();
  for (const n of nodes) {
    const sc = (n.data as { styleClass?: string })?.styleClass;
    const k = sc && String(sc).trim();
    if (k) {
      if (!classMap.has(k)) classMap.set(k, []);
      classMap.get(k)!.push(n.id);
    }
  }
  for (const [cls, ids] of classMap) {
    if (ids.length) {
      lines.push(`class ${[...new Set(ids)].join(",")} ${cls}`);
    }
  }

  for (const n of nodes) {
    const data = (n.data || {}) as {
      customFill?: string;
      customText?: string;
      customStroke?: string;
    };
    const styleParts: string[] = [];
    if (data.customFill) styleParts.push(`fill:${data.customFill}`);
    if (data.customText) styleParts.push(`color:${data.customText}`);
    if (data.customStroke) styleParts.push(`stroke:${data.customStroke}`, "stroke-width:2px");
    if (styleParts.length) {
      lines.push(`style ${n.id} ${styleParts.join(",")}`);
    }
  }

  edges.forEach((e, i) => {
    const stroke = (e.style as { stroke?: string } | undefined)?.stroke;
    if (stroke && String(stroke).trim()) {
      lines.push(`linkStyle ${i} stroke:${stroke},stroke-width:2.4px`);
    }
  });

  return lines.join("\n");
}
