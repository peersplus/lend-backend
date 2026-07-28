import mongoose from 'mongoose';
const schema = new mongoose.Schema({
    id: { type: String, index: true },
}, { strict: false, versionKey: false });
const modelCache = new Map();
export function getCollectionModel(tableName) {
    if (modelCache.has(tableName)) {
        return modelCache.get(tableName);
    }
    const model = mongoose.model(`col_${tableName}`, schema, tableName);
    modelCache.set(tableName, model);
    return model;
}
