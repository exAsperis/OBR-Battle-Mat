import OBR from "@owlbear-rodeo/sdk";
import { useEffect } from "react";

export const MIN_ACTION_HEIGHT = 160;

export function contentHeight(element: HTMLElement): number {
  const measured = Math.ceil(element.getBoundingClientRect().height);
  return Math.max(MIN_ACTION_HEIGHT, measured);
}

export function useActionHeight(): void {
  useEffect(() => {
    let active = true;
    let observer: ResizeObserver | undefined;
    let frame: number | undefined;
    let lastHeight: number | undefined;

    const scheduleResize = () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = undefined;
        const root = document.getElementById("root");
        if (!active || !root) return;
        const height = contentHeight(root);
        if (height === lastHeight) return;
        lastHeight = height;
        void OBR.action.setHeight(height).catch(() => { lastHeight = undefined; });
      });
    };

    OBR.onReady(() => {
      if (!active) return;
      const root = document.getElementById("root");
      if (!root) return;
      observer = new ResizeObserver(scheduleResize);
      observer.observe(root);
      scheduleResize();
    });

    return () => {
      active = false;
      observer?.disconnect();
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, []);
}
