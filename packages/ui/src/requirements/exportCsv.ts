interface RequirementExportItem {
  refId: string;
  title: string;
  priority: string;
  status: string;
  workstreamName: string | null;
  taskCount: number;
}

function escapeCsvValue(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportRequirementsCsv(items: RequirementExportItem[]): void {
  const headers = "Ref ID,Title,Priority,Status,Workstream,Tasks";

  const rows = items.map((item) => {
    const refId = escapeCsvValue(item.refId);
    const title = escapeCsvValue(item.title);
    const priority = escapeCsvValue(item.priority);
    const status = escapeCsvValue(item.status);
    const workstream = escapeCsvValue(item.workstreamName ?? "");
    const tasks = String(item.taskCount);
    return `${refId},${title},${priority},${status},${workstream},${tasks}`;
  });

  const csv = [headers, ...rows].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const filename = `requirements-export-${yyyy}-${mm}-${dd}.csv`;

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
