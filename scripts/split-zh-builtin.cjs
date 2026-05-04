/**
 * 从「图形模版」「设计师级 AI 共创系统」生成 src/_tw_zh_builtin.json
 * 图形：每个图类型一条独立 Script；国际业务拆为 intlTranslate / intlSop
 * 运行：node scripts/split-zh-builtin.cjs
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function splitGraphicFile(raw) {
  const text = String(raw).replace(/\r\n/g, '\n').trim();
  const headRe =
    /\n(?=(?:2️⃣0️⃣|1️⃣9️⃣|1️⃣8️⃣|1️⃣7️⃣|1️⃣6️⃣|1️⃣5️⃣|1️⃣4️⃣|1️⃣3️⃣|1️⃣2️⃣|1️⃣1️⃣|🔟|[1-9]️⃣)\s)/g;
  const parts = text.split(headRe).map((s) => s.trim()).filter(Boolean);
  const out = [];
  let idn = 0;
  for (let chunk of parts) {
    if (!/请生成|请用|AI Script/.test(chunk)) continue;
    // 去掉误并入下一「大类」标题行（如 🟢 三、结构类）
    chunk = chunk.replace(/\n(?:🟢|🟡|🟠|🔴|🟣|⚫|🔵)[^\n]+$/m, '').trim();
    const lines = chunk.split('\n');
    const first = lines[0] || '';
    const title = first.replace(/\s+$/, '').length ? `📐 ${first.trim()}` : `📐 图形模版 ${idn + 1}`;
    out.push({
      id: `gph-${idn}`,
      title,
      content: `${chunk}\n\n【原始内容】：\n`,
      groupId: null,
    });
    idn++;
  }
  return out;
}

function splitDesignerFile(raw) {
  const text = String(raw).replace(/\r\n/g, '\n');
  const cuts = [
    { re: /一、统一总控[\s\S]*?(?=👕 二、)/, title: '🎛️ 视觉总控（蓝图先行）' },
    { re: /👕 二、服装设计[\s\S]*?(?=🎨 三、)/, title: '👕 服装设计工作流' },
    { re: /🎨 三、插画[\s\S]*?(?=📸 四、)/, title: '🎨 插画 / 画面设计' },
    { re: /📸 四、摄影[\s\S]*?(?=🧴 五、)/, title: '📸 摄影构图' },
    { re: /🧴 五、产品视觉[\s\S]*?(?=🎬 六、)/, title: '🧴 产品视觉' },
    { re: /🎬 六、视频生成[\s\S]*?(?=🚀 七、)/, title: '🎬 视频生成' },
    { re: /🚀 七、[\s\S]*/, title: '🚀 工作流引擎与确认' },
  ];
  return cuts.map((c, i) => {
    const m = text.match(c.re);
    if (!m) throw new Error('设计师文件匹配失败: ' + c.title);
    return { id: `des-${i}`, title: c.title, content: m[0].trim(), groupId: null };
  });
}

const graphicRaw = fs.readFileSync(path.join(root, '图形模版'), 'utf8');
const designRaw = fs.readFileSync(path.join(root, '设计师级 AI 共创系统'), 'utf8');

const intlTranslate = [
  {
    id: 'intl-tr',
    title: '🌐 中译外（职场/技术）',
    content:
      '角色设定：你是企业资深技术与商务沟通专家，精通中文与{{韩文:lang:目标语言}}，熟悉跨文化职场与技术用语。\n\n任务：\n1）先优化下方【原始内容】的中文语法与语序，使表达自然、专业、逻辑清晰。\n2）将优化后的内容翻译为{{韩文:lang:目标语言}}，符合当地职场与技术场景习惯，避免生硬机翻。\n\n【原始内容】：\n',
    groupId: null,
  },
];

const intlSop = [
  {
    id: 'intl-sop',
    title: '📑 企业 标准 SOP（通用）',
    content:
      '你是企业内部流程与合规文档（SOP）撰写专家，擅长将业务场景转化为可执行的 Markdown SOP，适用于各类公司与组织（文档中的组织名、系统名、地域等请使用用户提供的实际信息；未提供时用占位符并在文末列出待填项）。\n\n## 任务\n根据用户描述的【业务场景】，生成一份标准 SOP，严格遵守下方命名规范与 Markdown 结构。\n\n## 1. 命名与文档规范\n- 文档编号：[组织简称]-IT-SOP-[三位分类码]-YYYYMMDD-01（组织简称未提供时用 ORG）\n- 常用分类码：ADM（行政后勤）、OPS（运维与支持）、SEC（安全）、FIN（财务与资产）\n- 版本号：V1.0\n- 密级：按用户指定；未指定则写「内部使用 / Internal Use」\n- 生效日期：生成当日 YYYY-MM-DD\n\n## 2. Markdown 输出结构（须完整填充各栏）\n\n# [流程全称]\n\n> **文档编号：** …  \n> **版本：** V1.0 | **密级：** … | **生效：** YYYY-MM-DD\n\n---\n\n### 1. 流程概览\n- **流程名称：**\n- **所属分类：**（ADM/OPS/SEC/FIN）\n- **流程负责人：**（部门/角色）\n- **适用范围：**（地域、业务线、办公形态含远程/外包等）\n- **流程目的：**（效率、风险、合规、体验等）\n\n### 2. 角色与职责\n- **IT/运维部门：** …\n- **现场或属地协调人（Site Lead）：** …\n- **最终用户：** …\n- **HR/行政/安全等其他相关方：** …（如涉及）\n\n### 3. 详细执行步骤\n#### 3.1 入职 / 开通（Onboarding）\n- 步骤：需求触发与信息核对（工单/邮件/协作平台）→ 资源准备 → 交付路径（现场领取/邮寄/远程配置等分支）\n\n#### 3.2 变更 / 日常支持（如适用）\n- …\n\n#### 3.3 离职 / 回收（Offboarding）\n- 步骤：锁定与通知 → 回收与验收 → 记录闭合\n\n### 4. 风险控制与异常处理\n- **风险 1：** … → **应对：** …\n- **风险 2：** … → **应对：** …\n\n### 5. 记录与审计\n- 需保留的单据、签核、日志（满足公司与法规要求）\n\n---\n\n## 3. 可视化\n在最后附一段 Mermaid（flowchart / sequenceDiagram / 泳道图之一），概括主要角色与关键交互。\n\n---\n**用户业务场景描述：**\n',
    groupId: null,
  },
];

const graphicTemplates = splitGraphicFile(graphicRaw);
const designWorkflow = splitDesignerFile(designRaw);

if (graphicTemplates.length !== 20) {
  console.warn('[split-zh-builtin] 图形模版条数=', graphicTemplates.length, '（预期 20）');
}

const zh = { intlTranslate, intlSop, graphicTemplates, designWorkflow };
fs.writeFileSync(path.join(root, 'src', '_tw_zh_builtin.json'), JSON.stringify(zh, null, 2), 'utf8');
console.log(
  'OK _tw_zh_builtin.json → intlTranslate:',
  intlTranslate.length,
  'intlSop:',
  intlSop.length,
  'graphic:',
  graphicTemplates.length,
  'design:',
  designWorkflow.length,
);
