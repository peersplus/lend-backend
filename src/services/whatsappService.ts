import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { WhatsAppSession } from '../models/WhatsAppSession.js';
import { createItem, createRequest, listItems } from './listingService.js';

const MENU_TEXT = [
  '👋 Welcome to PeersPlus!',
  '',
  'Please choose an option:',
  '',
  '1️⃣ Lend an Item',
  '2️⃣ Request an Item',
  '3️⃣ Other',
  '',
  'Reply with 1, 2, or 3.',
].join('\n');

type Flow = 'menu' | 'lend' | 'request' | 'other';

type IncomingMessage = {
  phone: string;
  text: string;
};

function normalizePhone(phone: string) {
  return String(phone || '').trim().replace(/[^0-9+]/g, '');
}

function normalizeText(text: unknown) {
  return String(text || '').trim();
}

function buildUserIdFromPhone(phone: string) {
  return `wa:${normalizePhone(phone)}`;
}

function parseMoney(input: string) {
  const cleaned = String(input || '').replace(/[^0-9.]/g, '').trim();
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

function parseUrgency(input: string): 'normal' | 'urgent' | null {
  const value = String(input || '').trim().toLowerCase();
  if (['2', 'urgent', 'high', 'now', 'asap'].includes(value)) return 'urgent';
  if (['1', 'normal', 'regular'].includes(value)) return 'normal';
  return null;
}

function parsePriceMode(input: string): 'free' | 'rent' | null {
  const value = String(input || '').trim().toLowerCase();
  if (['1', 'free'].includes(value)) return 'free';
  if (['2', 'rent', 'rental'].includes(value)) return 'rent';
  return null;
}

function scoreMatch(haystack: string, terms: string[]) {
  let score = 0;
  for (const term of terms) {
    if (!term) continue;
    if (haystack.includes(term)) score += 1;
  }
  return score;
}

function extractIncomingMessages(payload: any): IncomingMessage[] {
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  const result: IncomingMessage[] = [];

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const messages = Array.isArray(change?.value?.messages) ? change.value.messages : [];
      for (const msg of messages) {
        const phone = normalizePhone(String(msg?.from || ''));
        if (!phone) continue;

        const text = normalizeText(
          msg?.text?.body
          || msg?.interactive?.button_reply?.title
          || msg?.interactive?.button_reply?.id
          || msg?.interactive?.list_reply?.title
          || msg?.interactive?.list_reply?.id
          || msg?.button?.text,
        );

        if (!text) continue;
        result.push({ phone, text });
      }
    }
  }

  return result;
}

async function sendWhatsAppText(to: string, body: string) {
  const token = String(env.whatsappAccessToken || '').trim();
  const phoneNumberId = String(env.whatsappPhoneNumberId || '').trim();
  const apiVersion = String(env.whatsappApiVersion || 'v18.0').trim();

  if (!token || !phoneNumberId) {
    console.warn('[whatsapp] Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID. Skipping send.');
    return;
  }

  const res = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to:'918800846237',
      type: 'template',
      template: { "name": "hello_world",
      language: { "code": "en_US" } }
    }),
  });

   const reason = await res.text();
       
    if (!res.ok) {
        throw new Error(`WhatsApp send failed (${res.status}): ${reason}`);
    }
    else{
          const reason = await res.text();
          console.log(`[whatsapp] Sent to ${to}: ${body} | response: ${reason}`);
    }
}

async function getSession(phone: string) {
  return WhatsAppSession.findOne({ phone, is_active: true }).lean();
}

async function setSession(phone: string, flow: Flow, step: string, data: Record<string, unknown>) {
  const now = new Date().toISOString();
  const existing = await WhatsAppSession.findOne({ phone, is_active: true }).lean();

  if (!existing) {
    await WhatsAppSession.create({
      id: randomUUID(),
      phone,
      flow,
      step,
      data,
      is_active: true,
      last_interaction_at: now,
      created_at: now,
      updated_at: now,
    });
    return;
  }

  await WhatsAppSession.findOneAndUpdate(
    { id: existing.id },
    {
      $set: {
        flow,
        step,
        data,
        last_interaction_at: now,
        updated_at: now,
      },
    },
  );
}

async function sendMenuAndReset(phone: string) {
  await setSession(phone, 'menu', 'awaiting_menu', {});
  await sendWhatsAppText(phone, MENU_TEXT);
}

