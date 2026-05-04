import { flowToMermaid } from "../src/utils/flowToMermaid.ts";
import { mermaidToFlow } from "../src/utils/mermaidToFlow.ts";

const code = `graph TD
A-->B`;
const p = mermaidToFlow(code);
const out = flowToMermaid(p.direction, p.nodes, p.edges);
if (!out.includes("A") || !out.includes("B")) {
  throw new Error("roundtrip missing nodes");
}
if (!out.includes("-->")) {
  throw new Error("roundtrip missing edge");
}
console.log("verify:flow-roundtrip OK\n", out);
