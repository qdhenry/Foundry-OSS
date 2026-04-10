"use client";

export type DiscoveryTab = "documents" | "findings" | "imported" | "videos";

interface DiscoveryTabBarProps {
  activeTab: DiscoveryTab;
  onTabChange: (tab: DiscoveryTab) => void;
  documentCount: number;
  analyzingCount: number;
  pendingFindingsCount: number;
  importedCount: number;
  videoCount?: number;
}

export function DiscoveryTabBar({
  activeTab,
  onTabChange,
  documentCount,
  analyzingCount,
  pendingFindingsCount,
  importedCount,
  videoCount,
}: DiscoveryTabBarProps) {
  const tabs: {
    id: DiscoveryTab;
    label: string;
    badge: number | null;
    attention: boolean;
    tooltip: string;
  }[] = [
    {
      id: "documents",
      label: "Documents",
      badge: documentCount > 0 ? documentCount : null,
      attention: analyzingCount > 0,
      tooltip: "Uploaded documents and their analysis status",
    },
    {
      id: "findings",
      label: "Findings",
      badge: pendingFindingsCount > 0 ? pendingFindingsCount : null,
      attention: pendingFindingsCount > 0,
      tooltip: "AI-extracted findings ready for review",
    },
    {
      id: "imported",
      label: "Imported",
      badge: importedCount > 0 ? importedCount : null,
      attention: false,
      tooltip: "Findings imported as requirements, risks, or integrations",
    },
    {
      id: "videos",
      label: "Videos",
      badge: videoCount && videoCount > 0 ? videoCount : null,
      attention: false,
      tooltip: "Uploaded video recordings for analysis",
    },
  ];

  return (
    <div className="flex items-center gap-2">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            title={tab.tooltip}
            onClick={() => onTabChange(tab.id)}
            className={`relative inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-accent-default text-text-on-brand"
                : "bg-surface-raised text-text-primary hover:bg-surface-elevated"
            }`}
          >
            {tab.label}

            {tab.badge !== null && (
              <span
                className={`inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none ${
                  tab.attention && !isActive
                    ? "bg-accent-default text-text-on-brand"
                    : isActive
                      ? "bg-white/20 text-text-on-brand"
                      : "bg-surface-elevated text-text-primary"
                }`}
              >
                {tab.badge}
              </span>
            )}

            {tab.attention && !isActive && tab.badge === null && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent-default" />
            )}
          </button>
        );
      })}
    </div>
  );
}