async function handleLendFlow(phone: string, step: string, data: Record<string, unknown>, text: string) {
  const value = normalizeText(text);

  if (step === 'lend_title') {
    if (!value) {
      await sendWhatsAppText(phone, 'Please send item title. Example: Drill machine');
      return;
    }

    await setSession(phone, 'lend', 'lend_category', { ...data, title: value });
    await sendWhatsAppText(phone, 'Great. What category? Example: Tools, Electronics, Home');
    return;
  }

  if (step === 'lend_category') {
    if (!value) {
      await sendWhatsAppText(phone, 'Please send category.');
      return;
    }

    await setSession(phone, 'lend', 'lend_price_mode', { ...data, category: value });
    await sendWhatsAppText(phone, 'Is this free or rent? Reply:\n1 for Free\n2 for Rent');
    return;
  }

  if (step === 'lend_price_mode') {
    const priceMode = parsePriceMode(value);
    if (!priceMode) {
      await sendWhatsAppText(phone, 'Invalid choice. Reply 1 for Free or 2 for Rent.');
      return;
    }

    if (priceMode === 'free') {
      await setSession(phone, 'lend', 'lend_deposit', { ...data, price_mode: 'free', price_amount: null });
      await sendWhatsAppText(phone, 'Any deposit amount? Reply number (e.g. 500) or 0 for no deposit.');
      return;
    }

    await setSession(phone, 'lend', 'lend_price_amount', { ...data, price_mode: 'rent' });
    await sendWhatsAppText(phone, 'Please send rent amount (number only). Example: 200');
    return;
  }

  if (step === 'lend_price_amount') {
    const amount = parseMoney(value);
    if (amount == null || amount <= 0) {
      await sendWhatsAppText(phone, 'Please send a valid rent amount. Example: 200');
      return;
    }

    await setSession(phone, 'lend', 'lend_deposit', { ...data, price_amount: amount });
    await sendWhatsAppText(phone, 'Any deposit amount? Reply number (e.g. 500) or 0 for no deposit.');
    return;
  }

  if (step === 'lend_deposit') {
    const deposit = parseMoney(value);
    if (deposit == null) {
      await sendWhatsAppText(phone, 'Please send a valid deposit amount. Use 0 for no deposit.');
      return;
    }

    await setSession(phone, 'lend', 'lend_location', { ...data, deposit_amount: deposit });
    await sendWhatsAppText(phone, 'Please send your location/building/address for pickup.');
    return;
  }

  if (step === 'lend_location') {
    if (!value) {
      await sendWhatsAppText(phone, 'Please send pickup location/address.');
      return;
    }

    const finalData: Record<string, unknown> = { ...data, address: value };
    try {
      const created = await createItem(buildUserIdFromPhone(phone), {
        title: String(finalData.title || '').trim(),
        category: String(finalData.category || 'Other').trim() || 'Other',
        description: `Created via WhatsApp from ${phone}`,
        price_mode: finalData.price_mode === 'rent' ? 'rent' : 'free',
        price_amount: finalData.price_mode === 'rent' ? Number(finalData.price_amount || 0) : null,
        deposit_amount: Number(finalData.deposit_amount || 0),
        address: value,
        building_name: value,
      });

      await sendWhatsAppText(phone, `✅ Item listed successfully. Item ID: ${created?.id || 'N/A'}`);
      await sendMenuAndReset(phone);
    } catch (error: any) {
      console.error('[whatsapp] createItem failed', error);
      await sendWhatsAppText(phone, `Could not create item right now: ${error?.message || 'unknown error'}. Please try again.`);
    }
  }
}

