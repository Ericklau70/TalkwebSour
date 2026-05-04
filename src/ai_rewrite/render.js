// ─────────────────────────────────────────────────────────────
//  TalkwebSour · AI Rewrite · Layer 3: Render
//  职责：所有 UI 渲染，共三个子面板：
//    1. Command Palette  — 选择 slash command
//    2. Preview Panel   — 流式输出 + 采用/丢弃
//    3. Diff View       — 原文 vs 新文对比
//  对外接口：TwRenderLayer.init(root, callbacks)
//  对内依赖：无（纯 UI，通过 callbacks 通知上层）
// ─────────────────────────────────────────────────────────────

const TwRenderLayer = (() => {
  'use strict';

  // ── 运行时引用 ────────────────────────────────────────────────
  let _root = null;   // Shadow DOM root 或 document
  let _lang = 'zh';
  const DEFAULT_MERMAID_SEED = `flowchart TD
    A["需求输入"] --> B["方案评审"]
    B --> C{"是否通过"}
    C -->|"是"| D["开发执行"]
    C -->|"否"| E["补充信息"]
    E --> B
    D --> F["交付验收"]`;

  /** 每次 init 前中止，避免 shadow 重建或重复 init 导致重复监听 */
  let _paletteAc = null;
  let _previewAc = null;
  let _diffAc = null;

  // 外部回调
  let _cb = {
    onCommand: null,  // (commandId: string) → void
    onSelect:  null,  // (snippetId: string, title: string) → void  离线模式选中后回调
    onAccept:  null,  // (newText: string) → void
    onReject:  null,  // () → void
    onDiff:    null,  // (newText: string) → void
    onEditorAskAI: null,      // () → Promise<void>  快速模式编辑区「Asking AI」
    onEditorChatReset: null,  // () → void  关闭编辑区时清空多轮上下文
    onPaletteAgencyChat: null, // () → void  快速条：进入与 script 相同的 AI 对话编辑区
    onHistoryRestore: null, // (sessionId: string) → void | Promise<void>
  };

  const $  = (sel) => _root.querySelector(sel);

  // ── 样式 ──────────────────────────────────────────────────────
  const CSS = /* css */`
    /* ═══════════════════════════════════════
       1. COMMAND PALETTE  ·  Raycast style
    ═══════════════════════════════════════ */

    /* 蒙层：几乎透明，只有微弱遮罩（z-index 必须高于侧边栏）*/
    #twar-overlay {
      position: fixed !important; 
      inset: 0 !important; 
      z-index: 2147483648 !important;
      display: flex !important; 
      align-items: flex-start !important; 
      justify-content: center !important;
      padding-top: 15vh !important;
      background: rgba(0,0,0,0.15) !important;
      backdrop-filter: blur(2px) !important;
      -webkit-backdrop-filter: blur(2px) !important;
      opacity: 0 !important; 
      pointer-events: none !important;
      transition: opacity 0.12s ease !important;
      visibility: hidden !important;
    }
    #twar-overlay.open {
      opacity: 1 !important; 
      pointer-events: auto !important;
      visibility: visible !important;
    }
    /* 快捷网页下拉：不占 flex 槽位，避免调色板水平偏移 */
    #twar-shortcuts-layer {
      position: absolute !important;
      inset: 0 !important;
      pointer-events: none !important;
      z-index: 2147483649 !important;
    }

    /* AI 浮层根：禁止出现横向滚动条（由子区域各自纵向滚动） */
    #twar-wrapper {
      overflow-x: hidden;
      max-width: 100vw;
    }

    /* Palette：极简小搜索条 */
    #twar-palette-box {
      width: 520px; max-width: 90vw;
      max-height: min(560px, 88vh);
      background: rgba(18,20,28,0.96);
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 12px;
      box-shadow: 
        0 8px 32px rgba(0,0,0,0.5),
        0 0 0 1px rgba(255,255,255,0.08);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      overflow-x: hidden;
      overflow-y: hidden;
      display: flex;
      flex-direction: column;
      min-width: 0;
      transform: translateY(-8px);
      transition: all 0.2s cubic-bezier(0.2,0.8,0.3,1);
    }
    #twar-overlay.open #twar-palette-box {
      transform: translateY(0);
    }
    /* 展开状态：显示内容编辑区时加高 */
    #twar-palette-box.expanded {
      width: 620px;
      max-height: min(620px, 90vh);
    }

    /* 选中文本预览条（只在 AI 模式显示）*/
    #twar-ctx-strip {
      display: none;
      flex-shrink: 0;
      padding: 6px 14px;
      font-size: 10px; color: rgba(255,255,255,0.3);
      background: rgba(255,255,255,0.02);
      border-bottom: 1px solid rgba(255,255,255,0.06);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    #twar-ctx-strip.has-text { display: block; }
    #twar-ctx-label {
      color: rgba(255,255,255,0.2); margin-right: 5px;
      text-transform: uppercase; font-size: 8px; letter-spacing: 1px;
    }

    /* Agency · 风格与 Agent（在线快速模式） */
    #twar-agency-strip {
      display: none;
      flex-shrink: 0;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 6px 10px;
      padding: 7px 12px 9px;
      font-size: 11px;
      color: rgba(255,255,255,0.82);
      background: rgba(110,159,255,0.07);
      border-bottom: 1px solid rgba(255,255,255,0.06);
      line-height: 1.35;
    }
    #twar-agency-strip.show { display: flex; }
    #twar-agency-strip.off .twar-ag-sum { opacity: 0.55; }
    .twar-agency-enable {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      flex-shrink: 0;
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
    }
    .twar-agency-enable input { margin: 0; accent-color: #6e9fff; }
    .twar-ag-sum {
      flex: 1 1 160px;
      min-width: 0;
      word-break: break-word;
      font-size: 10px;
      color: rgba(255,255,255,0.78);
    }
    .twar-agency-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      flex-shrink: 0;
      margin-left: auto;
    }
    .twar-ag-mini {
      font-size: 10px;
      padding: 3px 8px;
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.14);
      background: rgba(255,255,255,0.06);
      color: rgba(255,255,255,0.85);
      cursor: pointer;
      line-height: 1.2;
    }
    .twar-ag-mini:disabled {
      opacity: 0.35;
      cursor: default;
    }
    .twar-ag-mini:not(:disabled):hover {
      background: rgba(255,255,255,0.12);
    }
    .twar-ag-mini.twar-ag-chat {
      min-width: 52px;
      padding: 3px 6px;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    .twar-agency-status {
      flex: 1 1 100%;
      width: 100%;
      margin-top: 2px;
      padding-top: 6px;
      border-top: 1px solid rgba(255,255,255,0.06);
      font-size: 9px;
      line-height: 1.35;
      color: rgba(255,255,255,0.48);
      word-break: break-word;
    }

    /* 搜索栏：极简单行 */
    #twar-search-wrap {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 14px;
      flex-shrink: 0;
      min-width: 0;
    }
    #twar-search-icon {
      font-size: 16px; flex-shrink: 0;
      opacity: 0.4; transition: opacity 0.2s;
    }
    #twar-overlay.open #twar-search-icon { opacity: 0.6; }

    #twar-palette-input {
      flex: 1 1 auto; min-width: 0; width: 0;
      background: transparent; border: none;
      color: rgba(255,255,255,0.95); font-size: 15px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-weight: 400;
      outline: none; caret-color: #6e9fff;
    }
    #twar-palette-input::placeholder { color: rgba(255,255,255,0.25); }

    #twar-input-right {
      display: flex; align-items: center; gap: 6px; flex-shrink: 0;
    }
    #twar-count-badge {
      font-size: 9px; color: rgba(255,255,255,0.25);
      background: rgba(255,255,255,0.06);
      border-radius: 8px; padding: 2px 7px;
    }
    /* Copy 按钮（离线模式选中后显示）*/
    #twar-copy-btn {
      display: none;
      padding: 5px 12px; font-size: 11px; font-weight: 600;
      background: linear-gradient(135deg, #00d4ff, #7b4fff);
      color: #000; border: none; border-radius: 6px;
      cursor: pointer; transition: opacity 0.15s;
    }
    #twar-copy-btn:hover { opacity: 0.85; }
    #twar-copy-btn.show { display: block; }

    /* 快速模式「S」常用网页 · 对话历史（🕘） */
    .twar-shortcuts-wrap { position: relative; flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; }
    #twar-history-layer {
      position: absolute !important;
      inset: 0 !important;
      pointer-events: none !important;
      z-index: 2147483649 !important;
    }
    #twar-history-btn,
    #twar-mermaid-btn {
      width: 28px; height: 28px; padding: 0;
      font-size: 14px; line-height: 1;
      color: rgba(255,255,255,0.85);
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    #twar-history-btn:hover,
    #twar-mermaid-btn:hover {
      background: rgba(168,85,247,0.14);
      border-color: rgba(168,85,247,0.38);
    }
    #twar-history-dd {
      display: none;
      position: fixed;
      left: 0;
      top: 0;
      min-width: 260px;
      max-width: min(92vw, 380px);
      max-height: min(320px, 52vh);
      overflow-x: hidden;
      overflow-y: auto;
      padding: 10px 10px 8px;
      background: rgba(12, 18, 36, 0.82);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 10px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.45);
      box-sizing: border-box;
      pointer-events: auto;
    }
    #twar-history-dd.open { display: block; }
    .twar-hist-row {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 8px 6px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      cursor: pointer;
      font-size: 11px;
      color: rgba(255,255,255,0.88);
      line-height: 1.35;
    }
    .twar-hist-row:last-child { border-bottom: none; }
    .twar-hist-row:hover { background: rgba(255,255,255,0.05); border-radius: 6px; }
    .twar-hist-meta { flex: 1; min-width: 0; word-break: break-word; }
    .twar-hist-time { font-size: 10px; color: rgba(255,255,255,0.42); margin-bottom: 3px; }
    .twar-hist-del {
      flex-shrink: 0;
      width: 22px; height: 22px;
      padding: 0;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: rgba(255,255,255,0.35);
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
    }
    .twar-hist-del:hover { color: rgba(248,113,113,0.95); background: rgba(248,113,113,0.08); }
    .twar-chat-turn { margin-bottom: 12px; }
    .twar-chat-turn-meta { font-size: 10px; color: rgba(255,255,255,0.38); margin-bottom: 4px; }
    .twar-chat-bubble.twar-chat-user {
      padding: 8px 10px;
      border-radius: 8px;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.08);
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .twar-chat-bubble.twar-chat-assistant {
      padding: 4px 0 0;
      font-size: 12px;
    }

    #twar-shortcuts-btn {
      width: 28px; height: 28px; padding: 0;
      font-size: 13px; font-weight: 700;
      color: rgba(255,255,255,0.85);
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    #twar-shortcuts-btn:hover {
      background: rgba(0,212,255,0.12);
      border-color: rgba(0,212,255,0.35);
    }
    #twar-shortcuts-dd {
      display: none;
      position: fixed;
      left: 0;
      top: 0;
      min-width: 260px;
      max-width: min(92vw, 360px);
      padding: 10px 10px 8px;
      background: rgba(12, 18, 36, 0.82);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 10px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.45);
      box-sizing: border-box;
      pointer-events: auto;
    }
    #twar-shortcuts-dd.open { display: block; }
    .twar-sc-title {
      font-size: 10px;
      color: rgba(255,255,255,0.45);
      letter-spacing: 0.4px;
      margin-bottom: 8px;
    }
    .twar-sc-row-edit {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px 2px 10px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      font-size: 12px;
    }
    .twar-sc-row-edit:last-child { border-bottom: none; padding-bottom: 4px; }
    .twar-sc-inp {
      width: 100%;
      box-sizing: border-box;
      padding: 7px 9px;
      font-size: 11px;
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.05);
      color: rgba(255,255,255,0.9);
      outline: none;
    }
    .twar-sc-inp::placeholder { color: rgba(255,255,255,0.28); }
    .twar-sc-row-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 2px;
    }
    .twar-sc-open {
      padding: 5px 10px;
      font-size: 11px;
      font-weight: 600;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      background: linear-gradient(135deg, #00d4ff, #7b4fff);
      color: #000;
    }
    .twar-sc-open:hover { opacity: 0.9; }
    .twar-sc-save {
      padding: 5px 10px;
      font-size: 11px;
      font-weight: 600;
      border: 1px solid rgba(255,255,255,0.22);
      border-radius: 6px;
      cursor: pointer;
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.92);
    }
    .twar-sc-save:hover { background: rgba(255,255,255,0.14); }
    .twar-sc-del {
      flex: 0 0 auto;
      border: none;
      background: transparent;
      color: rgba(255,255,255,0.35);
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      padding: 2px 6px;
    }
    .twar-sc-del:hover { color: #ff6b6b; }
    .twar-sc-del:disabled { opacity: 0.3; cursor: default; pointer-events: none; }

    /* 内容编辑区（选中提示语后展开）*/
    #twar-content-editor {
      display: none;
      border-top: 1px solid rgba(255,255,255,0.08);
      padding: 12px 14px;
      flex-direction: column;
      gap: 8px;
      flex: 1 1 auto;
      min-height: 0;
      min-width: 0;
      overflow-x: hidden;
      overflow-y: auto;
    }
    #twar-content-editor.show { display: flex; }

    #twar-editor-title {
      font-size: 11px; color: rgba(0,212,255,0.8);
      font-weight: 600; letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    #twar-editor-textarea {
      width: 100%; min-width: 0; box-sizing: border-box;
      min-height: 120px; max-height: 240px;
      padding: 10px 12px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 8px;
      color: rgba(255,255,255,0.92);
      font-size: 13px; line-height: 1.6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      outline: none; resize: vertical;
      overflow-x: hidden;
      overflow-wrap: anywhere; word-break: break-word;
      transition: border-color 0.15s;
    }
    #twar-editor-textarea:focus {
      border-color: rgba(0,212,255,0.4);
      background: rgba(255,255,255,0.04);
    }
    #twar-editor-actions {
      display: flex; flex-wrap: wrap; gap: 8px;
      min-width: 0;
    }
    .twar-editor-btn {
      flex: 1 1 120px;
      min-width: 0;
      padding: 8px;
      font-size: 12px; font-weight: 600;
      border: none; border-radius: 7px;
      cursor: pointer; transition: all 0.15s;
      font-family: inherit;
    }
    #twar-editor-copy {
      background: linear-gradient(135deg, #00d4ff, #7b4fff);
      color: #000;
    }
    #twar-editor-copy:hover { opacity: 0.88; }
    #twar-editor-ask-ai {
      background: linear-gradient(135deg, #7b4fff, #c084fc);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.2) !important;
    }
    #twar-editor-ask-ai:hover:not(:disabled) { opacity: 0.92; filter: brightness(1.05); }
    #twar-editor-ask-ai:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    #twar-editor-ai-wrap {
      display: none;
      flex-direction: column;
      gap: 6px;
      margin-top: 2px;
    }
    #twar-editor-ai-wrap.show { display: flex; }
    #twar-editor-ai-title {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.4px;
      color: rgba(192, 132, 252, 0.85);
      text-transform: uppercase;
    }
    #twar-editor-ai-reply {
      min-height: 72px;
      max-height: 200px;
      overflow-x: auto;
      overflow-y: auto;
      padding: 10px 12px;
      background: rgba(123, 79, 255, 0.08);
      border: 1px solid rgba(192, 132, 252, 0.25);
      border-radius: 8px;
      color: rgba(255,255,255,0.9);
      font-size: 12px;
      line-height: 1.55;
      white-space: pre-wrap;
      word-break: break-word;
    }
    #twar-editor-ai-reply.streaming { border-color: rgba(0, 212, 255, 0.35); }
    #twar-editor-ai-reply .twar-ai-md { white-space: normal; }
    #twar-editor-back {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.15) !important;
      color: rgba(255,255,255,0.5);
      flex: 1 1 100px;
    }
    #twar-editor-back:hover { background: rgba(255,255,255,0.08); }

    /* 命令列表：紧凑显示 */
    #twar-cmd-list {
      max-height: min(260px, 38vh);
      flex: 0 1 auto;
      min-width: 0;
      overflow-x: hidden;
      overflow-y: auto;
      padding: 6px 8px;
      scrollbar-width: thin; 
      scrollbar-color: rgba(110,159,255,0.2) transparent;
    }
    #twar-cmd-list::-webkit-scrollbar { width: 3px; }
    #twar-cmd-list::-webkit-scrollbar-thumb { 
      background: rgba(110,159,255,0.2); border-radius: 2px; 
    }
    .twar-group {
      margin-bottom: 4px;
    }
    .twar-group-hdr {
      display: flex; align-items: center; gap: 6px;
      padding: 5px 8px;
      border-radius: 6px;
      cursor: pointer;
      color: rgba(180, 202, 236, 0.72);
      font-size: 10px;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.06);
      user-select: none;
    }
    .twar-group-hdr:hover {
      background: rgba(255,255,255,0.06);
      border-color: rgba(110,159,255,0.25);
    }
    .twar-group-arrow {
      font-size: 9px;
      color: rgba(110,159,255,0.72);
      transition: transform 0.15s ease;
      width: 10px;
      flex-shrink: 0;
    }
    .twar-group-hdr.open .twar-group-arrow {
      transform: rotate(90deg);
    }
    .twar-group-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .twar-group-count {
      font-size: 9px;
      color: rgba(140, 166, 208, 0.8);
      background: rgba(110,159,255,0.12);
      border: 1px solid rgba(110,159,255,0.22);
      border-radius: 10px;
      padding: 0 6px;
      line-height: 16px;
    }
    .twar-group-body.collapsed { display: none; }

    .twar-cmd-item {
      display: flex; align-items: center; gap: 8px;
      padding: 7px 10px;
      margin-left: 14px;
      border-radius: 7px; cursor: pointer;
      transition: background 0.08s;
      user-select: none;
      min-width: 0;
    }
    .twar-cmd-item.active {
      background: rgba(110,159,255,0.15);
    }
    .twar-cmd-item:not(.active):hover {
      background: rgba(255,255,255,0.04);
    }

    /* 去掉图标容器，改为单个emoji */
    .twar-cmd-icon {
      font-size: 14px; flex-shrink: 0; opacity: 0.8;
    }

    /* 标签：单行紧凑 */
    .twar-cmd-label {
      flex: 1;
      min-width: 0;
      font-size: 13px; 
      color: rgba(255,255,255,0.9);
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* 匹配高亮 */
    .twar-match { color: #6e9fff; font-weight: 600; }

    /* active 时右侧显示"↵" */
    .twar-cmd-enter {
      font-size: 14px; 
      color: rgba(110,159,255,0.5);
      opacity: 0;
      transition: opacity 0.1s;
    }
    .twar-cmd-item.active .twar-cmd-enter { opacity: 1; }

    .twar-cmd-score {
      flex-shrink: 0;
      font-size: 10px;
      font-weight: 700;
      color: rgba(140, 166, 208, 0.75);
      min-width: 1.2em;
      text-align: right;
      margin-right: 2px;
    }

    /* 空结果 */
    #twar-cmd-empty {
      padding: 24px 0; text-align: center;
      font-size: 12px; color: rgba(255,255,255,0.25);
    }
    #twar-cmd-empty span { display: block; font-size: 20px; margin-bottom: 6px; opacity: 0.5; }

    /* 智能推荐提示（浅灰） */
    #twar-smart-hint {
      display: none;
      flex-shrink: 0;
      margin: 2px 10px 8px;
      padding: 8px 10px;
      border-radius: 8px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      color: rgba(210,218,232,0.72);
      font-size: 11px;
      line-height: 1.5;
      overflow-x: hidden;
      overflow-wrap: anywhere; word-break: break-word;
    }
    #twar-smart-hint.show { display: block; }
    #twar-smart-hint .hint-title {
      color: rgba(220,228,240,0.78);
      font-weight: 600;
      margin-right: 4px;
    }
    #twar-smart-hint .twar-hint-hit {
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px solid rgba(255,255,255,0.07);
      color: rgba(175,190,215,0.82);
      font-size: 10px;
      line-height: 1.45;
    }
    #twar-smart-hint .twar-hint-hit strong {
      color: rgba(0,212,255,0.65);
      font-weight: 600;
      margin-right: 2px;
    }

    /* 底部栏：极简提示 */
    #twar-palette-footer {
      padding: 6px 14px;
      display: flex; align-items: center; justify-content: space-between;
      gap: 8px;
      border-top: 1px solid rgba(255,255,255,0.06);
      font-size: 9px; color: rgba(255,255,255,0.2);
      flex-shrink: 0;
      min-width: 0;
    }
    #twar-footer-hint {
      letter-spacing: 0.5px;
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere; word-break: break-word;
    }
    #twar-footer-count {
      color: rgba(110,159,255,0.5);
      flex-shrink: 0;
      white-space: nowrap;
    }

    /* ═══════════════════════════════════════
       2. PREVIEW PANEL
    ═══════════════════════════════════════ */
    #twar-preview {
      position: fixed; bottom: 28px; right: 28px;
      width: 440px; max-width: 92vw;
      max-height: 72vh;
      background: rgba(8,12,24,0.97);
      border: 1px solid rgba(0,212,255,0.3);
      border-radius: 14px;
      box-shadow:
        0 0 40px rgba(0,212,255,0.1),
        0 20px 48px rgba(0,0,0,0.55);
      display: none; flex-direction: column; z-index: 2147483649;
      overflow: hidden;
      animation: twar-slide-up 0.22s cubic-bezier(0.34,1.56,0.64,1) both;
    }
    #twar-preview.open { display: flex; }

    #twar-preview-hdr {
      padding: 10px 14px;
      display: flex; align-items: center; justify-content: space-between;
      border-bottom: 1px solid rgba(0,212,255,0.12);
      background: linear-gradient(180deg, rgba(0,212,255,0.06) 0%, transparent 100%);
      flex-shrink: 0;
    }
    #twar-preview-title  { font-size: 12px; font-weight: 700; color: #00d4ff; }
    #twar-preview-status { font-size: 10px; color: #6a8aaa; }

    #twar-preview-body {
      flex: 1;
      overflow-x: auto;
      overflow-y: auto;
      padding: 14px 16px;
      font-size: 13px; line-height: 1.75; color: #e8f4ff;
      white-space: pre-wrap; word-break: break-word;
      min-height: 0;
      min-width: 0;
      scrollbar-width: thin; scrollbar-color: rgba(0,212,255,0.15) transparent;
    }
    #twar-preview-body::-webkit-scrollbar { width: 3px; }
    #twar-preview-body::-webkit-scrollbar-thumb {
      background: rgba(0,212,255,0.2); border-radius: 2px;
    }
    #twar-preview-body .twar-ai-md { white-space: normal; }
    .twar-mermaid-wrap {
      margin: 10px 0;
      padding: 8px;
      border-radius: 10px;
      background: rgba(0,0,0,0.25);
      border: 1px solid rgba(0,212,255,0.15);
      overflow-x: auto;
      overflow-y: auto;
      max-width: 100%;
    }
    /* 宽图（树状图等）不在侧栏内强行缩到 100% 宽，避免又扁又糊；横向滚动由外层承担 */
    .twar-mermaid-inner { width: max-content !important; max-width: none !important; }
    .twar-mermaid-inner svg {
      display: block; max-width: none !important; width: auto !important; height: auto;
      text-rendering: geometricPrecision;
      shape-rendering: geometricPrecision;
    }
    .twar-mermaid-loading {
      font-size: 12px; color: rgba(0,212,255,0.55); padding: 6px 0;
    }
    .twar-mermaid-fallback {
      margin: 0; font-size: 11px; line-height: 1.45;
      color: #ffb4b4; white-space: pre-wrap; word-break: break-word;
    }
    /* 工具栏淡出时不再拦截点击，避免「查看」模式下点图表区域无法触发全屏打开 */
    .tw-mermaid-block-root .tw-mb-toolbar {
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.18s ease;
    }
    .tw-mermaid-block-root:hover .tw-mb-toolbar {
      opacity: 1;
      pointer-events: auto;
    }
    .tw-mb-light-canvas {
      background: #ffffff;
      color: #0f172a;
      border-radius: 8px;
      padding: 12px;
      box-sizing: border-box;
    }
    .tw-mb-light-canvas svg {
      display: block;
      max-width: none !important;
      width: auto !important;
      height: auto;
      text-rendering: geometricPrecision;
      shape-rendering: geometricPrecision;
    }
    /* 嵌入快速模式：与 MermaidBlock 行内 maxWidth:none 一致，不在 CSS 层再次压窄 */
    .tw-mermaid-block-root:not(.tw-mb-layout-fullscreen) .tw-mb-light-canvas svg {
      max-width: none !important;
    }
    /* 全屏查看：保持 SVG 固有尺寸，靠 export-area 滚动浏览，避免整图被压窄变糊 */
    .tw-mermaid-block-root.tw-mb-layout-fullscreen .tw-mb-light-canvas svg {
      max-width: none !important;
      width: auto !important;
      text-rendering: geometricPrecision;
      shape-rendering: geometricPrecision;
    }
    /* 嵌入模式：点击图表区域打开全屏查看页 */
    .tw-mb-light-canvas.tw-mb-diagram-click-fs {
      cursor: pointer;
      outline: none;
    }
    .tw-mb-light-canvas.tw-mb-diagram-click-fs:hover {
      box-shadow: 0 0 0 2px rgba(0, 212, 255, 0.42);
    }
    .tw-mb-light-canvas.tw-mb-diagram-click-fs:focus-visible {
      box-shadow: 0 0 0 2px rgba(0, 212, 255, 0.65);
    }
    .tw-mermaid-block-root.tw-mb-layout-fullscreen .tw-mb-export-area {
      background: #0b1020;
    }
    .tw-mermaid-block-root.tw-mb-layout-fullscreen .tw-mb-toolbar {
      opacity: 1;
      pointer-events: auto;
    }

    .twar-cursor {
      display: inline-block; width: 2px; height: 14px; margin-left: 1px;
      background: #00d4ff; vertical-align: text-bottom;
      animation: twar-blink 0.7s step-end infinite;
    }

    #twar-preview-actions {
      padding: 10px 14px; display: flex; gap: 8px; flex-shrink: 0;
      border-top: 1px solid rgba(0,212,255,0.12);
    }
    .twar-btn {
      padding: 8px 14px; font-size: 12px; font-weight: 600;
      font-family: inherit; border-radius: 8px; cursor: pointer;
      transition: all 0.15s; border: none;
    }
    .twar-btn-accept {
      flex: 1;
      background: linear-gradient(135deg, #00d4ff, #7b4fff);
      color: #000; letter-spacing: 0.5px;
    }
    .twar-btn-accept:hover { opacity: 0.88; box-shadow: 0 0 16px rgba(0,212,255,0.35); }
    .twar-btn-diff {
      background: rgba(0,212,255,0.08);
      border: 1px solid rgba(0,212,255,0.25) !important;
      color: #00d4ff;
    }
    .twar-btn-diff:hover { background: rgba(0,212,255,0.15); }
    .twar-btn-reject {
      background: rgba(255,68,102,0.08);
      border: 1px solid rgba(255,68,102,0.25) !important;
      color: #ff4466;
    }
    .twar-btn-reject:hover { background: rgba(255,68,102,0.15); }

    /* ═══════════════════════════════════════
       3. DIFF VIEW
    ═══════════════════════════════════════ */
    #twar-diff {
      position: fixed; bottom: 28px; right: 28px;
      width: 680px; max-width: 96vw;
      max-height: 70vh;
      background: rgba(8,12,24,0.98);
      border: 1px solid rgba(0,212,255,0.3);
      border-radius: 14px;
      box-shadow: 0 20px 48px rgba(0,0,0,0.55);
      display: none; flex-direction: column; z-index: 2147483650;
      overflow: hidden;
      animation: twar-pop 0.18s cubic-bezier(0.34,1.56,0.64,1) both;
    }
    #twar-diff.open { display: flex; }

    #twar-diff-hdr {
      padding: 10px 14px; display: flex;
      align-items: center; justify-content: space-between;
      border-bottom: 1px solid rgba(0,212,255,0.12);
      font-size: 12px; font-weight: 700; color: #00d4ff; flex-shrink: 0;
    }
    #twar-diff-close-btn {
      background: none; border: none; color: #6a8aaa;
      cursor: pointer; font-size: 18px; line-height: 1; padding: 0;
      transition: color 0.15s;
    }
    #twar-diff-close-btn:hover { color: #ff4466; }

    #twar-diff-grid {
      display: grid; grid-template-columns: 1fr 1fr;
      flex: 1; overflow: hidden; min-height: 0;
    }
    .twar-diff-panel {
      padding: 14px 16px; overflow-y: auto;
      font-size: 12px; line-height: 1.75; font-family: 'JetBrains Mono', monospace;
      white-space: pre-wrap; word-break: break-word;
      scrollbar-width: thin; scrollbar-color: rgba(0,212,255,0.15) transparent;
    }
    .twar-diff-panel:first-child {
      border-right: 1px solid rgba(0,212,255,0.1);
    }
    .twar-diff-panel::-webkit-scrollbar { width: 3px; }
    .twar-diff-panel::-webkit-scrollbar-thumb {
      background: rgba(0,212,255,0.2); border-radius: 2px;
    }
    .twar-diff-label {
      font-size: 9px; letter-spacing: 2px; text-transform: uppercase;
      margin-bottom: 10px; font-family: inherit;
    }
    .twar-diff-old-label { color: rgba(255,68,102,0.6); }
    .twar-diff-new-label { color: rgba(0,255,170,0.6); }
    #twar-diff-old-text  { color: rgba(255,68,102,0.85); }
    #twar-diff-new-text  { color: rgba(0,255,170,0.9); }

    #twar-diff-ftr {
      padding: 10px 14px; display: flex; gap: 8px; flex-shrink: 0;
      border-top: 1px solid rgba(0,212,255,0.12);
    }

    /* ═══════════════════════════════════════
       ANIMATIONS
    ═══════════════════════════════════════ */
    @keyframes twar-pop {
      from { opacity: 0; transform: scale(0.93) translateY(10px); }
      to   { opacity: 1; transform: scale(1)    translateY(0); }
    }
    @keyframes twar-slide-up {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes twar-blink {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0; }
    }
  `;

  // ── DOM 注入 ──────────────────────────────────────────────────
  function _mount() {
    console.log('[TwRenderLayer] _mount 被调用，开始注入 UI');
    
    if (!_root) {
      console.error('[TwRenderLayer] _root 为 null，无法注入 UI！');
      return;
    }
    
    // 注入样式
    const style = document.createElement('style');
    style.id = 'twar-styles';
    style.textContent = CSS;
    _root.appendChild(style);
    console.log('[TwRenderLayer] 样式已注入');

    // 注入 HTML（三个面板）
    const wrapper = document.createElement('div');
    wrapper.id = 'twar-wrapper';
    wrapper.innerHTML = `
      <!-- 1. Command Palette 蒙层 -->
      <div id="twar-overlay">
        <div id="twar-palette-box">
          <!-- 选中文本预览条 -->
          <div id="twar-ctx-strip">
            <span id="twar-ctx-label">处理文本</span>
            <span id="twar-ctx-text"></span>
          </div>
          <div id="twar-agency-strip" aria-label="Agency">
            <label class="twar-agency-enable">
              <input type="checkbox" id="twar-agency-enhance-cb" name="twar-agency-enhance-cb" />
              <span id="twar-agency-enable-lbl">拼接</span>
            </label>
            <div class="twar-ag-sum" id="twar-agency-sum"></div>
            <div class="twar-agency-actions">
              <button type="button" class="twar-ag-mini" id="twar-ag-btn-voice"></button>
              <button type="button" class="twar-ag-mini twar-ag-chat" id="twar-ag-btn-chat"></button>
            </div>
            <div id="twar-agency-status" class="twar-agency-status" aria-live="polite"></div>
          </div>
          <!-- 搜索栏 -->
          <div id="twar-search-wrap">
            <span id="twar-search-icon">🔍</span>
            <input id="twar-palette-input" name="twar-palette-input" placeholder="搜索..." autocomplete="off" spellcheck="false" type="text">
            <div id="twar-input-right">
              <div class="twar-shortcuts-wrap" id="twar-shortcuts-wrap">
                <button type="button" id="twar-mermaid-btn" title="">🧭</button>
                <button type="button" id="twar-history-btn" title="">🕘</button>
                <button type="button" id="twar-shortcuts-btn" title="">S</button>
              </div>
              <span id="twar-count-badge"></span>
              <button id="twar-copy-btn">Copy</button>
            </div>
          </div>
          <!-- 命令列表 -->
          <div id="twar-cmd-list"></div>
          <!-- 智能推荐 -->
          <div id="twar-smart-hint"></div>
          <!-- 内容编辑区（选中后展开）-->
          <div id="twar-content-editor">
            <div id="twar-editor-title">📋 提示语内容</div>
            <textarea id="twar-editor-textarea" name="twar-editor-textarea" placeholder="提示语内容将显示在这里..." spellcheck="false"></textarea>
            <div id="twar-editor-ai-wrap">
              <div id="twar-editor-ai-title">AI</div>
              <div id="twar-editor-ai-reply"></div>
            </div>
            <div id="twar-editor-actions">
              <button class="twar-editor-btn" id="twar-editor-back">← 返回</button>
              <button type="button" class="twar-editor-btn" id="twar-editor-ask-ai">Asking AI</button>
              <button class="twar-editor-btn" id="twar-editor-copy">Copy</button>
            </div>
          </div>
          <!-- 底部提示 -->
          <div id="twar-palette-footer">
            <span id="twar-footer-hint">↑↓ 选择 · ↵ 确认 · Esc 关闭</span>
            <span id="twar-footer-count"></span>
          </div>
        </div>
        <!-- 脱离 flex 流 + 避免 palette overflow 裁切；层上 pointer-events:none，仅下拉可点 -->
        <div id="twar-shortcuts-layer">
          <div id="twar-shortcuts-dd">
            <div class="twar-sc-title" id="twar-shortcuts-dd-title"></div>
            <div id="twar-shortcuts-list"></div>
          </div>
        </div>
        <div id="twar-history-layer">
          <div id="twar-history-dd">
            <div class="twar-sc-title" id="twar-history-dd-title"></div>
            <div id="twar-history-list"></div>
          </div>
        </div>
      </div>

      <!-- 2. Preview Panel -->
      <div id="twar-preview">
        <div id="twar-preview-hdr">
          <span id="twar-preview-title">✨ AI 输出</span>
          <span id="twar-preview-status">生成中...</span>
        </div>
        <div id="twar-preview-body"></div>
        <div id="twar-preview-actions" style="display:none">
          <button class="twar-btn twar-btn-accept" id="twar-accept-btn">✓ 采用</button>
          <button class="twar-btn twar-btn-diff"   id="twar-diff-btn">⇄ 对比</button>
          <button class="twar-btn twar-btn-reject" id="twar-reject-btn">✕ 丢弃</button>
        </div>
      </div>

      <!-- 3. Diff View -->
      <div id="twar-diff">
        <div id="twar-diff-hdr">
          <span>⇄ 修改对比</span>
          <button id="twar-diff-close-btn">✕</button>
        </div>
        <div id="twar-diff-grid">
          <div class="twar-diff-panel">
            <div class="twar-diff-label twar-diff-old-label">原 文</div>
            <div id="twar-diff-old-text"></div>
          </div>
          <div class="twar-diff-panel">
            <div class="twar-diff-label twar-diff-new-label">新 文</div>
            <div id="twar-diff-new-text"></div>
          </div>
        </div>
        <div id="twar-diff-ftr">
          <button class="twar-btn twar-btn-accept" id="twar-diff-accept-btn">✓ 采用新文</button>
          <button class="twar-btn twar-btn-reject" id="twar-diff-reject-btn">✕ 保留原文</button>
        </div>
      </div>
    `;
    _root.appendChild(wrapper);
    
    console.log('[TwRenderLayer] HTML 已注入到 Shadow DOM');
    console.log('[TwRenderLayer] #twar-overlay:', !!_root.querySelector('#twar-overlay'));
    console.log('[TwRenderLayer] #twar-palette-input:', !!_root.querySelector('#twar-palette-input'));
    console.log('[TwRenderLayer] #twar-cmd-list:', !!_root.querySelector('#twar-cmd-list'));
  }

  // ─────────────────────────────────────────────────────────────
  //  1. COMMAND PALETTE  ·  Raycast / Spotlight 风格
  // ─────────────────────────────────────────────────────────────
  let _allCommands  = [];
  let _filteredCmds = [];
  let _activeIdx    = 0;
  let _selectedText = '';   // 外部传入的待处理文本（用于预览条）
  let _paletteOpts  = {};   // 可选配置：placeholder / emptyHint / labels（与界面语言一致）
  let _groupCollapsed = {};

  /** 快速面板文案（由 tw_ai_rewrite._paletteUiLabels 注入） */
  function _Lbl() {
    return _paletteOpts.labels || {};
  }

  /** 搜索条、预览、对比等固定控件文案（与 _lang 一致） */
  function _applyPaletteShellI18n() {
    const L = _Lbl();
    const mb = $('#twar-mermaid-btn');
    if (mb) {
      mb.textContent = '🧭';
      mb.title =
        L.mermaidBtnTip ||
        (_lang === 'zh'
          ? '快速进入 Mermaid 编辑器（新标签页）'
          : _lang === 'ko'
            ? 'Mermaid 편집기 바로 열기 (새 탭)'
            : 'Open Mermaid editor quickly (new tab)');
    }
    const hb = $('#twar-history-btn');
    if (hb) {
      hb.textContent = '🕘';
      hb.title =
        L.historyBtnTip ||
        (_lang === 'zh'
          ? '快速模式对话记录（点击恢复）'
          : _lang === 'ko'
            ? '빠른 모드 대화 기록 (복원)'
            : 'Quick-mode chat history (restore)');
    }
    const sb = $('#twar-shortcuts-btn');
    if (sb) {
      sb.textContent = 'S';
      sb.title =
        L.shortcutsBtnTip ||
        (_lang === 'zh'
          ? '常用网页：展开后可编辑名称与网址'
          : _lang === 'ko'
            ? '자주 쓰는 페이지：이름·주소 편집'
            : 'Favorite page: edit label and URL');
    }
    const ddT = $('#twar-shortcuts-dd-title');
    if (ddT) {
      ddT.textContent =
        L.shortcutsDdTitle || (_lang === 'zh' ? '快捷网页' : _lang === 'ko' ? '바로가기' : 'Shortcuts');
    }
    const ht = $('#twar-history-dd-title');
    if (ht) {
      ht.textContent =
        L.historyDdTitle ||
        (_lang === 'zh' ? '对话记录' : _lang === 'ko' ? '대화 기록' : 'Chat history');
    }
    const listCopy = $('#twar-copy-btn');
    if (listCopy) {
      listCopy.textContent = L.listCopyBtn || (_lang === 'zh' ? '复制' : _lang === 'ko' ? '복사' : 'Copy');
    }
    const acc = $('#twar-accept-btn');
    const dff = $('#twar-diff-btn');
    const rej = $('#twar-reject-btn');
    if (acc) acc.textContent = L.previewAccept || (_lang === 'zh' ? '✓ 采用' : _lang === 'ko' ? '✓ 적용' : '✓ Accept');
    if (dff) dff.textContent = L.previewDiff || (_lang === 'zh' ? '⇄ 对比' : _lang === 'ko' ? '⇄ 비교' : '⇄ Compare');
    if (rej) rej.textContent = L.previewReject || (_lang === 'zh' ? '✕ 丢弃' : _lang === 'ko' ? '✕ 취소' : '✕ Discard');
    const diffHdr = $('#twar-diff-hdr');
    if (diffHdr) {
      const sp = diffHdr.querySelector('span');
      if (sp) sp.textContent = L.diffTitle || (_lang === 'zh' ? '⇄ 修改对比' : _lang === 'ko' ? '⇄ 수정 비교' : '⇄ Compare changes');
    }
    const diffClose = $('#twar-diff-close-btn');
    if (diffClose) diffClose.title = L.diffCloseTip || (_lang === 'zh' ? '关闭' : _lang === 'ko' ? '닫기' : 'Close');
    const oldLab = $('#twar-diff')?.querySelector('.twar-diff-old-label');
    const newLab = $('#twar-diff')?.querySelector('.twar-diff-new-label');
    if (oldLab) oldLab.textContent = L.diffOldLabel || (_lang === 'zh' ? '原文' : _lang === 'ko' ? '원문' : 'Original');
    if (newLab) newLab.textContent = L.diffNewLabel || (_lang === 'zh' ? '新文' : _lang === 'ko' ? '새 글' : 'Revised');
    const da = $('#twar-diff-accept-btn');
    const dr = $('#twar-diff-reject-btn');
    if (da) da.textContent = L.diffAcceptNew || (_lang === 'zh' ? '✓ 采用新文' : _lang === 'ko' ? '✓ 새 글 적용' : '✓ Use revised');
    if (dr) dr.textContent = L.diffKeepOld || (_lang === 'zh' ? '✕ 保留原文' : _lang === 'ko' ? '✕ 원문 유지' : '✕ Keep original');
  }

  /** 脚本编辑区按钮与占位符 */
  function _applyEditorShellI18n() {
    const L = _Lbl();
    const b = $('#twar-editor-back');
    const c = $('#twar-editor-copy');
    const a = $('#twar-editor-ask-ai');
    const ta = $('#twar-editor-textarea');
    const aiT = $('#twar-editor-ai-title');
    if (b) b.textContent = L.editorBack || (_lang === 'zh' ? '← 返回' : _lang === 'ko' ? '← 뒤로' : '← Back');
    if (c) c.textContent = L.editorCopy || (_lang === 'zh' ? '复制' : _lang === 'ko' ? '복사' : 'Copy');
    if (a) a.textContent = L.editorAskAi || 'Asking AI';
    if (ta) {
      ta.placeholder = L.editorPlaceholder || (_lang === 'zh' ? '脚本内容显示于此；可编辑后复制或使用 Asking AI 提问。' : _lang === 'ko' ? '스크립트가 여기에 표시됩니다. 편집 후 복사하거나 Asking AI로 질문하세요.' : 'Snippet content appears here. Edit, copy, or use Asking AI.');
    }
    if (aiT) {
      aiT.textContent = L.editorAiSectionTitle || (_lang === 'zh' ? 'AI 回答（可多轮）' : _lang === 'ko' ? 'AI 답변 (다중 턴)' : 'AI reply (multi-turn)');
    }
  }
  function _groupKey(cmd) {
    return String(cmd?.groupKey || cmd?.groupId || '__ungrouped__');
  }

  function _groupLabel(cmd) {
    const raw = cmd?.groupLabel;
    if (raw && typeof raw === 'object') return raw[_lang] || raw.en || raw.zh || 'Ungrouped';
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
    const L = _Lbl();
    if (L.ungroupedLabel) return L.ungroupedLabel;
    if (_lang === 'zh') return '未分组';
    if (_lang === 'ko') return '미분류';
    return 'Ungrouped';
  }

  function _groupCommands(items) {
    const map = new Map();
    for (const item of items) {
      const key = _groupKey(item);
      if (!map.has(key)) {
        map.set(key, { key, label: _groupLabel(item), items: [] });
      }
      map.get(key).items.push(item);
    }
    return Array.from(map.values());
  }

  function _ensureActiveGroupExpanded() {
    const cmd = _filteredCmds[_activeIdx];
    if (!cmd) return;
    const key = _groupKey(cmd);
    if (_groupCollapsed[key]) _groupCollapsed[key] = false;
  }


  // 兜底聚焦：确保面板打开后可直接输入（无需再次点击输入框）
  function _focusPaletteInput() {
    const overlay = $('#twar-overlay');
    const input   = $('#twar-palette-input');
    if (!overlay || !input || !overlay.classList.contains('open')) return;
    if (document.activeElement !== input) {
      input.focus({ preventScroll: true });
      const end = input.value.length;
      input.setSelectionRange(end, end);
    }
  }

  // ── 工具 ─────────────────────────────────────────────────────
  function _getLabel(cmd) {
    return cmd.label?.[_lang] || cmd.label?.en || cmd.id;
  }
  function _getDesc(cmd) {
    return cmd.description?.[_lang] || cmd.description?.en || '';
  }

  /**
   * 在文字中把匹配词高亮（包裹 <mark class="twar-match">）。
   * 只高亮文本节点，不破坏已有 HTML 结构。
   */
  function _highlight(text, query) {
    if (!query) return _escHtml(text);
    const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return _escHtml(text).replace(re, '<mark class="twar-match">$1</mark>');
  }

  // ── 列表初次渲染（数据变化时才调用）───────────────────────────
  function _renderList(filter = '') {
    const q = filter.replace(/^\//, '').toLowerCase().trim();

    _filteredCmds = q
      ? _allCommands.filter(c =>
          _getLabel(c).toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q) ||
          (_getDesc(c) || '').toLowerCase().includes(q)
        )
      : _allCommands;

    _activeIdx = Math.min(_activeIdx, Math.max(0, _filteredCmds.length - 1));

    const list  = $('#twar-cmd-list');
    const badge = $('#twar-count-badge');
    const tabHint = $('#twar-tab-hint');
    if (!list) return;

    // 底部计数
    const footerCount = $('#twar-footer-count');
    const Lc = _Lbl();
    if (footerCount) {
      const unit = Lc.countUnit || (_lang === 'zh' ? '条' : _lang === 'ko' ? '개' : 'items');
      footerCount.textContent = `${_filteredCmds.length} ${unit}`;
    }

    if (!_filteredCmds.length) {
      const tmpl = Lc.noResultsForQuery;
      const emptyMsg = q
        ? (tmpl ? tmpl.replace(/\{q\}/g, _escHtml(q)) : (_lang === 'zh' ? `没有匹配「${_escHtml(q)}」的内容` : _lang === 'ko' ? `「${_escHtml(q)}」와 일치하는 항목이 없습니다` : `No results for "${_escHtml(q)}"`))
        : (_paletteOpts.emptyHint || Lc.emptyDefault || (_lang === 'zh' ? '暂无内容' : _lang === 'ko' ? '항목 없음' : 'Nothing here'));
      list.innerHTML = `<div id="twar-cmd-empty"><span>🔍</span>${emptyMsg}</div>`;
      _updateRecommendation(q);
      return;
    }

    let idx = 0;
    const renderRows = (items) => items.map((c) => {
      const cur = idx++;
      const scoreHtml =
        String(c.id || '').startsWith('snippet:')
          ? `<span class="twar-cmd-score" title="${Number(c._useCount) || 0}">${Number(c._useCount) || 0}</span>`
          : '';
      return `
        <div class="twar-cmd-item${cur === _activeIdx ? ' active' : ''}"
             data-id="${c.id}" data-idx="${cur}" role="option"
             aria-selected="${cur === _activeIdx}">
          <span class="twar-cmd-icon">${c.icon || '▶'}</span>
          <span class="twar-cmd-label">${_highlight(_getLabel(c), q)}</span>
          ${scoreHtml}
          <span class="twar-cmd-enter">↵</span>
        </div>
      `;
    }).join('');

    // 快捷 mode（离线脚本）优先按使用次数全局排序展示，不受分组块顺序影响
    if (_isOfflineMode && !_paletteOpts?.forceGroupedList) {
      list.innerHTML = renderRows(_filteredCmds);
    } else {
      const grouped = _groupCommands(_filteredCmds);
      list.innerHTML = grouped.map(group => {
        const collapsed = !!_groupCollapsed[group.key];
        const rows = renderRows(group.items);
        return `
          <div class="twar-group" data-group-key="${_escHtml(group.key)}">
            <div class="twar-group-hdr${collapsed ? '' : ' open'}" data-group-key="${_escHtml(group.key)}">
              <span class="twar-group-arrow">▶</span>
              <span class="twar-group-name">${_escHtml(group.label)}</span>
              <span class="twar-group-count">${group.items.length}</span>
            </div>
            <div class="twar-group-body${collapsed ? ' collapsed' : ''}" data-group-key="${_escHtml(group.key)}">
              ${rows}
            </div>
          </div>
        `;
      }).join('');
    }

    // 事件绑定（事件委托替代逐项绑定）
    list.onclick = (e) => {
      const hdr = e.target.closest('.twar-group-hdr');
      if (hdr) {
        const gk = hdr.dataset.groupKey;
        _groupCollapsed[gk] = !_groupCollapsed[gk];
        _renderList($('#twar-palette-input')?.value || '');
        return;
      }
      const item = e.target.closest('.twar-cmd-item');
      if (!item) return;
      _execCommand(item.dataset.id);
    };
    list.onmousemove = (e) => {
      const item = e.target.closest('.twar-cmd-item');
      if (!item) return;
      const idx = parseInt(item.dataset.idx);
      if (idx !== _activeIdx) {
        _setActive(idx, false); // 鼠标移动不自动滚动
      }
    };

    _scrollActiveIntoView();
    _updateRecommendation(q);
  }

  // ── 仅更新 active 样式（不重建 DOM，方向键时调用）──────────────
  function _setActive(idx, scroll = true) {
    const list = $('#twar-cmd-list');
    if (!list) return;

    const prev = list.querySelector('.twar-cmd-item.active');
    if (prev) {
      prev.classList.remove('active');
      prev.setAttribute('aria-selected', 'false');
    }

    _activeIdx = Math.max(0, Math.min(idx, _filteredCmds.length - 1));
    const next = list.querySelector(`[data-idx="${_activeIdx}"]`);
    if (next) {
      next.classList.add('active');
      next.setAttribute('aria-selected', 'true');
    }

    // 更新选中项（用于 Copy 按钮）
    _selectedItemId = _filteredCmds[_activeIdx]?.id || null;
    _ensureActiveGroupExpanded();
    _updateCopyButton();
    _updateRecommendation($('#twar-palette-input')?.value?.trim() || '');

    if (scroll) _scrollActiveIntoView();
  }

  function _scrollActiveIntoView() {
    const list = $('#twar-cmd-list');
    const el   = list?.querySelector('.twar-cmd-item.active');
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  /** 快速模式已打开时，用最新 snippets 分数重建列表（不改变搜索词） */
  function _setPaletteCommands(commands) {
    const overlay = $('#twar-overlay');
    if (!overlay?.classList.contains('open')) return;
    const prevSel = _selectedItemId;
    const q = $('#twar-palette-input')?.value || '';
    _allCommands = commands || [];
    _renderList(q);
    const idx = _filteredCmds.findIndex((c) => c.id === prevSel);
    if (idx >= 0) {
      _activeIdx = idx;
      _setActive(_activeIdx, false);
    }
    void _syncAgencyStrip();
  }

  // ── 执行指令 ─────────────────────────────────────────────────
  function _execCommand(id) {
    // script：快速模式完整态（full）下，Copy 直接走 onCommand（插入/复制并计分）
    if (id && String(id).startsWith('snippet:') && _isOfflineMode && _currentMode === 'full') {
      _closePalette();
      _hideEditor();
      _cb.onCommand?.(id);
      return;
    }

    // script：其余模式进入编辑区（可再复制）
    if (id && String(id).startsWith('snippet:') && _cb.onSelect) {
      const cmd = _filteredCmds.find(c => c.id === id);
      if (cmd) {
        _cb.onSelect(id, _getLabel(cmd));
        return;
      }
    }

    // 离线模式 + 缩小模式：展开编辑区，不关闭面板
    if (_isOfflineMode && _currentMode === 'compact') {
      const cmd = _filteredCmds.find(c => c.id === id);
      if (cmd) {
        const title = _getLabel(cmd);
        _cb.onSelect?.(id, title);  // 调用 onSelect，展开编辑区
      }
      return;
    }

    // 离线模式 + 完整模式：直接插入并关闭
    // 在线模式：直接执行 AI 并关闭
    _closePalette();
    _hideEditor();
    _cb.onCommand?.(id);
  }

  // ── 离线模式：内容编辑区 ─────────────────────────────────────
  let _isOfflineMode   = false;
  let _selectedItemId  = null;
  let _selectedContent = '';
  let _currentMode     = 'compact';  // 'compact' | 'full'
  let _shortcutsList   = [];
  let _shortcutsDdOpen = false;
  let _historyDdOpen = false;
  /** 编辑区当前 script / AI 对话标题（供 IndexedDB 元数据） */
  let _selectedEditorTitle = '';
  /** 每次成功写入 storage 后递增；丢弃「早于本次写入发起的」chrome.storage.get 回调，防止覆盖刚保存的数据 */
  let _shortcutsStorageSeq = 0;

  /** 快速模式编辑区「问 AI」流式累积与复制 */
  let _editorAiAccText   = '';
  let _editorAiLastFull  = '';
  /** 流式输出时当前助手气泡容器（多轮时不整页清空） */
  let _editorStreamBubble = null;

  function _editorAiStrings() {
    const L = _Lbl();
    return {
      title: L.editorAiSectionTitle || (_lang === 'zh' ? 'AI 回答（可多轮）' : _lang === 'ko' ? 'AI 답변 (다중 턴)' : 'AI reply (multi-turn)'),
      gen: L.editorAiGenerating || (_lang === 'zh' ? '生成中…' : _lang === 'ko' ? '생성 중…' : 'Generating…'),
    };
  }

  function _resetEditorAiPanel() {
    _editorAiAccText = '';
    _editorAiLastFull = '';
    _editorStreamBubble = null;
    _editorAiBodySeq++;
    const wrap = $('#twar-editor-ai-wrap');
    const body = $('#twar-editor-ai-reply');
    if (body) {
      _disposeReactMermaidIn(body);
      body.textContent = '';
      body.classList.remove('streaming');
    }
    wrap?.classList.remove('show');
    const ask = $('#twar-editor-ask-ai');
    if (ask) {
      ask.disabled = false;
    }
  }

  function _setEditorAskBusy(busy) {
    const ask = $('#twar-editor-ask-ai');
    if (ask) ask.disabled = !!busy;
  }

  /**
   * @param {{ priorMessages?: Array<{role:string,content:string,ts?:number}>, pendingUserContent?: string }|undefined} opts
   */
  function _beginEditorAiStream(opts) {
    const wrap = $('#twar-editor-ai-wrap');
    const body = $('#twar-editor-ai-reply');
    const S = _editorAiStrings();
    $('#twar-editor-ai-title').textContent = S.title;
    _editorAiAccText = '';
    _editorStreamBubble = null;

    if (!body) {
      wrap?.classList.add('show');
      return;
    }

    _disposeReactMermaidIn(body);
    body.innerHTML = '';
    body.classList.remove('streaming');

    const prior = opts && Array.isArray(opts.priorMessages) ? opts.priorMessages : [];
    const pending =
      opts && opts.pendingUserContent != null ? String(opts.pendingUserContent).trim() : '';

    const seq = ++_editorAiBodySeq;
    const interactive = true;
    const L = _Lbl();

    prior.forEach((m) => {
      if (!m || (m.role !== 'user' && m.role !== 'assistant')) return;
      const ts = typeof m.ts === 'number' ? m.ts : null;
      const metaTxt = ts ? _formatHistTime(ts) : '';

      if (m.role === 'user') {
        const row = document.createElement('div');
        row.className = 'twar-chat-turn twar-chat-user-turn';
        const meta = document.createElement('div');
        meta.className = 'twar-chat-turn-meta';
        meta.textContent =
          (L.historyUserLabel || (_lang === 'zh' ? '你' : _lang === 'ko' ? '나' : 'You')) +
          (metaTxt ? ` · ${metaTxt}` : '');
        const bubble = document.createElement('div');
        bubble.className = 'twar-chat-bubble twar-chat-user';
        bubble.innerHTML = _escHtml(m.content);
        row.appendChild(meta);
        row.appendChild(bubble);
        body.appendChild(row);
      } else {
        const row = document.createElement('div');
        row.className = 'twar-chat-turn twar-chat-assistant-turn';
        const meta = document.createElement('div');
        meta.className = 'twar-chat-turn-meta';
        meta.textContent =
          (L.historyAssistantLabel ||
            (_lang === 'zh' ? 'AI' : _lang === 'ko' ? 'AI' : 'AI')) +
          (metaTxt ? ` · ${metaTxt}` : '');
        row.appendChild(meta);
        const holder = document.createElement('div');
        holder.className = 'twar-chat-bubble twar-chat-assistant';
        holder.appendChild(
          _buildAiOutputFragment(String(m.content || ''), false, seq, () => _editorAiBodySeq, interactive),
        );
        row.appendChild(holder);
        body.appendChild(row);
      }
    });

    if (pending) {
      const row = document.createElement('div');
      row.className = 'twar-chat-turn twar-chat-user-turn';
      const meta = document.createElement('div');
      meta.className = 'twar-chat-turn-meta';
      meta.textContent = L.historyUserLabel || (_lang === 'zh' ? '你' : _lang === 'ko' ? '나' : 'You');
      const bubble = document.createElement('div');
      bubble.className = 'twar-chat-bubble twar-chat-user';
      bubble.innerHTML = _escHtml(pending);
      row.appendChild(meta);
      row.appendChild(bubble);
      body.appendChild(row);
    }

    const asRow = document.createElement('div');
    asRow.className = 'twar-chat-turn twar-chat-assistant-turn';
    const metaA = document.createElement('div');
    metaA.className = 'twar-chat-turn-meta';
    metaA.textContent =
      (L.historyAssistantLabel || (_lang === 'zh' ? 'AI' : _lang === 'ko' ? 'AI' : 'AI')) +
      ` · ${S.gen}`;
    const bubble = document.createElement('div');
    bubble.className = 'twar-chat-bubble twar-chat-assistant streaming';
    bubble.innerHTML = `<div class="twar-ai-md">${_escHtml(S.gen)}</div>`;
    _editorStreamBubble = bubble;
    body.classList.add('streaming');
    asRow.appendChild(metaA);
    asRow.appendChild(bubble);
    body.appendChild(asRow);

    wrap?.classList.add('show');
    body.scrollTop = body.scrollHeight;
  }

  function _appendEditorAiChunk(chunk) {
    const body = $('#twar-editor-ai-reply');
    if (!body) return;

    if (_editorStreamBubble) {
      _editorAiAccText += chunk;
      _disposeReactMermaidIn(_editorStreamBubble);
      const seq = ++_editorAiBodySeq;
      _editorStreamBubble.innerHTML = '';
      _editorStreamBubble.appendChild(
        _buildAiOutputFragment(_editorAiAccText, false, seq, () => _editorAiBodySeq, false),
      );
      body.scrollTop = body.scrollHeight;
      return;
    }

    _editorAiAccText += chunk;
    _applyEditorAiBodyFromAcc(false);
    body.scrollTop = body.scrollHeight;
  }

  function _completeEditorAiStream(fullText) {
    const body = $('#twar-editor-ai-reply');
    _editorAiLastFull = fullText != null ? String(fullText) : _editorAiAccText;
    const hadStreamBubble = !!_editorStreamBubble;
    if (_editorStreamBubble) {
      _editorStreamBubble.classList.remove('streaming');
      _editorStreamBubble = null;
    }
    body?.classList.remove('streaming');
    if (!hadStreamBubble && body) {
      _editorAiAccText = _editorAiLastFull;
      _applyEditorAiBodyFromAcc(false);
      body.scrollTop = body.scrollHeight;
    }
  }

  function _showEditorAiError(msg) {
    const body = $('#twar-editor-ai-reply');
    const wrap = $('#twar-editor-ai-wrap');
    wrap?.classList.add('show');
    if (_editorStreamBubble) {
      _disposeReactMermaidIn(_editorStreamBubble);
      _editorStreamBubble.innerHTML = '';
      const pre = document.createElement('div');
      pre.className = 'twar-ai-md';
      pre.style.color = '#ff8a8a';
      pre.textContent = msg;
      _editorStreamBubble.appendChild(pre);
      _editorStreamBubble.classList.remove('streaming');
      _editorStreamBubble = null;
      body?.classList.remove('streaming');
      return;
    }
    if (body) {
      _disposeReactMermaidIn(body);
      body.classList.remove('streaming');
      body.textContent = msg;
    }
  }

  function _updateCopyButton() {
    const btn = $('#twar-copy-btn');
    if (!btn) return;
    btn.classList.toggle('show', _isOfflineMode && _selectedItemId);
  }

  function _closeHistoryDd() {
    $('#twar-history-dd')?.classList.remove('open');
    _historyDdOpen = false;
  }

  function _closeShortcutsDd() {
    $('#twar-shortcuts-dd')?.classList.remove('open');
    _shortcutsDdOpen = false;
  }

  function _syncShortcutsDdPosition() {
    const dd = $('#twar-shortcuts-dd');
    const btn = $('#twar-shortcuts-btn');
    if (!dd || !btn || !dd.classList.contains('open')) return;
    const pad = 6;
    const br = btn.getBoundingClientRect();
    const vw = window.innerWidth || 400;
    const vh = window.innerHeight || 600;
    const dw = dd.offsetWidth || 280;
    const dh = dd.offsetHeight || 200;
    let left = Math.round(br.right - dw);
    left = Math.min(Math.max(8, left), vw - dw - 8);
    let top = Math.round(br.bottom + pad);
    if (top + dh > vh - 8 && br.top - dh - pad >= 8) {
      top = Math.round(br.top - dh - pad);
    }
    top = Math.min(Math.max(8, top), vh - dh - 8);
    dd.style.left = `${left}px`;
    dd.style.top = `${top}px`;
  }

  function _syncHistoryDdPosition() {
    const dd = $('#twar-history-dd');
    const btn = $('#twar-history-btn');
    if (!dd || !btn || !dd.classList.contains('open')) return;
    const pad = 6;
    const br = btn.getBoundingClientRect();
    const vw = window.innerWidth || 400;
    const vh = window.innerHeight || 600;
    const dw = dd.offsetWidth || 280;
    const dh = dd.offsetHeight || 220;
    let left = Math.round(br.right - dw);
    left = Math.min(Math.max(8, left), vw - dw - 8);
    let top = Math.round(br.bottom + pad);
    if (top + dh > vh - 8 && br.top - dh - pad >= 8) {
      top = Math.round(br.top - dh - pad);
    }
    top = Math.min(Math.max(8, top), vh - dh - 8);
    dd.style.left = `${left}px`;
    dd.style.top = `${top}px`;
  }

  async function _renderHistoryList() {
    const box = $('#twar-history-list');
    if (!box) return;
    const L = _Lbl();
    box.textContent = '';
    const emptyText =
      L.historyEmpty ||
      (_lang === 'zh' ? '暂无记录' : _lang === 'ko' ? '기록 없음' : 'No saved chats');
    const freeLbl =
      L.historyFreeChat ||
      (_lang === 'zh' ? '自由对话（未选 script）' : _lang === 'ko' ? '자유 대화(script 없음)' : 'Free chat (no script)');
    const untitled =
      L.historyUntitledScript ||
      (_lang === 'zh' ? '未命名 script' : _lang === 'ko' ? '제목 없음' : 'Untitled script');

    let rows = [];
    try {
      if (window.TwQuickChatHistory?.listSessions) {
        rows = await window.TwQuickChatHistory.listSessions(80);
      }
    } catch (e) {
      console.warn('[TwRenderLayer] history list', e);
    }

    if (!rows.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.35);padding:6px 4px;';
      empty.textContent = emptyText;
      box.appendChild(empty);
      return;
    }

    rows.forEach((session) => {
      const row = document.createElement('div');
      row.className = 'twar-hist-row';
      row.dataset.sessionId = session.id;

      const meta = document.createElement('div');
      meta.className = 'twar-hist-meta';

      const timeEl = document.createElement('div');
      timeEl.className = 'twar-hist-time';
      timeEl.textContent = _formatHistTime(session.updatedAt || session.createdAt);

      const line = document.createElement('div');
      const title =
        session.source === 'agency-chat'
          ? freeLbl
          : session.snippetTitle?.trim() || untitled;
      line.textContent = title;

      meta.appendChild(timeEl);
      meta.appendChild(line);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'twar-hist-del';
      del.title =
        L.historyDeleteTip ||
        (_lang === 'zh' ? '删除记录' : _lang === 'ko' ? '삭제' : 'Delete');
      del.textContent = '×';

      row.appendChild(meta);
      row.appendChild(del);

      row.addEventListener('click', () => {
        try {
          void Promise.resolve(_cb.onHistoryRestore?.(session.id));
        } catch (e) {
          console.warn('[TwRenderLayer] onHistoryRestore', e);
        }
        _closeHistoryDd();
      });
      del.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        try {
          await window.TwQuickChatHistory?.deleteSession?.(session.id);
        } catch (e) {
          console.warn('[TwRenderLayer] deleteSession', e);
        }
        await _renderHistoryList();
      });

      box.appendChild(row);
    });
  }

  function _formatHistTime(ts) {
    if (!ts || typeof ts !== 'number') return '';
    try {
      const locale =
        _lang === 'zh' ? 'zh-CN' : _lang === 'ko' ? 'ko-KR' : undefined;
      const d = new Date(ts);
      return d.toLocaleString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (_) {
      return '';
    }
  }

  function _toggleHistoryDd() {
    const dd = $('#twar-history-dd');
    if (!dd) return;
    _closeShortcutsDd();
    const open = dd.classList.toggle('open');
    _historyDdOpen = open;
    if (open) {
      requestAnimationFrame(() => {
        void _renderHistoryList();
      });
      requestAnimationFrame(() => {
        _syncHistoryDdPosition();
        requestAnimationFrame(() => _syncHistoryDdPosition());
      });
    }
  }

  function _openMermaidEditorFromPalette() {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
        _toast(
          _lang === 'zh'
            ? '无法打开 Mermaid 编辑页（runtime 不可用）'
            : _lang === 'ko'
              ? 'Mermaid 편집기를 열 수 없습니다 (runtime 없음)'
              : 'Cannot open Mermaid editor (runtime unavailable)',
        );
        return;
      }
      chrome.runtime.sendMessage(
        {
          type: 'TW_OPEN_MERMAID_VIEWER',
          code: DEFAULT_MERMAID_SEED,
          lang: _lang,
          mode: 'edit',
        },
        () => void chrome.runtime.lastError,
      );
      _closeHistoryDd();
      _closeShortcutsDd();
    } catch (e) {
      console.warn('[TwRenderLayer] open Mermaid editor', e);
    }
  }

  function _toggleShortcutsDd() {
    const dd = $('#twar-shortcuts-dd');
    if (!dd) return;
    _closeHistoryDd();
    const open = dd.classList.toggle('open');
    _shortcutsDdOpen = open;
    if (open) {
      _loadShortcutsFromStorage();
      requestAnimationFrame(() => {
        _syncShortcutsDdPosition();
        requestAnimationFrame(() => _syncShortcutsDdPosition());
      });
    }
  }

  function _shortcutHostLabel(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '') || url;
    } catch (_) {
      return url;
    }
  }

  /** 与 content.js 一致：写入 storage 前的清洗 */
  function _cleanShortcutsForWrite(list) {
    return (Array.isArray(list) ? list : [])
      .map((x) => ({
        label: String(x?.label || '').trim(),
        url: String(x?.url || '').trim(),
      }))
      .filter((x) => /^https?:\/\//i.test(x.url))
      .map((x) => ({
        label: x.label || _shortcutHostLabel(x.url),
        url: x.url,
      }));
  }

  /** 与 content.js load 一致：读入后保底至少一条 */
  function _normalizeLoadedShortcutsList(rawList) {
    const api = window.TwPaletteShortcutsApi;
    const fallbackUrl =
      typeof api?.defaultUrl === 'function'
        ? api.defaultUrl()
        : 'https://www.processon.com/mermaid';
    let list = rawList;
    if (!Array.isArray(list) || list.length === 0) {
      list = [{ label: 'ProcessOn · Mermaid', url: fallbackUrl }];
    } else {
      list = list
        .map((x) => ({
          label: String(x?.label || '').trim(),
          url: String(x?.url || '').trim(),
        }))
        .filter((x) => /^https?:\/\//i.test(x.url))
        .map((x) => ({
          label: x.label || _shortcutHostLabel(x.url),
          url: x.url,
        }));
    }
    if (!list.length) {
      list = [{ label: 'ProcessOn · Mermaid', url: fallbackUrl }];
    }
    return list;
  }

  function _paletteOpenExternalUrl(norm) {
    const u = String(norm || '').trim();
    if (!/^https?:\/\//i.test(u)) return;
    try {
      if (window.TwPaletteShortcutsApi?.openUrl) {
        window.TwPaletteShortcutsApi.openUrl(u);
        return;
      }
    } catch (_) {}
    window.open(u, '_blank', 'noopener,noreferrer');
  }

  /** 用于比较两处 URL 是否实质相同（避免 trailing slash / 编码差导致误判为「有改动」） */
  function _shortcutUrlsEffectivelyEqual(a, b) {
    const sa = String(a || '').trim();
    const sb = String(b || '').trim();
    if (!sa || !sb) return sa === sb;
    try {
      return new URL(sa).href === new URL(sb).href;
    } catch (_) {
      return sa === sb;
    }
  }

  /** 补全协议；无法解析则返回 null */
  function _normalizePaletteShortcutUrl(raw) {
    let s = String(raw || '').trim();
    if (!s) return null;
    if (!/^https?:\/\//i.test(s)) {
      if (/^\/\//.test(s)) s = 'https:' + s;
      else if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}\b/i.test(s)) s = 'https://' + s;
      else return null;
    }
    try {
      const u = new URL(s);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      return u.href;
    } catch (_) {
      return null;
    }
  }

  function _persistShortcutsList(after, opts) {
    const skipRender = !!(opts && opts.skipRender);
    if (!skipRender) _renderShortcutsList();
    const clean = _cleanShortcutsForWrite(_shortcutsList);
    if (
      clean.length === 0 &&
      Array.isArray(_shortcutsList) &&
      _shortcutsList.length > 0
    ) {
      console.warn('[TwRenderLayer] shortcuts: 清洗后为空，跳过写入以免覆盖为默认项');
      if (typeof after === 'function') after();
      if (skipRender && _shortcutsDdOpen) {
        requestAnimationFrame(() => _syncShortcutsDdPosition());
      }
      return;
    }
    const finish = () => {
      if (typeof after === 'function') after();
      else if (!skipRender) _loadShortcutsFromStorage();
      if (skipRender && _shortcutsDdOpen) {
        requestAnimationFrame(() => _syncShortcutsDdPosition());
      }
    };
    const afterWrite = () => {
      _shortcutsStorageSeq++;
      try {
        localStorage.removeItem('tw_palette_shortcuts_fallback');
      } catch (_) {}
      finish();
    };
    const tryFallbackWrite = () => {
      if (window.TwPaletteShortcutsApi?.save) {
        window.TwPaletteShortcutsApi.save(_shortcutsList, afterWrite);
        return;
      }
      try {
        localStorage.setItem('tw_palette_shortcuts_fallback', JSON.stringify(clean));
      } catch (_) {}
      afterWrite();
    };
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local?.set) {
        chrome.storage.local.set({ tw_palette_shortcuts: clean }, () => {
          if (chrome.runtime?.lastError) {
            console.warn('[TwRenderLayer] shortcuts chrome.storage.set', chrome.runtime.lastError);
            tryFallbackWrite();
            return;
          }
          afterWrite();
        });
        return;
      }
    } catch (e) {
      console.warn('[TwRenderLayer] shortcuts save', e);
    }
    tryFallbackWrite();
  }

  function _loadShortcutsFromStorage() {
    const seqAtStart = _shortcutsStorageSeq;
    const apply = (raw) => {
      if (seqAtStart !== _shortcutsStorageSeq) return;
      _shortcutsList = _normalizeLoadedShortcutsList(raw);
      _renderShortcutsList();
    };
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local?.get) {
        chrome.storage.local.get({ tw_palette_shortcuts: null }, (r) => {
          if (chrome.runtime?.lastError) {
            console.warn('[TwRenderLayer] shortcuts chrome.storage.get', chrome.runtime.lastError);
          }
          apply(r?.tw_palette_shortcuts);
        });
        return;
      }
    } catch (e) {
      console.warn('[TwRenderLayer] shortcuts load', e);
    }
    if (window.TwPaletteShortcutsApi?.load) {
      window.TwPaletteShortcutsApi.load((list) => apply(list));
      return;
    }
    try {
      const raw = localStorage.getItem('tw_palette_shortcuts_fallback');
      if (raw) {
        apply(JSON.parse(raw));
        return;
      }
    } catch (_) {}
    apply(null);
  }

  function _renderShortcutsList() {
    const box = $('#twar-shortcuts-list');
    if (!box) return;
    const L = _Lbl();
    const labPh =
      L.shortcutsLabelPh || (_lang === 'zh' ? '显示名称' : _lang === 'ko' ? '표시 이름' : 'Label');
    const urlPh =
      L.shortcutsUrlPh || (_lang === 'zh' ? 'https://…' : _lang === 'ko' ? 'https://…' : 'https://…');
    box.textContent = '';
    const items = _shortcutsList || [];
    if (!items.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.35);padding:6px 4px;';
      empty.textContent = L.shortcutsEmpty || (_lang === 'zh' ? '暂无快捷网页' : _lang === 'ko' ? '바로가기 없음' : 'No shortcuts');
      box.appendChild(empty);
      return;
    }
    const canRemove = items.length > 1;
    items.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'twar-sc-row-edit';

      const labInp = document.createElement('input');
      labInp.type = 'text';
      labInp.className = 'twar-sc-inp';
      labInp.maxLength = 80;
      labInp.autocomplete = 'off';
      labInp.id = `twar-sc-label-${idx}`;
      labInp.name = `tw_palette_shortcut_label_${idx}`;
      labInp.placeholder = labPh;
      labInp.value = item.label || '';

      const urlInp = document.createElement('input');
      urlInp.type = 'text';
      urlInp.className = 'twar-sc-inp';
      urlInp.maxLength = 2048;
      urlInp.autocomplete = 'off';
      urlInp.spellcheck = false;
      urlInp.id = `twar-sc-url-${idx}`;
      urlInp.name = `tw_palette_shortcut_url_${idx}`;
      urlInp.placeholder = urlPh;
      urlInp.value = item.url || '';

      const actions = document.createElement('div');
      actions.className = 'twar-sc-row-actions';

      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'twar-sc-save';
      saveBtn.id = `twar-sc-save-${idx}`;
      saveBtn.name = `tw_palette_shortcut_save_${idx}`;
      saveBtn.textContent =
        L.shortcutsSave || (_lang === 'zh' ? '保存' : _lang === 'ko' ? '저장' : 'Save');

      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'twar-sc-open';
      openBtn.textContent =
        L.shortcutsOpen || (_lang === 'zh' ? '打开' : _lang === 'ko' ? '열기' : 'Open');

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'twar-sc-del';
      del.title = L.shortcutsRemoveTip || (_lang === 'zh' ? '删除' : _lang === 'ko' ? '삭제' : 'Remove');
      del.textContent = '×';
      del.disabled = !canRemove;

      function tryCommit() {
        const prev = _shortcutsList[idx];
        if (!prev) return false;
        const lab = String(labInp.value || '').trim();
        const raw = String(urlInp.value || '').trim();
        if (!raw) {
          _toast(
            L.shortcutsUrlRequired ||
              (_lang === 'zh' ? '网址不能为空' : _lang === 'ko' ? '주소를 입력하세요' : 'URL required'),
          );
          labInp.value = prev.label || '';
          urlInp.value = prev.url || '';
          return false;
        }
        const norm = _normalizePaletteShortcutUrl(raw);
        if (!norm) {
          _toast(
            L.shortcutsUrlInvalid ||
              (_lang === 'zh'
                ? '请输入有效网址（可自动补全 https://）'
                : _lang === 'ko'
                  ? '유효한 주소를 입력하세요.'
                  : 'Enter a valid URL.'),
          );
          labInp.value = prev.label || '';
          urlInp.value = prev.url || '';
          return false;
        }
        let title = lab;
        if (!title) {
          try {
            title = new URL(norm).hostname.replace(/^www\./, '');
          } catch (_) {
            title = norm;
          }
        }
        if (
          (prev.label || '') === title &&
          _shortcutUrlsEffectivelyEqual(prev.url, norm)
        ) {
          return false;
        }
        _shortcutsList[idx] = { label: title, url: norm };
        _persistShortcutsList(undefined, { skipRender: true });
        return true;
      }

      labInp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          labInp.blur();
        }
      });
      urlInp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          urlInp.blur();
        }
      });
      labInp.addEventListener('blur', () => {
        tryCommit();
      });
      urlInp.addEventListener('blur', () => {
        tryCommit();
      });

      /** capture：尽量先于输入框 blur，避免读到空串把界面还原成默认址 */
      saveBtn.addEventListener(
        'pointerdown',
        (e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          if (tryCommit()) {
            _toast(
              L.shortcutsSaved ||
                (_lang === 'zh' ? '已保存' : _lang === 'ko' ? '저장됨' : 'Saved'),
            );
          }
        },
        true,
      );
      /** 键盘 Space/Enter 触发的是 click，无前置 pointerdown */
      saveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (tryCommit()) {
          _toast(
            L.shortcutsSaved ||
              (_lang === 'zh' ? '已保存' : _lang === 'ko' ? '저장됨' : 'Saved'),
          );
        }
      });

      openBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const raw = String(urlInp.value || '').trim();
        const norm = _normalizePaletteShortcutUrl(raw);
        if (!norm) {
          _toast(
            L.shortcutsUrlInvalid ||
              (_lang === 'zh'
                ? '请先填写有效网址'
                : _lang === 'ko'
                  ? '유효한 주소를 입력하세요.'
                  : 'Enter a valid URL first.'),
          );
          return;
        }
        _paletteOpenExternalUrl(norm);
        _closeShortcutsDd();
      });

      del.addEventListener('click', (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        if (!canRemove) return;
        _shortcutsList = (_shortcutsList || []).filter((_, j) => j !== idx);
        _persistShortcutsList();
      });

      actions.appendChild(saveBtn);
      actions.appendChild(openBtn);
      actions.appendChild(del);
      row.appendChild(labInp);
      row.appendChild(urlInp);
      row.appendChild(actions);
      box.appendChild(row);
    });
  }

  function _bindShortcutsUi(sig) {
    const btn = $('#twar-shortcuts-btn');
    const wrap = $('#twar-shortcuts-wrap');
    btn?.addEventListener(
      'click',
      (e) => {
        e.stopPropagation();
        _toggleShortcutsDd();
      },
      { signal: sig },
    );
    function _shortcutsPointerOutside(e) {
      if (!_shortcutsDdOpen) return;
      const ddEl = $('#twar-shortcuts-dd');
      const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
      const inUi =
        (wrap && (path.includes(wrap) || wrap.contains(e.target))) ||
        (ddEl && (path.includes(ddEl) || ddEl.contains(e.target)));
      if (inUi) return;
      _closeShortcutsDd();
    }
    document.addEventListener('pointerdown', _shortcutsPointerOutside, { capture: true, signal: sig });
    window.addEventListener(
      'resize',
      () => {
        if (_shortcutsDdOpen) _syncShortcutsDdPosition();
      },
      { signal: sig },
    );
  }

  function _bindHistoryUi(sig) {
    const btn = $('#twar-history-btn');
    btn?.addEventListener(
      'click',
      (e) => {
        e.stopPropagation();
        _toggleHistoryDd();
      },
      { signal: sig },
    );
    function _histPointerOutside(e) {
      if (!_historyDdOpen) return;
      const ddEl = $('#twar-history-dd');
      const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
      const inUi =
        (btn && (path.includes(btn) || btn.contains(e.target))) ||
        (ddEl && (path.includes(ddEl) || ddEl.contains(e.target)));
      if (inUi) return;
      _closeHistoryDd();
    }
    document.addEventListener('pointerdown', _histPointerOutside, { capture: true, signal: sig });
    window.addEventListener(
      'resize',
      () => {
        if (_historyDdOpen) _syncHistoryDdPosition();
      },
      { signal: sig },
    );
  }

  function _bindMermaidEntryUi(sig) {
    const btn = $('#twar-mermaid-btn');
    btn?.addEventListener(
      'click',
      (e) => {
        e.stopPropagation();
        _openMermaidEditorFromPalette();
      },
      { signal: sig },
    );
  }

  // 工具函数：移除内容中的占位符 {{value:type:label}}
  function _removePlaceholders(text) {
    if (!text) return '';
    // 将 {{学术严谨:tone:语气}} 转换为 "学术严谨语气"
    // 将 {{英文:lang:语言}} 转换为 "英文语言"
    return text.replace(/\{\{([^:]+):([^:]+):([^}]+)\}\}/g, '$1$3');
  }

  function _showEditor(snippetId, title, content) {
    console.log('[TwRenderLayer] _showEditor 被调用', { snippetId, title, content: content?.slice(0, 50) });
    
    _resetEditorAiPanel();
    const askBtn = $('#twar-editor-ask-ai');
    if (askBtn) askBtn.style.display = _isOfflineMode ? 'none' : '';

    _selectedItemId  = snippetId;
    _selectedEditorTitle = title || '';
    _selectedContent = content;

    const editor   = $('#twar-content-editor');
    const textarea = $('#twar-editor-textarea');
    const titleEl  = $('#twar-editor-title');
    const list     = $('#twar-cmd-list');
    const box      = $('#twar-palette-box');

    if (!editor || !textarea) {
      console.error('[TwRenderLayer] 编辑区元素未找到！', { editor: !!editor, textarea: !!textarea });
      return;
    }

    titleEl.textContent = `📋 ${title}`;
    // 与主界面一致：先由 content 展开变量，再去掉残留占位格式
    let rawIn = content || '';
    if (window.TwExpandSnippetContent && snippetId && String(snippetId).startsWith('snippet:')) {
      const sid = String(snippetId).replace(/^snippet:/, '');
      rawIn = TwExpandSnippetContent(sid, rawIn);
    }
    const cleanContent = _removePlaceholders(rawIn).trim();
    textarea.value = cleanContent;
    console.log('[TwRenderLayer] textarea.value 设置为:', textarea.value?.slice(0, 50));

    // 隐藏列表，显示编辑区，面板加宽
    if (list) list.style.display = 'none';
    editor.classList.add('show');
    if (box) box.classList.add('expanded');

    _applyEditorShellI18n();
    if (String(snippetId) === 'tw:agency-chat') {
      const P = _Lbl();
      if (P.paletteAgencyChatPlaceholder) {
        textarea.placeholder = P.paletteAgencyChatPlaceholder;
      }
    }

    // 聚焦编辑区，光标移到末尾
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      console.log('[TwRenderLayer] 编辑区已聚焦');
    }, 100);
  }

  function _hideEditor() {
    const editor = $('#twar-content-editor');
    const list   = $('#twar-cmd-list');
    const box    = $('#twar-palette-box');

    _resetEditorAiPanel();
    try { _cb.onEditorChatReset?.(); } catch (_) {}

    editor?.classList.remove('show');
    if (list) list.style.display = '';
    box?.classList.remove('expanded');

    _selectedItemId  = null;
    _selectedEditorTitle = '';
    _selectedContent = '';
  }

  /**
   * 渲染已保存的多轮对话（恢复历史时用；每条消息可带 ts）
   * @param {{ role: string, content: string, ts?: number }[]} messages
   */
  function _renderEditorChatTranscript(messages) {
    const wrap = $('#twar-editor-ai-wrap');
    const body = $('#twar-editor-ai-reply');
    if (!wrap || !body) return;

    _editorStreamBubble = null;
    _disposeReactMermaidIn(body);
    body.classList.remove('streaming');
    body.innerHTML = '';

    const L = _Lbl();
    $('#twar-editor-ai-title').textContent =
      L.editorAiSectionTitle ||
      (_lang === 'zh' ? 'AI 回答（可多轮）' : _lang === 'ko' ? 'AI 답변 (다중 턴)' : 'AI reply (multi-turn)');

    const seq = ++_editorAiBodySeq;
    const interactive = true;
    const arr = messages || [];

    arr.forEach((m) => {
      if (!m || (m.role !== 'user' && m.role !== 'assistant')) return;
      const ts = typeof m.ts === 'number' ? m.ts : null;
      const metaTxt = ts ? _formatHistTime(ts) : '';

      if (m.role === 'user') {
        const row = document.createElement('div');
        row.className = 'twar-chat-turn twar-chat-user-turn';
        const meta = document.createElement('div');
        meta.className = 'twar-chat-turn-meta';
        meta.textContent =
          (L.historyUserLabel || (_lang === 'zh' ? '你' : _lang === 'ko' ? '나' : 'You')) +
          (metaTxt ? ` · ${metaTxt}` : '');
        const bubble = document.createElement('div');
        bubble.className = 'twar-chat-bubble twar-chat-user';
        bubble.innerHTML = _escHtml(m.content);
        row.appendChild(meta);
        row.appendChild(bubble);
        body.appendChild(row);
      } else {
        const row = document.createElement('div');
        row.className = 'twar-chat-turn twar-chat-assistant-turn';
        const meta = document.createElement('div');
        meta.className = 'twar-chat-turn-meta';
        meta.textContent =
          (L.historyAssistantLabel ||
            (_lang === 'zh' ? 'AI' : _lang === 'ko' ? 'AI' : 'AI')) +
          (metaTxt ? ` · ${metaTxt}` : '');
        row.appendChild(meta);
        const holder = document.createElement('div');
        holder.className = 'twar-chat-bubble twar-chat-assistant';
        holder.appendChild(
          _buildAiOutputFragment(String(m.content || ''), false, seq, () => _editorAiBodySeq, interactive),
        );
        row.appendChild(holder);
        body.appendChild(row);
      }
    });

    const lastAsst = [...arr].reverse().find((x) => x?.role === 'assistant');
    _editorAiLastFull = lastAsst ? String(lastAsst.content || '') : '';
    _editorAiAccText = _editorAiLastFull;
    wrap.classList.add('show');
    body.scrollTop = body.scrollHeight;
  }

  // ── 键盘绑定 ─────────────────────────────────────────────────
  function _bindPalette() {
    _paletteAc?.abort();
    _paletteAc = new AbortController();
    const sig = _paletteAc.signal;

    const overlay = $('#twar-overlay');
    const input   = $('#twar-palette-input');
    if (!overlay || !input) return;

    // 点击蒙层关闭
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) _closePalette({ restoreSidebar: false });
    }, { signal: sig });

    // 输入实时过滤
    input.addEventListener('input', (e) => {
      _activeIdx = 0;
      _selectedItemId = _filteredCmds[0]?.id || null;
      _renderList(e.target.value);
    }, { signal: sig });

    input.addEventListener('keydown', (e) => {
      switch (e.key) {

        case 'ArrowDown':
          e.preventDefault();
          _setActive(_activeIdx + 1);
          break;

        case 'ArrowUp':
          e.preventDefault();
          _setActive(_activeIdx - 1);
          break;

        case 'Enter':
        case 'Return': {
          e.preventDefault();
          const cmd = _filteredCmds[_activeIdx];
          if (cmd) {
            // 离线模式：Enter 等同于点 Copy
            // 在线模式：Enter 直接执行
            _execCommand(cmd.id);
          }
          break;
        }

        case 'Escape':
          if (_shortcutsDdOpen) {
            _closeShortcutsDd();
            break;
          }
          if (_historyDdOpen) {
            _closeHistoryDd();
            break;
          }
          _closePalette({ restoreSidebar: false });
          break;
      }
    }, { signal: sig });

    _bindShortcutsUi(sig);
    _bindHistoryUi(sig);
    _bindMermaidEntryUi(sig);

    // Copy 按钮（搜索框右侧，快速复制当前选中项）
    const copyBtn = $('#twar-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        if (_selectedItemId) _execCommand(_selectedItemId);
      }, { signal: sig });
    }

    // 编辑区按钮
    $('#twar-editor-back')?.addEventListener('click', _hideEditor, { signal: sig });
    
    $('#twar-editor-copy')?.addEventListener('click', () => {
      const Lt = _Lbl();
      const wrap = $('#twar-editor-ai-wrap');
      const body = $('#twar-editor-ai-reply');
      const aiDone =
        wrap?.classList.contains('show') &&
        body &&
        !body.classList.contains('streaming');
      const aiPlain = String(_editorAiLastFull || _editorAiAccText || '').trim();

      // AI 已完成：只保留一个「复制」，复制 AI 全文（不关闭面板，与原先「复制答案」一致）
      if (aiDone && aiPlain) {
        if (navigator.clipboard?.writeText) {
          navigator.clipboard
            .writeText(aiPlain)
            .then(() => {
              _toast(
                Lt.toastAnswerCopied ||
                  (_lang === 'zh' ? '✓ 已复制答案' : _lang === 'ko' ? '✓ 답안 복사됨' : '✓ Answer copied'),
              );
            })
            .catch(() => {
              alert(
                Lt.alertCopyAnswerFailed ||
                  (_lang === 'zh'
                    ? '复制失败，请手动选择答案文本复制'
                    : _lang === 'ko'
                      ? '복사에 실패했습니다. 답변을 직접 선택해 복사하세요.'
                      : 'Copy failed. Select the answer and copy manually.'),
              );
            });
        } else {
          const reply = $('#twar-editor-ai-reply');
          if (reply) {
            const range = document.createRange();
            range.selectNodeContents(reply);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            try {
              document.execCommand('copy');
              _toast(
                Lt.toastAnswerCopied ||
                  (_lang === 'zh' ? '✓ 已复制答案' : _lang === 'ko' ? '✓ 답안 복사됨' : '✓ Answer copied'),
              );
            } catch (_) {
              alert(
                Lt.alertCopyFailedShort || (_lang === 'zh' ? '复制失败' : _lang === 'ko' ? '복사 실패' : 'Copy failed'),
              );
            }
            sel.removeAllRanges();
          }
        }
        return;
      }

      const textarea = $('#twar-editor-textarea');
      let content = textarea?.value || '';

      content = _removePlaceholders(content);

      console.log('[TwRenderLayer] Copy按钮点击，内容长度:', content.length);

      if (navigator.clipboard?.writeText) {
        navigator.clipboard
          .writeText(content)
          .then(() => {
            console.log('[TwRenderLayer] 复制成功');
            _toast(Lt.toastCopied || (_lang === 'zh' ? '✓ 已复制' : _lang === 'ko' ? '✓ 복사됨' : '✓ Copied'));
          })
          .catch((err) => {
            console.error('[TwRenderLayer] 复制失败:', err);
            alert(
              Lt.alertCopyFailed ||
                (_lang === 'zh'
                  ? '复制失败，请手动选择内容复制'
                  : _lang === 'ko'
                    ? '복사에 실패했습니다. 텍스트를 직접 선택해 복사하세요.'
                    : 'Copy failed. Select the text and copy manually.'),
            );
          });
      } else {
        textarea.value = content;
        textarea.select();
        try {
          document.execCommand('copy');
          _toast(Lt.toastCopied || (_lang === 'zh' ? '✓ 已复制' : _lang === 'ko' ? '✓ 복사됨' : '✓ Copied'));
        } catch (err) {
          alert(
            Lt.alertCopyFailed ||
              (_lang === 'zh'
                ? '复制失败，请手动选择内容复制'
                : _lang === 'ko'
                  ? '복사에 실패했습니다. 텍스트를 직접 선택해 복사하세요.'
                  : 'Copy failed. Select the text and copy manually.'),
          );
        }
      }

      _closePalette({ restoreSidebar: false });
    }, { signal: sig });

    $('#twar-editor-ask-ai')?.addEventListener('click', async () => {
      if (!_cb.onEditorAskAI) return;
      try {
        await _cb.onEditorAskAI();
      } catch (err) {
        console.error('[TwRenderLayer] Asking AI 失败', err);
      }
    }, { signal: sig });

    $('#twar-agency-enhance-cb')?.addEventListener(
      'change',
      () => {
        try {
          window.TwPatchAgencyEnhance?.(!!$('#twar-agency-enhance-cb')?.checked);
        } catch (_) {}
        void _syncAgencyStrip();
      },
      { signal: sig },
    );
    $('#twar-agency-strip')?.addEventListener(
      'mousedown',
      (e) => {
        e.stopPropagation();
      },
      { signal: sig, capture: true },
    );
    $('#twar-ag-btn-voice')?.addEventListener(
      'click',
      () => {
        try {
          window.TwPaletteAgencyClear?.('celeb');
        } catch (_) {}
        void _syncAgencyStrip();
      },
      { signal: sig },
    );
    $('#twar-ag-btn-chat')?.addEventListener(
      'click',
      () => {
        try {
          _cb.onPaletteAgencyChat?.();
        } catch (_) {}
      },
      { signal: sig },
    );
  }

  /** 在线快速模式：同步顶部 Agency 条（风格 / Agent / 拼接开关） */
  async function _syncAgencyStrip() {
    const strip = $('#twar-agency-strip');
    if (!strip) return;
    if (_isOfflineMode) {
      strip.classList.remove('show', 'off');
      const stOff = $('#twar-agency-status');
      if (stOff) stOff.textContent = '';
      return;
    }
    const L = _Lbl();
    const enLab = $('#twar-agency-enable-lbl');
    if (enLab) enLab.textContent = L.paletteAgencyToggle || 'Enhance';
    const bV = $('#twar-ag-btn-voice');
    const bC = $('#twar-ag-btn-chat');
    if (bV) bV.textContent = L.paletteAgencyClearVoice || '×';
    if (bC) {
      bC.textContent = L.paletteAgencyChatStripBtn || L.paletteAgencyChatFooterBtn || 'AI对话';
      bC.title = L.paletteAgencyChatBtnTip || '';
    }
    if (bV) bV.title = L.paletteAgencyClearVoice || '';

    const fn = window.TwAgencyUI?.getPaletteStripModel;
    const statusEl = $('#twar-agency-status');
    if (typeof fn !== 'function') {
      strip.classList.add('show');
      const sm = $('#twar-agency-sum');
      if (sm) sm.textContent = L.paletteAgencyEmpty || '—';
      if (statusEl) statusEl.textContent = L.paletteAgencyStripNeutral || '';
      return;
    }
    try {
      const m = await fn();
      const cb = $('#twar-agency-enhance-cb');
      if (cb) cb.checked = !!m.enhanceEnabled;
      const sum = $('#twar-agency-sum');
      const txt = m.lineBase ? String(m.lineDisplay || m.lineBase) : (L.paletteAgencyEmpty || '');
      if (sum) sum.textContent = txt;
      strip.classList.toggle('off', !!(m.lineBase && !m.enhanceEnabled));
      strip.classList.add('show');
      if (bV) bV.disabled = !m.hasStar;
      if (statusEl) {
        if (!m.lineBase) {
          statusEl.textContent = L.paletteAgencyStripNeutral || '';
        } else if (m.enhanceEnabled) {
          statusEl.textContent = L.paletteAgencyEnhanceOnHint || '';
        } else {
          statusEl.textContent = L.paletteAgencyEnhanceOffHint || '';
        }
      }
    } catch (err) {
      console.warn('[TwRenderLayer] _syncAgencyStrip failed', err);
      strip.classList.add('show');
      const sum = $('#twar-agency-sum');
      if (sum && !sum.textContent) sum.textContent = L.paletteAgencyEmpty || '—';
    }
  }

  function _toast(msg) {
    console.log('[TwRenderLayer] Toast:', msg);
    
    // 复用 content.js 的 #tw-toast
    const toastEl = _root?.querySelector('#tw-toast');
    if (toastEl) {
      const oldText = toastEl.textContent;
      toastEl.textContent = msg;
      toastEl.classList.add('show');
      setTimeout(() => {
        toastEl.classList.remove('show');
        toastEl.textContent = oldText;
      }, 2000);
    }
  }

  // ── 打开 / 关闭 ──────────────────────────────────────────────
  function _openPalette(selectedText = '') {
    console.log('[TwRenderLayer] _openPalette 被调用, selectedText:', selectedText || '(空)', 'isOfflineMode:', _isOfflineMode);
    
    const input = $('#twar-palette-input');
    if (!input) {
      console.error('[TwRenderLayer] #twar-palette-input 未找到！render.js 可能未正确初始化');
      return;
    }

    _selectedText   = selectedText;
    _activeIdx      = 0;
    _selectedItemId = _filteredCmds[0]?.id || null;
    _groupCollapsed = {};
    input.value     = '';
    const L = _Lbl();
    input.placeholder = _paletteOpts.placeholder ||
      L.searchPlaceholder ||
      (_lang === 'zh' ? '搜索…' : _lang === 'ko' ? '검색…' : 'Search…');

    console.log('[TwRenderLayer] placeholder 设置为:', input.placeholder);

    const stripLbl = $('#twar-ctx-label');
    if (stripLbl && L.ctxStripLabel) stripLbl.textContent = L.ctxStripLabel;
    const footerHintEl = $('#twar-footer-hint');
    if (footerHintEl && L.footerHint) footerHintEl.textContent = L.footerHint;

    // 选中文本预览条
    const strip   = $('#twar-ctx-strip');
    const ctxText = $('#twar-ctx-text');
    if (strip && ctxText) {
      if (selectedText) {
        const preview = selectedText.length > 60
          ? selectedText.slice(0, 60) + '…'
          : selectedText;
        ctxText.textContent = preview;
        strip.classList.add('has-text');
      } else {
        strip.classList.remove('has-text');
      }
    }

    _renderList('');
    _updateCopyButton();  // 根据模式显示/隐藏 Copy 按钮
    _updateRecommendation('');
    _closeShortcutsDd();
    void _syncAgencyStrip();
    // 勿在此处 _loadShortcutsFromStorage：会与用户点「保存」时的 set 竞态，晚到的 get 回调会把列表刷回默认址

    const overlay = $('#twar-overlay');
    if (overlay) {
      overlay.classList.add('open');
      console.log('[TwRenderLayer] #twar-overlay 已添加 .open 类');
      
      // 强制设置样式（以防CSS被覆盖）
      overlay.style.display = 'flex';
      overlay.style.opacity = '1';
      overlay.style.visibility = 'visible';
      overlay.style.pointerEvents = 'auto';
      
      console.log('[TwRenderLayer] 面板样式已强制设置:', {
        display: overlay.style.display,
        opacity: overlay.style.opacity,
        visibility: overlay.style.visibility,
        classList: Array.from(overlay.classList),
      });
    } else {
      console.error('[TwRenderLayer] #twar-overlay 未找到！');
    }

    // 立即 + 延迟兜底聚焦，避免不同浏览器/页面脚本抢焦点
    _focusPaletteInput();
    requestAnimationFrame(() => _focusPaletteInput());
    setTimeout(() => _focusPaletteInput(), 30);
    setTimeout(() => _focusPaletteInput(), 120);
    console.log('[TwRenderLayer] 输入框已请求聚焦（含兜底重试）');
  }

  function _updateRecommendation(query = '') {
    const hint = $('#twar-smart-hint');
    if (!hint) return;
    if (!_paletteOpts?.showRecommendation) {
      hint.classList.remove('show');
      hint.textContent = '';
      return;
    }
    const picked = _filteredCmds[_activeIdx] || _filteredCmds[0];
    if (!picked) {
      hint.classList.remove('show');
      hint.textContent = '';
      return;
    }
    const label = _getLabel(picked);
    const Lr = _Lbl();
    const desc = _getDesc(picked) || Lr.recommendDescDefault || (_lang === 'zh' ? '可直接用于当前输入场景。' : _lang === 'ko' ? '현재 입력 상황에 바로 쓸 수 있습니다.' : 'Fits your current context.');
    const title = _paletteOpts.recommendationTitle || (_lang === 'zh' ? '推荐脚本：' : _lang === 'ko' ? '추천 스크립트:' : 'Recommended:');
    const by = query
      ? (Lr.recommendFromQuery
        ? Lr.recommendFromQuery.replace(/\{q\}/g, _escHtml(query))
        : (_lang === 'zh' ? `（基于“${_escHtml(query)}”）` : _lang === 'ko' ? `(「${_escHtml(query)}」 기준)` : `(from "${_escHtml(query)}")`))
      : '';
    const hitLbl = Lr.recommendHit || (_lang === 'zh' ? '命中关键词' : _lang === 'ko' ? '키워드 일치' : 'Matched');
    const reasons = picked._recommendReasons || [];
    const hitSep = _lang === 'en' ? ': ' : '：';
    const hitHtml = reasons.length
      ? `<div class="twar-hint-hit"><strong>${_escHtml(hitLbl)}${hitSep}</strong>${reasons.map(r => _escHtml(r)).join(' / ')}</div>`
      : '';
    hint.innerHTML = `<span class="hint-title">${_escHtml(title)}</span>${_escHtml(label)} ${by}<br>${_escHtml(desc)}${hitHtml}`;
    hint.classList.add('show');
  }

  function _closePalette(opts = {}) {
    const { restoreSidebar = true } = opts;
    _closeShortcutsDd();
    _closeHistoryDd();
    $('#twar-overlay')?.classList.remove('open');
    _hideEditor();
    
    // 关闭面板后是否恢复侧边栏显示
    // 需求：用户按 Esc 退出时，不要自动把左侧插件面板重新弹出来。
    if (restoreSidebar) {
      const sb = _root?.querySelector('#sb');
      if (sb && sb.dataset.twSidePanel !== '1') {
        sb.classList.remove('hidden');
        try { window.TwUpdatePageContentGutter?.(); } catch (_) {}
        console.log('[TwRenderLayer] 侧边栏已恢复显示');
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  2. PREVIEW PANEL
  // ─────────────────────────────────────────────────────────────
  let _accText     = '';   // 累积的流式文本
  let _lastNewText = '';   // finishPreview 时暂存，供 diff 用
  let _previewBodySeq = 0;
  let _editorAiBodySeq = 0;

  function _disposeReactMermaidIn(container) {
    if (!container) return;
    const api = window.TwMermaidEditor;
    if (!api || typeof api.unmount !== 'function') return;
    container.querySelectorAll('[data-tw-react-root="1"]').forEach((el) => {
      try { api.unmount(el); } catch (_) {}
    });
  }

  function _splitTwMermaid(fullText) {
    try {
      const mod = window.TwParseAIResponse;
      const fn = mod && mod.splitByMermaid;
      if (typeof fn === 'function') return fn(String(fullText ?? ''));
    } catch (e) { console.warn('[TwRenderLayer] splitByMermaid', e); }
    return [{ type: 'text', text: String(fullText ?? '') }];
  }

  function _hydrateMermaidSlot(wrapEl, code, seq, getSeq) {
    (async () => {
      try {
        const fn = window.TalkWebMermaid && window.TalkWebMermaid.renderMermaid;
        if (typeof fn !== 'function') throw new Error('TalkWebMermaid.renderMermaid unavailable');
        const svg = await fn(code);
        if (seq !== getSeq()) return;
        wrapEl.textContent = '';
        const holder = document.createElement('div');
        holder.className = 'mermaid-wrapper twar-mermaid-inner';
        holder.innerHTML = svg;
        wrapEl.appendChild(holder);
        wrapEl.classList.add('twar-mermaid-openable');
        wrapEl.title =
          _lang === 'zh'
            ? '点击在新标签页打开全图'
            : _lang === 'ko'
              ? '클릭하여 새 탭에서 전체 보기'
              : 'Click to open full diagram in a new tab';
        wrapEl.style.cursor = 'pointer';
        wrapEl.addEventListener(
          'click',
          () => {
            try {
              if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                chrome.runtime.sendMessage(
                  {
                    type: 'TW_OPEN_MERMAID_VIEWER',
                    code,
                    lang: _lang,
                    mode: 'view',
                  },
                  () => void chrome.runtime.lastError,
                );
              }
            } catch (_) {}
          },
          { passive: true },
        );
      } catch (err) {
        console.error(err);
        if (seq !== getSeq()) return;
        wrapEl.textContent = '';
        const pre = document.createElement('pre');
        pre.className = 'twar-mermaid-fallback';
        pre.textContent = code;
        wrapEl.appendChild(pre);
      }
    })();
  }

  function _mountMermaidBlock(wrap, code, seq, getSeq) {
    wrap.textContent = '';
    const host = document.createElement('div');
    host.style.position = 'relative';
    wrap.appendChild(host);
    try {
      const api = window.TwMermaidEditor;
      if (!api || typeof api.mount !== 'function') throw new Error('TwMermaidEditor missing');
      api.mount(host, {
        code,
        uiLang: _lang,
        layoutVariant: 'embedded',
        onDelete: () => {
          if (seq !== getSeq()) return;
          try { api.unmount(host); } catch (_) {}
          wrap.remove();
        },
      });
    } catch (err) {
      console.warn('[TwRenderLayer] MermaidBlock fallback', err);
      const ld = document.createElement('div');
      ld.className = 'twar-mermaid-loading';
      ld.textContent = '…';
      wrap.appendChild(ld);
      _hydrateMermaidSlot(wrap, code, seq, getSeq);
    }
  }

  function _buildAiOutputFragment(fullText, withCursor, seq, getSeq, interactiveMermaid) {
    const frag = document.createDocumentFragment();
    const parts = _splitTwMermaid(fullText);
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part.type === 'text') {
        const d = document.createElement('div');
        d.className = 'twar-ai-md';
        d.innerHTML = _escHtml(part.text);
        frag.appendChild(d);
      } else if (part.type === 'mermaid') {
        const wrap = document.createElement('div');
        wrap.className = 'twar-mermaid-wrap';
        frag.appendChild(wrap);
        if (interactiveMermaid) {
          _mountMermaidBlock(wrap, part.code, seq, getSeq);
        } else {
          const ld = document.createElement('div');
          ld.className = 'twar-mermaid-loading';
          ld.textContent = '…';
          wrap.appendChild(ld);
          _hydrateMermaidSlot(wrap, part.code, seq, getSeq);
        }
      }
    }
    if (withCursor) {
      const c = document.createElement('span');
      c.className = 'twar-cursor';
      frag.appendChild(c);
    }
    return frag;
  }

  function _applyPreviewBodyFromAcc(withCursor) {
    const body = $('#twar-preview-body');
    if (!body) return;
    _disposeReactMermaidIn(body);
    const seq = ++_previewBodySeq;
    body.innerHTML = '';
    const interactive = !withCursor;
    body.appendChild(_buildAiOutputFragment(_accText, withCursor, seq, () => _previewBodySeq, interactive));
    body.scrollTop = body.scrollHeight;
  }

  function _applyEditorAiBodyFromAcc(withCursor) {
    const body = $('#twar-editor-ai-reply');
    if (!body) return;
    _disposeReactMermaidIn(body);
    const seq = ++_editorAiBodySeq;
    body.innerHTML = '';
    const interactive = !body.classList.contains('streaming');
    body.appendChild(_buildAiOutputFragment(_editorAiAccText, withCursor, seq, () => _editorAiBodySeq, interactive));
    body.scrollTop = body.scrollHeight;
  }

  function _openPreview(commandLabel = 'AI 输出') {
    _accText = '';
    const body   = $('#twar-preview-body');
    const title  = $('#twar-preview-title');
    const status = $('#twar-preview-status');
    const acts   = $('#twar-preview-actions');
    const Lp = _Lbl();

    if (!body) return;
    title.textContent  = `✨ ${commandLabel}`;
    status.textContent = Lp.previewGen || (_lang === 'zh' ? '生成中…' : _lang === 'ko' ? '생성 중…' : 'Generating…');
    _applyPaletteShellI18n();
    _applyPreviewBodyFromAcc(true);
    if (acts) acts.style.display = 'none';
    $('#twar-preview').classList.add('open');
  }

  function _appendChunk(chunk) {
    _accText += chunk;
    _applyPreviewBodyFromAcc(true);
  }

  function _finishPreview() {
    _lastNewText = _accText;
    const body   = $('#twar-preview-body');
    const status = $('#twar-preview-status');
    const acts   = $('#twar-preview-actions');
    const Lp = _Lbl();
    if (!body) return;
    _applyPreviewBodyFromAcc(false);
    status.textContent = Lp.previewDone || (_lang === 'zh' ? '完成 ✓' : _lang === 'ko' ? '완료 ✓' : 'Done ✓');
    if (acts) acts.style.display = 'flex';
  }

  function _closePreview() {
    const body = $('#twar-preview-body');
    _disposeReactMermaidIn(body);
    $('#twar-preview')?.classList.remove('open');
    _previewBodySeq++;
    _accText = '';
  }

  function _bindPreview() {
    _previewAc?.abort();
    _previewAc = new AbortController();
    const sig = _previewAc.signal;
    $('#twar-accept-btn').addEventListener('click', () => {
      _cb.onAccept?.(_lastNewText);
      _closePreview();
    }, { signal: sig });
    $('#twar-reject-btn').addEventListener('click', () => {
      _cb.onReject?.();
      _closePreview();
    }, { signal: sig });
    $('#twar-diff-btn').addEventListener('click', () => {
      _cb.onDiff?.(_lastNewText);
    }, { signal: sig });
  }

  // ─────────────────────────────────────────────────────────────
  //  3. DIFF VIEW
  // ─────────────────────────────────────────────────────────────
  function _openDiff(original, revised) {
    const oldEl = $('#twar-diff-old-text');
    const newEl = $('#twar-diff-new-text');
    if (!oldEl || !newEl) return;
    oldEl.innerHTML = _escHtml(original);
    newEl.innerHTML = _escHtml(revised);
    _applyPaletteShellI18n();
    $('#twar-diff').classList.add('open');
  }

  function _closeDiff() {
    $('#twar-diff')?.classList.remove('open');
  }

  function _bindDiff() {
    _diffAc?.abort();
    _diffAc = new AbortController();
    const sig = _diffAc.signal;

    $('#twar-diff-close-btn').addEventListener('click', _closeDiff, { signal: sig });
    $('#twar-diff-accept-btn').addEventListener('click', () => {
      _cb.onAccept?.(_lastNewText);
      _closeDiff();
      _closePreview();
    }, { signal: sig });
    $('#twar-diff-reject-btn').addEventListener('click', () => {
      _cb.onReject?.();
      _closeDiff();
      _closePreview();
    }, { signal: sig });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const editor = $('#twar-content-editor');
        if (editor?.classList.contains('show')) {
          _hideEditor();
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        _closeDiff();
        _closePalette({ restoreSidebar: false });
      }
    }, { capture: true, signal: sig });
  }

  // ── 工具：HTML 转义 + 换行 ────────────────────────────────────
  function _escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '<br>');
  }

  // ── 初始化 ───────────────────────────────────────────────────
  /**
   * @param {ShadowRoot|Document} shadowRootOrDoc
   * @param {Object} callbacks
   * @param {Function} callbacks.onCommand  (id) → void
   * @param {Function} callbacks.onAccept   (newText) → void
   * @param {Function} callbacks.onReject   () → void
   * @param {Function} callbacks.onDiff     (newText) → void
   */
  function init(shadowRootOrDoc, callbacks = {}) {
    _root = shadowRootOrDoc;
    _cb   = { ...callbacks };
    _root.querySelector('#twar-styles')?.remove();
    _root.querySelector('#twar-wrapper')?.remove();
    _mount();
    _bindPalette();
    _bindPreview();
    _bindDiff();
  }

  // ── 公开接口 ──────────────────────────────────────────────────
  return {
    init,

    // Palette
    openPalette(commands, lang = 'zh', selectedText = '', opts = {}) {
      _allCommands    = commands || [];
      _lang           = (() => {
        const l = String(lang || 'en').toLowerCase();
        if (l === 'zh') return 'zh';
        if (l === 'ko') return 'ko';
        return 'en';
      })();
      _paletteOpts    = opts;
      _isOfflineMode  = opts.isOfflineMode || false;
      _currentMode    = opts.mode || 'compact';

      const overlay = _root?.querySelector('#twar-overlay');
      const alreadyOpen = overlay?.classList?.contains('open');
      if (alreadyOpen) {
        _applyPaletteShellI18n();
        const input = $('#twar-palette-input');
        const q = input?.value || '';
        _selectedText = selectedText;
        const ctxStrip = $('#twar-ctx-strip');
        const ctxText = $('#twar-ctx-text');
        if (ctxStrip && ctxText) {
          if (selectedText) {
            const preview =
              selectedText.length > 60 ? selectedText.slice(0, 60) + '…' : selectedText;
            ctxText.textContent = preview;
            ctxStrip.classList.add('has-text');
          } else {
            ctxStrip.classList.remove('has-text');
          }
        }
        const prevSel = _selectedItemId;
        _renderList(q);
        const nIdx = _filteredCmds.findIndex((c) => c.id === prevSel);
        if (nIdx >= 0) {
          _activeIdx = nIdx;
          _setActive(_activeIdx, false);
        } else if (_filteredCmds.length) {
          _activeIdx = 0;
          _selectedItemId = _filteredCmds[0]?.id || null;
          _setActive(0, false);
        }
        _updateCopyButton();
        _updateRecommendation(q.trim());
        void _syncAgencyStrip();
        return;
      }

      _selectedItemId = commands?.[0]?.id || null;
      _hideEditor();  // 每次打开时先隐藏编辑区
      _applyPaletteShellI18n();
      _openPalette(selectedText);
    },
    
    // 显示编辑区（供外部调用）
    showEditor: _showEditor,
    closePalette: _closePalette,
    setPaletteCommands: _setPaletteCommands,
    refreshPaletteAgencyStrip: () => {
      void _syncAgencyStrip();
    },

    // Preview
    openPreview(label, lang = 'zh') {
      const l = String(lang || 'en').toLowerCase();
      _lang = l === 'zh' ? 'zh' : l === 'ko' ? 'ko' : 'en';
      _openPreview(label);
    },
    appendChunk:  _appendChunk,
    finishPreview: _finishPreview,
    closePreview:  _closePreview,
    getAccumulatedText() { return _accText; },

    // 快速模式编辑区「问 AI」流式 UI（供 TwAiRewrite 驱动）
    beginEditorAiStream: _beginEditorAiStream,
    appendEditorAiChunk: _appendEditorAiChunk,
    completeEditorAiStream: _completeEditorAiStream,
    setEditorAskBusy: _setEditorAskBusy,
    showEditorAiError: _showEditorAiError,

    getEditorContext() {
      return { itemId: _selectedItemId, title: _selectedEditorTitle || '' };
    },
    renderEditorChatTranscript: _renderEditorChatTranscript,

    // Diff
    openDiff:  _openDiff,
    closeDiff: _closeDiff,
  };
})();

// 挂载到 window，供其他模块调用
window.TwRenderLayer = TwRenderLayer;
