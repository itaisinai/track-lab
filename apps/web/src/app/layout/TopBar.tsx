import type { View } from "../../types";

type TopBarProps = {
  currentReviewJobId: number | null;
  notificationCount: number;
  view: View;
  onAnalyzeClick: () => void;
  onDataStoreClick: () => void;
  onNotificationsClick: () => void;
  onRemixSearchClick: () => void;
  onSavedRemixesClick: () => void;
  onReviewClick: () => void;
  onSavedResultsClick: () => void;
};

export function TopBar({
  currentReviewJobId,
  notificationCount,
  view,
  onAnalyzeClick,
  onDataStoreClick,
  onNotificationsClick,
  onRemixSearchClick,
  onSavedRemixesClick,
  onReviewClick,
  onSavedResultsClick,
}: TopBarProps) {
  return (
    <header className="topbar">
      <h1>Track Lab Agent</h1>
      <nav className="tabs" aria-label="Views">
        <button
          className={
            view === "enrich" && !currentReviewJobId
              ? "nav-tab active"
              : "nav-tab"
          }
          type="button"
          onClick={onAnalyzeClick}
        >
          Analyze
        </button>
        <button
          className={view === "remix-search" ? "nav-tab active" : "nav-tab"}
          type="button"
          onClick={onRemixSearchClick}
        >
          Remix Search
        </button>
        <button
          className={view === "saved-remixes" ? "nav-tab active" : "nav-tab"}
          type="button"
          onClick={onSavedRemixesClick}
        >
          Saved Remixes
        </button>
        <button
          className={view === "results" ? "nav-tab active" : "nav-tab"}
          type="button"
          onClick={onSavedResultsClick}
        >
          Saved Results
        </button>
        <button
          className={
            view === "review" || currentReviewJobId
              ? "nav-tab active"
              : "nav-tab"
          }
          type="button"
          onClick={onReviewClick}
        >
          Review Queue
        </button>
        <button
          className={view === "datastore" ? "nav-tab active" : "nav-tab"}
          type="button"
          onClick={onDataStoreClick}
        >
          Data Store
        </button>
      </nav>
      <button
        className="notification-button"
        type="button"
        onClick={onNotificationsClick}
      >
        Notifications {notificationCount}
      </button>
    </header>
  );
}
