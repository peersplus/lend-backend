import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBookingNotificationPlan, buildBookingReminderPlan, buildBookingRequestResendAction, buildBookingStatusEmailDrafts, validateBookingRequestOwner } from './listingService.ts';

test('builds owner notification for new booking requests', () => {
  const plan = buildBookingNotificationPlan(null, 'requested', 'Drill', 'owner-1', 'borrower-1');

  assert.equal(plan.length, 1);
  assert.deepEqual(plan[0].userId, 'owner-1');
  assert.equal(plan[0].title, 'New booking request');
  assert.match(plan[0].body, /Drill/);
});

test('builds owner and borrower notifications for pickup and return transitions', () => {
  const pickedUpPlan = buildBookingNotificationPlan('approved', 'picked_up', 'Drill', 'owner-1', 'borrower-1');
  const returnedPlan = buildBookingNotificationPlan('picked_up', 'returned', 'Drill', 'owner-1', 'borrower-1');

  assert.deepEqual(pickedUpPlan.map((p) => p.userId).sort(), ['borrower-1', 'owner-1']);
  assert.equal(pickedUpPlan.find((p) => p.userId === 'owner-1')?.title, 'Item picked up');
  assert.equal(returnedPlan.find((p) => p.userId === 'borrower-1')?.title, 'Item returned');
});

test('rejects booking requests from the item creator', () => {
  const result = validateBookingRequestOwner('creator-1', 'creator-1');

  assert.equal(result.ok, false);
  assert.match(result.message || '', /creator/i);
});

test('marks an existing pending booking request for replacement when the same borrower re-requests', () => {
  const action = buildBookingRequestResendAction('requested');

  assert.equal(action.shouldCancel, true);
  assert.equal(action.action, 'resend');
});

test('builds a high-alert reminder plan for urgent booking requests', () => {
  const plan = buildBookingReminderPlan({ urgency: 'urgent', reminder_count: 0, created_at: new Date().toISOString(), status: 'requested' }, 'owner-1', 'borrower-1');

  assert.equal(plan.isHighAlert, true);
  assert.equal(plan.type, 'booking_request_high_alert');
  assert.match(plan.body, /30/i);
});

test('buildBookingStatusEmailDrafts sends approved emails to owner and borrower', () => {
  const drafts = buildBookingStatusEmailDrafts({
    status: 'approved',
    previousStatus: 'requested',
    bookingId: 'b-1',
    itemTitle: 'Drill',
    owner: { email: 'owner@example.com', full_name: 'Owner' },
    borrower: { email: 'borrower@example.com', full_name: 'Borrower' },
    appUrl: 'http://localhost:8080/bookings',
  });

  assert.equal(drafts.length, 2);
  assert.deepEqual(drafts.map((d) => d.to).sort(), ['borrower@example.com', 'owner@example.com']);
});

test('buildBookingStatusEmailDrafts sends declined emails to owner and borrower', () => {
  const drafts = buildBookingStatusEmailDrafts({
    status: 'declined',
    previousStatus: 'requested',
    bookingId: 'b-2',
    itemTitle: 'Ladder',
    owner: { email: 'owner@example.com', full_name: 'Owner' },
    borrower: { email: 'borrower@example.com', full_name: 'Borrower' },
    appUrl: 'http://localhost:8080/bookings',
  });

  assert.equal(drafts.length, 2);
  assert.deepEqual(drafts.map((d) => d.to).sort(), ['borrower@example.com', 'owner@example.com']);
});

test('buildBookingStatusEmailDrafts sends cancel/dispatched/returned/defect/completed to both users', () => {
  const statuses = ['cancelled', 'picked_up', 'returned', 'defect_reported', 'completed'];

  for (const status of statuses) {
    const drafts = buildBookingStatusEmailDrafts({
      status,
      previousStatus: 'approved',
      bookingId: `b-${status}`,
      itemTitle: 'Camera',
      owner: { email: 'owner@example.com', full_name: 'Owner' },
      borrower: { email: 'borrower@example.com', full_name: 'Borrower' },
      appUrl: 'http://localhost:8080/bookings',
      pickupAt: new Date().toISOString(),
      returnedAt: new Date().toISOString(),
      defectNotes: 'Scratch on surface',
      amountPaid: 50,
    });

    assert.equal(drafts.length, 2, `expected both recipients for status ${status}`);
    assert.deepEqual(drafts.map((d) => d.to).sort(), ['borrower@example.com', 'owner@example.com']);
  }
});
