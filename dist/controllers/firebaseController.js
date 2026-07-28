import * as firebaseService from '../services/firebaseService.js';
export async function createUserController(req, res) {
    const { email, password, displayName, disabled } = req.body;
    if (!email || !password)
        return res.status(400).json({ error: 'email and password are required' });
    const user = await firebaseService.createFirebaseUser({ email, password, displayName, disabled });
    res.status(201).json({ uid: user.uid, email: user.email, displayName: user.displayName });
}
export async function updateUserController(req, res) {
    const { uid } = req.params;
    const updates = req.body;
    const user = await firebaseService.updateFirebaseUser(uid, updates);
    res.json({ uid: user.uid, email: user.email, displayName: user.displayName, disabled: user.disabled });
}
export async function disableUserController(req, res) {
    await firebaseService.disableFirebaseUser(req.params.uid);
    res.json({ success: true });
}
export async function enableUserController(req, res) {
    await firebaseService.enableFirebaseUser(req.params.uid);
    res.json({ success: true });
}
export async function deleteUserController(req, res) {
    await firebaseService.deleteFirebaseUser(req.params.uid);
    res.status(204).end();
}
export async function getUserController(req, res) {
    const user = await firebaseService.getFirebaseUser(req.params.uid);
    res.json({ uid: user.uid, email: user.email, displayName: user.displayName, disabled: user.disabled, emailVerified: user.emailVerified });
}
export async function setCustomClaimsController(req, res) {
    const { uid } = req.params;
    const { role, location_id, dealer_id } = req.body;
    await firebaseService.setCustomClaims(uid, { role, location_id, dealer_id });
    res.json({ success: true });
}
export async function sendTestDriveNotificationController(req, res) {
    const { status, ...ctx } = req.body;
    if (!status)
        return res.status(400).json({ error: 'status is required' });
    await firebaseService.notifyTestDriveStatusChange(status, ctx);
    res.json({ success: true });
}
