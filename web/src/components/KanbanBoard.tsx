"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { BoardCard } from "@/lib/applications";
import { format } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";
import {
  APPLICATION_STATUS_KEYS,
  APPLICATION_STATUSES,
  cityLabel,
  sourceLabel,
  type ApplicationStatusKey,
} from "@/lib/taxonomy";
import { CalendarIcon, ExternalIcon, MapPinIcon, NoteIcon, XIcon } from "./icons";

type Status = ApplicationStatusKey;
type Patch = Partial<Pick<BoardCard, "status" | "notes" | "followUpDate">>;

/** Four columns; the last one holds two drop zones: offer received / rejected. */
const COLUMNS: { id: string; zones: Status[] }[] = [
  { id: "INTERESTED", zones: ["INTERESTED"] },
  { id: "APPLIED", zones: ["APPLIED"] },
  { id: "INTERVIEW", zones: ["INTERVIEW"] },
  { id: "RESULT", zones: ["OFFER", "REJECTED"] },
];

const ZONE_STYLE: Record<Status, string> = {
  INTERESTED: "bg-slate-400",
  APPLIED: "bg-brand-500",
  INTERVIEW: "bg-amber-500",
  OFFER: "bg-emerald-500",
  REJECTED: "bg-rose-400",
};

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time

const isOverdue = (card: BoardCard) =>
  Boolean(card.followUpDate) && card.followUpDate! <= today() && card.status !== "OFFER" && card.status !== "REJECTED";

export function KanbanBoard({ initialCards }: { initialCards: BoardCard[] }) {
  const { locale, t } = useI18n();
  const [cards, setCards] = useState(initialCards);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Browsers fire a click after a mouse drag ends: ignore it.
  const lastDragEnd = useRef(0);
  const open = (id: string) => {
    if (Date.now() - lastDragEnd.current > 250) setEditingId(id);
  };

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // A short press delay keeps vertical scrolling usable on phones.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const byStatus = useMemo(() => {
    const groups = Object.fromEntries(APPLICATION_STATUS_KEYS.map((s) => [s, [] as BoardCard[]])) as Record<
      Status,
      BoardCard[]
    >;
    for (const card of cards) groups[card.status].push(card);
    for (const list of Object.values(groups)) list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return groups;
  }, [cards]);

  async function update(id: string, patch: Patch) {
    const previous = cards;
    setError(null);
    setCards((list) =>
      list.map((card) => (card.id === id ? { ...card, ...patch, updatedAt: new Date().toISOString() } : card)),
    );
    const response = await fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => null);
    if (!response?.ok) {
      setCards(previous); // roll back the optimistic update
      setError(t.board.error);
      return false;
    }
    return true;
  }

  async function remove(id: string) {
    const previous = cards;
    setCards((list) => list.filter((card) => card.id !== id));
    const response = await fetch(`/api/applications/${id}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) {
      setCards(previous);
      setError(t.board.error);
    }
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    lastDragEnd.current = Date.now();
    const target = event.over?.id as Status | undefined;
    const card = cards.find((c) => c.id === event.active.id);
    if (card && target && target !== card.status) void update(card.id, { status: target });
  }

  const activeCard = cards.find((c) => c.id === activeId) ?? null;
  const editingCard = cards.find((c) => c.id === editingId) ?? null;

  return (
    <>
      {error && (
        <div role="alert" className="mb-4 flex items-center justify-between rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-800">
          {error}
          <button type="button" onClick={() => setError(null)} aria-label={t.board.close}>
            <XIcon />
          </button>
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        {/* Horizontal scroll with snapping on phones, 4-column grid on desktop. */}
        <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
          {COLUMNS.map((column) => {
            const count = column.zones.reduce((sum, zone) => sum + byStatus[zone].length, 0);
            const title = column.id === "RESULT" ? t.board.resultColumn : APPLICATION_STATUSES[column.id as Status][locale];
            return (
              <section
                key={column.id}
                className="flex w-[82vw] max-w-[320px] shrink-0 snap-start flex-col rounded-xl bg-slate-100/80 p-3 sm:w-[300px] lg:w-auto lg:max-w-none"
                aria-label={title}
              >
                <header className="mb-3 flex items-center justify-between px-1">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    {column.zones.length === 1 && <span className={`h-2 w-2 rounded-full ${ZONE_STYLE[column.zones[0]!]}`} />}
                    {title}
                  </h2>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600">{count}</span>
                </header>
                <div className="flex flex-1 flex-col gap-3">
                  {column.zones.map((zone) => (
                    <DropZone
                      key={zone}
                      status={zone}
                      label={column.zones.length > 1 ? APPLICATION_STATUSES[zone][locale] : null}
                      emptyLabel={t.board.dropHere}
                    >
                      {byStatus[zone].map((card) => (
                        <DraggableCard key={card.id} card={card} onOpen={() => open(card.id)} hidden={card.id === activeId} />
                      ))}
                    </DropZone>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
        <DragOverlay dropAnimation={null}>{activeCard && <CardBody card={activeCard} lifted />}</DragOverlay>
      </DndContext>

      {editingCard && (
        <CardEditor
          card={editingCard}
          onClose={() => setEditingId(null)}
          onSave={async (patch) => {
            if (await update(editingCard.id, patch)) setEditingId(null);
          }}
          onRemove={async () => {
            if (window.confirm(t.board.removeConfirm)) {
              setEditingId(null);
              await remove(editingCard.id);
            }
          }}
        />
      )}
    </>
  );
}

function DropZone({
  status,
  label,
  emptyLabel,
  children,
}: {
  status: Status;
  label: string | null;
  emptyLabel: string;
  children: ReactNode[];
}) {
  const { isOver, setNodeRef } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[96px] flex-1 flex-col gap-2 rounded-lg p-1 transition-colors ${
        isOver ? "bg-brand-100/70 ring-2 ring-brand-300" : ""
      } ${label ? "border border-dashed border-slate-300 p-2" : ""}`}
    >
      {label && (
        <p className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span className={`h-2 w-2 rounded-full ${ZONE_STYLE[status]}`} />
          {label}
        </p>
      )}
      {children}
      {children.length === 0 && (
        <p className="grid flex-1 place-items-center rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400">
          {emptyLabel}
        </p>
      )}
    </div>
  );
}

