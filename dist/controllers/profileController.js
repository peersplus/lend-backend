import * as profileService from '../services/profileService.js';
export async function getProfileController(req, res) {
    const { id } = req.params;
    const data = await profileService.getProfileById(id);
    if (!data)
        return res.status(404).json({ error: 'Profile not found' });
    res.json({ data });
}
export async function getMyProfileController(req, res) {
    const uid = req.authUser?.uid;
    if (!uid)
        return res.status(401).json({ error: 'Unauthorized' });
    const data = await profileService.getProfileByUserId(uid);
    if (!data)
        return res.status(404).json({ error: 'Profile not found' });
    res.json({ data });
}
export async function listProfilesController(req, res) {
    const data = await profileService.listProfiles(req.query);
    res.json({ data });
}
export async function upsertProfileController(req, res) {
    const data = await profileService.upsertProfile(req.body);
    res.json({ data });
}
export async function updateProfileController(req, res) {
    const data = await profileService.updateProfile(req.params.id, req.body);
    if (!data)
        return res.status(404).json({ error: 'Profile not found' });
    res.json({ data });
}
export async function clearExpiredLeavesController(req, res) {
    try {
        const count = await profileService.clearExpiredLeaves();
        res.json({ data: { cleared: count } });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}