async function handleRequestFlow(phone: string, step: string, data: Record<string, unknown>, text: string) {
  const value = normalizeText(text);

  if (step === 'request_title') {
    if (!value) {
      await sendWhatsAppText(phone, 'Please tell us what item you need.');
      return;
    }

    await setSession(phone, 'request', 'request_location', { ...data, title: value });
    await sendWhatsAppText(phone, 'Please send your location/building/address.');
    return;
  }

  if (step === 'request_location') {
    if (!value) {
      await sendWhatsAppText(phone, 'Please send your location/address.');
      return;
    }

    await setSession(phone, 'request', 'request_urgency', { ...data, location: value });
    await sendWhatsAppText(phone, 'Urgency? Reply:\n1 for Normal\n2 for Urgent');
    return;
  }

  if (step === 'request_urgency') {
    const urgency = parseUrgency(value);
    if (!urgency) {
      await sendWhatsAppText(phone, 'Invalid choice. Reply 1 for Normal or 2 for Urgent.');
      return;
    }

    const finalData: Record<string, unknown> = { ...data, urgency };

    try {
      await createRequest(buildUserIdFromPhone(phone), {
        title: String(finalData.title || '').trim(),
        category: 'Other',
        urgency,
        radius_km: 5,
        description: `Location: ${String(finalData.location || '').trim()} (created via WhatsApp from ${phone})`,
      });

      const allItems = await listItems();
      const titleTerms = String(finalData.title || '').toLowerCase().split(/\s+/).filter((term) => term.length > 1);
      const ranked = allItems
        .map((item: any) => {
          const haystack = [item?.title, item?.description, item?.category].map((v) => String(v || '').toLowerCase()).join(' ');
          return { item, score: scoreMatch(haystack, titleTerms) };
        })
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((row) => row.item);

      await sendWhatsAppText(phone, '✅ Request created successfully.');

      if (ranked.length) {
        const itemUrl = `${env.publicFrontendUrl || 'http://localhost:8080'}/items`;
        const lines = ranked.map((item: any, idx: number) => `${idx + 1}. ${item?.title || 'Item'} (${item?.category || 'Other'})`);
        await sendWhatsAppText(phone, `Here are some matching items:\n${lines.join('\n')}\n\nBrowse: ${itemUrl}`);
      } else {
        await sendWhatsAppText(phone, 'No close matches found yet. Your request is now visible to nearby members.');
      }

      await sendMenuAndReset(phone);
    } catch (error: any) {
      console.error('[whatsapp] createRequest failed', error);
      await sendWhatsAppText(phone, `Could not create request right now: ${error?.message || 'unknown error'}. Please try again.`);
    }
  }
}

async function handleOtherFlow(phone: string, text: string) {
  const value = normalizeText(text);
  if (!value) {
    await sendWhatsAppText(phone, 'Please type your message so our team can help you.');
    return;
  }

  await sendWhatsAppText(phone, '✅ Thanks! We received your message. Our support/admin team will connect with you soon.');
  await sendMenuAndReset(phone);
}

async function handleIncomingMessage(message: IncomingMessage) {
  const phone = normalizePhone(message.phone);
  const text = normalizeText(message.text);
  if (!phone || !text) return;

  const normalized = text.toLowerCase();
  const isGreeting = ['hi', 'hello', 'hey', 'start', 'menu'].includes(normalized);

  let session = await getSession(phone);
  if (!session) {
    await setSession(phone, 'menu', 'awaiting_menu', {});
    session = await getSession(phone);
  }

  if (isGreeting) {
    await sendMenuAndReset(phone);
    return;
  }

  const flow = (session?.flow || 'menu') as Flow;
  const step = String(session?.step || 'awaiting_menu');
  const data = (session?.data || {}) as Record<string, unknown>;

  if (step === 'awaiting_menu') {
    if (['1', '1️⃣'].includes(normalized)) {
      await setSession(phone, 'lend', 'lend_title', {});
      await sendWhatsAppText(phone, 'Great choice. What item do you want to lend? Please send item title.');
      return;
    }

    if (['2', '2️⃣'].includes(normalized)) {
      await setSession(phone, 'request', 'request_title', {});
      await sendWhatsAppText(phone, 'What item do you need? Please send item title/name.');
      return;
    }

    if (['3', '3️⃣'].includes(normalized)) {
      await setSession(phone, 'other', 'other_text', {});
      await sendWhatsAppText(phone, 'Please share your message and our support/admin team will help you.');
      return;
    }

    await sendWhatsAppText(phone, 'Please reply with 1, 2, or 3.');
    return;
  }

  if (flow === 'lend') {
    await handleLendFlow(phone, step, data, text);
    return;
  }

  if (flow === 'request') {
    await handleRequestFlow(phone, step, data, text);
    return;
  }

  if (flow === 'other') {
    await handleOtherFlow(phone, text);
    return;
  }

  await sendMenuAndReset(phone);
}

export function verifyWhatsAppSignature(rawBody: unknown, signatureHeader?: string | null) {
  const appSecret = String(env.whatsappAppSecret || '').trim();
  if (!appSecret) return true;

  const signature = String(signatureHeader || '').trim();
  if (!signature.startsWith('sha256=')) return false;

  const received = signature.replace(/^sha256=/, '').trim();
  const payload = Buffer.isBuffer(rawBody)
    ? rawBody
    : Buffer.from(String(rawBody || ''), 'utf8');

  const expected = createHmac('sha256', appSecret).update(payload).digest('hex');

  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(receivedBuffer, expectedBuffer);
}

export async function processWhatsAppWebhookPayload(payload: any) {
  const messages = extractIncomingMessages(payload);
  for (const message of messages) {
    try {
      await handleIncomingMessage(message);
    } catch (error) {
      console.error('[whatsapp] message processing failed', error);
    }
  }
}
