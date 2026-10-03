import { z } from "zod";
import { CITY_SLUGS, DOMAIN_SLUGS, OFFER_TYPE_KEYS } from "@/lib/taxonomy";

const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === "" ? null : value), schema.nullable().default(null));

export const createAlertSchema = z
  .object({
    keywords: z.string().trim().max(100).default(""),
    city: optional(z.enum(CITY_SLUGS)),
    domain: optional(z.enum(DOMAIN_SLUGS)),
    type: optional(z.enum(OFFER_TYPE_KEYS)),
  })
  .refine((v) => v.keywords || v.city || v.domain || v.type, {
    message: "at least one criterion is required",
    path: ["keywords"],
  });
