import type { Prisma } from "@prisma/client";
import { offerSummarySelect } from "./offers";

export const applicationInclude = {
  offer: { select: { ...offerSummarySelect, sourceUrl: true } },
} satisfies Prisma.ApplicationInclude;

export type ApplicationWithOffer = Prisma.ApplicationGetPayload<{ include: typeof applicationInclude }>;

/** JSON-safe card for the client-side Kanban board. */
export interface BoardCard {
  id: string;
  status: ApplicationWithOffer["status"];
  notes: string;
  followUpDate: string | null; // YYYY-MM-DD
  updatedAt: string;
  offer: {
    id: string;
    title: string;
    company: string;
    city: string | null;
    type: string;
    sourceName: string;
    sourceUrl: string;
  };
}

export function toBoardCard(app: ApplicationWithOffer): BoardCard {
  return {
    id: app.id,
    status: app.status,
    notes: app.notes,
    followUpDate: app.followUpDate ? app.followUpDate.toISOString().slice(0, 10) : null,
    updatedAt: app.updatedAt.toISOString(),
    offer: {
      id: app.offer.id,
      title: app.offer.title,
      company: app.offer.company,
      city: app.offer.city,
      type: app.offer.type,
      sourceName: app.offer.sourceName,
      sourceUrl: app.offer.sourceUrl,
    },
  };
}
