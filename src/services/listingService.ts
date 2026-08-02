import { randomUUID } from 'node:crypto';
import { Item } from '../models/Item.js';
import { Booking } from '../models/Booking.js';
import { Request } from '../models/Request.js';
import { RequestOffer } from '../models/RequestOffer.js';
import { Message } from '../models/Message.js';
import { Profile } from '../models/Profile.js';
import { persistNotification, sendPushToUser } from './firebaseService.js';
import { sendMail } from './mailService.js';
import { env } from '../config/env.js';

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'because', 'by', 'for', 'from', 'get', 'have', 'help', 'i', 'in', 'is', 'it',
  'me', 'my', 'need', 'needed', 'needs', 'of', 'on', 'or', 'our', 'please', 'the', 'to', 'urgent', 'urgently', 'us', 'we', 'with', 'you', 'your',
]);

const URGENT_MATCH_PATTERNS: Record<string, string[]> = {
  charger: ['charger', 'charging', 'cable', 'usb', 'type c', 'type-c', 'lightning', 'adapter', 'power bank', 'powerbank'],
  laptop: ['laptop', 'notebook', 'macbook'],
  phone: ['phone', 'mobile', 'smartphone', 'iphone', 'android'],
  medicine: ['medicine', 'med', 'tablet', 'capsule', 'first aid', 'first-aid', 'bandage'],
  wheelchair: ['wheelchair', 'wheel chair'],
  stroller: ['stroller', 'pram', 'baby carriage'],
  pump: ['air pump', 'pump', 'inflator'],
  tool: ['tool', 'drill', 'screwdriver', 'hammer', 'wrench', 'spanner', 'pliers', 'cutter', 'saw'],
  inverter: ['inverter', 'ups', 'backup battery', 'battery backup'],
  torch: ['torch', 'flashlight', 'emergency light'],
};

function lean(doc: any) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject() : { ...doc };
  delete o._id;
  return o;
}

function toNumber(value: unknown) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeImageUrls(input: unknown, fallback: unknown): string[] {
  const values = Array.isArray(input)
    ? input
    : Array.isArray(fallback)
      ? fallback
      : [];

  return Array.from(
    new Set(
      values
        .map((entry) => String(entry || '').trim())
        .filter(Boolean),
    ),
  );
}

function normalizeItemPayload(data: Record<string, unknown>) {
  const imageUrls = normalizeImageUrls(data.image_urls, data.image_url ? [data.image_url] : []);
  const imageUrl = imageUrls[0] || null;
  const videoUrl = String(data.video_url || '').trim() || null;
  return {
    ...data,
    image_urls: imageUrls,
    image_url: imageUrl,
    video_url: videoUrl,
  };
}

