import { db, type ActivityEntry } from '../db/db';
import { verifyActivityLog } from './activity';
import { missingDocNumbers } from './docs';
import { formatNgwee } from './format';

export type Severity = 'high' | 'medium';

export interface Alert {
  /** Stable id so the owner can mark an alert as reviewed. */
  id: string;
  severity: Severity;
  at: string;
  title: string;
  details: string;
  username?: string;
}

/** Thresholds for the unusual-activity checks. */
export const RULES = {
  largeRemovalNgwee: 200_000, // K 2,000 of stock removed in one go
  largeRemovalShare: 0.5, // or half of an item's stock
  writeOffsPerDay: 3, // removals by one person in one day
  priceDropShare: 0.2, // a price cut of 20% or more
  priceRestoreHours: 48, // a price lowered and put back within this time
  discountShare: 0.1, // discounts of 10% or more on a quotation or invoice
  openHour: 7,
  closeHour: 19,
};

const SIGN_IN_ACTIONS = new Set(['Signed in', 'Signed out', 'Signed out automatically', 'Failed sign-in attempt']);
const num = (e: ActivityEntry, k: string) => Number(e.meta?.[k] ?? NaN);
const day = (iso: string) => iso.slice(0, 10);

export function isAfterHours(iso: string): boolean {
  const d = new Date(iso);
  const h = d.getHours();
  return d.getDay() === 0 || h < RULES.openHour || h >= RULES.closeHour;
}

/** Rules that only need the activity log. Kept separate so they can be tested on plain data. */
export function activityAlerts(entries: ActivityEntry[]): Alert[] {
  const alerts: Alert[] = [];
  const sorted = [...entries].sort((a, b) => a.at.localeCompare(b.at));
  const removalsByUserDay = new Map<string, ActivityEntry[]>();
  const priceCuts: ActivityEntry[] = [];

  for (const e of sorted) {
    switch (e.action) {
      case 'Account locked':
        alerts.push({
          id: `locked:${e.id}`,
          severity: 'high',
          at: e.at,
          title: `${e.username}'s account was locked`,
          details: 'Someone typed the wrong password 5 times in a row. Check that it was really them.',
          username: e.username,
        });
        break;
      case 'Sign-in attempt while locked':
      case 'Blocked sign-in (account deactivated)':
        alerts.push({
          id: `blocked:${e.id}`,
          severity: 'medium',
          at: e.at,
          title: `Blocked sign-in on ${e.username}`,
          details: e.action === 'Sign-in attempt while locked' ? 'Tried to sign in while the account was locked.' : 'A deactivated account tried to sign in with the right password.',
          username: e.username,
        });
        break;
      case 'Stock removed': {
        const value = num(e, 'valueNgwee');
        const share = Math.abs(num(e, 'change')) / num(e, 'before');
        if (value >= RULES.largeRemovalNgwee || share >= RULES.largeRemovalShare)
          alerts.push({
            id: `removal:${e.id}`,
            severity: 'high',
            at: e.at,
            title: `Large stock removal by ${e.username}`,
            details: `${e.details}. Worth ${formatNgwee(value)} at selling price.`,
            username: e.username,
          });
        const key = `${e.userId}|${day(e.at)}`;
        removalsByUserDay.set(key, [...(removalsByUserDay.get(key) ?? []), e]);
        break;
      }
      case 'Stock uploaded':
        if (num(e, 'removedValueNgwee') >= RULES.largeRemovalNgwee)
          alerts.push({
            id: `upload:${e.id}`,
            severity: 'high',
            at: e.at,
            title: `Stock upload lowered quantities`,
            details: `${e.details}. An upload can hide missing stock, so compare it with a physical count.`,
            username: e.username,
          });
        break;
      case 'Invoice voided':
        alerts.push({
          id: `void:${e.id}`,
          severity: num(e, 'paidNgwee') > 0 ? 'high' : 'medium',
          at: e.at,
          title: `Invoice voided by ${e.username}`,
          details:
            e.details +
            (num(e, 'paidNgwee') > 0 ? `. ${formatNgwee(num(e, 'paidNgwee'))} had already been paid on it: check where the money went.` : ''),
          username: e.username,
        });
        break;
      case 'Payment details changed':
        alerts.push({
          id: `paydetails:${e.id}`,
          severity: 'high',
          at: e.at,
          title: `Mobile money or bank details changed by ${e.username}`,
          details: `${e.details}. Make sure every number belongs to the company, or customers' money could go to someone else.`,
          username: e.username,
        });
        break;
      case 'Payment rejected':
        alerts.push({
          id: `payreject:${e.id}`,
          severity: 'medium',
          at: e.at,
          title: `Payment rejected by ${e.username}`,
          details: `${e.details}. A fake or reused proof of payment is a warning sign.`,
          username: e.username,
        });
        break;
      case 'Quotation created':
      case 'Quotation edited':
      case 'Invoice issued':
      case 'Cash sale': {
        const gross = num(e, 'grossNgwee');
        const disc = num(e, 'discountNgwee');
        if (gross > 0 && disc / gross >= RULES.discountShare)
          alerts.push({
            id: `discount:${e.id}`,
            severity: 'medium',
            at: e.at,
            title: `${Math.round((disc / gross) * 100)}% discount given by ${e.username}`,
            details: `${e.details}. Discount ${formatNgwee(disc)} on ${formatNgwee(gross)}.`,
            username: e.username,
          });
        break;
      }
      case 'Price changed': {
        const oldP = num(e, 'oldNgwee');
        const newP = num(e, 'newNgwee');
        if (newP < oldP) priceCuts.push(e);
        if (oldP > 0 && (oldP - newP) / oldP >= RULES.priceDropShare)
          alerts.push({
            id: `pricecut:${e.id}`,
            severity: 'medium',
            at: e.at,
            title: `Big price cut by ${e.username}`,
            details: e.details,
            username: e.username,
          });
        // Lowered, then put back up: the pattern used to sell cheap to a friend or pocket the difference.
        const cut = priceCuts.find(
          (c) =>
            c.meta?.productId === e.meta?.productId &&
            num(c, 'newNgwee') === oldP &&
            newP >= num(c, 'oldNgwee') &&
            new Date(e.at).getTime() - new Date(c.at).getTime() <= RULES.priceRestoreHours * 3600_000,
        );
        if (cut)
          alerts.push({
            id: `priceflip:${e.id}`,
            severity: 'high',
            at: e.at,
            title: `Price lowered and then put back`,
            details: `${cut.details} by ${cut.username}, then back to ${formatNgwee(newP)} by ${e.username}. Check what was sold in between.`,
            username: cut.username,
          });
        break;
      }
    }
    if (!SIGN_IN_ACTIONS.has(e.action) && e.role !== 'owner' && isAfterHours(e.at))
      alerts.push({
        id: `hours:${e.id}`,
        severity: 'medium',
        at: e.at,
        title: `Activity outside business hours`,
        details: `${e.username}: ${e.action}${e.details ? ` (${e.details})` : ''}`,
        username: e.username,
      });
  }

  for (const [, list] of removalsByUserDay)
    if (list.length >= RULES.writeOffsPerDay)
      alerts.push({
        id: `writeoffs:${list[0].userId}:${day(list[0].at)}`,
        severity: 'high',
        at: list[list.length - 1].at,
        title: `${list.length} stock removals by ${list[0].username} in one day`,
        details: list.map((e) => e.details).join('; '),
        username: list[0].username,
      });

  return alerts;
}

