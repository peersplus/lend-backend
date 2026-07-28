import * as communicationService from '../services/communicationService.js';
export async function listCommunicationsController(req, res) {
    const limit = Number(req.query.limit) || 200;
    const data = await communicationService.listCommunications(req.query, limit);
    res.json({ data });
}
export async function createCommunicationController(req, res) {
    const data = await communicationService.createCommunication(req.body);
    res.status(201).json({ data });
}
export async function updateCommunicationStatusController(req, res) {
    const { status, ...extra } = req.body;
    const data = await communicationService.updateCommunicationStatus(req.params.id, status, extra);
    if (!data)
        return res.status(404).json({ error: 'Communication not found' });
    res.json({ data });
}
export async function updateCommunicationController(req, res) {
    const data = await communicationService.updateCommunication(req.params.id, req.body);
    if (!data)
        return res.status(404).json({ error: 'Communication not found' });
    res.json({ data });
}
