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
  refreshAllJobs: () => Promise<void>;
  refreshReviewJobs: () => Promise<void>;
};

export function useAppRouting({
  setCurrentReviewJobId,
  setShowSearchForm,
  loadSavedResults,
  openJobFromRoute,
  refreshAllJobs,
  refreshReviewJobs,
}: UseAppRoutingOptions) {
  const initialRoute = getRouteFromPath(window.location.pathname);
  const [view, setView] = useState<View>(initialRoute.view);

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

    if (route.view === "enrich" && !route.jobId) {
      setShowSearchForm(true);
      setCurrentReviewJobId(null);
      return;
    }

    if (route.view === "results") {
      await loadSavedResults();
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
    updateHistory(getPathForView(nextView), options.replace ?? false);
  }

  function navigateToJob(jobId: number) {
    updateHistory(`/review/jobs/${jobId}`, false);
  }

  return {
    navigateToJob,
    navigateToView,
    setView,
    view,
  };
}
