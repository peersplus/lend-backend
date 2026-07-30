import { randomUUID } from 'node:crypto';
import { Item } from '../models/Item.js';
import { Booking } from '../models/Booking.js';
import { Request } from '../models/Request.js';
import { RequestOffer } from '../models/RequestOffer.js';
import { Message } from '../models/Message.js';
import { Profile } from '../models/Profile.js';
import { persistNotification, sendPushToUser } from './firebaseService.js';
function lean(doc) {
    if (!doc)
        return null;
    const o = doc.toObject ? doc.toObject() : { ...doc };
    delete o._id;
    return o;
}
function toNumber(value) {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : null;
}
function getDistanceKm(lat1, lng1, lat2, lng2) {
    const toRad = (value) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
async function emitNotifications(recipients, payload) {
    if (!recipients.length)
        return;
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
async function notifyNearbyUsersForItem(item, actorUserId) {
    const lat = toNumber(item?.lat);
    const lng = toNumber(item?.lng);
    if (lat == null || lng == null)
        return;
    const profiles = await Profile.find({
        user_id: { $ne: actorUserId || null },
        lat: { $ne: null },
        lng: { $ne: null },
    }).lean();
    const nearbyUserIds = profiles
        .filter((profile) => {
        const profileLat = toNumber(profile?.lat);
        const profileLng = toNumber(profile?.lng);
        if (profileLat == null || profileLng == null)
            return false;
        return getDistanceKm(lat, lng, profileLat, profileLng) <= 5;
    })
        .map((profile) => profile.user_id)
        .filter(Boolean);
    if (!nearbyUserIds.length)
        return;
    await emitNotifications(nearbyUserIds, {
        title: 'New item nearby',
        body: `${item?.title || 'A new item'} was posted nearby.`,
        type: 'item_nearby',
        referenceId: item?.id,
        referenceType: 'item',
        metadata: { item_title: item?.title || null, item_id: item?.id || null },
    });
}
async function notifyRequestFollowers(request) {
    const offerDocs = await RequestOffer.find({ request_id: request?.id }).lean();
    const recipients = [request?.owner_id, ...offerDocs.map((doc) => doc.helper_id)].filter(Boolean);
    if (!recipients.length)
        return;
    const statusLabel = request?.status === 'closed' ? 'closed' : 'reopened';
    await emitNotifications(recipients, {
        title: `Request ${statusLabel}`,
        body: `${request?.title || 'Your request'} was ${statusLabel}.`,
        type: 'request_updated',
        referenceId: request?.id,
        referenceType: 'request',
        metadata: { request_title: request?.title || null, status: request?.status || null },
    });
}
export function buildBookingNotificationPlan(previousStatus, nextStatus, itemTitle, ownerId, borrowerId) {
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
async function sendBookingNotifications(booking, previousStatus) {
    const itemDoc = await Item.findOne({ id: booking?.item_id }).lean();
    const ownerId = String(booking?.owner_id || '');
    const borrowerId = String(booking?.borrower_id || '');
    const plan = buildBookingNotificationPlan(previousStatus, String(booking?.status || 'requested'), itemDoc?.title || 'your item', ownerId, borrowerId);
    if (!plan.length)
        return;
    await emitNotifications(plan.map((entry) => entry.userId).filter(Boolean), {
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
    return docs.map((doc) => {
        delete doc._id;
        return doc;
    });
}
export async function createItem(userId, data) {
    const now = new Date().toISOString();
    const doc = await Item.create({
        id: randomUUID(),
        owner_id: userId,
        status: 'available',
        created_at: now,
        updated_at: now,
        ...data,
    });
    const item = lean(doc);
    await notifyNearbyUsersForItem(item, userId);
    return item;
}
export async function updateItem(id, data) {
    const doc = await Item.findOneAndUpdate({ id }, { $set: { ...data, updated_at: new Date().toISOString() } }, { new: true });
    const item = lean(doc);
    if (item)
        await notifyNearbyUsersForItem(item);
    return item;
}
export async function deleteItem(id) {
    const doc = await Item.findOneAndDelete({ id });
    return lean(doc);
}
export async function listBookings(userId, role) {
    const field = role === 'borrowed' ? 'borrower_id' : 'owner_id';
    const docs = await Booking.find({ [field]: userId }).sort({ created_at: -1 }).lean();
    return docs.map((doc) => {
        delete doc._id;
        return doc;
    });
}
export async function createBooking(data) {
    const now = new Date().toISOString();
    const doc = await Booking.create({ id: randomUUID(), created_at: now, updated_at: now, ...data });
    const booking = lean(doc);
    if (booking)
        await sendBookingNotifications(booking, null);
    return booking;
}
export async function updateBooking(id, data) {
    const previous = await Booking.findOne({ id }).lean();
    const doc = await Booking.findOneAndUpdate({ id }, { $set: { ...data, updated_at: new Date().toISOString() } }, { new: true });
    const booking = lean(doc);
    if (booking)
        await sendBookingNotifications(booking, previous?.status || null);
    return booking;
}
export async function listRequests(userId, isSuperadmin = false) {
    const query = {};
    if (!isSuperadmin) {
        if (userId)
            query.$or = [{ status: 'open' }, { owner_id: userId }];
        else
            query.status = 'open';
    }
    const docs = await Request.find(query).sort({ created_at: -1 }).limit(120).lean();
    return docs.map((doc) => {
        delete doc._id;
        return doc;
    });
}
export async function createRequest(userId, data) {
    const now = new Date().toISOString();
    const doc = await Request.create({ id: randomUUID(), owner_id: userId, status: 'open', created_at: now, updated_at: now, ...data });
    const request = lean(doc);
    if (request) {
        const lat = toNumber(request.lat);
        const lng = toNumber(request.lng);
        if (lat != null && lng != null) {
            const radiusKm = toNumber(request.radius_km) ?? 5;
            const profiles = await Profile.find({
                user_id: { $ne: userId },
                lat: { $ne: null },
                lng: { $ne: null },
            }).lean();
            const nearbyUserIds = profiles.filter((profile) => {
                const profileLat = toNumber(profile?.lat);
                const profileLng = toNumber(profile?.lng);
                if (profileLat == null || profileLng == null)
                    return false;
                return getDistanceKm(lat, lng, profileLat, profileLng) <= radiusKm;
            }).map((profile) => profile.user_id).filter(Boolean);
            await emitNotifications(nearbyUserIds, {
                title: 'New neighborhood request',
                body: `${request.title || 'A neighbor'} needs help nearby.`,
                type: 'request_nearby',
                referenceId: request.id,
                referenceType: 'request',
                metadata: { request_title: request.title || null, request_id: request.id || null },
            });
        }
    }
    return request;
}
export async function updateRequest(id, data) {
    const previous = await Request.findOne({ id }).lean();
    const doc = await Request.findOneAndUpdate({ id }, { $set: { ...data, updated_at: new Date().toISOString() } }, { new: true });
    const request = lean(doc);
    if (request && previous?.status !== request?.status) {
        await notifyRequestFollowers(request);
    }
    return request;
}
export async function deleteRequest(id) {
    const doc = await Request.findOneAndDelete({ id });
    return lean(doc);
}
export async function createRequestOffer(data) {
    const now = new Date().toISOString();
    const doc = await RequestOffer.create({ id: randomUUID(), created_at: now, updated_at: now, ...data });
    const offer = lean(doc);
    if (offer) {
        const requestDoc = await Request.findOne({ id: offer.request_id }).lean();
        if (requestDoc?.owner_id) {
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
export async function listRequestOffers(requestIds) {
    const docs = await RequestOffer.find({ request_id: { $in: requestIds } }).sort({ created_at: 1 }).lean();
    return docs.map((doc) => {
        delete doc._id;
        return doc;
    });
}
export async function listMessages(filters) {
    const docs = await Message.find(filters).sort({ created_at: 1 }).lean();
    return docs.map((doc) => {
        delete doc._id;
        return doc;
    });
}
export async function createMessage(data) {
    const now = new Date().toISOString();
    const doc = await Message.create({ id: randomUUID(), created_at: now, updated_at: now, ...data });
    return lean(doc);
}
export async function getProfileForUser(userId) {
    const doc = await Profile.findOne({ user_id: userId }).lean();
    if (!doc)
        return null;
    delete doc._id;
    return doc;
}
export async function updateProfileForUser(userId, data) {
    const now = new Date().toISOString();
    const doc = await Profile.findOneAndUpdate({ user_id: userId }, { $set: { ...data, updated_at: now }, $setOnInsert: { created_at: now, id: randomUUID(), user_id: userId, full_name: '', email: '' } }, { upsert: true, new: true });
    return lean(doc);
}
