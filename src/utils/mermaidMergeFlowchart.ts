/**
 * 拖拽编辑同步回代码时，保留 flowchart 行之上的 %%init、classDef 等前缀。
 */
export function mergeFlowchartIntoCode(
  originalCode: string,
  newFlowchartBody: string,
): string {
  const lines = originalCode.split(/\r?\n/);
  let graphIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (/^(flowchart|graph)\s+/i.test(t)) {
      graphIdx = i;
      break;
    }
  }
  if (graphIdx < 0) return newFlowchartBody.trim();
  const head = lines.slice(0, graphIdx).join("\n").trimEnd();
  const body = newFlowchartBody.trim();
  return head ? `${head}\n${body}` : body;
}
