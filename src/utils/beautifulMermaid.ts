import { renderMermaid } from "./mermaidRenderer";

export async function renderBeautifulMermaid(code: string) {
  const svg = await renderMermaid(code);

  return `
    <div class="mermaid-wrapper w-full overflow-auto">
      ${svg}
    </div>
  `;
}