function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function tokenizeNaturalText(input: string) {
  const normalized = String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return [] as string[];
  return normalized
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function expandIntentTerms(tokens: string[], text: string) {
  const expanded = new Set(tokens);
  const normalizedText = String(text || '').toLowerCase();

  for (const [label, phrases] of Object.entries(URGENT_MATCH_PATTERNS)) {
    const hasMatch = phrases.some((phrase) => normalizedText.includes(phrase));
    if (hasMatch) expanded.add(label);
  }

  return Array.from(expanded);
}

function scoreItemRelevance(item: any, requestTerms: string[], requestText: string, requestCategory: string) {
  const haystack = [item?.title, item?.description, item?.category]
    .map((value) => String(value || '').toLowerCase())
    .join(' ');
  if (!haystack.trim()) return { score: 0, matchedTerms: [] as string[] };

  const matchedTerms = requestTerms.filter((term) => haystack.includes(term));
  let score = matchedTerms.length;

  for (const [label, phrases] of Object.entries(URGENT_MATCH_PATTERNS)) {
    const reqHasLabel = requestTerms.includes(label) || phrases.some((phrase) => requestText.includes(phrase));
    if (!reqHasLabel) continue;
    const itemHasLabel = haystack.includes(label) || phrases.some((phrase) => haystack.includes(phrase));
    if (itemHasLabel) score += 3;
  }

  const itemCategory = String(item?.category || '').trim().toLowerCase();
  if (requestCategory && itemCategory && requestCategory === itemCategory) {
    score += 2;
  }

  return { score, matchedTerms };
}

async function notifyUrgentRequestMatches(request: any, actorUserId: string, options?: { stage?: 'initial' | 'realert' }) {
  const lat = toNumber(request?.lat);
  const lng = toNumber(request?.lng);
  if (lat == null || lng == null) return;

  const requestText = [request?.title, request?.description].map((value) => String(value || '')).join(' ').toLowerCase();
  const requestCategory = String(request?.category || '').trim().toLowerCase();
  const baseTokens = tokenizeNaturalText(requestText);
  const requestTerms = expandIntentTerms(baseTokens, requestText);
  if (!requestTerms.length) return;

  const radiusKm = Math.max(1, Math.min(30, toNumber(request?.radius_km) ?? 5));
  const items = await Item.find({ status: 'available', owner_id: { $ne: actorUserId } })
    .limit(Math.max(50, env.urgentMatchMaxItems))
    .lean();
  if (!items.length) return;

  const ownerIds = Array.from(new Set(items.map((item: any) => String(item?.owner_id || '')).filter(Boolean)));
  const ownerProfiles = ownerIds.length
    ? await Profile.find({ user_id: { $in: ownerIds } }, { user_id: 1, lat: 1, lng: 1 }).lean()
    : [];
  const ownerById = new Map(ownerProfiles.map((profile: any) => [String(profile.user_id || ''), profile]));

  const bestByOwner = new Map<string, { itemId: string; itemTitle: string; score: number; matchedTerms: string[]; distanceKm: number }>();

  for (const item of items as any[]) {
    const ownerId = String(item?.owner_id || '');
    if (!ownerId || ownerId === actorUserId) continue;

    const itemLat = toNumber(item?.lat);
    const itemLng = toNumber(item?.lng);
    const ownerProfile = ownerById.get(ownerId);
    const ownerLat = toNumber(ownerProfile?.lat);
    const ownerLng = toNumber(ownerProfile?.lng);
    const targetLat = itemLat ?? ownerLat;
    const targetLng = itemLng ?? ownerLng;
    if (targetLat == null || targetLng == null) continue;

    const distanceKm = getDistanceKm(lat, lng, targetLat, targetLng);
    if (distanceKm > radiusKm) continue;

    const relevance = scoreItemRelevance(item, requestTerms, requestText, requestCategory);
    if (relevance.score < env.urgentMatchMinScore) continue;

    const existing = bestByOwner.get(ownerId);
    if (!existing || relevance.score > existing.score || (relevance.score === existing.score && distanceKm < existing.distanceKm)) {
      bestByOwner.set(ownerId, {
        itemId: String(item?.id || ''),
        itemTitle: String(item?.title || 'an item'),
        score: relevance.score,
        matchedTerms: relevance.matchedTerms,
        distanceKm,
      });
    }
  }

  if (!bestByOwner.size) return;

  const stage = options?.stage || 'initial';
  const prioritized = Array.from(bestByOwner.entries())
    .sort((a, b) => {
      if (b[1].score !== a[1].score) return b[1].score - a[1].score;
      return a[1].distanceKm - b[1].distanceKm;
    })
    .slice(0, Math.max(1, env.urgentMatchMaxRecipients));

  await Promise.allSettled(prioritized.map(async ([ownerId, match]) => {
    const title = stage === 'realert' ? 'Reminder: urgent help request nearby' : 'Urgent help request nearby';
    const body = `Neighbor needs help now: ${request?.title || 'Urgent request'}. You have ${match.itemTitle}.`;

    await Promise.allSettled([
      sendPushToUser(ownerId, {
        title,
        body,
        data: {
          type: 'urgent_request_match',
          priority: 'high',
          stage,
          request_id: String(request?.id || ''),
          matched_item_id: match.itemId,
        },
      }),
      persistNotification({
        userId: ownerId,
        title,
        body,
        type: 'urgent_request_match',
        referenceId: String(request?.id || ''),
        referenceType: 'request',
        metadata: {
          request_id: request?.id || null,
          matched_item_id: match.itemId,
          matched_item_title: match.itemTitle,
          matched_terms: match.matchedTerms,
          distance_km: Number(match.distanceKm.toFixed(2)),
          match_score: match.score,
          stage,
          ai_signal: 'keyword_nlp_v1',
        },
      }),
    ]);
  }));
}

function scheduleUrgentRealertIfNeeded(requestId: string, userId: string) {
  if (!env.urgentRealertEnabled) return;
  const delayMs = Math.max(1, env.urgentRealertMinutes) * 60 * 1000;

  const timer = setTimeout(async () => {
    try {
      const request = await Request.findOne({ id: requestId, status: 'open' }).lean();
      if (!request) return;

      const offerCount = await RequestOffer.countDocuments({ request_id: requestId });
      if (offerCount > 0) return;

      await notifyUrgentRequestMatches(request, userId, { stage: 'realert' });
    } catch (error) {
      console.error('[urgent-match] re-alert failed', error);
    }
  }, delayMs);

  if (typeof (timer as any).unref === 'function') {
    (timer as any).unref();
  }
}

async function emitNotifications(recipients: string[], payload: {
  title: string;
  body: string;
  type: string;
  referenceId?: string;
  referenceType?: string;
  metadata?: Record<string, unknown>;
}) {
  if (!recipients.length) return;

  const uniqueRecipients = Array.from(new Set(recipients.filter(Boolean)));
  await Promise.allSettled(uniqueRecipients.map(async (userId) => {
    await Promise.allSettled([
      sendPushToUser(userId, {
        title: payload.title,
        body: payload.body,
        data: {
          type: payload.type,
          ...(payload.referenceId ? { reference_id: payload.referenceId } : {}),
          ...(payload.referenceType ? { reference_type: payload.referenceType } : {}),
        },
      }),
      persistNotification({
        userId,
        title: payload.title,
        body: payload.body,
        type: payload.type,
        referenceId: payload.referenceId,
        referenceType: payload.referenceType,
        metadata: payload.metadata,
      }),
    ]);
  }));
}

async function sendItemCreatedEmail(item: any) {
  const ownerId = String(item?.owner_id || '').trim();
  if (!ownerId) return;

  const ownerProfile = await Profile.findOne({ user_id: ownerId }).lean();
  const ownerEmail = String(ownerProfile?.email || '').trim();
  if (!ownerEmail) return;

  const itemTitle = String(item?.title || '').trim() || 'your item';
  const ownerName = ownerProfile?.full_name || ownerEmail || 'there';
  const appUrl = `${process.env.PUBLIC_FRONTEND_URL || 'http://localhost:8080'}/items`;

  await sendMail({
    to: ownerEmail,
    subject: `Item listed: ${itemTitle}`,
    html: `<p>Hi ${ownerName},</p><p>Your item <strong>${itemTitle}</strong> was added successfully.</p><p>You can view and manage it here: <a href="${appUrl}">${appUrl}</a></p>`,
    text: `Hi ${ownerName}, your item ${itemTitle} was added successfully. Manage it at ${appUrl}`,
  });
}

async function notifyNearbyUsersForItem(item: any, actorUserId?: string) {
  const profiles = await Profile.find({
    user_id: { $ne: actorUserId || null },
  }, {
    user_id: 1,
  }).lean();

  const nearbyUserIds = profiles
    .map((profile: any) => profile.user_id)
    .filter(Boolean);

  if (!nearbyUserIds.length) return;

  await emitNotifications(nearbyUserIds, {
    title: 'Item added near you',
    body: `${item?.title || 'A new item'} was added near you.`,
    type: 'item_nearby',
    referenceId: item?.id,
    referenceType: 'item',
    metadata: { item_title: item?.title || null, item_id: item?.id || null },
  });
}

async function notifyRequestFollowers(request: any) {
  const offerDocs = await RequestOffer.find({ request_id: request?.id }).lean();
  const recipients = [request?.owner_id, ...offerDocs.map((doc: any) => doc.helper_id)].filter(Boolean);
  if (!recipients.length) return;

  const statusLabel = request?.status === 'closed' ? 'closed' : 'reopened';
  await emitNotifications(recipients as string[], {
    title: `Request ${statusLabel}`,
    body: `${request?.title || 'Your request'} was ${statusLabel}.`,
    type: 'request_updated',
    referenceId: request?.id,
    referenceType: 'request',
    metadata: { request_title: request?.title || null, status: request?.status || null },
  });
}

export function buildBookingNotificationPlan(
  previousStatus: string | null,
  nextStatus: string,
  itemTitle: string,
  ownerId: string,
  borrowerId: string,
) {
  const title = itemTitle || 'your item';
  const baseData = {
    referenceType: 'booking',
    metadata: { item_title: title },
  };

  switch (nextStatus) {
    case 'requested':
      return [{
        userId: ownerId,
        title: 'New booking request',
        body: `Someone requested to borrow ${title}.`,
        type: 'booking_requested',
        ...baseData,
      }];
    case 'approved':
      return [{
        userId: borrowerId,
        title: 'Booking approved',
        body: `Your request for ${title} was approved.`,
        type: 'booking_approved',
        ...baseData,
      }];
    case 'picked_up':
      return [
        {
          userId: ownerId,
          title: 'Item picked up',
          body: `${title} was marked as picked up.`,
          type: 'booking_picked_up',
          ...baseData,
        },
        {
          userId: borrowerId,
          title: 'Item picked up',
          body: `You picked up ${title}.`,
          type: 'booking_picked_up',
          ...baseData,
        },
      ];
    case 'returned':
    case 'defect_reported':
      return [
        {
          userId: ownerId,
          title: nextStatus === 'defect_reported' ? 'Return reported' : 'Item returned',
          body: `${title} was ${nextStatus === 'defect_reported' ? 'reported as returned with a defect' : 'returned'}.`,
          type: nextStatus === 'defect_reported' ? 'booking_return_reported' : 'booking_returned',
          ...baseData,
        },
        {
          userId: borrowerId,
          title: nextStatus === 'defect_reported' ? 'Return reported' : 'Item returned',
          body: `You ${nextStatus === 'defect_reported' ? 'reported a return issue for' : 'returned'} ${title}.`,
          type: nextStatus === 'defect_reported' ? 'booking_return_reported' : 'booking_returned',
          ...baseData,
        },
      ];
    case 'declined':
      return [{
        userId: borrowerId,
        title: 'Booking declined',
        body: `Your request for ${title} was declined.`,
        type: 'booking_declined',
        ...baseData,
      }];
    case 'cancelled':
      return [
        {
          userId: ownerId,
          title: 'Booking cancelled',
          body: `The booking for ${title} was cancelled.`,
          type: 'booking_cancelled',
          ...baseData,
        },
        {
          userId: borrowerId,
          title: 'Booking cancelled',
          body: `The booking for ${title} was cancelled.`,
          type: 'booking_cancelled',
          ...baseData,
        },
      ];
    default:
      return [];
  }
}

export function validateBookingRequestOwner(ownerId: string, borrowerId: string) {
  const normalizedOwnerId = String(ownerId || '').trim();
  const normalizedBorrowerId = String(borrowerId || '').trim();

  if (!normalizedOwnerId || !normalizedBorrowerId) {
    return { ok: true as const };
  }

  if (normalizedBorrowerId === normalizedOwnerId) {
    return { ok: false as const, message: 'You cannot request to borrow an item you created as the creator.' };
  }

  return { ok: true as const };
}

export function buildBookingRequestResendAction(status: string | null | undefined) {
  const normalizedStatus = String(status || '').trim().toLowerCase();
  if (normalizedStatus === 'requested') {
    return { shouldCancel: true, action: 'resend' as const };
  }
  return { shouldCancel: false, action: 'create' as const };
}

export function buildBookingReminderPlan(
  booking: Partial<{ urgency: string | null; reminder_count: number | null; created_at: string | null; status: string | null }>,
  ownerId: string,
  borrowerId: string,
) {
  const urgency = String(booking?.urgency || 'normal').trim().toLowerCase() === 'urgent' ? 'urgent' : 'normal';
  const isHighAlert = urgency === 'urgent';
  const reminderCount = Number(booking?.reminder_count || 0) + 1;
  const title = isHighAlert ? 'High alert: urgent booking request' : 'Reminder: booking request still waiting';
  const body = isHighAlert
    ? 'Please respond within 30 minutes to this urgent request so the borrower gets a timely answer.'
    : 'Please respond soon — this request has been waiting for your response for more than a day.';
  const type = isHighAlert ? 'booking_request_high_alert' : 'booking_request_reminder';

  return {
    isHighAlert,
    title,
    body,
    type,
    userId: ownerId,
    reminderCount,
    urgency,
    metadata: { urgency, reminder_count: reminderCount, response_window: isHighAlert ? '30m' : '24h' },
  };
}

async function sendBookingRequestEmail(booking: any) {
  const itemDoc = await Item.findOne({ id: booking?.item_id }).lean();
  const ownerId = String(booking?.owner_id || itemDoc?.owner_id || '');
  const borrowerId = String(booking?.borrower_id || '');
  const itemTitle = itemDoc?.title || 'your item';

  if (!ownerId || !borrowerId || String(booking?.status || 'requested') !== 'requested') {
    return;
  }

  const [ownerProfile, borrowerProfile] = await Promise.all([
    Profile.findOne({ user_id: ownerId }).lean(),
    Profile.findOne({ user_id: borrowerId }).lean(),
  ]);

  if (!ownerProfile?.email && !borrowerProfile?.email) return;

  const ownerName = ownerProfile?.full_name || ownerProfile?.email || 'there';
  const borrowerName = borrowerProfile?.full_name || borrowerProfile?.email || 'Someone';
  const reviewUrl = `${process.env.PUBLIC_FRONTEND_URL || 'http://localhost:8080'}/bookings`;
  const subject = `New booking request for ${itemTitle}`;
  const html = `
    <p>Hi ${ownerName},</p>
    <p>${borrowerName} requested to borrow <strong>${itemTitle}</strong>.</p>
    <p>Please <a href="${reviewUrl}">sign in and open your bookings</a> to review and respond to the request.</p>
    <p>You can approve, decline, or chat directly from there.</p>
  `;

  const outbound: Array<{ to: string; subject: string; html: string; text: string }> = [];

  if (ownerProfile?.email) {
    outbound.push({
      to: ownerProfile.email,
      subject,
      html,
      text: `${borrowerName} requested to borrow ${itemTitle}. Sign in to your bookings to review it: ${reviewUrl}`,
    });
  }

  if (borrowerProfile?.email) {
    outbound.push({
      to: borrowerProfile.email,
      subject: `Request sent for ${itemTitle}`,
      html: `
        <p>Hi ${borrowerProfile.full_name || 'there'},</p>
        <p>Your request to borrow <strong>${itemTitle}</strong> was sent to the owner.</p>
        <p>You can follow updates in <a href="${reviewUrl}">your bookings</a>.</p>
      `,
      text: `Your request for ${itemTitle} was sent. Track updates at ${reviewUrl}`,
    });
  }

  await Promise.allSettled(outbound.map((mail) => sendMail(mail)));
}

async function sendBookingReminderEmail(booking: any, reminderPlan: ReturnType<typeof buildBookingReminderPlan>) {
  const itemDoc = await Item.findOne({ id: booking?.item_id }).lean();
  const ownerId = String(booking?.owner_id || '');
  const borrowerId = String(booking?.borrower_id || '');
  const itemTitle = itemDoc?.title || 'your item';

  if (!ownerId || !borrowerId) return;

  const [ownerProfile, borrowerProfile] = await Promise.all([
    Profile.findOne({ user_id: ownerId }).lean(),
    Profile.findOne({ user_id: borrowerId }).lean(),
  ]);

  if (!ownerProfile?.email) return;

  const borrowerName = borrowerProfile?.full_name || borrowerProfile?.email || 'Someone';
  const reviewUrl = `${process.env.PUBLIC_FRONTEND_URL || 'http://localhost:8080'}/bookings`;
  const subject = reminderPlan.isHighAlert
    ? `High alert: ${borrowerName} needs a response for ${itemTitle} within 30 minutes`
    : `Reminder: ${borrowerName} is waiting for your response about ${itemTitle}`;
  const html = `
    <p>Hi ${ownerProfile.full_name || 'there'},</p>
    <p>${borrowerName} is waiting for your response about <strong>${itemTitle}</strong>.</p>
    <p>${reminderPlan.isHighAlert ? 'This is a high-alert reminder — please respond within 30 minutes.' : 'A reminder was sent because this request has been waiting for a response.'}</p>
    <p><a href="${reviewUrl}">Open your bookings</a> to approve, decline, or chat.</p>
  `;

  await sendMail({
    to: ownerProfile.email,
    subject,
    html,
    text: `${borrowerName} is waiting for your response about ${itemTitle}. ${reminderPlan.isHighAlert ? 'Please respond within 30 minutes.' : 'Please respond soon.'}`,
  });
}

export function buildBookingStatusEmailDrafts(params: {
  status: string;
  previousStatus?: string | null;
  bookingId?: string;
  itemTitle: string;
  owner?: { email?: string | null; full_name?: string | null };
  borrower?: { email?: string | null; full_name?: string | null };
  appUrl: string;
  pickupAt?: string | null;
  returnedAt?: string | null;
  defectNotes?: string | null;
  amountPaid?: number | null;
}) {
  const status = String(params.status || '').trim().toLowerCase();
  const oldStatus = String(params.previousStatus || '').trim().toLowerCase();
  if (!status || status === oldStatus || status === 'requested') return [] as Array<{ to: string; subject: string; html: string; text: string }>;

  const ownerEmail = String(params.owner?.email || '').trim();
  const borrowerEmail = String(params.borrower?.email || '').trim();
  const ownerName = params.owner?.full_name || ownerEmail || 'there';
  const borrowerName = params.borrower?.full_name || borrowerEmail || 'there';
  const itemTitle = params.itemTitle || 'your item';
  const bookingId = String(params.bookingId || '');
  const pickupAt = params.pickupAt ? new Date(params.pickupAt).toLocaleString() : null;
  const returnedAt = params.returnedAt ? new Date(params.returnedAt).toLocaleString() : null;
  const defectNotes = String(params.defectNotes || '').trim();
  const amountPaid = Number(params.amountPaid || 0);
  const appUrl = params.appUrl;

  const outbound: Array<{ to: string; subject: string; html: string; text: string }> = [];

  if (status === 'approved') {
    if (borrowerEmail) {
      outbound.push({
        to: borrowerEmail,
        subject: `Booking approved for ${itemTitle}`,
        html: `<p>Hi ${borrowerName},</p><p>Your booking request for <strong>${itemTitle}</strong> was approved.</p><p>You can coordinate pickup in chat and bookings: <a href="${appUrl}">${appUrl}</a></p>`,
        text: `Hi ${borrowerName}, your booking for ${itemTitle} was approved. Open ${appUrl}`,
      });
    }
    if (ownerEmail) {
      outbound.push({
        to: ownerEmail,
        subject: `You approved a booking for ${itemTitle}`,
        html: `<p>Hi ${ownerName},</p><p>You approved booking <strong>${bookingId}</strong> for <strong>${itemTitle}</strong>.</p><p>Track it in bookings: <a href="${appUrl}">${appUrl}</a></p>`,
        text: `Hi ${ownerName}, you approved booking ${bookingId} for ${itemTitle}. Open ${appUrl}`,
      });
    }
  }

  if (status === 'declined') {
    if (borrowerEmail) {
      outbound.push({
        to: borrowerEmail,
        subject: `Booking declined for ${itemTitle}`,
        html: `<p>Hi ${borrowerName},</p><p>Your booking request for <strong>${itemTitle}</strong> was declined.</p><p>You can browse other nearby items: <a href="${appUrl.replace('/bookings', '/items')}">Items</a></p>`,
        text: `Hi ${borrowerName}, your booking request for ${itemTitle} was declined.`,
      });
    }
    if (ownerEmail) {
      outbound.push({
        to: ownerEmail,
        subject: `You declined a booking for ${itemTitle}`,
        html: `<p>Hi ${ownerName},</p><p>You declined booking <strong>${bookingId}</strong> for <strong>${itemTitle}</strong>.</p><p>See details: <a href="${appUrl}">${appUrl}</a></p>`,
        text: `Hi ${ownerName}, you declined booking ${bookingId} for ${itemTitle}.`,
      });
    }
  }

  if (status === 'cancelled') {
    if (ownerEmail) {
      outbound.push({
        to: ownerEmail,
        subject: `Booking cancelled for ${itemTitle}`,
        html: `<p>Hi ${ownerName},</p><p>The booking for <strong>${itemTitle}</strong> was cancelled.</p><p>See details: <a href="${appUrl}">${appUrl}</a></p>`,
        text: `Hi ${ownerName}, booking for ${itemTitle} was cancelled.`,
      });
    }
    if (borrowerEmail) {
      outbound.push({
        to: borrowerEmail,
        subject: `Booking cancelled for ${itemTitle}`,
        html: `<p>Hi ${borrowerName},</p><p>The booking for <strong>${itemTitle}</strong> was cancelled.</p><p>See details: <a href="${appUrl}">${appUrl}</a></p>`,
        text: `Hi ${borrowerName}, booking for ${itemTitle} was cancelled.`,
      });
    }
  }

  if (status === 'picked_up') {
    if (ownerEmail) {
      outbound.push({
        to: ownerEmail,
        subject: `Item dispatched/picked up: ${itemTitle}`,
        html: `<p>Hi ${ownerName},</p><p><strong>${itemTitle}</strong> was marked as picked up${pickupAt ? ` at ${pickupAt}` : ''}.</p><p>Track this booking: <a href="${appUrl}">${appUrl}</a></p>`,
        text: `Hi ${ownerName}, ${itemTitle} was picked up${pickupAt ? ` at ${pickupAt}` : ''}.`,
      });
    }
    if (borrowerEmail) {
      outbound.push({
        to: borrowerEmail,
        subject: `Pickup confirmed: ${itemTitle}`,
        html: `<p>Hi ${borrowerName},</p><p>Pickup for <strong>${itemTitle}</strong> is confirmed${pickupAt ? ` at ${pickupAt}` : ''}.</p><p>Track this booking: <a href="${appUrl}">${appUrl}</a></p>`,
        text: `Hi ${borrowerName}, pickup for ${itemTitle} is confirmed${pickupAt ? ` at ${pickupAt}` : ''}.`,
      });
    }
  }

  if (status === 'returned') {
    if (ownerEmail) {
      outbound.push({
        to: ownerEmail,
        subject: `Return confirmed: ${itemTitle}`,
        html: `<p>Hi ${ownerName},</p><p><strong>${itemTitle}</strong> was marked returned${returnedAt ? ` at ${returnedAt}` : ''}.</p><p>${amountPaid > 0 ? `Amount recorded: <strong>$${amountPaid}</strong>.` : ''}</p><p>See booking: <a href="${appUrl}">${appUrl}</a></p>`,
        text: `Hi ${ownerName}, ${itemTitle} was returned${returnedAt ? ` at ${returnedAt}` : ''}.${amountPaid > 0 ? ` Amount: $${amountPaid}.` : ''}`,
      });
    }
    if (borrowerEmail) {
      outbound.push({
        to: borrowerEmail,
        subject: `Return recorded: ${itemTitle}`,
        html: `<p>Hi ${borrowerName},</p><p>Your return for <strong>${itemTitle}</strong> was recorded${returnedAt ? ` at ${returnedAt}` : ''}.</p><p>${amountPaid > 0 ? `Amount recorded: <strong>$${amountPaid}</strong>.` : ''}</p><p>See booking: <a href="${appUrl}">${appUrl}</a></p>`,
        text: `Hi ${borrowerName}, return for ${itemTitle} recorded${returnedAt ? ` at ${returnedAt}` : ''}.${amountPaid > 0 ? ` Amount: $${amountPaid}.` : ''}`,
      });
    }
  }

  if (status === 'defect_reported') {
    if (ownerEmail) {
      outbound.push({
        to: ownerEmail,
        subject: `Defect reported on return: ${itemTitle}`,
        html: `<p>Hi ${ownerName},</p><p>A defect was reported for returned item <strong>${itemTitle}</strong>.</p><p>${defectNotes ? `Notes: ${defectNotes}` : ''}</p><p>${amountPaid > 0 ? `Recorded amount: <strong>$${amountPaid}</strong>.` : ''}</p><p>Review booking: <a href="${appUrl}">${appUrl}</a></p>`,
        text: `Hi ${ownerName}, defect reported on ${itemTitle}.${defectNotes ? ` Notes: ${defectNotes}.` : ''}`,
      });
    }
    if (borrowerEmail) {
      outbound.push({
        to: borrowerEmail,
        subject: `Defect report submitted: ${itemTitle}`,
        html: `<p>Hi ${borrowerName},</p><p>Your return was marked with a defect for <strong>${itemTitle}</strong>.</p><p>${defectNotes ? `Notes: ${defectNotes}` : ''}</p><p>${amountPaid > 0 ? `Recorded amount: <strong>$${amountPaid}</strong>.` : ''}</p><p>See booking: <a href="${appUrl}">${appUrl}</a></p>`,
        text: `Hi ${borrowerName}, defect reported for ${itemTitle}.${defectNotes ? ` Notes: ${defectNotes}.` : ''}`,
      });
    }
  }

  if (status === 'completed') {
    if (ownerEmail) {
      outbound.push({
        to: ownerEmail,
        subject: `Booking completed: ${itemTitle}`,
        html: `<p>Hi ${ownerName},</p><p>Booking for <strong>${itemTitle}</strong> is now completed.</p><p>Thanks for sharing in your community.</p>`,
        text: `Hi ${ownerName}, booking for ${itemTitle} is completed.`,
      });
    }
    if (borrowerEmail) {
      outbound.push({
        to: borrowerEmail,
        subject: `Booking completed: ${itemTitle}`,
        html: `<p>Hi ${borrowerName},</p><p>Your booking for <strong>${itemTitle}</strong> is now completed.</p><p>Thanks for being a responsible neighbor.</p>`,
        text: `Hi ${borrowerName}, booking for ${itemTitle} is completed.`,
      });
    }
  }

  return outbound;
}

async function sendBookingStatusEmails(booking: any, previousStatus: string | null) {
  const itemDoc = await Item.findOne({ id: booking?.item_id }).lean();
  const ownerId = String(booking?.owner_id || itemDoc?.owner_id || '');
  const borrowerId = String(booking?.borrower_id || '');
  const itemTitle = itemDoc?.title || 'your item';
  if (!ownerId || !borrowerId) return;

  const [ownerProfile, borrowerProfile] = await Promise.all([
    Profile.findOne({ user_id: ownerId }).lean(),
    Profile.findOne({ user_id: borrowerId }).lean(),
  ]);

  const appUrl = `${process.env.PUBLIC_FRONTEND_URL || 'http://localhost:8080'}/bookings`;
  const outbound = buildBookingStatusEmailDrafts({
    status: String(booking?.status || ''),
    previousStatus,
    bookingId: String(booking?.id || ''),
    itemTitle,
    owner: { email: ownerProfile?.email || null, full_name: ownerProfile?.full_name || null },
    borrower: { email: borrowerProfile?.email || null, full_name: borrowerProfile?.full_name || null },
    appUrl,
    pickupAt: booking?.pickup_at || null,
    returnedAt: booking?.returned_at || null,
    defectNotes: booking?.defect_notes || null,
    amountPaid: Number(booking?.amount_paid || 0),
  });

  await Promise.allSettled(outbound.map((mail) => sendMail(mail)));
}

async function sendRequestCreatedEmail(request: any) {
  const ownerId = String(request?.owner_id || '');
  if (!ownerId) return;
  const ownerProfile = await Profile.findOne({ user_id: ownerId }).lean();
  if (!ownerProfile?.email) return;

  const requestTitle = request?.title || 'your request';
  const appUrl = `${process.env.PUBLIC_FRONTEND_URL || 'http://localhost:8080'}/requests`;
  await sendMail({
    to: ownerProfile.email,
    subject: `Request created: ${requestTitle}`,
    html: `<p>Hi ${ownerProfile.full_name || 'there'},</p><p>Your request <strong>${requestTitle}</strong> is now live.</p><p>Track responses here: <a href="${appUrl}">${appUrl}</a></p>`,
    text: `Your request ${requestTitle} is now live. Track responses at ${appUrl}`,
  });
}

async function sendRequestStatusFollowUpEmails(request: any, previousStatus?: string | null) {
  const currentStatus = String(request?.status || 'open').trim().toLowerCase();
  const oldStatus = String(previousStatus || '').trim().toLowerCase();
  if (currentStatus === oldStatus) return;

  const offerDocs = await RequestOffer.find({ request_id: request?.id }).lean();
  const helperIds = Array.from(new Set(offerDocs.map((doc: any) => String(doc?.helper_id || '')).filter(Boolean)));
  const recipients = Array.from(new Set([String(request?.owner_id || ''), ...helperIds].filter(Boolean)));
  if (!recipients.length) return;

  const profiles = await Profile.find({ user_id: { $in: recipients } }).lean();
  const profileByUserId = new Map(profiles.map((p: any) => [String(p.user_id || ''), p]));
  const ownerId = String(request?.owner_id || '');
  const requestTitle = request?.title || 'your request';
  const appUrl = `${process.env.PUBLIC_FRONTEND_URL || 'http://localhost:8080'}/requests`;

  const statusLabel = currentStatus === 'closed' ? 'closed' : currentStatus === 'open' ? 'reopened' : currentStatus;

  const outbound: Array<{ to: string; subject: string; html: string; text: string }> = [];
  for (const userId of recipients) {
    const profile = profileByUserId.get(userId);
    const email = String(profile?.email || '').trim();
    if (!email) continue;

    const isOwner = userId === ownerId;
    const person = profile?.full_name || email || 'there';
    outbound.push({
      to: email,
      subject: `Request ${statusLabel}: ${requestTitle}`,
      html: `<p>Hi ${person},</p><p>${isOwner ? 'Your request' : 'A request you follow'} <strong>${requestTitle}</strong> is now <strong>${statusLabel}</strong>.</p><p>Open requests: <a href="${appUrl}">${appUrl}</a></p>`,
      text: `${isOwner ? 'Your request' : 'A followed request'} ${requestTitle} is now ${statusLabel}. Open ${appUrl}`,
    });
  }

  await Promise.allSettled(outbound.map((mail) => sendMail(mail)));
}

async function sendRequestOfferFollowUpEmail(offer: any, requestDoc: any) {
  const ownerId = String(requestDoc?.owner_id || '');
  const helperId = String(offer?.helper_id || '');
  if (!ownerId || !helperId) return;

  const [ownerProfile, helperProfile] = await Promise.all([
    Profile.findOne({ user_id: ownerId }).lean(),
    Profile.findOne({ user_id: helperId }).lean(),
  ]);

  const requestTitle = requestDoc?.title || 'your request';
  const helperName = helperProfile?.full_name || helperProfile?.email || 'A neighbor';
  const appUrl = `${process.env.PUBLIC_FRONTEND_URL || 'http://localhost:8080'}/requests`;

  const outbound: Array<{ to: string; subject: string; html: string; text: string }> = [];

  if (ownerProfile?.email) {
    outbound.push({
      to: ownerProfile.email,
      subject: `New offer on request: ${requestTitle}`,
      html: `<p>Hi ${ownerProfile.full_name || 'there'},</p><p>${helperName} offered to help with <strong>${requestTitle}</strong>.</p><p>Review in requests: <a href="${appUrl}">${appUrl}</a></p>`,
      text: `${helperName} offered to help with ${requestTitle}. Review in ${appUrl}`,
    });
  }

  if (helperProfile?.email) {
    outbound.push({
      to: helperProfile.email,
      subject: `Offer sent for request: ${requestTitle}`,
      html: `<p>Hi ${helperProfile.full_name || 'there'},</p><p>Your offer for <strong>${requestTitle}</strong> was sent successfully.</p><p>Track updates in requests: <a href="${appUrl}">${appUrl}</a></p>`,
      text: `Your offer for ${requestTitle} was sent. Track updates in ${appUrl}`,
    });
  }

  await Promise.allSettled(outbound.map((mail) => sendMail(mail)));
}

async function sendBookingNotifications(booking: any, previousStatus: string | null) {
  const itemDoc = await Item.findOne({ id: booking?.item_id }).lean();
  const ownerId = String(booking?.owner_id || '');
  const borrowerId = String(booking?.borrower_id || '');
  const plan = buildBookingNotificationPlan(previousStatus, String(booking?.status || 'requested'), itemDoc?.title || 'your item', ownerId, borrowerId);
  if (!plan.length) return;

  if (String(booking?.status || 'requested') === 'requested') {
    await sendBookingRequestEmail(booking);
  }

  await sendBookingStatusEmails(booking, previousStatus);

  await emitNotifications(plan.map((entry: any) => entry.userId).filter(Boolean), {
    title: plan[0].title,
    body: plan[0].body,
    type: plan[0].type,
    referenceId: booking?.id,
    referenceType: 'booking',
    metadata: { item_title: itemDoc?.title || null, status: booking?.status || null },
  });
}

export async function listItems() {
  const docs = await Item.find({ status: 'available' }).sort({ created_at: -1 }).limit(60).lean();
  return docs.map((doc: any) => {
    doc.image_urls = normalizeImageUrls(doc.image_urls, doc.image_url ? [doc.image_url] : []);
    doc.image_url = doc.image_urls[0] || null;
    delete doc._id;
    return doc;
  });
}

export async function createItem(userId: string, data: Record<string, unknown>) {
  const now = new Date().toISOString();
  const normalized = normalizeItemPayload(data);
  const doc = await Item.create({
    id: randomUUID(),
    owner_id: userId,
    status: 'available',
    created_at: now,
    updated_at: now,
    ...normalized,
  });
  const item = lean(doc);
  await Promise.allSettled([
    notifyNearbyUsersForItem(item, userId),
    sendItemCreatedEmail(item),
  ]);
  return item;
}

export async function updateItem(id: string, data: Record<string, unknown>, actorUserId?: string) {
  const existing = await Item.findOne({ id }).lean();
  if (!existing) return null;
  if (actorUserId && String(existing.owner_id || '') !== actorUserId) {
    throw new Error('Forbidden: only the owner can edit this item');
  }

  const normalized = normalizeItemPayload(data);
  const doc = await Item.findOneAndUpdate({ id }, { $set: { ...normalized, updated_at: new Date().toISOString() } }, { new: true });
  const item = lean(doc);
  if (item) await notifyNearbyUsersForItem(item);
  return item;
}

export async function deleteItem(id: string, actorUserId?: string) {
  if (!actorUserId) return null;
  const doc = await Item.findOneAndDelete({ id, owner_id: actorUserId });
  return lean(doc);
}

export async function listBookings(userId: string, role: 'borrowed' | 'lent') {
  const field = role === 'borrowed' ? 'borrower_id' : 'owner_id';
  const docs = await Booking.find({ [field]: userId }).sort({ created_at: -1 }).lean();
  return docs.map((doc: any) => {
    delete doc._id;
    return doc;
  });
}

export async function createBooking(data: Record<string, unknown>) {
  const now = new Date().toISOString();
  const ownerId = String(data.owner_id || '');
  const borrowerId = String(data.borrower_id || '');
  const itemId = String(data.item_id || '');

  if (itemId) {
    const itemDoc = await Item.findOne({ id: itemId }).lean();
    const actualOwnerId = String(itemDoc?.owner_id || ownerId || '');
    const validation = validateBookingRequestOwner(actualOwnerId, borrowerId);
    if (!validation.ok) {
      throw new Error(validation.message || 'You cannot request to borrow an item you created.');
    }
  } else {
    const validation = validateBookingRequestOwner(ownerId, borrowerId);
    if (!validation.ok) {
      throw new Error(validation.message || 'You cannot request to borrow an item you created.');
    }
  }

  const existingPending = await Booking.findOne({
    item_id: itemId,
    borrower_id: borrowerId,
    status: 'requested',
  }).lean();

  if (existingPending) {
    const existing = await Booking.findOneAndUpdate(
      { id: existingPending.id },
      { $set: { updated_at: now, ...data, status: 'requested' } },
      { new: true },
    );
    const booking = lean(existing);
    if (booking) await sendBookingNotifications(booking, existingPending.status || null);
    return booking;
  }

  const doc = await Booking.create({
    id: randomUUID(),
    created_at: now,
    updated_at: now,
    urgency: String(data.urgency || 'normal').trim().toLowerCase() === 'urgent' ? 'urgent' : 'normal',
    reminder_count: 0,
    last_reminder_at: null,
    last_high_alert_at: null,
    response_deadline_at: null,
    ...data,
  });
  const booking = lean(doc);
  if (booking) await sendBookingNotifications(booking, null);
  return booking;
}

export async function updateBooking(id: string, data: Record<string, unknown>) {
  const previous = await Booking.findOne({ id }).lean();
  const now = new Date().toISOString();
  const action = String(data.action || '').trim().toLowerCase();

  if (action === 'remind' && previous?.status === 'requested') {
    const urgency = String(data.urgency || previous?.urgency || 'normal').trim().toLowerCase() === 'urgent' ? 'urgent' : 'normal';
    const reminderCount = Number(previous?.reminder_count || 0) + 1;
    const responseDeadlineAt = urgency === 'urgent'
      ? new Date(Date.now() + 30 * 60 * 1000).toISOString()
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const doc = await Booking.findOneAndUpdate(
      { id },
      {
        $set: {
          urgency,
          reminder_count: reminderCount,
          last_reminder_at: now,
          response_deadline_at: responseDeadlineAt,
          ...(urgency === 'urgent' ? { last_high_alert_at: now } : {}),
          updated_at: now,
        },
      },
      { new: true },
    );

    const booking = lean(doc);
    if (booking) {
      const reminderPlan = buildBookingReminderPlan(booking, String(booking.owner_id || ''), String(booking.borrower_id || ''));
      await sendBookingReminderEmail(booking, reminderPlan);
      await emitNotifications([String(booking.owner_id || '')].filter(Boolean), {
        title: reminderPlan.title,
        body: reminderPlan.body,
        type: reminderPlan.type,
        referenceId: booking.id,
        referenceType: 'booking',
        metadata: { item_title: booking.item_id || null, urgency: reminderPlan.urgency, reminder_count: reminderPlan.reminderCount },
      });
    }
    return booking;
  }

  const doc = await Booking.findOneAndUpdate({ id }, { $set: { ...data, updated_at: now } }, { new: true });
  const booking = lean(doc);
  if (booking) await sendBookingNotifications(booking, previous?.status || null);
  return booking;
}

function maskName(name: string) {
  const value = String(name || '').trim();
  if (!value) return 'Verified neighbor';
  const parts = value.split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Verified neighbor';
  return parts.map((part) => `${part.charAt(0).toUpperCase()}${part.length > 1 ? '.' : ''}`).join(' ');
}

export async function listPublicBookingFeedback(limit = 8) {
  const max = Number.isFinite(limit) ? Math.min(Math.max(Number(limit), 1), 24) : 8;
  const docs = await Booking.find({
    borrower_rating: { $gte: 1, $lte: 5 },
    borrower_feedback: { $ne: null },
    status: { $in: ['returned', 'completed', 'defect_reported'] },
  })
    .sort({ borrower_feedback_submitted_at: -1, returned_at: -1, created_at: -1 })
    .limit(max * 3)
    .lean();

  const rows = docs
    .map((doc: any) => {
      const feedback = String(doc?.borrower_feedback || '').trim();
      const rating = Number(doc?.borrower_rating || 0);
      if (!feedback || rating < 1 || rating > 5) return null;
      return {
        booking_id: String(doc?.id || ''),
        item_id: String(doc?.item_id || ''),
        borrower_id: String(doc?.borrower_id || ''),
        rating,
        feedback,
        created_at: String(doc?.borrower_feedback_submitted_at || doc?.returned_at || doc?.updated_at || ''),
      };
    })
    .filter(Boolean) as Array<{
      booking_id: string;
      item_id: string;
      borrower_id: string;
      rating: number;
      feedback: string;
      created_at: string;
    }>;

  const itemIds = Array.from(new Set(rows.map((row) => row.item_id).filter(Boolean)));
  const borrowerIds = Array.from(new Set(rows.map((row) => row.borrower_id).filter(Boolean)));

  const [items, borrowers] = await Promise.all([
    itemIds.length ? Item.find({ id: { $in: itemIds } }).lean() : Promise.resolve([]),
    borrowerIds.length ? Profile.find({ user_id: { $in: borrowerIds } }).lean() : Promise.resolve([]),
  ]);

  const itemMap = new Map(items.map((item: any) => [String(item.id || ''), String(item.title || 'Shared item')]));
  const borrowerMap = new Map(borrowers.map((profile: any) => [String(profile.user_id || ''), String(profile.full_name || '')]));

  const sorted = rows
    .sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .slice(0, max)
    .map((row) => ({
      booking_id: row.booking_id,
      rating: row.rating,
      feedback: row.feedback,
      item_title: itemMap.get(row.item_id) || 'Shared item',
      borrower_name: maskName(borrowerMap.get(row.borrower_id) || ''),
      created_at: row.created_at,
    }));

  return sorted;
}

export async function listRequests(userId?: string, isSuperadmin = false) {
  const query: Record<string, unknown> = {};
  if (!isSuperadmin) {
    if (userId) query.$or = [{ status: 'open' }, { owner_id: userId }];
    else query.status = 'open';
  }
  const docs = await Request.find(query).sort({ created_at: -1 }).limit(120).lean();
  return docs.map((doc: any) => {
    delete doc._id;
    return doc;
  });
}

export async function createRequest(userId: string, data: Record<string, unknown>) {
  const now = new Date().toISOString();
  const doc = await Request.create({ id: randomUUID(), owner_id: userId, status: 'open', created_at: now, updated_at: now, ...data });
  const request = lean(doc);
  if (request) {
    await sendRequestCreatedEmail(request);

    const lat = toNumber(request.lat);
    const lng = toNumber(request.lng);
    if (lat != null && lng != null) {
      const radiusKm = toNumber(request.radius_km) ?? 5;
      const profiles = await Profile.find({
        user_id: { $ne: userId },
        lat: { $ne: null },
        lng: { $ne: null },
      }).lean();
      const nearbyUserIds = profiles.filter((profile: any) => {
        const profileLat = toNumber(profile?.lat);
        const profileLng = toNumber(profile?.lng);
        if (profileLat == null || profileLng == null) return false;
        return getDistanceKm(lat, lng, profileLat, profileLng) <= radiusKm;
      }).map((profile: any) => profile.user_id).filter(Boolean);

      await emitNotifications(nearbyUserIds, {
        title: 'New neighborhood request',
        body: `${request.title || 'A neighbor'} needs help nearby.`,
        type: 'request_nearby',
        referenceId: request.id,
        referenceType: 'request',
        metadata: { request_title: request.title || null, request_id: request.id || null },
      });

      const isUrgent = String(request.urgency || '').trim().toLowerCase() === 'urgent';
      if (isUrgent) {
        await notifyUrgentRequestMatches(request, userId);
        scheduleUrgentRealertIfNeeded(String(request.id || ''), userId);
      }
    }
  }
  return request;
}

export async function updateRequest(id: string, data: Record<string, unknown>) {
  const previous = await Request.findOne({ id }).lean();
  const doc = await Request.findOneAndUpdate({ id }, { $set: { ...data, updated_at: new Date().toISOString() } }, { new: true });
  const request = lean(doc);
  if (request && previous?.status !== request?.status) {
    await sendRequestStatusFollowUpEmails(request, previous?.status || null);
    await notifyRequestFollowers(request);
  }
  return request;
}

export async function deleteRequest(id: string) {
  const doc = await Request.findOneAndDelete({ id });
  return lean(doc);
}

export async function createRequestOffer(data: Record<string, unknown>) {
  const now = new Date().toISOString();
  const doc = await RequestOffer.create({ id: randomUUID(), created_at: now, updated_at: now, ...data });
  const offer = lean(doc);
  if (offer) {
    const requestDoc = await Request.findOne({ id: offer.request_id }).lean();
    if (requestDoc?.owner_id) {
      await sendRequestOfferFollowUpEmail(offer, requestDoc);
      await emitNotifications([requestDoc.owner_id], {
        title: 'New help offer',
        body: `Someone offered to help with ${requestDoc.title || 'your request'}.`,
        type: 'request_offer_received',
        referenceId: offer.id,
        referenceType: 'request_offer',
        metadata: { request_id: requestDoc.id, request_title: requestDoc.title || null },
      });
    }
  }
  return offer;
}

export async function listRequestOffers(requestIds: string[]) {
  const docs = await RequestOffer.find({ request_id: { $in: requestIds } }).sort({ created_at: 1 }).lean();
  return docs.map((doc: any) => {
    delete doc._id;
    return doc;
  });
}

export async function listMessages(filters: Record<string, unknown>) {
  const docs = await Message.find(filters).sort({ created_at: 1 }).lean();
  return docs.map((doc: any) => {
    delete doc._id;
    return doc;
  });
}

export async function createMessage(data: Record<string, unknown>) {
  const now = new Date().toISOString();
  const doc = await Message.create({ id: randomUUID(), created_at: now, updated_at: now, ...data });
  return lean(doc);
}

export async function getProfileForUser(userId: string) {
  const doc = await Profile.findOne({ user_id: userId }).lean();
  return lean(doc);
}

export async function updateProfileForUser(userId: string, data: Record<string, unknown>) {
  const now = new Date().toISOString();
  const doc = await Profile.findOneAndUpdate(
    { user_id: userId },
    { $set: { ...data, updated_at: now }, $setOnInsert: { created_at: now, id: randomUUID(), user_id: userId, full_name: '', email: '' } },
    { upsert: true, new: true },
  );
  return lean(doc);
}
