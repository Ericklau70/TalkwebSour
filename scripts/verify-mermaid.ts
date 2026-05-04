import { Window as HappyWindow } from "happy-dom";

function installHappyDomGlobals() {
  const window = new HappyWindow({ url: "http://localhost/" });
  const g = globalThis as typeof globalThis & Record<string, unknown>;
  g.window = window as unknown as Window & typeof globalThis;
  g.document = window.document;
  Object.defineProperty(g, "navigator", {
    value: window.navigator,
    configurable: true,
    writable: true,
  });
  g.requestAnimationFrame = window.requestAnimationFrame.bind(window);
  g.getComputedStyle = window.getComputedStyle.bind(window);
  g.HTMLElement = window.HTMLElement;
  g.Element = window.Element;
  g.SVGElement = window.SVGElement;
}

async function main() {
  installHappyDomGlobals();
  const { renderMermaid } = await import("../src/utils/mermaidRenderer.ts");
  const svg = await renderMermaid(`graph TD
A-->B`);
  if (!svg.includes("<svg")) {
    throw new Error("Expected SVG output from Mermaid");
  }
  console.log("verify:mermaid OK, SVG length:", svg.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
