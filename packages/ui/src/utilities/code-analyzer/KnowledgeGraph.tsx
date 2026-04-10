"use client";

import dynamic from "next/dynamic";

const KnowledgeGraphInner = dynamic(
  () => import("./KnowledgeGraphInner").then((mod) => ({ default: mod.KnowledgeGraphInner })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
      </div>
    ),
  },
);

export interface KnowledgeGraphProps {
  nodes: any[];
  edges: any[];
  selectedNodeId?: string;
  onNodeSelect: (nodeId: string) => void;
  searchHighlightIds?: string[];
  activeFilters: Set<string>;
}

export function KnowledgeGraph(props: KnowledgeGraphProps) {
  return <KnowledgeGraphInner {...props} />;
}