/** All checks, newest first. */
export async function computeAlerts(): Promise<Alert[]> {
  const alerts = activityAlerts(await db.activity.toArray());

  const log = await verifyActivityLog();
  for (const p of log.problems)
    alerts.push({
      id: `log:${p.seq}:${p.problem}`,
      severity: 'high',
      at: p.at ?? new Date().toISOString(),
      title: 'The activity log has been tampered with',
      details: `${p.problem}. Someone may be trying to cover their tracks.`,
    });

  for (const n of await missingDocNumbers())
    alerts.push({
      id: `missingdoc:${n}`,
      severity: 'high',
      at: new Date().toISOString(),
      title: `Document ${n} is missing`,
      details: 'Numbers are never reused, so this quotation or invoice was deleted outside the app.',
    });

  // A quantity that does not match the item's own stock history was changed outside the app.
  const [products, moves] = await Promise.all([db.products.toArray(), db.stockMovements.toArray()]);
  const latest = new Map<string, { at: string; qty: number; total: number }>();
  for (const m of moves) {
    const cur = latest.get(m.productId) ?? { at: '', qty: 0, total: 0 };
    latest.set(m.productId, {
      at: m.at >= cur.at ? m.at : cur.at,
      qty: m.at >= cur.at ? m.quantityAfter : cur.qty,
      total: cur.total + m.change,
    });
  }
  for (const p of products) {
    const h = latest.get(p.id);
    const expected = h ? h.total : 0;
    if (p.quantity !== expected)
      alerts.push({
        id: `stockmismatch:${p.id}:${p.quantity}:${expected}`,
        severity: 'high',
        at: p.updatedAt,
        title: `Stock for ${p.name} does not match its history`,
        details: `Shows ${p.quantity} ${p.unit}, but its recorded movements add up to ${expected}. The number was changed outside the app.`,
      });
  }

  return alerts.sort((a, b) => b.at.localeCompare(a.at));
}

const REVIEWED = 'alerts.reviewed';

export async function reviewedAlertIds(): Promise<Set<string>> {
  try {
    return new Set(JSON.parse((await db.settings.get(REVIEWED))?.value ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

export async function markReviewed(ids: string[]) {
  const set = await reviewedAlertIds();
  ids.forEach((i) => set.add(i));
  await db.settings.put({ key: REVIEWED, value: JSON.stringify([...set]) });
}
