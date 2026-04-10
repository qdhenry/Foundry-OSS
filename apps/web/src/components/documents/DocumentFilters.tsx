"use client";

const CATEGORIES = [
  { value: "architecture", label: "Architecture" },
  { value: "requirements", label: "Requirements" },
  { value: "testing", label: "Testing" },
  { value: "deployment", label: "Deployment" },
  { value: "meeting_notes", label: "Meeting Notes" },
  { value: "other", label: "Other" },
] as const;

interface DocumentFiltersProps {
  selectedCategory: string | undefined;
  onCategoryChange: (category: string | undefined) => void;
}

export function DocumentFilters({ selectedCategory, onCategoryChange }: DocumentFiltersProps) {
  return (
    <div className="flex items-center gap-3">
      <select
        value={selectedCategory ?? ""}
        onChange={(e) => onCategoryChange(e.target.value === "" ? undefined : e.target.value)}
        className="select"
      >
        <option value="">All Categories</option>
        {CATEGORIES.map((cat) => (
          <option key={cat.value} value={cat.value}>
            {cat.label}
          </option>
        ))}
      </select>

      {selectedCategory && (
        <button
          onClick={() => onCategoryChange(undefined)}
          className="text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          Clear filter
        </button>
      )}
    </div>
  );
}
