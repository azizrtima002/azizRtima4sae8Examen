import { z } from "zod";
import { APPLICATION_STATUS_KEYS } from "@/lib/taxonomy";

export const createApplicationSchema = z.object({
  offerId: z.string().uuid(),
  status: z.enum(APPLICATION_STATUS_KEYS).default("INTERESTED"),
});

export const updateApplicationSchema = z
  .object({
    status: z.enum(APPLICATION_STATUS_KEYS),
    notes: z.string().max(5000),
    followUpDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "invalid date")
      .nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "nothing to update");
