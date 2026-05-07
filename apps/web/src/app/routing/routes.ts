import type { View } from "../../types";

export type AppRoute = {
  view: View;
  path: string;
  jobId?: number;
};

export function getRouteFromPath(pathname: string): AppRoute {
  const normalizedPath = normalizePath(pathname);
  const reviewJobMatch = normalizedPath.match(/^\/review\/jobs\/(\d+)$/);
  const remixJobMatch = normalizedPath.match(/^\/remix-search\/jobs\/(\d+)$/);

  if (reviewJobMatch) {
    return {
      view: "enrich",
      path: normalizedPath,
      jobId: Number(reviewJobMatch[1]),
    };
  }

  if (remixJobMatch) {
    return {
      view: "remix-search",
      path: normalizedPath,
      jobId: Number(remixJobMatch[1]),
    };
  }

  if (normalizedPath === "/results") {
    return { view: "results", path: normalizedPath };
  }

  if (normalizedPath === "/remix-search") {
    return { view: "remix-search", path: normalizedPath };
  }

  if (normalizedPath === "/saved-remixes") {
    return { view: "saved-remixes", path: normalizedPath };
  }

  if (normalizedPath === "/review") {
    return { view: "review", path: normalizedPath };
  }

  if (normalizedPath === "/datastore") {
    return { view: "datastore", path: normalizedPath };
  }

  return { view: "enrich", path: "/analyze" };
}

export function getPathForView(view: View) {
  if (view === "results") {
    return "/results";
  }

  if (view === "remix-search") {
    return "/remix-search";
  }

  if (view === "saved-remixes") {
    return "/saved-remixes";
  }

  if (view === "review") {
    return "/review";
  }

  if (view === "datastore") {
    return "/datastore";
  }

  return "/analyze";
}

export function updateHistory(path: string, replace: boolean) {
  if (window.location.pathname === path) {
    return;
  }

  if (replace) {
    window.history.replaceState(null, "", path);
    return;
  }

  window.history.pushState(null, "", path);
}

function normalizePath(pathname: string) {
  if (!pathname || pathname === "/") {
    return "/analyze";
  }

  return pathname.replace(/\/+$/, "") || "/analyze";
}
