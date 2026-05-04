// ─────────────────────────────────────────────────────────────
//  TalkwebSour · insertTextToTarget
//
//  通用文本注入工具。兼容：
//    • textarea / input（含 React / Vue 受控组件）
//    • contenteditable（含 ChatGPT、Claude、Notion 等）
//
//  mode:
//    'replaceAll'       – 替换全部内容
//    'replaceSelection' – 替换当前选区（无选区 → 等同 insertCursor）
//    'insertCursor'     – 在光标位置插入，不影响其他内容
//
//  暴露：window.insertTextToTarget
// ─────────────────────────────────────────────────────────────

(function (global) {
  'use strict';

  // ══════════════════════════════════════════════════════════════
  //  内部工具
  // ══════════════════════════════════════════════════════════════

  /**
   * 取出某构造函数原型上属性的原生 setter。
   * 用于绕过 React/Vue 劫持 .value 的问题。
   */
  function _nativeSetter(Constructor, prop) {
    const desc = Object.getOwnPropertyDescriptor(Constructor.prototype, prop);
    return desc && desc.set;
  }

  // 缓存一次，避免每次调用都查找
  const _inputSetter    = _nativeSetter(HTMLInputElement,    'value');
  const _textareaSetter = _nativeSetter(HTMLTextAreaElement, 'value');

  /**
   * 用原生 setter 设置 value（绕过框架劫持），再触发合成事件链。
   * React 需要 InputEvent 而不仅仅是 Event，才能触发 onChange。
   */
  function _setNativeValue(el, value) {
    const setter = el.tagName === 'TEXTAREA' ? _textareaSetter : _inputSetter;
    if (setter) {
      setter.call(el, value);
    } else {
      el.value = value;
    }
    // 同时触发 input + change，兼容 React/Vue/原生
    el.dispatchEvent(new InputEvent('input',  { bubbles: true, cancelable: true }));
    el.dispatchEvent(new Event('change',      { bubbles: true, cancelable: true }));
  }

  /**
   * 将光标设置到指定位置，并触发 selectionchange 让框架感知。
   */
  function _setCursor(el, pos) {
    try {
      el.setSelectionRange(pos, pos);
      el.dispatchEvent(new Event('select', { bubbles: true }));
    } catch {
      // readonly 等场景静默忽略
    }
  }


  // ══════════════════════════════════════════════════════════════
  //  分支 A：textarea / input
  // ══════════════════════════════════════════════════════════════

  function _handleInput(el, text, mode) {
    // 确保焦点在目标元素（不丢失焦点到文档外）
    if (document.activeElement !== el) el.focus({ preventScroll: true });

    const oldVal = el.value;
    const ss     = el.selectionStart ?? 0;
    const se     = el.selectionEnd   ?? oldVal.length;

    let newVal, cursorPos;

    switch (mode) {
      case 'replaceAll':
        newVal    = text;
        cursorPos = text.length;
        break;

      case 'replaceSelection':
        // 无选区时等同 insertCursor
        if (ss === se) {
          newVal    = oldVal.slice(0, ss) + text + oldVal.slice(ss);
          cursorPos = ss + text.length;
        } else {
          newVal    = oldVal.slice(0, ss) + text + oldVal.slice(se);
          cursorPos = ss + text.length;
        }
        break;

      case 'insertCursor':
      default:
        newVal    = oldVal.slice(0, ss) + text + oldVal.slice(ss);
        cursorPos = ss + text.length;
        break;
    }

    _setNativeValue(el, newVal);
    _setCursor(el, cursorPos);
  }


  // ══════════════════════════════════════════════════════════════
  //  分支 B：contenteditable
  //  策略：优先 document.execCommand（保留 undo 历史），
  //        退而使用 Range API + 手动触发 InputEvent
  // ══════════════════════════════════════════════════════════════

  /** 确保 el 获得焦点，光标落在末尾（仅当当前无选区时兜底）*/
  function _focusContentEditable(el) {
    if (document.activeElement !== el) {
      el.focus({ preventScroll: true });
      // 把光标移到内容末尾
      const sel   = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  /**
   * 通过 execCommand('insertText') 注入文本。
   * 优点：浏览器原生维护 undo 栈，ChatGPT/Notion 等都能正确响应。
   * 缺点：已被 W3C 标记为 deprecated，但 Chrome/Edge 至今仍支持。
   */
  function _execInsert(text) {
    return document.execCommand('insertText', false, text);
  }

  /**
   * 通过 Range API 注入文本节点（execCommand 失败时的后备方案）。
   * 手动派发 InputEvent 触发框架更新。
   */
  function _rangeInsert(el, text) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    range.deleteContents();

    const node = document.createTextNode(text);
    range.insertNode(node);

    // 光标移到插入文本末尾
    range.setStartAfter(node);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    // 手动触发 input 事件（React 等框架监听这个来同步状态）
    el.dispatchEvent(new InputEvent('input', {
      bubbles:      true,
      cancelable:   true,
      inputType:    'insertText',
      data:         text,
    }));
  }

  /**
   * replaceAll for contenteditable：清空内容后整体插入。
   * 针对不同框架有不同的空白处理逻辑。
   */
  function _replaceAllContentEditable(el, text) {
    el.focus({ preventScroll: true });

    // 1. 全选
    document.execCommand('selectAll', false, null);

    // 2. 尝试 execCommand 整体替换
    const ok = _execInsert(text);
    if (ok) return;

    // 3. 后备：直接清空 innerHTML，再插入纯文本节点
    //    保留换行（\n → <br>）
    el.innerHTML = '';
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      el.appendChild(document.createTextNode(line));
      if (i < lines.length - 1) el.appendChild(document.createElement('br'));
    });

    // 光标移到末尾
    const sel   = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);

    el.dispatchEvent(new InputEvent('input', {
      bubbles: true, cancelable: true, inputType: 'insertText', data: text,
    }));
  }

  function _handleContentEditable(el, text, mode) {
    _focusContentEditable(el);

    switch (mode) {
      case 'replaceAll':
        _replaceAllContentEditable(el, text);
        break;

      case 'replaceSelection': {
        const sel = window.getSelection();
        // 有选区 → 先删除再插入；无选区 → 等同 insertCursor
        if (sel && !sel.isCollapsed) {
          const ok = _execInsert(text);
          if (!ok) _rangeInsert(el, text);
        } else {
          // 无选区：在光标位置插入
          const ok = _execInsert(text);
          if (!ok) _rangeInsert(el, text);
        }
        break;
      }

      case 'insertCursor':
      default: {
        // 不改变选区，直接在光标处插入
        const ok = _execInsert(text);
        if (!ok) _rangeInsert(el, text);
        break;
      }
    }
  }


  // ══════════════════════════════════════════════════════════════
  //  ChatGPT 专项适配
  //  ChatGPT (2024~) 使用 ProseMirror contenteditable，
  //  execCommand 不会触发其内部状态更新，
  //  需要额外派发 keydown (Enter) 才能让"发送按钮"激活。
  //  但插入文本本身用 execCommand + InputEvent 组合即可。
  // ══════════════════════════════════════════════════════════════

  /** 检测是否是 ChatGPT / Claude 类 ProseMirror 编辑器 */
  function _isProseMirror(el) {
    return (
      el.classList.contains('ProseMirror') ||
      el.closest?.('[class*="ProseMirror"]') !== null ||
      el.getAttribute?.('data-testid') === 'conversation-turn-content'
    );
  }

  /**
   * ChatGPT 专用注入：
   * 1. 用 execCommand 写入文本（触发 ProseMirror 的 MutationObserver）
   * 2. 派发 InputEvent 确保 React 状态同步
   * 3. 派发 compositionend（某些 ChatGPT 版本需要）
   */
  function _handleChatGPT(el, text, mode) {
    _focusContentEditable(el);

    if (mode === 'replaceAll') {
      document.execCommand('selectAll', false, null);
    } else if (mode === 'replaceSelection') {
      // 保留已有选区
    }
    // insertCursor: 什么都不做，光标已在正确位置

    // Step 1: execCommand 写入
    const ok = document.execCommand('insertText', false, text);

    if (!ok) {
      // Step 2: Range 后备
      _rangeInsert(el, text);
    }

    // Step 3: 触发 composition 事件链（部分 ProseMirror 版本需要）
    el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
    el.dispatchEvent(new CompositionEvent('compositionend',   { bubbles: true, data: text }));
    el.dispatchEvent(new InputEvent('input', {
      bubbles: true, cancelable: true, inputType: 'insertText', data: text,
    }));
  }


  // ══════════════════════════════════════════════════════════════
  //  主函数
  // ══════════════════════════════════════════════════════════════

  /**
   * 将文本注入目标元素。
   *
   * @param {HTMLElement|null} target
   *   注入目标。传 null 时自动使用 document.activeElement。
   *
   * @param {string} text
   *   要注入的文本内容。
   *
   * @param {'replaceAll'|'replaceSelection'|'insertCursor'} [mode='replaceSelection']
   *   注入模式。
   *
   * @returns {'input'|'contenteditable'|'clipboard'|'none'}
   *   实际使用的注入方式，便于调用方记录或 fallback。
   */
  /** SPA（如 ChatGPT 新对话）会卸载旧输入框，需在主页面重新定位 composer */
  function _findLikelyPageComposer() {
    const sels = [
      '#prompt-textarea',
      '[data-testid="composer-text-input"]',
      'textarea[data-testid="prompt-textarea"]',
      'div.ProseMirror[contenteditable="true"]',
    ];
    for (const sel of sels) {
      try {
        const n = document.querySelector(sel);
        if (!n || !n.isConnected) continue;
        const tag = n.tagName?.toUpperCase();
        if (tag === 'TEXTAREA' || tag === 'INPUT') return n;
        if (n.isContentEditable || n.contentEditable === 'true') return n;
      } catch {
        // ignore invalid selector in old browsers
      }
    }
    return null;
  }

  function insertTextToTarget(target, text, mode = 'replaceSelection') {
    let el = target;
    if (el && !el.isConnected) el = null;
    if (!el) el = document.activeElement;
    if (el && !el.isConnected) el = null;
    if (!el || el === document.body || el === document.documentElement) {
      el = _findLikelyPageComposer();
    }

    // 无任何可用目标
    if (!el || el === document.body || el === document.documentElement) {
      _fallbackClipboard(text);
      return 'clipboard';
    }

    const tag = el.tagName?.toUpperCase();

    // ── 分支 A：textarea / input ──────────────────────────────
    if (tag === 'TEXTAREA' || tag === 'INPUT') {
      // input[type=file] 等不可写类型直接跳过
      const inputType = el.type?.toLowerCase() ?? '';
      const blocked   = ['file', 'checkbox', 'radio', 'range', 'color', 'button', 'submit', 'reset', 'image'];
      if (blocked.includes(inputType)) {
        _fallbackClipboard(text);
        return 'clipboard';
      }
      _handleInput(el, text, mode);
      return 'input';
    }

    // ── 分支 B：contenteditable ───────────────────────────────
    if (el.isContentEditable || el.contentEditable === 'true') {
      if (_isProseMirror(el)) {
        _handleChatGPT(el, text, mode);
      } else {
        _handleContentEditable(el, text, mode);
      }
      return 'contenteditable';
    }

    // ── 分支 C：都不满足 → 剪贴板兜底 ───────────────────────
    _fallbackClipboard(text);
    return 'clipboard';
  }

  /** 剪贴板兜底 */
  function _fallbackClipboard(text) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => _legacyCopy(text));
    } else {
      _legacyCopy(text);
    }
  }

  /** 非 HTTPS 环境的旧式剪贴板写入 */
  function _legacyCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch {}
    document.body.removeChild(ta);
  }


  // ══════════════════════════════════════════════════════════════
  //  便捷工厂（可选，方便链式调用）
  // ══════════════════════════════════════════════════════════════
  insertTextToTarget.replaceAll = (target, text) =>
    insertTextToTarget(target, text, 'replaceAll');

  insertTextToTarget.replaceSelection = (target, text) =>
    insertTextToTarget(target, text, 'replaceSelection');

  insertTextToTarget.insertCursor = (target, text) =>
    insertTextToTarget(target, text, 'insertCursor');


  // ══════════════════════════════════════════════════════════════
  //  导出
  // ══════════════════════════════════════════════════════════════
  global.insertTextToTarget = insertTextToTarget;

  // CommonJS / ES Module 兼容（如果有 bundler 的话）
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = insertTextToTarget;
  }

})(typeof globalThis !== 'undefined' ? globalThis : window);
