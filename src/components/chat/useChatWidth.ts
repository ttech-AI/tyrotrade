import * as React from "react";

// Shared drag-to-resize width for the TYRO chat surfaces (the mobile Sheet
// drawer and the desktop inline panel). Both use this hook so a width set on
// one persists to the other via the same localStorage key.
const MIN_WIDTH = 380;
const MAX_WIDTH = 900;
export const DEFAULT_CHAT_WIDTH = 460;
const STORAGE_KEY = "tyro:chat:width";

function clampWidth(w: number): number {
  // Never let the panel cover the whole viewport, even on small screens.
  const vwCap = typeof window !== "undefined" ? window.innerWidth * 0.95 : MAX_WIDTH;
  return Math.max(MIN_WIDTH, Math.min(w, MAX_WIDTH, vwCap));
}

export interface ChatWidth {
  width: number;
  reset: () => void;
  /** Attach to a left-edge handle's `onPointerDown`. */
  startResize: (e: React.PointerEvent) => void;
  /** True while a drag is in progress — use to suppress width transitions. */
  dragging: boolean;
}

export function useChatWidth(): ChatWidth {
  const [width, setWidth] = React.useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_CHAT_WIDTH;
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    return saved && !Number.isNaN(saved) ? clampWidth(saved) : DEFAULT_CHAT_WIDTH;
  });
  const [dragging, setDragging] = React.useState(false);
  const draggingRef = React.useRef(false);

  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(Math.round(width)));
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, [width]);

  const reset = React.useCallback(() => setWidth(DEFAULT_CHAT_WIDTH), []);

  const startResize = React.useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    setDragging(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    const onMove = (ev: PointerEvent) => {
      if (!draggingRef.current) return;
      // Both surfaces are right-anchored: width grows as the pointer moves left.
      setWidth(clampWidth(window.innerWidth - ev.clientX));
    };
    const onUp = () => {
      draggingRef.current = false;
      setDragging(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  return { width, reset, startResize, dragging };
}
