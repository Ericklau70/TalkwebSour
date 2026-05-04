/**
 * 合并 zh / en / ko 内置场景 JSON → src/tw_builtin_scenes.js
 * 运行：node scripts/merge-tw-builtin-i18n.cjs
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const zh = JSON.parse(fs.readFileSync(path.join(root, 'src', '_tw_zh_builtin.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'tw-builtin-en.json'), 'utf8'));
const ko = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'tw-builtin-ko.json'), 'utf8'));

const header =
  '// TalkwebSour V3.1 — 首次引导内置场景：按界面语言 zh / en / ko 提供标题与正文\n';
const body = `var TW_BUILTIN_SCENES = ${JSON.stringify({ zh, en, ko }, null, 2)};\n`;
fs.writeFileSync(path.join(root, 'src', 'tw_builtin_scenes.js'), header + body, 'utf8');
console.log('OK → src/tw_builtin_scenes.js', body.length, 'bytes');
