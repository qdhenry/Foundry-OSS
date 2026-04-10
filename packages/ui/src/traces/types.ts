export interface TraceFilters {
  dateRange: number;
  skill: string | null;
  trigger: string | null;
  reviewStatus: string | null;
  model: string | null;
  search: string;
}

export interface FilterOptions {
  skills: string[];
  triggers: string[];
  models: string[];
}
