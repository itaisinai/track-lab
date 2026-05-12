import { motion } from "framer-motion";
import { DataStoreView } from "../../features/datastore/DataStoreView";
import { EnrichView } from "../../features/enrichment/EnrichView";
import { RemixSearchView } from "../../features/remix-search/RemixSearchView";
import { ResultDrawer } from "../../features/results/ResultDrawer";
import { ResultsView } from "../../features/results/ResultsView";
import { ReviewQueueView } from "../../features/review-queue/ReviewQueueView";
import { SavedRemixesView } from "../../features/saved-remixes/SavedRemixesView";
import { ActiveJobStrip } from "./ActiveJobStrip";
import trackLabBanner from "../../../assets/track-lab-banner.png";
import {
  AgentActivityPanel,
  DashboardFooter,
  DashboardMetrics,
  ProviderStatusPanel,
  RecentResultsPanel,
} from "../../features/dashboard/components";
import {
  useAppShell,
  useEnrichmentContext,
  useJobsContext,
  useResultsContext,
} from "../providers/app-contexts";
import { Sidebar } from "./sidebar/Sidebar";

export function AppView() {
  const {
    activeJobs,
    currentReviewJobId,
    jobsError,
    notificationJobs,
    remixJobId,
    view,
    onAnalyzeClick,
    onDataStoreClick,
    onNotificationsClick,
    onRemixSearchClick,
    onSavedRemixesClick,
    onReviewClick,
    onSavedResultsClick,
  } = useAppShell();
  const enrichment = useEnrichmentContext();
  const resultsState = useResultsContext();
  const jobs = useJobsContext();
  return (
    <>
      <div className="page dashboard-shell">
        <Sidebar
          currentReviewJobId={currentReviewJobId}
          notificationCount={notificationJobs.length}
          view={view}
          onAnalyzeClick={onAnalyzeClick}
          onDataStoreClick={onDataStoreClick}
          onNotificationsClick={onNotificationsClick}
          onRemixSearchClick={onRemixSearchClick}
          onSavedRemixesClick={onSavedRemixesClick}
          onReviewClick={onReviewClick}
          onSavedResultsClick={onSavedResultsClick}
        />
        <main className="page-content">
          <div className="dashboard-commandbar">
            <div>
              <span>AI-powered music intelligence workstation</span>
              <strong>{viewLabel(view)}</strong>
            </div>
            <button
              className="notification-button command-notification"
              type="button"
              onClick={onNotificationsClick}
            >
              Notifications <strong>{notificationJobs.length}</strong>
            </button>
          </div>

          <motion.section
            className="brand-banner"
            aria-label="Track Lab"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, ease: "easeOut" }}
          >
            <img
              className="brand-banner-image"
              src={trackLabBanner}
              alt="Track Lab. Discover. Analyze. Elevate. Smarter tools for DJs. Better tracks. Every time."
            />
          </motion.section>

          <ActiveJobStrip activeJobs={activeJobs} error={jobsError} />

          {view === "remix-search" ? (
            <div className="route-card">
              <RemixSearchView jobId={remixJobId} />
            </div>
          ) : view === "saved-remixes" ? (
            <div className="route-card">
              <SavedRemixesView />
            </div>
          ) : view === "enrich" ? (
            <>
              <DashboardMetrics
                activeJobs={activeJobs}
                allJobs={jobs.allJobs}
                results={resultsState.results}
              />
              <div className="dashboard-grid">
                <EnrichView
                  title={enrichment.title}
                  artists={enrichment.artists}
                  response={enrichment.response}
                  error={enrichment.error}
                  saveMessage={enrichment.saveMessage}
                  isLoading={enrichment.isLoading}
                  isSaving={enrichment.isSaving}
                  canSave={enrichment.canSave}
                  canDismiss={Boolean(enrichment.currentReviewJobId)}
                  showSearchForm={enrichment.showSearchForm}
                  trackDetails={enrichment.trackDetails}
                  onTitleChange={enrichment.onTitleChange}
                  onArtistsChange={enrichment.onArtistsChange}
                  onSubmit={enrichment.onSubmit}
                  onEnrich={enrichment.onEnrich}
                  onSave={enrichment.onSaveCurrentJob}
                  onDismiss={enrichment.onDismissCurrentJob}
                />
                <AgentActivityPanel
                  activeJobs={activeJobs}
                  isLoading={enrichment.isLoading}
                />
                <ProviderStatusPanel trackDetails={enrichment.trackDetails} />
                <RecentResultsPanel
                  results={resultsState.results}
                  onSavedResultsClick={onSavedResultsClick}
                />
              </div>
              <DashboardFooter allJobs={jobs.allJobs} />
            </>
          ) : view === "results" ? (
            <div className="route-card">
              <ResultsView
                results={resultsState.results}
                error={resultsState.resultsError}
                isLoading={resultsState.isResultsLoading}
                reenrichingId={resultsState.reenrichingId}
                isSearchingRemixes={resultsState.isSearchingRemixes}
                activeJobs={resultsState.activeJobs}
                onRefresh={resultsState.onRefreshResults}
                onMore={resultsState.onMoreResult}
                onReenrich={resultsState.onReenrichResult}
                onDelete={resultsState.onDeleteResult}
                onSearchRemixes={resultsState.onSearchRemixes}
              />
            </div>
          ) : view === "review" ? (
            <div className="route-card">
              <ReviewQueueView
                jobs={jobs.reviewJobs}
                notifications={jobs.notificationJobs}
                error={jobs.jobsError}
                onRefresh={jobs.onRefreshJobs}
                onOpen={jobs.onOpenJob}
                onRetry={jobs.onRetryJob}
                onDismiss={jobs.onDismissJob}
              />
            </div>
          ) : (
            <div className="route-card">
              <DataStoreView
                jobs={jobs.allJobs}
                results={jobs.results}
                error={jobs.jobsError}
                onRefresh={jobs.onRefreshDataStore}
              />
            </div>
          )}
        </main>
      </div>

      {view === "results" && resultsState.selectedResult && (
        <ResultDrawer
          result={resultsState.selectedResult}
          state={resultsState.drawerState}
          isEnriching={
            resultsState.reenrichingId === resultsState.selectedResult.id
          }
          isSearchingRemixes={resultsState.isSearchingRemixes}
          onClose={resultsState.onCloseDrawer}
          onEnrich={resultsState.onReenrichResult}
          onDelete={resultsState.onDeleteResult}
          onSearchRemixes={resultsState.onSearchRemixes}
        />
      )}
    </>
  );
}

function viewLabel(view: string) {
  const labels: Record<string, string> = {
    datastore: "Data Store",
    enrich: "Analyze",
    results: "Saved Results",
    review: "Review Queue",
    "remix-search": "Remix Search",
    "saved-remixes": "Saved Remixes",
  };

  return labels[view] ?? "Dashboard";
}
