// ─────────────────────────────────────────────────────────────
//  TalkwebSour · AI Rewrite · Layer 1: Trigger
//  职责：
//    - 监听快捷键，决定触发模式
//    - 监听选中文本，缓存最新值
//  对外接口：TwTriggerLayer.init(callbacks)
//  对内依赖：无（纯事件层）
// ─────────────────────────────────────────────────────────────

const TwTriggerLayer = (() => {
  'use strict';

  // ── 内部状态 ──────────────────────────────────────────────────
  let _selectedText   = '';
  let _lastInputFocus = null;   // 最后一次聚焦的可编辑元素（用于侧边栏按钮触发时写回）
  let _cb = {
    // onTrigger(text: string, mode: 'palette' | 'rewrite') → void
    onTrigger: null,
    // onSelect(text: string) → void  （每次选区变化）
    onSelect: null,
  };

  // ── 读取当前选区文本 ──────────────────────────────────────────
  // 同时兼容普通 DOM 和 Shadow DOM 内部的选区
  function _readSelection() {
    try {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return '';
      return sel.toString().trim();
    } catch {
      return '';
    }
  }

  // ── 选区监听器 ────────────────────────────────────────────────
  function _bindSelectionWatcher(signal) {
    document.addEventListener('mouseup', () => {
      const text = _readSelection();
      if (text === _selectedText) return; // 没变化不触发
      _selectedText = text;
      if (text && _cb.onSelect) _cb.onSelect(text);
    }, { signal });

    document.addEventListener('selectionchange', () => {
      _selectedText = _readSelection();
    }, { signal });
  }

  // ── 跟踪最后聚焦的可编辑元素 ────────────────────────────────
  function _bindInputFocusTracker(signal) {
    document.addEventListener('focusin', (e) => {
      const el  = e.target;
      const tag = el?.tagName?.toUpperCase();
      if (
        tag === 'TEXTAREA' ||
        (tag === 'INPUT' && !['file','checkbox','radio','range','color','button','submit','reset'].includes(el.type?.toLowerCase())) ||
        el.isContentEditable ||
        el.contentEditable === 'true'
      ) {
        _lastInputFocus = el;
      }
    }, { capture: true, signal });
  }

  // ── 快捷键监听器 ──────────────────────────────────────────────
  const DEFAULT_HOTKEYS = {
    // 注意：这里的匹配以 `e.code` 为准（而不是 e.key），更稳定。
    mac: {
      palette:   { code: 'Slash',  key: '/', modifiers: { meta: true,  ctrl: false, alt: false, shift: true } },
      rewrite:   { code: 'KeyR',    key: 'R', modifiers: { meta: false, ctrl: false, alt: true,  shift: true } },
      shorten:   { code: 'KeyS',    key: 'S', modifiers: { meta: false, ctrl: false, alt: true,  shift: true } },
      translate: { code: 'KeyT',    key: 'T', modifiers: { meta: false, ctrl: false, alt: true,  shift: true } },
    },
    win: {
      palette:   { code: 'Slash',  key: '/', modifiers: { meta: false, ctrl: true,  alt: false, shift: true } },
      rewrite:   { code: 'KeyR',    key: 'R', modifiers: { meta: false, ctrl: true,  alt: false, shift: true } },
      shorten:   { code: 'KeyS',    key: 'S', modifiers: { meta: false, ctrl: true,  alt: false, shift: true } },
      translate: { code: 'KeyT',    key: 'T', modifiers: { meta: false, ctrl: true,  alt: false, shift: true } },
    },
  };

  // getHotkeys(): () => state.hotkeys
  let _getHotkeys = null;
  let _isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent || '');

  /** 重复 init（如语言切换重建 shadow）时先移除旧监听 */
  let _layerAc = null;

  function _modsMatch(e, mods) {
    // 只检查 mods 中为 true 的条件（更宽容，避免用户多按了一个无关修饰键就失效）
    if (mods?.meta && !e.metaKey) return false;
    if (mods?.ctrl && !e.ctrlKey) return false;
    if (mods?.alt && !e.altKey) return false;
    if (mods?.shift && !e.shiftKey) return false;
    return true;
  }

  function _matchHotkey(e, cfg) {
    if (!cfg?.code) return false;
    return e.code === cfg.code && _modsMatch(e, cfg.modifiers);
  }

  function _bindHotkeys(signal) {
    document.addEventListener('keydown', (e) => {
      // UI 捕获“新快捷键组合”时，暂时禁用触发，避免互相干扰
      if (window.__TW_HOTKEY_CAPTURING) return;

      const hotkeys = (_getHotkeys ? _getHotkeys() : null) || DEFAULT_HOTKEYS;
      const platformHotkeys = _isMac ? hotkeys.mac : hotkeys.win;

      const actionList = ['palette', 'rewrite', 'shorten', 'translate'];
      for (const action of actionList) {
        if (_matchHotkey(e, platformHotkeys?.[action])) {
          e.preventDefault();
          e.stopPropagation();
          if (_cb.onTrigger) {
            _cb.onTrigger(_selectedText, action);
          }
          return;
        }
      }
    }, { capture: true, signal }); // capture=true 确保比页面自身的监听器先执行
  }

  // ── 公开接口 ──────────────────────────────────────────────────

  /**
   * 初始化 Trigger 层。
   * @param {Object} callbacks
   * @param {Function} callbacks.onTrigger   (text, mode) → void
   * @param {Function} [callbacks.onSelect]  (text) → void
   */
  function init(callbacks = {}) {
    _layerAc?.abort();
    _layerAc = new AbortController();
    const sig = _layerAc.signal;
    _cb = { ...callbacks };
    _getHotkeys = callbacks.getHotkeys || null;
    _bindInputFocusTracker(sig);
    _bindSelectionWatcher(sig);
    _bindHotkeys(sig);
  }

  /** 手动获取当前缓存的选中文本（供入口层随时读取） */
  function getSelectedText() {
    return _selectedText;
  }

  /** 手动更新选中文本（供入口层在编辑框场景下覆盖） */
  function setSelectedText(text) {
    _selectedText = text;
  }

  /** 获取页面上最后一次聚焦的可编辑元素（用于侧边栏按钮触发时写回） */
  function getLastInputFocus() {
    if (_lastInputFocus && !_lastInputFocus.isConnected) _lastInputFocus = null;
    return _lastInputFocus;
  }

  return { init, getSelectedText, setSelectedText, getLastInputFocus };
})();

// 挂载到 window，供其他模块调用
window.TwTriggerLayer = TwTriggerLayer;
