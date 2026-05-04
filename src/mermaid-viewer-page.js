/**
 * 全屏 Mermaid 查看页：从 chrome.storage.session 读取一次性 payload 后挂载编辑器。
 */
(function () {
  const key = decodeURIComponent(String(location.hash || "").replace(/^#/, ""));
  const host = document.getElementById("tw-mv-host");
  if (!key || !host) {
    document.body.innerHTML = "<p style=\"padding:16px;color:#c00\">Invalid viewer URL.</p>";
    return;
  }

  function fail(msg) {
    host.textContent = msg;
  }

  if (!chrome.storage?.session) {
    fail("chrome.storage.session unavailable");
    return;
  }

  chrome.storage.session.get(key, (bag) => {
    const err = chrome.runtime.lastError;
    if (err) {
      fail(String(err.message || err));
      return;
    }
    const data = bag[key];
    chrome.storage.session.remove(key);
    if (!data || typeof data.code !== "string") {
      fail("No diagram data (expired or invalid key).");
      return;
    }
    if (!window.TwMermaidEditor || typeof window.TwMermaidEditor.mount !== "function") {
      fail("TwMermaidEditor bundle not loaded.");
      return;
    }
    const lang = data.lang === "ko" || data.lang === "en" ? data.lang : "zh";
    const mode = data.mode === "edit" || data.mode === "drag" || data.mode === "view" ? data.mode : "view";
    try {
      window.TwMermaidEditor.mount(host, {
        code: data.code,
        uiLang: lang,
        initialMode: mode,
        layoutVariant: "fullscreen",
        onDelete: () => {
          try {
            window.close();
          } catch (_) {}
        },
      });
    } catch (e) {
      fail(String(e && e.message ? e.message : e));
    }
  });
})();
