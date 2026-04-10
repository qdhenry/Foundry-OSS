"use client";

import { Background, Controls, type Edge, MiniMap, type Node, ReactFlow } from "@xyflow/react";
import { useCallback, useMemo } from "react";
import "@xyflow/react/dist/style.css";

const LAYER_COLORS: Record<string, string> = {
  api: "#3b82f6",
  service: "#64748b",
  data: "#22c55e",
  ui: "#f59e0b",
  utility: "#6b7280",
  config: "#06b6d4",
  test: "#14b8a6",
};

const _LAYER_BG_CLASSES: Record<string, string> = {
  api: "bg-blue-500",
  service: "bg-slate-500",
  data: "bg-green-500",
  ui: "bg-amber-500",
  utility: "bg-gray-500",
  config: "bg-cyan-500",
  test: "bg-teal-500",
};

const LAYER_ORDER = ["api", "service", "data", "ui", "utility", "config", "test"];

export interface KnowledgeGraphInnerProps {
  nodes: any[];
  edges: any[];
  selectedNodeId?: string;
  onNodeSelect: (nodeId: string) => void;
  searchHighlightIds?: string[];
  activeFilters: Set<string>;
}

export function KnowledgeGraphInner({
  nodes,
  edges,
  selectedNodeId,
  onNodeSelect,
  searchHighlightIds = [],
  activeFilters,
}: KnowledgeGraphInnerProps) {
  const searchHighlightSet = useMemo(() => new Set(searchHighlightIds), [searchHighlightIds]);

  const rfNodes: Node[] = useMemo(() => {
    // Group nodes by layer, then arrange in columns
    const grouped: Record<string, any[]> = {};
    for (const node of nodes) {
      const layer = node.layer ?? "utility";
      if (!grouped[layer]) grouped[layer] = [];
      grouped[layer].push(node);
    }

    const result: Node[] = [];
    let colIndex = 0;

    for (const layer of LAYER_ORDER) {
      const layerNodes = grouped[layer];
      if (!layerNodes || !activeFilters.has(layer)) continue;

      layerNodes.forEach((node, rowIndex) => {
        const nodeId = node.id ?? node._id;
        const isSelected = nodeId === selectedNodeId;
        const isHighlighted = searchHighlightSet.has(nodeId);
        const color = LAYER_COLORS[layer] ?? LAYER_COLORS.utility;

        result.push({
          id: String(nodeId),
          position: { x: colIndex * 250, y: rowIndex * 80 },
          data: {
            label: (
              <div
                className={`rounded-lg border px-3 py-2 text-xs transition-all duration-200 ${
                  isSelected
                    ? "border-accent-default bg-surface-default shadow-md ring-2 ring-accent-default/30"
                    : isHighlighted
                      ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20 shadow-sm"
                      : "border-border-default bg-surface-default hover:shadow-sm"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="truncate font-medium text-text-heading">{node.name}</span>
                </div>
                {(node.nodeType ?? node.type) && (
                  <span className="mt-0.5 block text-[10px] text-text-muted">
                    {node.nodeType ?? node.type}
                  </span>
                )}
              </div>
            ),
          },
          style: {
            background: "transparent",
            border: "none",
            padding: 0,
            width: 200,
          },
        });
      });

      colIndex++;
    }

    return result;
  }, [nodes, activeFilters, selectedNodeId, searchHighlightSet]);

  const rfEdges: Edge[] = useMemo(() => {
    return edges.map((edge: any, index: number) => ({
      id: edge.id ?? `edge-${index}`,
      source: String(edge.source),
      target: String(edge.target),
      animated: true,
      style: { stroke: "#94a3b8", strokeWidth: 1.5 },
    }));
  }, [edges]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeSelect(node.id);
    },
    [onNodeSelect],
  );

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      onNodeClick={handleNodeClick}
      fitView
      minZoom={0.1}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={20} size={1} />
      <Controls
        showInteractive={false}
        className="rounded-lg border border-border-default bg-surface-default shadow-sm"
      />
      <MiniMap
        nodeColor={(node) => {
          const layer = nodes.find((n: any) => String(n.id ?? n._id) === node.id)?.layer;
          return LAYER_COLORS[layer ?? "utility"] ?? LAYER_COLORS.utility;
        }}
        maskColor="rgba(0,0,0,0.1)"
        className="rounded-lg border border-border-default"
      />
    </ReactFlow>
  );
}
