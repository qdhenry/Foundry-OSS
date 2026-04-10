export type RepoRole =
  | "storefront"
  | "integration"
  | "data_migration"
  | "infrastructure"
  | "extension"
  | "documentation";

export const ROLE_OPTIONS: Array<{ value: RepoRole; label: string }> = [
  { value: "storefront", label: "Storefront" },
  { value: "integration", label: "Integration" },
  { value: "data_migration", label: "Data Migration" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "extension", label: "Extension" },
  { value: "documentation", label: "Documentation" },
];

export interface AvailableRepo {
  id: number;
  full_name: string;
  name: string;
  default_branch: string;
  language: string | null;
  private: boolean;
  is_template?: boolean;
}

export interface ConnectedRepo {
  _id: string;
  repoFullName: string;
  role: RepoRole;
  language?: string;
  isMonorepo: boolean;
  syncStatus: string;
  installationId: string;
  providerRepoId: string;
  defaultBranch: string;
}
