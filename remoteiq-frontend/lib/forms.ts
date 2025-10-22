import { z } from "zod";

export const ProfileSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  username: z.string().min(3, "Min 3 chars").regex(/^[a-z0-9_]+$/i, "Letters, numbers, underscore"),
  email: z.string().email("Invalid email"),
  billingEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  timezone: z.string().min(1, "Select a timezone"),
  locale: z.string().min(2, "Select a locale"),
  avatarUrl: z.string().url().optional().or(z.literal("")),
});
export type ProfileForm = z.infer<typeof ProfileSchema>;

export const SecuritySchema = z
  .object({
    twoFaEnabled: z.boolean(),
    autoRevokeSessions: z.boolean(),
    newPassword: z.union([z.string().min(8, "At least 8 characters"), z.literal("")]),
    confirmPassword: z.union([z.string().min(8, "At least 8 characters"), z.literal("")]),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  });
export type SecurityForm = z.infer<typeof SecuritySchema>;

export const NotificationsSchema = z.object({
  email: z.boolean(),
  push: z.boolean(),
  product: z.boolean(),
  digest: z.enum(["never", "daily", "weekly", "monthly"]),
  quiet: z
    .object({
      enabled: z.boolean(),
      // Required (no default at schema level) so resolver input matches the form generic
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
    })
    .refine(({ enabled, start, end }) => !enabled || start !== end, {
      message: "Start and end can’t match",
      path: ["end"],
    }),
  products: z.array(z.string()),
});
export type NotificationsForm = z.infer<typeof NotificationsSchema>;

export const IntegrationsSchema = z.object({
  slackWebhook: z.string().url("Enter a valid URL").or(z.literal("")),
  webhookUrl: z.string().url("Enter a valid URL").or(z.literal("")),
  webhookSigningSecret: z.string().optional().or(z.literal("")),
  events: z.array(z.string()),
});
export type IntegrationsForm = z.infer<typeof IntegrationsSchema>;

export const BillingSchema = z.object({
  company: z.string().min(1, "Required"),
  addr1: z.string().min(1, "Required"),
  addr2: z.string().optional().or(z.literal("")),
  city: z.string().min(1, "Required"),
  country: z.string().min(2, "Select a country"),
  taxId: z.string().optional().or(z.literal("")),
});
export type BillingForm = z.infer<typeof BillingSchema>;

export const ApiKeyCreateSchema = z.object({
  label: z.string().min(2, "Too short"),
  scopes: z.array(z.enum(["read", "write", "billing", "admin"])).nonempty("Pick at least one"),
  expiresIn: z.enum(["never", "30d", "90d"]),
  ipAllowlist: z.string().optional().or(z.literal("")),
});
export type ApiKeyCreateForm = z.infer<typeof ApiKeyCreateSchema>;
