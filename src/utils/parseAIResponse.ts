export type TwAiResponsePart =
  | { type: "text"; text: string }
  | { type: "mermaid"; code: string };

export function extractMermaidBlocks(text: string) {
  const regex = /```mermaid([\s\S]*?)```/g;
  const matches: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1].trim());
  }

  return matches;
}

/**
 * 将 AI 原文拆成「普通 Markdown 文本」与「Mermaid 代码块」交替片段，供 DOM 分段挂载（避免整段 replace）。
 */
export function splitByMermaid(text: string): TwAiResponsePart[] {
  const regex = /```mermaid([\s\S]*?)```/g;
  const parts: TwAiResponsePart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: "mermaid", code: match[1].trim() });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", text: text.slice(lastIndex) });
  }
  if (parts.length === 0) {
    return [{ type: "text", text }];
  }
  return parts;
}
