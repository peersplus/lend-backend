import { Request, Response } from 'express';
import { env } from '../config/env.js';
import { processWhatsAppWebhookPayload, verifyWhatsAppSignature } from '../services/whatsappService.js';

export async function whatsappWebhookVerifyController(req: Request, res: Response) {
  const mode = String(req.query['hub.mode'] || req.query['hub_mode'] || '').toLowerCase().trim();
  const token = String(req.query['hub.verify_token'] || req.query['hub.verifyToken'] || req.query['verify_token'] || '').trim();
  const challenge = String(req.query['hub.challenge'] || '');
  const expectedToken = String(env.whatsappWebhookVerifyToken || '').trim();

  if (mode === 'subscribe' && token && token === expectedToken) {
    return res.status(200).send(challenge);
  }

  return res.status(403).json({ data: null, error: { message: 'Webhook verification failed' } });
}

export async function whatsappWebhookMessageController(req: Request, res: Response) {
  const rawBody = (req as any).rawBody || '';
  const signature = req.header('x-hub-signature-256');

  if (!verifyWhatsAppSignature(rawBody, signature)) {
    return res.status(401).json({ data: null, error: { message: 'Invalid webhook signature' } });
  }

  await processWhatsAppWebhookPayload(req.body);
  return res.status(200).json({ ok: true });
}
