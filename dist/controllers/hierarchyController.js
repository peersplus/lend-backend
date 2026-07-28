import * as hierarchyService from '../services/hierarchyService.js';
// ── Business Units ────────────────────────────────────────────────────────────
export async function listBusinessUnitsController(req, res) {
    try {
        const filters = {};
        if (req.query.orgId)
            filters.orgId = req.query.orgId;
        const data = await hierarchyService.listBusinessUnits(filters);
        res.json({ data });
    }
    catch (err) {
        res.status(500).json({ error: { message: err.message } });
    }
}
export async function getBusinessUnitController(req, res) {
    try {
        const data = await hierarchyService.getBusinessUnitById(req.params.id);
        if (!data)
            return res.status(404).json({ error: { message: 'Business unit not found' } });
        res.json({ data });
    }
    catch (err) {
        res.status(500).json({ error: { message: err.message } });
    }
}
export async function createBusinessUnitController(req, res) {
    try {
        const data = await hierarchyService.createBusinessUnit(req.body);
        res.status(201).json({ data });
    }
    catch (err) {
        res.status(400).json({ error: { message: err.message } });
    }
}
export async function updateBusinessUnitController(req, res) {
    try {
        const data = await hierarchyService.updateBusinessUnit(req.params.id, req.body);
        if (!data)
            return res.status(404).json({ error: { message: 'Business unit not found' } });
        res.json({ data });
    }
    catch (err) {
        res.status(400).json({ error: { message: err.message } });
    }
}
export async function deleteBusinessUnitController(req, res) {
    try {
        await hierarchyService.deleteBusinessUnit(req.params.id);
        res.status(204).end();
    }
    catch (err) {
        res.status(500).json({ error: { message: err.message } });
    }
}
// ── Sales Offices ─────────────────────────────────────────────────────────────
export async function listSalesOfficesController(req, res) {
    try {
        const filters = {};
        if (req.query.orgId)
            filters.orgId = req.query.orgId;
        if (req.query.businessUnitId)
            filters.businessUnitId = req.query.businessUnitId;
        const data = await hierarchyService.listSalesOffices(filters);
        res.json({ data });
    }
    catch (err) {
        res.status(500).json({ error: { message: err.message } });
    }
}
export async function getSalesOfficeController(req, res) {
    try {
        const data = await hierarchyService.getSalesOfficeById(req.params.id);
        if (!data)
            return res.status(404).json({ error: { message: 'Sales office not found' } });
        res.json({ data });
    }
    catch (err) {
        res.status(500).json({ error: { message: err.message } });
    }
}
export async function createSalesOfficeController(req, res) {
    try {
        const data = await hierarchyService.createSalesOffice(req.body);
        res.status(201).json({ data });
    }
    catch (err) {
        res.status(400).json({ error: { message: err.message } });
    }
}
export async function updateSalesOfficeController(req, res) {
    try {
        const data = await hierarchyService.updateSalesOffice(req.params.id, req.body);
        if (!data)
            return res.status(404).json({ error: { message: 'Sales office not found' } });
        res.json({ data });
    }
    catch (err) {
        res.status(400).json({ error: { message: err.message } });
    }
}
export async function deleteSalesOfficeController(req, res) {
    try {
        await hierarchyService.deleteSalesOffice(req.params.id);
        res.status(204).end();
    }
    catch (err) {
        res.status(500).json({ error: { message: err.message } });
    }
}
// ── Plants ────────────────────────────────────────────────────────────────────
export async function listPlantsController(req, res) {
    try {
        const filters = {};
        if (req.query.orgId)
            filters.orgId = req.query.orgId;
        if (req.query.businessUnitId)
            filters.businessUnitId = req.query.businessUnitId;
        if (req.query.salesOfficeId)
            filters.salesOfficeId = req.query.salesOfficeId;
        const data = await hierarchyService.listPlants(filters);
        res.json({ data });
    }
    catch (err) {
        res.status(500).json({ error: { message: err.message } });
    }
}
export async function getPlantController(req, res) {
    try {
        const data = await hierarchyService.getPlantById(req.params.id);
        if (!data)
            return res.status(404).json({ error: { message: 'Plant not found' } });
        res.json({ data });
    }
    catch (err) {
        res.status(500).json({ error: { message: err.message } });
    }
}
export async function createPlantController(req, res) {
    try {
        const data = await hierarchyService.createPlant(req.body);
        res.status(201).json({ data });
    }
    catch (err) {
        res.status(400).json({ error: { message: err.message } });
    }
}
export async function updatePlantController(req, res) {
    try {
        const data = await hierarchyService.updatePlant(req.params.id, req.body);
        if (!data)
            return res.status(404).json({ error: { message: 'Plant not found' } });
        res.json({ data });
    }
    catch (err) {
        res.status(400).json({ error: { message: err.message } });
    }
}
export async function deletePlantController(req, res) {
    try {
        await hierarchyService.deletePlant(req.params.id);
        res.status(204).end();
    }
    catch (err) {
        res.status(500).json({ error: { message: err.message } });
    }
}
