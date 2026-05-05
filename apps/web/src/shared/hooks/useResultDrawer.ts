import { useState } from "react";
import type { SavedTrackResult } from "../../types";

export type DrawerState = "opening" | "open" | "closing";

export function useResultDrawer() {
  const [selectedResult, setSelectedResult] = useState<SavedTrackResult | null>(
    null,
  );
  const [drawerState, setDrawerState] = useState<DrawerState>("opening");

  function openDrawer(result: SavedTrackResult) {
    setDrawerState("opening");
    setSelectedResult(result);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setDrawerState("open");
      });
    });
  }

  function closeDrawer() {
    if (!selectedResult || drawerState === "closing") {
      return;
    }

    setDrawerState("closing");
    window.setTimeout(() => {
      setSelectedResult(null);
      setDrawerState("opening");
    }, 260);
  }

  return {
    closeDrawer,
    drawerState,
    openDrawer,
    selectedResult,
  };
}
