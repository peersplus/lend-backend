import * as dealerService from '../services/dealerService.js';
export async function listDealersController(req, res) {
    const data = await dealerService.listDealers(req.query);
    res.json({ data });
}
export async function getDealerController(req, res) {
    const data = await dealerService.getDealerById(req.params.id);
    if (!data)
        return res.status(404).json({ error: 'Dealer not found' });
    res.json({ data });
}
/** Public — no auth required. Returns only safe branding fields. */
export async function getDealerBrandingController(req, res) {
    const dealer = await dealerService.getDealerBySlug(req.params.slug);
    if (!dealer)
        return res.status(404).json({ error: 'Dealer not found' });
    res.json({
        data: {
            id: dealer.id,
            name: dealer.name,
            slug: dealer.slug,
            logo_url: dealer.logo_url ?? null,
            primary_color: dealer.primary_color ?? null,
            tagline: dealer.tagline ?? null,
        },
    });
}
export async function createDealerController(req, res) {
    const data = await dealerService.createDealer(req.body);
    res.status(201).json({ data });
}
export async function updateDealerController(req, res) {
    const data = await dealerService.updateDealer(req.params.id, req.body);
    if (!data)
        return res.status(404).json({ error: 'Dealer not found' });
    res.json({ data });
}
export async function deleteDealerController(req, res) {
    await dealerService.deleteDealer(req.params.id);
    res.status(204).end();
}
