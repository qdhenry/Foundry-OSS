"use client";

import { Folder } from "lucide-react";
import { useEffect, useState } from "react";

interface DirectoryPickerProps {
  repoId: string;
  accessToken?: string;
  owner: string;
  repo: string;
  branch: string;
  onSelect: (path: string) => void;
  selectedPath: string;
}

interface TreeNode {
  path: string;
  name: string;
  type: "dir" | "file";
  children?: TreeNode[];
}

export function DirectoryPicker({
  owner,
  repo,
  branch,
  onSelect,
  selectedPath,
}: DirectoryPickerProps) {
  const [_tree, _setTree] = useState<TreeNode[]>([]);
  const [_expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    // Note: In production, this would call a Convex action that uses the GitHub provider.
    // For now, we use a simple text input fallback.
    setLoading(false);
  }, [owner, repo, branch]);

  const _toggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  // Fallback to text input until tree browsing is wired up
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-text-secondary">Directory scope</label>
      <div className="flex items-center gap-2">
        <Folder className="h-4 w-4 text-text-muted" />
        <input
          type="text"
          value={selectedPath}
          onChange={(e) => onSelect(e.target.value)}
          placeholder="e.g., src/features/checkout (leave empty for entire repo)"
          className="w-full rounded-md border border-border-default bg-surface-default px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted"
        />
      </div>
    </div>
  );
}
