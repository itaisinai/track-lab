import {
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { View } from "../../types";
import {
  getPathForView,
  getRouteFromPath,
  updateHistory,
  type AppRoute,
} from "./routes";

type UseAppRoutingOptions = {
  setCurrentReviewJobId: Dispatch<SetStateAction<number | null>>;
  setShowSearchForm: Dispatch<SetStateAction<boolean>>;
  loadSavedResults: () => Promise<void>;
  openJobFromRoute: (jobId: number) => Promise<void>;
  openRemixJobFromRoute: (jobId: number) => void;
  refreshAllJobs: () => Promise<void>;
  refreshReviewJobs: () => Promise<void>;
};

export function useAppRouting({
  setCurrentReviewJobId,
  setShowSearchForm,
  loadSavedResults,
  openJobFromRoute,
  openRemixJobFromRoute,
  refreshAllJobs,
  refreshReviewJobs,
}: UseAppRoutingOptions) {
  const initialRoute = getRouteFromPath(window.location.pathname);
  const [view, setView] = useState<View>(initialRoute.view);
  const [remixJobId, setRemixJobId] = useState<number | null>(
    initialRoute.view === "remix-search" ? initialRoute.jobId ?? null : null,
  );

  useEffect(() => {
    void applyRoute(getRouteFromPath(window.location.pathname), {
      replace: true,
    });

    function handlePopState() {
      void applyRoute(getRouteFromPath(window.location.pathname), {
        replace: true,
      });
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  async function applyRoute(
    route: AppRoute,
    options: { replace?: boolean } = {},
  ) {
    if (route.path !== window.location.pathname) {
      updateHistory(route.path, options.replace ?? false);
    }

    setView(route.view);
    setRemixJobId(
      route.view === "remix-search" ? route.jobId ?? null : null,
    );

    if (route.view === "enrich" && !route.jobId) {
      setShowSearchForm(true);
      setCurrentReviewJobId(null);
      return;
    }

    if (route.view === "results") {
      await loadSavedResults();
      return;
    }

    if (route.view === "remix-search") {
      if (route.jobId) {
        openRemixJobFromRoute(route.jobId);
      }

      return;
    }

    if (route.view === "review") {
      await refreshReviewJobs();
      return;
    }

    if (route.view === "datastore") {
      await Promise.all([refreshAllJobs(), loadSavedResults()]);
      return;
    }

    if (route.jobId) {
      await openJobFromRoute(route.jobId);
    }
  }

  function navigateToView(nextView: View, options: { replace?: boolean } = {}) {
    setView(nextView);
    setRemixJobId(null);
    updateHistory(getPathForView(nextView), options.replace ?? false);
  }

  function navigateToJob(jobId: number) {
    updateHistory(`/review/jobs/${jobId}`, false);
  }

  function navigateToRemixJob(jobId: number) {
    setView("remix-search");
    setRemixJobId(jobId);
    updateHistory(`/remix-search/jobs/${jobId}`, false);
  }

  return {
    navigateToJob,
    navigateToRemixJob,
    navigateToView,
    remixJobId,
    setView,
    view,
  };
}
