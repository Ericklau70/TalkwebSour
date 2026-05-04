/**
 * 从 third_party/agency-agents 或 scripts/agency-samples 扫描 .md，
 * 生成 src/agency/agency-index.json 与 src/agency/bodies/*.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import fg from 'fast-glob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const VENDOR = path.join(ROOT, 'third_party', 'agency-agents');
const SAMPLES = path.join(__dirname, 'agency-samples');
const OUT_DIR = path.join(ROOT, 'src', 'agency');
const BODIES = path.join(OUT_DIR, 'bodies');

const IGNORE_NAMES = new Set(
  'readme.md contributing.md license.md contributing_zh-cn.md code_of_conduct.md security.md'.split(' '),
);

function readAllMdFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const all = fg.sync('**/*.md', { cwd: root, onlyFiles: true, absolute: true, ignore: ['**/node_modules/**', '**/.git/**'] });
  return all.filter((p) => {
    const base = path.basename(p).toLowerCase();
    if (IGNORE_NAMES.has(base)) return false;
    // 仅子目录中的 .md 视为智能体（与 agency-agents 仓库结构一致）
    const rel = path.relative(root, p);
    return rel.includes(path.sep) || rel.split(path.sep).length > 1;
  });
}

function safeId(s: string) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'agent';
}

function main() {
  let sourceDir = VENDOR;
  let files = readAllMdFiles(VENDOR);
  if (files.length === 0) {
    sourceDir = SAMPLES;
    files = readAllMdFiles(SAMPLES);
  }
  if (files.length === 0) {
    console.error('[build-agency-index] 无可用 .md 文件。请 clone agency-agents 到 third_party/agency-agents 或保留 scripts/agency-samples/。');
    process.exit(1);
  }

  fs.mkdirSync(BODIES, { recursive: true });

  const byCategory = new Map<string, { id: string; label: string; agents: any[] }>();

  for (const file of files) {
    const rel = path.relative(sourceDir, file);
    const top = rel.split(path.sep)[0] || 'root';
    const raw = fs.readFileSync(file, 'utf8');
    let data: Record<string, unknown>;
    let content: string;
    try {
      const parsed = matter(raw);
      data = parsed.data as Record<string, unknown>;
      content = parsed.content;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[build-agency-index] skip', rel.replace(/\\/g, '/'), msg);
      continue;
    }
    const title =
      (typeof data.name === 'string' && data.name) ||
      (typeof data.title === 'string' && data.title) ||
      path.basename(file, '.md');
    const description = typeof data.description === 'string' ? data.description : '';
    const titleZh =
      typeof data.name_zh === 'string'
        ? data.name_zh
        : typeof data.nameZh === 'string'
          ? data.nameZh
          : '';
    const titleKo =
      typeof data.name_ko === 'string'
        ? data.name_ko
        : typeof data.nameKo === 'string'
          ? data.nameKo
          : '';
    const descZh =
      typeof data.description_zh === 'string'
        ? data.description_zh
        : typeof data.descriptionZh === 'string'
          ? data.descriptionZh
          : '';
    const descKo =
      typeof data.description_ko === 'string'
        ? data.description_ko
        : typeof data.descriptionKo === 'string'
          ? data.descriptionKo
          : '';
    const id = `ag_${safeId(top + '_' + path.basename(file, '.md'))}`.replace(/-+/g, '_');
    const bodyId = id + '.json';
    const bodyPath = path.join(BODIES, bodyId);
    fs.writeFileSync(
      bodyPath,
      JSON.stringify(
        {
          id,
          file: rel.replace(/\\/g, '/'),
          frontMatter: data,
          content: content.trim(),
        },
        null,
        0,
      ),
      'utf8',
    );

    if (!byCategory.has(top)) {
      byCategory.set(top, { id: safeId(top) || 'cat', label: top, agents: [] });
    }
    const agentEntry: Record<string, unknown> = {
      id,
      title: String(title),
      description: String(description).slice(0, 480),
      bodyUrl: `bodies/${bodyId}`,
    };
    if (titleZh) agentEntry.titleZh = String(titleZh);
    if (titleKo) agentEntry.titleKo = String(titleKo);
    if (descZh) agentEntry.descZh = String(descZh).slice(0, 480);
    if (descKo) agentEntry.descKo = String(descKo).slice(0, 480);
    byCategory.get(top)!.agents.push(agentEntry);
  }

  const categories = [...byCategory.values()].sort((a, b) => a.label.localeCompare(b.label));

  const index = {
    version: 1,
    source: path.relative(ROOT, sourceDir).replace(/\\/g, '/'),
    generatedAt: new Date().toISOString(),
    categories,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'agency-index.json'), JSON.stringify(index, null, 2), 'utf8');
  console.log('[build-agency-index] categories:', categories.length, 'agents:', categories.reduce((n, c) => n + c.agents.length, 0));
}

main();
