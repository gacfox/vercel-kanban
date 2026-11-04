"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const START_DELAY_MS = 120;
const FADE_DURATION_MS = 200;
const MIN_VISIBLE_MS = 300;
const HOLD_AT_FULL_MS = 120;
const MAX_PROGRESS = 0.92;
const SAFETY_TIMEOUT_MS = 15_000;
const TRICKLE_INTERVAL_MS = 400;

type TimerRef = { current: number | null };

type NavigationProgressContextValue = {
  start: () => void;
  finish: () => void;
};

const NavigationProgressContext =
  React.createContext<NavigationProgressContextValue | null>(null);

function clearTimer(ref: TimerRef) {
  if (ref.current !== null) {
    window.clearTimeout(ref.current);
    ref.current = null;
  }
}

function clearIntervalTimer(ref: TimerRef) {
  if (ref.current !== null) {
    window.clearInterval(ref.current);
    ref.current = null;
  }
}

export function NavigationProgressProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [visible, setVisible] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  const activeRef = React.useRef(false);
  const visibleRef = React.useRef(false);
  const visibleSinceRef = React.useRef(0);

  const startTimerRef = React.useRef<number | null>(null);
  const trickleTimerRef = React.useRef<number | null>(null);
  const finishTimerRef = React.useRef<number | null>(null);
  const fadeTimerRef = React.useRef<number | null>(null);
  const safetyTimerRef = React.useRef<number | null>(null);

  const setBarVisible = React.useCallback((next: boolean) => {
    visibleRef.current = next;
    setVisible(next);
  }, []);

  const stopTrickle = React.useCallback(() => {
    clearIntervalTimer(trickleTimerRef);
  }, []);

  const finish = React.useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;

    clearTimer(startTimerRef);
    stopTrickle();
    clearTimer(safetyTimerRef);

    if (!visibleRef.current) {
      setProgress(0);
      return;
    }

    const elapsed = Date.now() - visibleSinceRef.current;
    const hold = Math.max(HOLD_AT_FULL_MS, MIN_VISIBLE_MS - elapsed);

    setProgress(1);
    finishTimerRef.current = window.setTimeout(() => {
      finishTimerRef.current = null;
      setBarVisible(false);
      fadeTimerRef.current = window.setTimeout(() => {
        fadeTimerRef.current = null;
        setProgress(0);
      }, FADE_DURATION_MS);
    }, hold);
  }, [setBarVisible, stopTrickle]);

  const start = React.useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;

    clearTimer(finishTimerRef);
    clearTimer(fadeTimerRef);
    clearTimer(safetyTimerRef);

    if (visibleRef.current) {
      setProgress(0.08);
    } else {
      setProgress(0);
    }

    startTimerRef.current = window.setTimeout(() => {
      startTimerRef.current = null;
      if (!activeRef.current) return;

      if (!visibleRef.current) {
        visibleSinceRef.current = Date.now();
        setBarVisible(true);
      }

      setProgress((current) => (current < 0.08 ? 0.08 : current));

      requestAnimationFrame(() => {
        if (activeRef.current) setProgress(0.3);
      });

      trickleTimerRef.current = window.setInterval(() => {
        setProgress((current) =>
          current >= MAX_PROGRESS
            ? current
            : current + (MAX_PROGRESS - current) * 0.12
        );
      }, TRICKLE_INTERVAL_MS);

      safetyTimerRef.current = window.setTimeout(finish, SAFETY_TIMEOUT_MS);
    }, START_DELAY_MS);
  }, [finish, setBarVisible]);

  React.useEffect(() => {
    return () => {
      activeRef.current = false;
      clearTimer(startTimerRef);
      clearIntervalTimer(trickleTimerRef);
      clearTimer(finishTimerRef);
      clearTimer(fadeTimerRef);
      clearTimer(safetyTimerRef);
    };
  }, []);

  React.useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.rel.split(" ").includes("external")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;

      const current = new URL(window.location.href);
      if (
        url.pathname === current.pathname &&
        url.search === current.search
      ) {
        return;
      }

      start();
    }

    function handlePopState() {
      start();
    }

    document.addEventListener("click", handleClick);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleClick);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [start]);

  const contextValue = React.useMemo(
    () => ({ start, finish }),
    [start, finish]
  );

  return (
    <NavigationProgressContext.Provider value={contextValue}>
      {children}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-[3px] overflow-hidden"
      >
        <div
          className={cn(
            "h-full origin-left bg-primary shadow-[0_0_8px_var(--primary)] transition-[transform,opacity] duration-200 ease-out will-change-transform motion-reduce:transition-none",
            visible ? "opacity-100" : "opacity-0"
          )}
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
    </NavigationProgressContext.Provider>
  );
}

/**
 * 监听 URL 变化，在导航提交后结束进度条。
 * useSearchParams 需要 Suspense，因此单独放在根布局的 Suspense 边界内。
 */
export function NavigationProgressCompletion() {
  const { finish } = useNavigationProgress();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const key = `${pathname}?${searchParams.toString()}`;
  const previousKeyRef = React.useRef(key);

  React.useEffect(() => {
    if (previousKeyRef.current === key) return;
    previousKeyRef.current = key;
    finish();
  }, [key, finish]);

  return null;
}

export function useNavigationProgress() {
  const context = React.useContext(NavigationProgressContext);
  if (!context) {
    throw new Error(
      "useNavigationProgress 必须在 NavigationProgressProvider 内使用"
    );
  }
  return context;
}
