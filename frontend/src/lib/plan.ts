/**
 * Pure helpers shared by the room and group planning pages.
 *
 * Room/group titles used to be regenerated from the slot count on every page
 * load ("Room 1", "Room 2", …), so any title an admin had renamed matched no
 * slot and its occupants disappeared from the page entirely. The list of
 * titles is now persisted on the event; these helpers make the page resilient
 * even when the stored list is stale or missing.
 */

export type PlanSlot<T> = {
  label: string;
  registrants: T[];
  emptyCount: number;
  overCapacity: boolean;
};

type NameList = { names: string[]; seen: Set<string> };

function collectNames(
  persisted: string[] | undefined | null,
  assignedTitles: Iterable<string>
): NameList {
  const names: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string) => {
    const name = raw.trim();
    if (!name || seen.has(name)) return;
    seen.add(name);
    names.push(name);
  };

  for (const name of persisted ?? []) push(name);
  for (const title of assignedTitles) push(title);

  return { names, seen };
}

function padNames(list: NameList, target: number, prefix: string) {
  let n = 1;
  while (list.names.length < target) {
    let candidate = `${prefix} ${n}`;
    while (list.seen.has(candidate)) {
      n += 1;
      candidate = `${prefix} ${n}`;
    }
    list.seen.add(candidate);
    list.names.push(candidate);
    n += 1;
  }
}

/**
 * Builds the ordered list of slot titles for one plan dimension.
 *
 * Persisted titles win, but any title that is still in use is always kept, so
 * nobody can be hidden by stale data. Missing titles are filled with
 * `"<prefix> N"` up to `count` slots.
 */
export function resolvePlanNames(
  persisted: string[] | undefined | null,
  assignedTitles: Iterable<string>,
  count: number,
  prefix: string
): { names: string[]; count: number } {
  const list = collectNames(persisted, assignedTitles);
  const target = Math.max(1, Math.trunc(count) || 1, list.names.length);
  padNames(list, target, prefix);
  return { names: list.names, count: list.names.length };
}

/**
 * The titles to render for the currently configured slot count.
 *
 * Truncates empty trailing titles but never invents duplicates; the save
 * endpoint refuses to remove a slot that still holds people.
 */
export function slicePlanNames(
  persisted: string[],
  count: number,
  prefix: string
): string[] {
  const target = Math.max(1, Math.trunc(count) || 1);
  const list = collectNames(persisted, []);
  list.names.length = Math.min(list.names.length, target);
  padNames(list, target, prefix);
  return list.names;
}

/**
 * Distributes participants across the given slots.
 *
 * Unlike the old implementation this never truncates an over-full slot and
 * never drops an assignment: anything that matches no slot is returned in
 * `unplaced` so the UI can still show it.
 */
export function buildPlanSlots<T extends { id: string }>(
  names: string[],
  members: T[],
  titleOf: (member: T) => string,
  maxPerSlot: number
): { slots: PlanSlot<T>[]; unplaced: T[] } {
  const byTitle = new Map<string, T[]>();
  for (const name of names) byTitle.set(name, []);

  const unplaced: T[] = [];
  for (const member of members) {
    const title = titleOf(member);
    const slot = title ? byTitle.get(title) : undefined;
    if (slot) slot.push(member);
    else unplaced.push(member);
  }

  const slots = names.map((label) => {
    const registrants = byTitle.get(label) ?? [];
    return {
      label,
      registrants,
      emptyCount: Math.max(0, maxPerSlot - registrants.length),
      overCapacity: registrants.length > maxPerSlot,
    };
  });

  return { slots, unplaced };
}
