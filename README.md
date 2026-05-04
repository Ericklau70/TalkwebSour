# TalkwebSour Chrome Extension V3.5

> 半透明科技感侧边栏 + 全局 AI 改写层（Command Palette）  
> Semi-transparent sidebar + global AI rewrite layer

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

## 故障排查（AI 面板无反应等）

### 1. 重新加载扩展（首选）

1. `chrome://extensions/` → 找到 **TalkwebSour** → **重新加载**  
2. **刷新**测试页面  
3. 再点工具栏图标与「⚡」

### 2. 检查模块是否加载

在页面控制台（F12 → Console）执行：

```js
window.TwAiRewrite
```

应返回包含 `openSearchPalette` 等方法的对象；若为 `undefined`，回到步骤 1。

### 3. 手动打开面板

```js
TwAiRewrite.openSearchPalette()
```

若仍无浮层，查看控制台红色报错信息。

### 4. 检查 Shadow DOM

```js
const host = document.querySelector('#talkweb-sour-host');
console.log(host?.shadowRoot?.querySelector('#twar-overlay'));
```

### 5. 快捷键被网站占用（如 GitHub 占用 ⌘K）

改用鼠标点击「⚡」按钮。

---

## 开发提示

- 修改 `src/content.js` 中的分类、默认语句等请参考源码内常量。  
- 样式主题变量在 `src/sidebar.css` 的 `:root`。  
- 插件注入 `<all_urls>`；若需限制站点，请改 `manifest.json` 的 `host_permissions`。  
- 数据存于浏览器本地；卸载扩展会丢失数据，请定期导出备份。

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
