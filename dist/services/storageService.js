import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
function sanitizePath(input) {
    const value = input.replace(/\\/g, '/').replace(/^\/+/, '');
    if (value.includes('..')) {
        throw new Error('Invalid path');
    }
    return value;
}
function bucketRoot(bucket) {
    return path.join(env.storageRoot, sanitizePath(bucket));
}
export async function saveFile(bucket, filePath, file, upsert = false) {
    const safeFilePath = sanitizePath(filePath);
    const target = path.join(bucketRoot(bucket), safeFilePath);
    const dir = path.dirname(target);
    await fs.mkdir(dir, { recursive: true });
    if (!upsert) {
        try {
            await fs.stat(target);
            throw new Error('File already exists');
        }
        catch (error) {
            if (error instanceof Error && error.message === 'File already exists') {
                throw error;
            }
            const fileError = error;
            if (fileError?.code !== 'ENOENT') {
                throw error;
            }
        }
    }
    const maybeTempPath = file.path;
    if (maybeTempPath) {
        await fs.copyFile(maybeTempPath, target);
        await fs.unlink(maybeTempPath).catch(() => {
            // Best effort temporary file cleanup.
        });
    }
    else if (file.buffer) {
        await fs.writeFile(target, file.buffer);
    }
    else {
        throw new Error('Upload payload is empty');
    }
    return { path: safeFilePath, fullPath: target };
}
export async function listFiles(bucket, prefix = '', limit = 100) {
    const root = path.join(bucketRoot(bucket), sanitizePath(prefix || ''));
    try {
        const entries = await fs.readdir(root, { withFileTypes: true });
        return entries
            .filter((entry) => entry.isFile())
            .slice(0, limit)
            .map((entry) => ({ name: entry.name, id: entry.name }));
    }
    catch {
        return [];
    }
}
export async function removeFiles(bucket, paths) {
    const removed = [];
    for (const entry of paths) {
        const safe = sanitizePath(entry);
        const target = path.join(bucketRoot(bucket), safe);
        try {
            await fs.unlink(target);
            removed.push(safe);
        }
        catch {
            // Ignore not found files for compatibility.
        }
    }
    return removed;
}
export function publicUrl(bucket, filePath) {
    const safe = sanitizePath(filePath);
    return `${env.publicApiUrl}/uploads/${sanitizePath(bucket)}/${safe}`;
}
