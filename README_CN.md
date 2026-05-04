# TalkwebSour Chrome Extension V3.5

> 半透明科技感侧边栏 + 全局 AI 改写层（Command Palette）  
> Semi-transparent sidebar + global AI rewrite layer
>
## 🌍 语言

- 🇬🇧 [English](./README_EN.md)
- 🇨🇳 中文（当前）
- 🇰🇷 [한국어](./README_KR.md)

---

## V3.5 要点

- 版本与界面标识统一为 **V3.5**（清单 `3.5.0`）。
- 一键安装脚本位于**项目根目录**：`SourMac.command`（Mac）、`SourWins.bat`（Windows）。
- 快速模式下**选中 script 即计入使用次数**（用于排序「常用脚本」），不再依赖必须先点「复制」。
- Mermaid 独立编辑器中，**AI 修复**会将左侧源码与 Mermaid 解析/渲染错误一并发送给模型。
- 文档收敛：本 README 为唯一主文档；历史零散说明类 `.md` 已移除。

---

## 功能概览

### 全局 AI 指令面板（Command Palette）

- **触发**：侧边栏搜索框旁的「⚡」按钮，或快捷键 **⌘K**（Mac） / **Alt+Shift+A**（Windows）。
- **双模式**：
  - **未配置 API Key**：仅提示语（script）搜索与插入。
  - **已配置 API Key**：对选中文字执行润色、精简、翻译等 AI 指令。

### 三层架构

- **Trigger** — 快捷键、选区跟踪、焦点记忆  
- **Command** — Slash 指令、Prompt、多 Provider  
- **Render** — Palette / Preview / Diff

### 文本注入兼容性

- `<textarea>` / `<input>`（含 React/Vue 受控组件）
- `contenteditable`
- ChatGPT / Claude 等 ProseMirror 编辑器

### 支持的 AI 服务（在扩展设置中配置）

- OpenAI（GPT-4o / 4o-mini 等）
- Google Gemini
- 阿里千问（OpenAI 兼容地址）
- DeepSeek
- Ollama（本地）

---

## 项目结构（节选）

```
TalkWebSour_V3.5/
├── manifest.json              # 扩展配置（version 3.5.0）
├── SourMac.command            # Mac 一键环境（项目根目录）
├── SourWins.bat               # Windows 一键环境（项目根目录）
├── popup.html / popup.js
├── src/
│   ├── content.js             # 侧边栏主逻辑
│   ├── background.js        # 后台服务
│   ├── ai_rewrite/          # AI 改写层
│   ├── components/          # 含 Mermaid 编辑器等
│   └── utils/               # bundle 构建产物等
├── icons/
└── scripts/                   # 构建与工具脚本（verify、build-agency 等）
```

---

## 一键环境安装（Mac / Windows）

无需事先安装 Node / Python：双击根目录脚本，将自动检测并安装缺失的 **Homebrew（仅 Mac）/ Node / npm / Python**，并在项目根目录执行 **`npm install`**。

| 平台 | 脚本 |
|------|------|
| **Mac** | `./SourMac.command` |
| **Windows** | `SourWins.bat` |

### 权限与常见问题

**Mac**

- 首次可能被拦截：**右键 → 打开**；或 **系统设置 → 隐私与安全性 → 仍要打开**。
- 若无法执行：`chmod +x SourMac.command`
- 可选配置：复制 `scripts/install.prefs.example` 为项目根目录 **`install.prefs`**（若不存在则仍会尝试读取 `scripts/install.prefs`）。设置 `BUILD_AGENCY_AFTER_INSTALL=1` 可在安装后重建 Agency 索引。

**Windows**

