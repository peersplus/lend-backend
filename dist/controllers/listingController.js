import * as listingService from '../services/listingService.js';
export async function listItemsController(req, res) {
    try {
        const data = await listingService.listItems();
        res.json({ data, error: null });
    }
    catch (error) {
        res.status(500).json({ data: null, error: { message: error?.message || 'Failed to load items' } });
    }
}
export async function createItemController(req, res) {
    try {
        if (!req.authUser?.uid)
            return res.status(401).json({ data: null, error: { message: 'Unauthorized' } });
        const data = await listingService.createItem(req.authUser.uid, req.body);
        res.status(201).json({ data, error: null });
    }
    catch (error) {
        res.status(500).json({ data: null, error: { message: error?.message || 'Failed to create item' } });
    }
}
export async function updateItemController(req, res) {
    try {
        const data = await listingService.updateItem(req.params.id, req.body);
        if (!data)
            return res.status(404).json({ data: null, error: { message: 'Item not found' } });
        res.json({ data, error: null });
    }
    catch (error) {
        res.status(500).json({ data: null, error: { message: error?.message || 'Failed to update item' } });
    }
}
export async function deleteItemController(req, res) {
    try {
        const data = await listingService.deleteItem(req.params.id);
        if (!data)
            return res.status(404).json({ data: null, error: { message: 'Item not found' } });
        res.json({ data, error: null });
    }
    catch (error) {
        res.status(500).json({ data: null, error: { message: error?.message || 'Failed to delete item' } });
    }
}
export async function listBookingsController(req, res) {
    try {
        if (!req.authUser?.uid)
            return res.status(401).json({ data: null, error: { message: 'Unauthorized' } });
        const role = req.query.role || 'borrowed';
        const data = await listingService.listBookings(req.authUser.uid, role);
        res.json({ data, error: null });
    }
    catch (error) {
        res.status(500).json({ data: null, error: { message: error?.message || 'Failed to load bookings' } });
    }
}
export async function createBookingController(req, res) {
    try {
        if (!req.authUser?.uid)
            return res.status(401).json({ data: null, error: { message: 'Unauthorized' } });
        const data = await listingService.createBooking({ ...req.body, owner_id: req.body.owner_id || req.authUser.uid, borrower_id: req.body.borrower_id || req.authUser.uid });
        res.status(201).json({ data, error: null });
    }
    catch (error) {
        res.status(500).json({ data: null, error: { message: error?.message || 'Failed to create booking' } });
    }
}
export async function updateBookingController(req, res) {
    try {
        const data = await listingService.updateBooking(req.params.id, req.body);
        if (!data)
            return res.status(404).json({ data: null, error: { message: 'Booking not found' } });
        res.json({ data, error: null });
    }
    catch (error) {
        res.status(500).json({ data: null, error: { message: error?.message || 'Failed to update booking' } });
    }
}
export async function listRequestsController(req, res) {
    try {
        const data = await listingService.listRequests(req.authUser?.uid, req.authUser?.role === 'superadmin' || req.authUser?.role === 'super_admin');
        res.json({ data, error: null });
    }
    catch (error) {
        res.status(500).json({ data: null, error: { message: error?.message || 'Failed to load requests' } });
    }
}
export async function createRequestController(req, res) {
    try {
        if (!req.authUser?.uid)
            return res.status(401).json({ data: null, error: { message: 'Unauthorized' } });
        const data = await listingService.createRequest(req.authUser.uid, req.body);
        res.status(201).json({ data, error: null });
    }
    catch (error) {
        res.status(500).json({ data: null, error: { message: error?.message || 'Failed to create request' } });
    }
}
export async function updateRequestController(req, res) {
    try {
        const data = await listingService.updateRequest(req.params.id, req.body);
        if (!data)
            return res.status(404).json({ data: null, error: { message: 'Request not found' } });
        res.json({ data, error: null });
    }
    catch (error) {
        res.status(500).json({ data: null, error: { message: error?.message || 'Failed to update request' } });
    }
}
export async function deleteRequestController(req, res) {
    try {
        const data = await listingService.deleteRequest(req.params.id);
        if (!data)
            return res.status(404).json({ data: null, error: { message: 'Request not found' } });
        res.json({ data, error: null });
    }
    catch (error) {
        res.status(500).json({ data: null, error: { message: error?.message || 'Failed to delete request' } });
    }
}
export async function createRequestOfferController(req, res) {
    try {
        if (!req.authUser?.uid)
            return res.status(401).json({ data: null, error: { message: 'Unauthorized' } });
        const data = await listingService.createRequestOffer({ ...req.body, helper_id: req.body.helper_id || req.authUser.uid });
        res.status(201).json({ data, error: null });
    }
    catch (error) {
        res.status(500).json({ data: null, error: { message: error?.message || 'Failed to create request offer' } });
    }
}
export async function listRequestOffersController(req, res) {
    try {
        const requestIds = String(req.query.requestIds || '').split(',').filter(Boolean);
        const data = await listingService.listRequestOffers(requestIds);
        res.json({ data, error: null });
    }
    catch (error) {
        res.status(500).json({ data: null, error: { message: error?.message || 'Failed to load offers' } });
    }
}
export async function listMessagesController(req, res) {
    try {
        const filters = req.query;
        const data = await listingService.listMessages(filters);
        res.json({ data, error: null });
    }
    catch (error) {
        res.status(500).json({ data: null, error: { message: error?.message || 'Failed to load messages' } });
    }
}
export async function createMessageController(req, res) {
    try {
        if (!req.authUser?.uid)
            return res.status(401).json({ data: null, error: { message: 'Unauthorized' } });
        const data = await listingService.createMessage({ ...req.body, sender_id: req.body.sender_id || req.authUser.uid });
        res.status(201).json({ data, error: null });
    }
    catch (error) {
        res.status(500).json({ data: null, error: { message: error?.message || 'Failed to create message' } });
    }
}
export async function getProfileController(req, res) {
    try {
        if (!req.authUser?.uid)
            return res.status(401).json({ data: null, error: { message: 'Unauthorized' } });
        const data = await listingService.getProfileForUser(req.authUser.uid);
        res.json({ data, error: null });
    }
    catch (error) {
        res.status(500).json({ data: null, error: { message: error?.message || 'Failed to load profile' } });
    }
}
export async function updateProfileController(req, res) {
    try {
        if (!req.authUser?.uid)
            return res.status(401).json({ data: null, error: { message: 'Unauthorized' } });
        const data = await listingService.updateProfileForUser(req.authUser.uid, req.body);
        res.json({ data, error: null });
    }
    catch (error) {
        res.status(500).json({ data: null, error: { message: error?.message || 'Failed to update profile' } });
    }
}
