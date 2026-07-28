import { invokeFunction } from '../services/functionService.js';
export async function invokeFunctionController(req, res) {
    const name = req.params.name;
    try {
        const data = await invokeFunction(name, req.body?.body ?? req.body ?? null, req.authUser?.uid);
        res.status(200).json({ data, error: null });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Function invocation failed';
        res.status(400).json({ data: null, error: { message } });
    }
}
