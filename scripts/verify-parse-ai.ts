import { extractMermaidBlocks, splitByMermaid } from "../src/utils/parseAIResponse.ts";

const input = `\`\`\`mermaid
graph TD
A-->B
\`\`\``;

const blocks = extractMermaidBlocks(input);
if (blocks.length !== 1 || !blocks[0].includes("A-->B")) {
  throw new Error("extractMermaidBlocks failed");
}

const parts = splitByMermaid(`intro\n\n${input}\n\noutro`);
if (parts.length !== 3 || parts[1].type !== "mermaid") {
  throw new Error("splitByMermaid multi-part failed");
}
if (parts[1].type === "mermaid" && !parts[1].code.includes("graph TD")) {
  throw new Error("mermaid code slice failed");
}

const multi = splitByMermaid(`${input}\n\n${input}`);
if (multi.filter((p) => p.type === "mermaid").length !== 2) {
  throw new Error("expected two mermaid segments");
}

console.log("verify:parse-ai OK");