- `winget` 失败时请以**管理员身份**运行 CMD，或先安装 [应用安装程序](https://aka.ms/getwinget)。
- 安装 Node 后若仍找不到 `node`：关闭窗口后重新双击脚本，或重启电脑。

**可选构建命令**（生成扩展用前端 bundle）：

```bash
npm run build:quick-chat-history
npm run build:mermaid-editor
npm run build:mermaid
npm run build:parse-ai
```

---

## 在 Chrome 中加载扩展（开发者模式）

1. 打开 `chrome://extensions/`
2. 开启右上角 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择本仓库根目录文件夹
5. 修改代码后：在扩展页点击 **重新加载**，并刷新测试网页（⌘R / F5）

---

## 使用说明（精简）

### 侧边栏

- 点击工具栏图标 → 显示/隐藏侧边栏  
- 拖动标题栏移动位置；拖动右缘调整宽度  
- 点击语句卡片复制到剪贴板；**Alt+/** 聚焦搜索  

### AI 面板（有 Key）

1. 在页面选中一段文字  
2. 按 ⌘K 或点「⚡」  
3. 选择指令 → 预览 → 「采用」写回  

### 快速模式与 script 排序

- 在快速模式列表中**点击某个 script** 即计一次使用（用于「按使用频率」排序）。  
- 无 Key 时亦可搜索、展开编辑区、使用「Asking AI」等，均会计入使用次数。

---

## 🆚 示例（核心卖点展示）

以下示例展示：  
👉 直接使用 AI vs 使用 TalkWeb 的差异

---

## 示例一：SOP 生成（普通 AI vs TalkWeb）

### 🧾 用户输入（原始）

现在需要梳理一下一般自购采购流程……

---

### ❌ 直接使用 AI（如 Gemini）

- 输出为简单步骤描述  
- 没有明确角色划分  
- 没有结构化格式  
- 无法直接用于企业执行  

📸 示例截图：  
<img width="1009" height="651" alt="image" src="https://github.com/user-attachments/assets/ecd60333-a74c-46a9-b03c-16cb9c6049ef" />

<img width="1004" height="654" alt="image" src="https://github.com/user-attachments/assets/8e204346-ddaf-4a79-8795-1c2211804c4e" />
<img width="1003" height="638" alt="image" src="https://github.com/user-attachments/assets/8a3d7375-f2ba-483d-ad68-9d979973dfde" />

---

### ✅ 使用 TalkWeb（标准 SOP Prompt）

- 自动识别业务职能（采购 / 财务等）  
- 自动补全角色（需求方 / 采购 / 财务 / 审批人）  
- 输出完整 SOP 文档结构  
- 包含流程步骤 + 风险控制 + 审计记录  
- 可直接用于企业内部执行  

📸 示例截图：  
<img width="1014" height="660" alt="image" src="https://github.com/user-attachments/assets/ef47b4b2-b13c-4176-b4f8-4645fb2b524d" />
<img width="1044" height="799" alt="image" src="https://github.com/user-attachments/assets/5f012aee-8a59-4cae-90d8-f6dfdac49189" />
<img width="1004" height="647" alt="image" src="https://github.com/user-attachments/assets/998a1932-2a00-45d5-bb66-2772add5202e" />
<img width="1019" height="650" alt="image" src="https://github.com/user-attachments/assets/3afb4b2e-6254-4baf-b1af-bb10c2a48b80" />



## 示例二：Mermaid 流程图生成

### 🧾 用户输入

帮我画一个采购流程图

---

### ❌ 直接使用 AI（如 ChatGPT）

- 可能生成不完整或逻辑混乱的图  
- 缺少业务角色  
- 不符合实际流程  

📸 示例截图：  
<img width="994" height="730" alt="image" src="https://github.com/user-attachments/assets/6e998bd8-be72-4954-a3c4-c1ff5c73f93a" />

---

### ✅ 使用 TalkWeb（结构化 + Agent）

- 自动识别流程阶段  
- 自动补全业务逻辑  
- 明确角色流转  
- 输出标准 Mermaid 图  

📸 示例截图：  
<img width="905" height="759" alt="image" src="https://github.com/user-attachments/assets/8a889b0d-7bba-485a-90b2-0291b625eff0" />
<img width="1466" height="833" alt="image" src="https://github.com/user-attachments/assets/90956c08-4cc7-41b5-aa54-68ea5bec73c6" />

---

## 示例三：AI 人设（角色化能力）

### 🧾 用户需求

用一个“搞笑的 Iron Man 风格 IT 工程师”帮我解决电脑问题

### ✅ TalkWeb 人设系统

- 可定义固定角色（Iron Man 风格 IT）  
- 保持语气一致（幽默 / 嘲讽 / 技术感）  
- 同时提供专业解决方案  
- 兼顾“可用性 + 娱乐性”  

📸 示例截图：  
<img width="1031" height="767" alt="image" src="https://github.com/user-attachments/assets/815c21bc-4d96-439f-8ecc-df71f83ce1b3" />
<img width="1030" height="773" alt="image" src="https://github.com/user-attachments/assets/9e77b6e7-b097-458b-95ac-4541189d43a8" />


---

## 🔥 核心差异总结

| 能力 | 普通 AI | TalkWeb |
|------|--------|--------|
| SOP 结构化 | ❌ | ✅ |
| 自动角色识别 | ❌ | ✅ |
| 可执行性 | ❌ | ✅ |
| 流程图质量 | 不稳定 | 高质量 |
| 人设稳定性 | ❌ | ✅ |
| Prompt 管理 | ❌ | ✅ |

---

👉 本质区别：

普通 AI = 回答问题  
TalkWeb = 构建系统

---

## CHANGELOG（V3.5）

- 版本号与 UI 标识更新至 V3.5 / 3.5.0。  
- 根目录一键脚本：`SourMac.command`、`SourWins.bat`；`install.prefs` 优先读根目录。  
- 快速模式 script 使用次数：选中即计数；避免与「复制」重复计数。  
- Mermaid 编辑器：AI 修复携带渲染错误信息；样式套用与插入片段选项扩展。  
- 文档合并为单一 README，移除零散修复类 Markdown。

---

## License / Author

作者：ErickLiu（见 `manifest.json`）。使用与分发请遵守当地法规与各 AI 服务条款。
