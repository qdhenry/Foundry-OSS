export const PHASE_COLORS: Record<string, string> = {
  discovery: "bg-status-info-bg text-status-info-fg border border-status-info-border",
  build: "bg-status-warning-bg text-status-warning-fg border border-status-warning-border",
  test: "bg-status-success-bg text-status-success-fg border border-status-success-border",
  deploy: "bg-status-warning-bg text-status-warning-fg border border-status-warning-border",
  complete: "bg-status-success-bg text-status-success-fg border border-status-success-border",
};

export const PLATFORM_COLORS: Record<string, string> = {
  magento: "bg-status-warning-bg text-status-warning-fg border border-status-warning-border",
  salesforce_b2b: "bg-status-info-bg text-status-info-fg border border-status-info-border",
  bigcommerce_b2b:
    "bg-status-success-bg text-status-success-fg border border-status-success-border",
  sitecore: "bg-status-error-bg text-status-error-fg border border-status-error-border",
  wordpress: "bg-interactive-subtle text-accent-default border border-border-accent",
  none: "bg-surface-raised text-text-secondary",
};

export const PLATFORM_LABELS: Record<string, string> = {
  magento: "Magento",
  salesforce_b2b: "Salesforce B2B",
  bigcommerce_b2b: "BigCommerce B2B",
  sitecore: "Sitecore",
  wordpress: "WordPress",
  none: "None",
};

export const STATUS_COLORS: Record<string, string> = {
  active: "bg-status-success-bg text-status-success-fg border border-status-success-border",
  paused: "bg-status-warning-bg text-status-warning-fg border border-status-warning-border",
  complete: "bg-surface-raised text-text-secondary",
  archived: "bg-surface-raised text-text-muted",
};
