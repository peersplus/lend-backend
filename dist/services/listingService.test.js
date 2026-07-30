import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBookingNotificationPlan } from './listingService.ts';
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
