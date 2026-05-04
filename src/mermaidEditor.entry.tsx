import { createRoot, type Root } from "react-dom/client";
import { MermaidBlock } from "./components/MermaidBlock";

const roots = new Map<HTMLElement, Root>();

export type TwMermaidMountOpts = {
  code: string;
  onDelete?: () => void;
  uiLang?: string;
  initialMode?: "view" | "edit" | "drag";
  layoutVariant?: "embedded" | "fullscreen";
};

function ensureReactFlowCss(root: Document | ShadowRoot) {
  const target = root instanceof ShadowRoot ? root : document.head;
  if (target.querySelector("link[data-tw-rf-css]")) return;
  const href =
    typeof chrome !== "undefined" && chrome.runtime?.getURL
      ? chrome.runtime.getURL("src/utils/reactflow.bundle.css")
      : "";
  if (!href) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.twRfCss = "1";
  target.appendChild(link);
}

function mount(host: HTMLElement, opts: TwMermaidMountOpts) {
  const rn = host.getRootNode();
  if (rn instanceof ShadowRoot || rn instanceof Document) {
    ensureReactFlowCss(rn);
  }
  host.dataset.twReactRoot = "1";
  let r = roots.get(host);
  if (!r) {
    r = createRoot(host);
    roots.set(host, r);
  }
  r.render(
    <MermaidBlock
      initialCode={opts.code}
      onDelete={opts.onDelete}
      uiLang={opts.uiLang}
      initialMode={opts.initialMode}
      layoutVariant={opts.layoutVariant ?? "embedded"}
    />,
  );
}

function unmount(host: HTMLElement) {
  const r = roots.get(host);
  if (r) {
    try {
      r.unmount();
    } catch (_) {
      /* ignore */
    }
    roots.delete(host);
  }
  delete host.dataset.twReactRoot;
}

declare global {
  interface Window {
    TwMermaidEditor?: { mount: typeof mount; unmount: typeof unmount };
  }
}

window.TwMermaidEditor = { mount, unmount };
