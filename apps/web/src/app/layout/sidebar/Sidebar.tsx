import { motion } from "framer-motion";
import type { View } from "../../../types";
import trackLabIcon from "../../../../assets/tracklab-icon.svg";
import {
  BellIcon,
  DatabaseIcon,
  FolderIcon,
  HeartIcon,
  QueueIcon,
  SearchIcon,
  SparkIcon,
} from "./icons";

type SidebarProps = {
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

export function Sidebar({
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
}: SidebarProps) {
  const navItems = [
    {
      label: "Analyze",
      active: view === "enrich" && !currentReviewJobId,
      onClick: onAnalyzeClick,
      icon: SparkIcon,
    },
    {
      label: "Remix Search",
      active: view === "remix-search",
      onClick: onRemixSearchClick,
      icon: SearchIcon,
    },
    {
      label: "Saved Remixes",
      active: view === "saved-remixes",
      onClick: onSavedRemixesClick,
      icon: HeartIcon,
    },
    {
      label: "Saved Results",
      active: view === "results",
      onClick: onSavedResultsClick,
      icon: FolderIcon,
    },
    {
      label: "Review Queue",
      active: view === "review" || Boolean(currentReviewJobId),
      onClick: onReviewClick,
      icon: QueueIcon,
    },
    {
      label: "Data Store",
      active: view === "datastore",
      onClick: onDataStoreClick,
      icon: DatabaseIcon,
    },
  ];

  return (
    <aside className="topbar" aria-label="Track Lab navigation">
      <div className="topbar-brand">
        <img className="topbar-brand-icon" src={trackLabIcon} alt="" aria-hidden="true" />
        <h1 className="topbar-title">
          <span>Track</span>
          <strong>Lab</strong>
        </h1>
      </div>
      <nav className="tabs" aria-label="Views">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <motion.button
              className={item.active ? "nav-tab active" : "nav-tab"}
              type="button"
              onClick={item.onClick}
              key={item.label}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
            >
              <Icon />
              <span>{item.label}</span>
            </motion.button>
          );
        })}
      </nav>
      <button
        className="notification-button"
        type="button"
        onClick={onNotificationsClick}
      >
        <BellIcon />
        <span>Notifications</span>
        <strong>{notificationCount}</strong>
      </button>
      <div className="sidebar-user">
        <span>DJ</span>
        <div>
          <strong>DJ Lab</strong>
          <small>Pro workspace</small>
        </div>
      </div>
    </aside>
  );
}
