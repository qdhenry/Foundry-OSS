"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { useCallback, useMemo, useState } from "react";
import { GraphControls } from "./GraphControls";
import { KnowledgeGraph } from "./KnowledgeGraph";
import { NodeDetailPanel } from "./NodeDetailPanel";

const ALL_LAYERS = ["api", "service", "data", "ui", "utility", "config", "test"];

export interface KnowledgeGraphTabProps {
  analysisId: string;
  orgId: string;
}

export function KnowledgeGraphTab({ analysisId, orgId }: KnowledgeGraphTabProps) {
  const { isAuthenticated } = useConvexAuth();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(() => new Set(ALL_LAYERS));
  const [searchQuery, setSearchQuery] = useState("");

  const graphData = useQuery(
    "codebaseAnalysis:getGraph" as any,
    isAuthenticated && orgId ? { analysisId, orgId } : "skip",
  ) as { nodes: any[]; edges: any[] } | undefined;

  const nodes = graphData?.nodes ?? [];
  const edges = graphData?.edges ?? [];

  const filteredNodes = useMemo(
    () => nodes.filter((n: any) => activeFilters.has(n.layer ?? "utility")),
    [nodes, activeFilters],
  );

  const filteredNodeIds = useMemo(
    () => new Set(filteredNodes.map((n: any) => n.id ?? n._id)),
    [filteredNodes],
  );

  const filteredEdges = useMemo(
    () =>
      edges
        .map((e: any) => ({
          ...e,
          source: e.sourceNodeId ?? e.source,
          target: e.targetNodeId ?? e.target,
        }))
        .filter((e: any) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)),
    [edges, filteredNodeIds],
  );

  const searchHighlightIds = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return filteredNodes
      .filter((n: any) => (n.name ?? "").toLowerCase().includes(q))
      .map((n: any) => n.id ?? n._id);
  }, [filteredNodes, searchQuery]);

  const selectedNode = useMemo(
    () =>
      selectedNodeId ? (nodes.find((n: any) => (n.id ?? n._id) === selectedNodeId) ?? null) : null,
    [nodes, selectedNodeId],
  );

  const handleFilterToggle = useCallback((layer: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) {
        next.delete(layer);
      } else {
        next.add(layer);
      }
      return next;
    });
  }, []);

  const handleNodeSelect = useCallback((nodeId: string) => {
    setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId));
  }, []);

  if (graphData === undefined) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center rounded-xl border border-border-default bg-surface-secondary">
        <p className="text-sm text-text-secondary">No graph data available for this analysis.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <GraphControls
        activeFilters={activeFilters}
        onFilterToggle={handleFilterToggle}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        nodeCount={filteredNodes.length}
      />

      <div className="relative h-[600px] rounded-xl border border-border-default bg-surface-secondary overflow-hidden">
        <KnowledgeGraph
          nodes={filteredNodes}
          edges={filteredEdges}
          selectedNodeId={selectedNodeId ?? undefined}
          onNodeSelect={handleNodeSelect}
          searchHighlightIds={searchHighlightIds}
          activeFilters={activeFilters}
        />
      </div>

      <NodeDetailPanel node={selectedNode} onClose={() => setSelectedNodeId(null)} />
    </div>
  );
}
