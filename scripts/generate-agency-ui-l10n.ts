/**
 * 根据 agency-index.json 生成 src/agency/ui-l10n/{zh,ko,en}.json
 * 用于界面语言与官方 Agent 标题/摘要显示（无需运行时联网）。
 *
 * 默认：en.json 从索引复制原文；zh/ko 使用 MyMemory 免费接口翻译标题（description 取翻译后的标题尾部或略译，避免过长）。
 * 需要网络：npm run generate:agency-l10n
 *
 * 环境变量：
 *   AGENCY_L10N_SKIP_NET=1 — 仅写入与英文相同的占位（不调用 API）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'src', 'agency', 'agency-index.json');
const OUT_DIR = path.join(ROOT, 'src', 'agency', 'ui-l10n');

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function translateMyMemory(text: string, langpair: string): Promise<string> {
  const q = text.slice(0, 480);
  const u = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${encodeURIComponent(langpair)}`;
  const res = await fetch(u);
  const j = (await res.json()) as { responseData?: { translatedText?: string } };
  return j.responseData?.translatedText || text;
}

async function main() {
  if (!fs.existsSync(INDEX)) {
    console.error('[generate-agency-ui-l10n] 缺少', INDEX, '请先 npm run build:agency');
    process.exit(1);
  }
  const raw = fs.readFileSync(INDEX, 'utf8');
  const index = JSON.parse(raw) as {
    categories: Array<{ agents: Array<{ id: string; title: string; description?: string }> }>;
  };
  const agents: Array<{ id: string; title: string; description: string }> = [];
  for (const c of index.categories || []) {
    for (const a of c.agents || []) {
      agents.push({
        id: a.id,
        title: String(a.title || ''),
        description: String(a.description || '').slice(0, 480),
      });
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const enPack: Record<string, { title: string; description: string }> = {};
  for (const a of agents) {
    enPack[a.id] = { title: a.title, description: a.description };
  }
  fs.writeFileSync(path.join(OUT_DIR, 'en.json'), JSON.stringify({ agents: enPack }, null, 0), 'utf8');
  console.log('[generate-agency-ui-l10n] en.json agents:', Object.keys(enPack).length);

  const skipNet = process.env.AGENCY_L10N_SKIP_NET === '1';
  const zhPack: Record<string, { title: string; description: string }> = {};
  const koPack: Record<string, { title: string; description: string }> = {};

  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    if (skipNet) {
      zhPack[a.id] = { title: a.title, description: a.description };
      koPack[a.id] = { title: a.title, description: a.description };
      continue;
    }
    try {
      const titleZh = await translateMyMemory(a.title, 'en|zh-CN');
      let descZh = a.description;
      if (a.description.length > 12) {
        descZh = await translateMyMemory(a.description.slice(0, 360), 'en|zh-CN');
      }
      zhPack[a.id] = { title: titleZh, description: descZh };
      await sleep(220);
      const titleKo = await translateMyMemory(a.title, 'en|ko');
      let descKo = a.description;
      if (a.description.length > 12) {
        descKo = await translateMyMemory(a.description.slice(0, 360), 'en|ko');
      }
      koPack[a.id] = { title: titleKo, description: descKo };
      await sleep(220);
    } catch (e) {
      console.warn('[warn]', a.id, e);
      zhPack[a.id] = { title: a.title, description: a.description };
      koPack[a.id] = { title: a.title, description: a.description };
    }
    if ((i + 1) % 20 === 0) console.log('[generate-agency-ui-l10n]', i + 1, '/', agents.length);
  }

  fs.writeFileSync(path.join(OUT_DIR, 'zh.json'), JSON.stringify({ agents: zhPack }, null, 0), 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'ko.json'), JSON.stringify({ agents: koPack }, null, 0), 'utf8');
  console.log('[generate-agency-ui-l10n] wrote zh.json / ko.json');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
