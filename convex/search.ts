import { v } from "convex/values";
import { query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";

/**
 * Search across programs, requirements, tasks, skills, and risks within an org.
 * Returns ranked results with entity type and summary.
 * @param orgId - Organization to search within
 * @param query - Search query string
 * @param limit - Maximum results (default varies by entity type)
 */
export const globalSearch = query({
  args: {
    orgId: v.string(),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    const searchQuery = args.query.toLowerCase().trim();
    const limit = args.limit ?? 10;

    if (searchQuery.length < 2) {
      return {
        requirements: [],
        skills: [],
        risks: [],
        users: [],
        tasks: [],
        integrations: [],
        documents: [],
        sprints: [],
        playbooks: [],
      };
    }

    // Build programId -> slug map for all programs in org
    const orgPrograms = await ctx.db
      .query("programs")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const slugMap = new Map<string, string>();
    for (const p of orgPrograms) {
      slugMap.set(p._id, p.slug ?? p._id);
    }

    // Search requirements by orgId index, then JS string match
    const allRequirements = await ctx.db
      .query("requirements")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .take(50);

    const matchedRequirements = allRequirements
      .filter(
        (r) =>
          r.title.toLowerCase().includes(searchQuery) ||
          r.refId.toLowerCase().includes(searchQuery),
      )
      .slice(0, limit)
      .map((r) => ({
        type: "requirement" as const,
        id: r._id,
        title: r.title,
        subtitle: `${r.refId}${r.batch ? ` · ${r.batch}` : ""}`,
        href: `/${slugMap.get(r.programId as string) ?? r.programId}/discovery`,
      }));

    // Search skills by orgId index
    const allSkills = await ctx.db
      .query("skills")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .take(50);

    const matchedSkills = allSkills
      .filter(
        (s) =>
          s.name.toLowerCase().includes(searchQuery) ||
          s.domain.toLowerCase().includes(searchQuery),
      )
      .slice(0, limit)
      .map((s) => ({
        type: "skill" as const,
        id: s._id,
        title: s.name,
        subtitle: `${s.domain} · v${s.currentVersion}`,
        href: `/${slugMap.get(s.programId as string) ?? s.programId}/skills/${s._id}`,
      }));

    // Search risks by orgId index
    const allRisks = await ctx.db
      .query("risks")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .take(50);

    const matchedRisks = allRisks
      .filter((r) => r.title.toLowerCase().includes(searchQuery))
      .slice(0, limit)
      .map((r) => ({
        type: "risk" as const,
        id: r._id,
        title: r.title,
        subtitle: `${r.severity} · ${r.status}`,
        href: `/${slugMap.get(r.programId as string) ?? r.programId}/risks`,
      }));

    // Search users — no orgId index on users, filter by orgIds membership
    const allUsers = await ctx.db.query("users").collect();
    const matchedUsers = allUsers
      .filter(
        (u) =>
          u.orgIds.includes(args.orgId) &&
          (u.name.toLowerCase().includes(searchQuery) ||
            u.email.toLowerCase().includes(searchQuery)),
      )
      .slice(0, limit)
      .map((u) => ({
        type: "user" as const,
        id: u._id,
        title: u.name,
        subtitle: `${u.email}${u.role ? ` · ${u.role}` : ""}`,
        href: `/team`,
      }));

    // Search tasks by orgId index
    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .take(50);

    const matchedTasks = allTasks
      .filter((t) => t.title.toLowerCase().includes(searchQuery))
      .slice(0, limit)
      .map((t) => ({
        type: "task" as const,
        id: t._id,
        title: t.title,
        subtitle: `${t.priority} · ${t.status}`,
        href: `/${slugMap.get(t.programId as string) ?? t.programId}/tasks/${t._id}`,
      }));

    // Search integrations by orgId index
    const allIntegrations = await ctx.db
      .query("integrations")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .take(50);

    const matchedIntegrations = allIntegrations
      .filter(
        (i) =>
          i.name.toLowerCase().includes(searchQuery) ||
          i.sourceSystem.toLowerCase().includes(searchQuery) ||
          i.targetSystem.toLowerCase().includes(searchQuery),
      )
      .slice(0, limit)
      .map((i) => ({
        type: "integration" as const,
        id: i._id,
        title: i.name,
        subtitle: `${i.sourceSystem} → ${i.targetSystem}`,
        href: `/${slugMap.get(i.programId as string) ?? i.programId}/integrations/${i._id}`,
      }));

    // Search documents by orgId index
    const allDocuments = await ctx.db
      .query("documents")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .take(50);

    const matchedDocuments = allDocuments
      .filter(
        (d) =>
          d.fileName.toLowerCase().includes(searchQuery) ||
          (d.description?.toLowerCase().includes(searchQuery) ?? false),
      )
      .slice(0, limit)
      .map((d) => ({
        type: "document" as const,
        id: d._id,
        title: d.fileName,
        subtitle: `${d.category} · ${(d.fileSize / 1024).toFixed(0)} KB`,
        href: `/${slugMap.get(d.programId as string) ?? d.programId}/documents`,
      }));

    // Search sprints by orgId index
    const allSprints = await ctx.db
      .query("sprints")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .take(50);

    const matchedSprints = allSprints
      .filter(
        (s) =>
          s.name.toLowerCase().includes(searchQuery) ||
          (s.goal?.toLowerCase().includes(searchQuery) ?? false),
      )
      .slice(0, limit)
      .map((s) => ({
        type: "sprint" as const,
        id: s._id,
        title: s.name,
        subtitle: `#${s.number} · ${s.status}`,
        href: `/${slugMap.get(s.programId as string) ?? s.programId}/sprints/${s._id}`,
      }));

    // Search playbooks by orgId index
    const allPlaybooks = await ctx.db
      .query("playbooks")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .take(50);

    const matchedPlaybooks = allPlaybooks
      .filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery) ||
          (p.description?.toLowerCase().includes(searchQuery) ?? false),
      )
      .slice(0, limit)
      .map((p) => ({
        type: "playbook" as const,
        id: p._id,
        title: p.name,
        subtitle: `${p.targetPlatform.replace("_", " ")} · ${p.steps.length} steps`,
        href: `/${slugMap.get(p.programId as string) ?? p.programId}/playbooks/${p._id}`,
      }));

    return {
      requirements: matchedRequirements,
      skills: matchedSkills,
      risks: matchedRisks,
      users: matchedUsers,
      tasks: matchedTasks,
      integrations: matchedIntegrations,
      documents: matchedDocuments,
      sprints: matchedSprints,
      playbooks: matchedPlaybooks,
    };
  },
});
