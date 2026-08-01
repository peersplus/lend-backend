import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('MONGODB_URI is not set in apps/api/.env');
  process.exit(1);
}

const shouldClean = process.argv.includes('--clean');
const idPrefix = `urgent-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function uid(suffix: string) {
  return `${idPrefix}-${suffix}`;
}

async function cleanup(ids: {
  requestId: string;
  itemIds: string[];
  ownerUserIds: string[];
  requesterUserId: string;
  ownerProfileIds: string[];
  requesterProfileId: string;
}) {
  const [{ Request }, { Item }, { Profile }, { Notification }, { RequestOffer }] = await Promise.all([
    import('../src/models/Request.js'),
    import('../src/models/Item.js'),
    import('../src/models/Profile.js'),
    import('../src/models/Notification.js'),
    import('../src/models/RequestOffer.js'),
  ]);

  await Promise.all([
    Request.deleteOne({ id: ids.requestId }),
    Item.deleteMany({ id: { $in: ids.itemIds } }),
    Profile.deleteMany({ user_id: { $in: [...ids.ownerUserIds, ids.requesterUserId] } }),
    Profile.deleteMany({ id: { $in: [...ids.ownerProfileIds, ids.requesterProfileId] } }),
    Notification.deleteMany({
      $or: [
        { reference_id: ids.requestId },
        { 'metadata.request_id': ids.requestId },
        { user_id: { $in: ids.ownerUserIds } },
      ],
    }),
    RequestOffer.deleteMany({ request_id: ids.requestId }),
  ]);
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const [{ createRequest }, { env }, { Profile }, { Item }, { Notification }] = await Promise.all([
    import('../src/services/listingService.js'),
    import('../src/config/env.js'),
    import('../src/models/Profile.js'),
    import('../src/models/Item.js'),
    import('../src/models/Notification.js'),
  ]);

  // Keep the test deterministic and avoid live SMTP side effects.
  env.smtpHost = '';
  env.smtpPort = 0;
  env.smtpUser = '';
  env.smtpPass = '';

  const requesterUserId = uid('requester-user');
  const requesterProfileId = uid('requester-profile');
  const ownerMatchUserId = uid('owner-match-user');
  const ownerNoMatchUserId = uid('owner-no-match-user');
  const ownerFarMatchUserId = uid('owner-far-match-user');

  const ownerProfileIds = [uid('owner-match-profile'), uid('owner-no-match-profile'), uid('owner-far-match-profile')];

  const requesterLat = 18.5204;
  const requesterLng = 73.8567;

  const ids = {
    requestId: uid('request'),
    itemIds: [uid('item-match-near'), uid('item-nomatch-near'), uid('item-match-far')],
    ownerUserIds: [ownerMatchUserId, ownerNoMatchUserId, ownerFarMatchUserId],
    requesterUserId,
    ownerProfileIds,
    requesterProfileId,
  };

  if (shouldClean) {
    await cleanup(ids);
    await mongoose.disconnect();
    console.log('Cleaned test records');
    return;
  }

  await cleanup(ids);

  const now = new Date().toISOString();

  await Profile.insertMany([
    {
      id: requesterProfileId,
      user_id: requesterUserId,
      full_name: 'Requester User',
      email: 'requester@test.local',
      phone: null,
      avatar_url: null,
      neighborhood: 'Center',
      lat: requesterLat,
      lng: requesterLng,
      fcm_tokens: [],
      location_id: null,
      brand_ids: [],
      is_active: true,
      on_leave: false,
      leave_start_date: null,
      leave_end_date: null,
      last_login_at: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: ownerProfileIds[0],
      user_id: ownerMatchUserId,
      full_name: 'Match Owner',
      email: 'owner1@test.local',
      phone: null,
      avatar_url: null,
      neighborhood: 'Near Match',
      lat: requesterLat + 0.005,
      lng: requesterLng + 0.004,
      fcm_tokens: [],
      location_id: null,
      brand_ids: [],
      is_active: true,
      on_leave: false,
      leave_start_date: null,
      leave_end_date: null,
      last_login_at: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: ownerProfileIds[1],
      user_id: ownerNoMatchUserId,
      full_name: 'No Match Owner',
      email: 'owner2@test.local',
      phone: null,
      avatar_url: null,
      neighborhood: 'Near No Match',
      lat: requesterLat + 0.004,
      lng: requesterLng + 0.004,
      fcm_tokens: [],
      location_id: null,
      brand_ids: [],
      is_active: true,
      on_leave: false,
      leave_start_date: null,
      leave_end_date: null,
      last_login_at: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: ownerProfileIds[2],
      user_id: ownerFarMatchUserId,
      full_name: 'Far Match Owner',
      email: 'owner3@test.local',
      phone: null,
      avatar_url: null,
      neighborhood: 'Far Match',
      lat: requesterLat + 0.35,
      lng: requesterLng + 0.35,
      fcm_tokens: [],
      location_id: null,
      brand_ids: [],
      is_active: true,
      on_leave: false,
      leave_start_date: null,
      leave_end_date: null,
      last_login_at: null,
      created_at: now,
      updated_at: now,
    },
  ]);

  await Item.insertMany([
    {
      id: ids.itemIds[0],
      owner_id: ownerMatchUserId,
      title: 'USB-C Fast Charger 65W',
      description: 'Phone charger with type-c cable',
      category: 'Electronics',
      price_mode: 'free',
      price_amount: null,
      deposit_amount: null,
      image_url: null,
      image_urls: [],
      video_url: null,
      status: 'available',
      building_name: null,
      address: null,
      lat: requesterLat + 0.005,
      lng: requesterLng + 0.004,
      created_at: now,
      updated_at: now,
    },
    {
      id: ids.itemIds[1],
      owner_id: ownerNoMatchUserId,
      title: 'Camping Tent 2-Person',
      description: 'Outdoor tent',
      category: 'Camping',
      price_mode: 'free',
      price_amount: null,
      deposit_amount: null,
      image_url: null,
      image_urls: [],
      video_url: null,
      status: 'available',
      building_name: null,
      address: null,
      lat: requesterLat + 0.004,
      lng: requesterLng + 0.004,
      created_at: now,
      updated_at: now,
    },
    {
      id: ids.itemIds[2],
      owner_id: ownerFarMatchUserId,
      title: 'Phone Charger Adapter',
      description: 'Charger and cable',
      category: 'Electronics',
      price_mode: 'free',
      price_amount: null,
      deposit_amount: null,
      image_url: null,
      image_urls: [],
      video_url: null,
      status: 'available',
      building_name: null,
      address: null,
      lat: requesterLat + 0.35,
      lng: requesterLng + 0.35,
      created_at: now,
      updated_at: now,
    },
  ]);

  const createdRequest = await createRequest(requesterUserId, {
    id: ids.requestId,
    owner_id: requesterUserId,
    title: 'Need a charger urgently, phone is about to switch off',
    description: 'Type-c charger needed immediately for a few hours',
    category: 'Electronics',
    urgency: 'urgent',
    needed_by: null,
    radius_km: 5,
    image_url: null,
    status: 'open',
    lat: requesterLat,
    lng: requesterLng,
    created_at: now,
    updated_at: now,
  });

  const alerts = await Notification.find({
    type: 'urgent_request_match',
    reference_id: createdRequest?.id,
  }).lean();

  const recipients = alerts.map((n: any) => n.user_id);
  const matchedTitles = alerts.map((n: any) => n.metadata?.matched_item_title).filter(Boolean);

  console.log('\nUrgent request NLP test result');
  console.table(alerts.map((n: any) => ({
    user_id: n.user_id,
    type: n.type,
    title: n.title,
    matched_item_title: n.metadata?.matched_item_title || null,
    match_score: n.metadata?.match_score ?? null,
    distance_km: n.metadata?.distance_km ?? null,
    stage: n.metadata?.stage ?? null,
  })));

  const hasMatchOwner = recipients.includes(ownerMatchUserId);
  const hasNoMatchOwner = recipients.includes(ownerNoMatchUserId);
  const hasFarOwner = recipients.includes(ownerFarMatchUserId);

  console.log(`\nExpected matched owner notified: ${hasMatchOwner ? 'YES' : 'NO'}`);
  console.log(`Expected non-matching owner not notified: ${hasNoMatchOwner ? 'NO (correct)' : 'YES (correct)'}`);
  console.log(`Expected far owner not notified: ${hasFarOwner ? 'NO (unexpected)' : 'YES (correct)'}`);
  console.log(`Matched item titles: ${matchedTitles.join(', ') || '(none)'}`);

  await cleanup(ids);
  await mongoose.disconnect();

  if (!hasMatchOwner || hasNoMatchOwner || hasFarOwner) {
    console.error('\nTest FAILED: matching outcome was not as expected.');
    process.exit(2);
  }

  console.log('\nTest PASSED: urgent NLP matching notified nearby relevant owner only.');
}

run().catch(async (error) => {
  console.error('Test script failed:', error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
