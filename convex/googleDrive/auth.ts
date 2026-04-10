import { ConvexError } from "convex/values";
import * as generatedApi from "../_generated/api";

const api: any = (generatedApi as any).api;
const internalApi: any = (generatedApi as any).internal;

type ActionQueryCtx = {
  auth: {
    getUserIdentity: () => Promise<{
      subject: string;
      org_id?: string;
    } | null>;
  };
  runQuery: (reference: any, args: Record<string, unknown>) => Promise<any>;
};

export async function assertActionOrgAccess(ctx: ActionQueryCtx, orgId: string) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Not authenticated");

  const user = await ctx.runQuery(api.users.getByClerkId, {
    clerkId: identity.subject,
  });
  if (!user) throw new ConvexError("Access denied");

  const jwtOrgId = (identity as any).org_id as string | undefined;
  if (!user.orgIds.includes(orgId) && jwtOrgId !== orgId) {
    throw new ConvexError("Access denied");
  }

  return user;
}

export async function authorizeCredentialOwner(
  ctx: ActionQueryCtx,
  args: {
    orgId: string;
    credentialId: any;
  },
) {
  const user = await assertActionOrgAccess(ctx, args.orgId);
  const credential = await ctx.runQuery(internalApi.googleDrive.credentials.getByIdInternal, {
    credentialId: args.credentialId,
  });

  if (!credential || credential.orgId !== args.orgId || credential.userId !== user._id) {
    throw new ConvexError("Invalid credential");
  }

  return { credential, user };
}