function DraggableCard({ card, onOpen, hidden }: { card: BoardCard; onOpen: () => void; hidden: boolean }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: card.id });
  const { t } = useI18n();
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-roledescription="draggable card"
      className={`touch-manipulation rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${hidden ? "opacity-30" : ""}`}
      onClick={onOpen}
    >
      <CardBody card={card} />
      <button
        type="button"
        className="sr-only focus:not-sr-only focus:mt-1 focus:text-xs focus:text-brand-700"
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {t.board.edit}
      </button>
    </div>
  );
}

function CardBody({ card, lifted = false }: { card: BoardCard; lifted?: boolean }) {
  const { locale, t } = useI18n();
  const overdue = isOverdue(card);
  return (
    <div
      className={`cursor-grab select-none rounded-lg border bg-white p-3 text-start active:cursor-grabbing ${
        lifted ? "rotate-2 border-brand-300 shadow-xl" : "border-slate-200 shadow-card hover:border-slate-300"
      }`}
    >
      <p className="line-clamp-2 text-sm font-medium leading-snug text-slate-900" dir="auto">
        {card.offer.title}
      </p>
      <p className="mt-1 truncate text-xs text-slate-500" dir="auto">
        {card.offer.company}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        {card.offer.city && (
          <span className="inline-flex items-center gap-1">
            <MapPinIcon width={12} height={12} />
            {cityLabel(card.offer.city, locale)}
          </span>
        )}
        {card.notes && (
          <span className="inline-flex items-center gap-1" title={t.board.notes}>
            <NoteIcon width={12} height={12} />
          </span>
        )}
        {card.followUpDate && (
          <span
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${
              overdue ? "bg-red-50 font-medium text-red-700" : "bg-slate-100"
            }`}
          >
            <CalendarIcon width={12} height={12} />
            {overdue
              ? t.board.overdue
              : format(t.board.followUp, {
                  date: new Date(`${card.followUpDate}T00:00:00`).toLocaleDateString(locale === "ar" ? "ar-TN" : "fr-FR", {
                    day: "numeric",
                    month: "short",
                  }),
                })}
          </span>
        )}
      </div>
    </div>
  );
}

function CardEditor({
  card,
  onClose,
  onSave,
  onRemove,
}: {
  card: BoardCard;
  onClose: () => void;
  onSave: (patch: Patch) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const { locale, t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState<Status>(card.status);
  const [notes, setNotes] = useState(card.notes);
  const [followUpDate, setFollowUpDate] = useState(card.followUpDate ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const patch: Patch = {};
    if (status !== card.status) patch.status = status;
    if (notes !== card.notes) patch.notes = notes;
    if ((followUpDate || null) !== card.followUpDate) patch.followUpDate = followUpDate || null;
    if (Object.keys(patch).length === 0) onClose();
    else await onSave(patch);
    setSaving(false);
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && onClose()}
      className="w-[calc(100%-2rem)] max-w-lg rounded-2xl p-0 shadow-2xl backdrop:bg-slate-900/40"
      aria-labelledby="card-editor-title"
    >
      <form onSubmit={submit} className="space-y-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="card-editor-title" className="font-semibold leading-snug text-slate-900" dir="auto">
              {card.offer.title}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500" dir="auto">
              {card.offer.company} · {sourceLabel(card.offer.sourceName)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost -me-2 -mt-1 p-2" aria-label={t.board.close}>
            <XIcon />
          </button>
        </div>

        <div>
          <label htmlFor="card-status" className="label">
            {t.board.status}
          </label>
          <select id="card-status" className="input" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            {APPLICATION_STATUS_KEYS.map((key) => (
              <option key={key} value={key}>
                {APPLICATION_STATUSES[key][locale]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="card-followup" className="label">
            {t.board.followUpDate}
          </label>
          <input
            id="card-followup"
            type="date"
            className="input"
            value={followUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="card-notes" className="label">
            {t.board.notes}
          </label>
          <textarea
            id="card-notes"
            className="input min-h-[120px] resize-y"
            value={notes}
            maxLength={5000}
            placeholder={t.board.notesPlaceholder}
            onChange={(e) => setNotes(e.target.value)}
            dir="auto"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
          <Link href={`/offers/${card.offer.id}`} className="text-sm font-medium text-brand-700 hover:underline">
            {t.board.viewOffer}
          </Link>
          <a
            href={card.offer.sourceUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
          >
            {sourceLabel(card.offer.sourceName)}
            <ExternalIcon width={14} height={14} />
          </a>
          <button type="button" onClick={onRemove} className="ms-auto text-sm font-medium text-red-700 hover:underline">
            {t.board.remove}
          </button>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t.board.cancel}
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {t.board.save}
          </button>
        </div>
      </form>
    </dialog>
  );
}
