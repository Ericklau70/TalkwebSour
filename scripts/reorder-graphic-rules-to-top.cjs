'use strict';

/**
 * Moves "## 🎨 Mermaid …" global block to the TOP of each graphicTemplates content,
 * keeping TalkWebSour contract + tail unchanged.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const scenesPath = path.join(root, 'src', 'tw_builtin_scenes.js');

const cfg = [
  {
    lang: 'zh',
    templates: null,
    startMarker: '## 🎨 Mermaid 通用增强规则',
    contractMarker: '---\n## Mermaid 渲染契约（TalkWebSour）'
  },
  {
    lang: 'en',
    templates: null,
    startMarker: '## 🎨 Mermaid universal enhancement rules',
    contractMarker: '---\n## Mermaid render contract (TalkWebSour)'
  },
  {
    lang: 'ko',
    templates: null,
    startMarker: '## 🎨 Mermaid 공통 강화 규칙',
    contractMarker: '---\n## Mermaid 렌더링 규약 (TalkWebSour)'
  }
];

const code = fs.readFileSync(scenesPath, 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(code, ctx);
const T = ctx.TW_BUILTIN_SCENES;

function reorderContents(templates, startMarker, contractMarker) {
  for (const item of templates) {
    let c = item.content;
    const i0 = c.indexOf(startMarker);
    const i1 = c.indexOf(contractMarker);
    if (i0 < 0 || i1 < 0 || i1 <= i0) continue;
    const intro = c.slice(0, i0).trimEnd();
    const rulesBlock = c.slice(i0, i1).trimEnd();
    const tail = c.slice(i1);
    item.content = `${rulesBlock}\n\n---\n\n${intro}\n\n${tail}`;
  }
}

for (const row of cfg) {
  row.templates = T[row.lang].graphicTemplates;
  reorderContents(row.templates, row.startMarker, row.contractMarker);
  console.log(row.lang + ': reordered');
}

const header =
  '// TalkwebSour V3.1 — 首次引导内置场景：按界面语言 zh / en / ko 提供标题与正文\n';
const body = `var TW_BUILTIN_SCENES = ${JSON.stringify(T, null, 2)};\n`;
fs.writeFileSync(scenesPath, header + body, 'utf8');

fs.writeFileSync(path.join(root, 'src', '_tw_zh_builtin.json'), JSON.stringify(T.zh, null, 2) + '\n');
fs.writeFileSync(path.join(root, 'scripts', 'tw-builtin-en.json'), JSON.stringify(T.en, null, 2) + '\n');
fs.writeFileSync(path.join(root, 'scripts', 'tw-builtin-ko.json'), JSON.stringify(T.ko, null, 2) + '\n');

console.log('OK → tw_builtin_scenes.js + JSON exports');
