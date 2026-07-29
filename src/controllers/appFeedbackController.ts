import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { AppFeedback } from '../models/AppFeedback.js';
import { Profile } from '../models/Profile.js';

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * POST /api/public/app-feedback
 * Public endpoint for product feedback and ideas.
 * we will split feedback into two categories: "feedback" and "idea"
 * - feedback: general feedback about the product, features, or experience
 * - idea: suggestions for new features or improvements
 */
export async function submitAppFeedbackController(req: Request, res: Response) {
  try {
    const category = req.body?.category === 'idea' ? 'idea' : 'feedback';
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const nameInput = typeof req.body?.name === 'string' ? req.body.name.trim() : null;

    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const authEmail = normalizeEmail(req.authUser?.email);
    const providedEmail = normalizeEmail(req.body?.email);
    const resolvedEmail = authEmail || providedEmail;

    if (!req.authUser?.uid && !resolvedEmail) {
      return res.status(400).json({ error: 'email is required for guest feedback' });
    }

    let matchedProfile: { user_id?: string; full_name?: string } | null = null;
    if (resolvedEmail) {
      const exactEmail = new RegExp(`^${escapeRegExp(resolvedEmail)}$`, 'i');
      matchedProfile = await Profile.findOne(
        { email: exactEmail },
        { user_id: 1, full_name: 1 },
      ).lean() as { user_id?: string; full_name?: string } | null;
    }

    const userId = req.authUser?.uid || matchedProfile?.user_id || null;
    const isKnownUser = Boolean(userId || matchedProfile);
    const feedbackName = nameInput || matchedProfile?.full_name || null;

    const now = new Date().toISOString();
    const id = randomUUID();

    await AppFeedback.create({
      id,
      user_id: userId,
      email: resolvedEmail,
      name: feedbackName,
      category,
      message,
      is_known_user: isKnownUser,
      created_at: now,
      updated_at: now,
    });

    return res.json({
      data: {
        id,
        saved: true,
        existing_email: Boolean(matchedProfile),
        known_user: isKnownUser,
      },
    });
  } catch (err: any) {
    console.error('[app-feedback] submit error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to submit feedback' });
  }
}

/**
 * GET /api/public/app-feedback
 * Public endpoint to list product feedback and ideas.
 */
export async function listAppFeedbackController(req: Request, res: Response) {
  try {
    const limitParam = Number(req.query?.limit);
    const resolvedLimit = Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.floor(limitParam), 500)
      : null;

    const query = AppFeedback.find({})
      .sort({ created_at: -1 })
      .lean();

    if (resolvedLimit) {
      query.limit(resolvedLimit);
    }

    const docs = await query;

    const rows = docs.map((doc: any) => ({
      id: String(doc?.id || ''),
      name: String(doc?.name || '').trim() || 'Anonymous',
      category: doc?.category === 'idea' ? 'idea' : 'feedback',
      message: String(doc?.message || '').trim(),
      is_known_user: Boolean(doc?.is_known_user),
      created_at: String(doc?.created_at || ''),
    })).filter((row) => row.message);

    return res.json({ data: rows });
  } catch (err: any) {
    console.error('[app-feedback] list error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to load feedback' });
  }
}
