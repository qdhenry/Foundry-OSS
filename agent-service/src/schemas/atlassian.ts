import { z } from "zod";

export const AtlassianOAuthExchangeRequestSchema = z.object({
  action: z.literal("exchange_code"),
  code: z.string().min(1),
  redirectUri: z.string().url().optional(),
});

export const AtlassianOAuthRefreshRequestSchema = z.object({
  action: z.literal("refresh_token"),
  refreshToken: z.string().min(1),
});

export const AtlassianOAuthRequestSchema = z.discriminatedUnion("action", [
  AtlassianOAuthExchangeRequestSchema,
  AtlassianOAuthRefreshRequestSchema,
]);

export const AtlassianTokenEndpointResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  token_type: z.string().min(1),
  scope: z.string().optional(),
  refresh_token: z.string().min(1).optional(),
});

export const AtlassianOAuthTokenSchema = z.object({
  accessToken: z.string().min(1),
  expiresIn: z.number().int().positive(),
  tokenType: z.string().min(1),
  scope: z.string().optional(),
  refreshToken: z.string().min(1).optional(),
  obtainedAt: z.string().datetime(),
});

export const AtlassianOAuthExchangeResponseSchema = z.object({
  action: z.literal("exchange_code"),
  token: AtlassianOAuthTokenSchema,
});

export const AtlassianOAuthRefreshResponseSchema = z.object({
  action: z.literal("refresh_token"),
  token: AtlassianOAuthTokenSchema,
});

export const AtlassianOAuthResponseSchema = z.discriminatedUnion("action", [
  AtlassianOAuthExchangeResponseSchema,
  AtlassianOAuthRefreshResponseSchema,
]);

export type AtlassianOAuthRequest = z.infer<typeof AtlassianOAuthRequestSchema>;
export type AtlassianOAuthResponse = z.infer<typeof AtlassianOAuthResponseSchema>;
