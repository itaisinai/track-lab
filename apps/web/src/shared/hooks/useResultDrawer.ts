import { useCallback, useState } from "react";

export type DrawerState = "opening" | "open" | "closing";

export function useResultDrawer<T>() {
  const [selectedResult, setSelectedResult] = useState<T | null>(null);
  const [drawerState, setDrawerState] = useState<DrawerState>("opening");

  const openDrawer = useCallback((result: T) => {
    setDrawerState("opening");
    setSelectedResult(result);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setDrawerState("open");
      });
    });
  }, []);

  const closeDrawer = useCallback(() => {
    if (!selectedResult || drawerState === "closing") {
      return;
    }

    setDrawerState("closing");
    window.setTimeout(() => {
      setSelectedResult(null);
      setDrawerState("opening");
    }, 260);
  }, [drawerState, selectedResult]);

  return {
    closeDrawer,
    drawerState,
    openDrawer,
    selectedResult,
  };
}
