import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';

function sanitizePath(input: string) {
  const value = input.replace(/\\/g, '/').replace(/^\/+/, '');
  if (value.includes('..')) {
    throw new Error('Invalid path');
  }
  return value;
}

function bucketRoot(bucket: string) {
  return path.join(env.storageRoot, sanitizePath(bucket));
}

function normalizeCloudName(input: string) {
  const value = String(input || '').trim();
  if (!value) return '';

  // Accept CLOUDINARY_USER_NAME as either plain cloud name or full Cloudinary URL.
  const fromUrl = value.match(/res\.cloudinary\.com\/([^/]+)/i)?.[1];
  return (fromUrl || value).trim();
}

const cloudNameCandidates = Array.from(new Set([
  normalizeCloudName(env.cloudinaryCloudName),
  normalizeCloudName(env.cloudinaryUserName),
].filter(Boolean)));

const primaryCloudName = cloudNameCandidates[0] || '';

const cloudinaryConfigured = Boolean(
  primaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret,
);

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: primaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
    secure: true,
  });
}

function configureCloudinaryFor(cloudName: string) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
    secure: true,
  });
}

function inferResourceType(filePath: string): 'image' | 'video' | 'raw' {
  const value = filePath.toLowerCase();
  if (/\.(mp4|mov|m4v|webm|avi|mkv|wmv|mpeg|mpg)$/.test(value)) return 'video';
  if (/\.(pdf|doc|docx|txt|csv|zip|rar|7z)$/.test(value)) return 'raw';
  return 'image';
}

function cloudinaryAssetRef(bucket: string, filePath: string) {
  const safeBucket = sanitizePath(bucket);
  const safeFilePath = sanitizePath(filePath);
  const resourceType = inferResourceType(safeFilePath);

  // For image/video uploads, keep extension as delivery format to avoid ".ext.ext" URLs.
  if (resourceType !== 'raw') {
    const parsed = path.posix.parse(safeFilePath);
    const publicPath = parsed.ext
      ? (parsed.dir ? `${parsed.dir}/${parsed.name}` : parsed.name)
      : safeFilePath;
    const format = parsed.ext ? parsed.ext.slice(1).toLowerCase() : undefined;
    return {
      publicId: `${safeBucket}/${publicPath}`,
      resourceType,
      format,
    } as const;
  }

  return {
    publicId: `${safeBucket}/${safeFilePath}`,
    resourceType,
    format: undefined,
  } as const;
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

async function uploadBufferToCloudinary(
  buffer: Buffer,
  publicId: string,
  resourceType: 'image' | 'video' | 'raw',
  upsert: boolean,
) {
  return new Promise<any>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        overwrite: upsert,
        resource_type: resourceType,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      },
    );

    Readable.from(buffer).pipe(stream);
  });
}

export async function saveFile(bucket: string, filePath: string, file: Express.Multer.File, upsert = false) {
  const safeFilePath = sanitizePath(filePath);
  const { publicId, resourceType } = cloudinaryAssetRef(bucket, safeFilePath);

  if (cloudinaryConfigured) {
    const maybeTempPath = (file as { path?: string }).path;
    const attempts = cloudNameCandidates.length ? cloudNameCandidates : [primaryCloudName];
    const errors: string[] = [];

    try {
      for (const cloudName of attempts) {
        try {
          configureCloudinaryFor(cloudName);

          const result = maybeTempPath
            ? await cloudinary.uploader.upload(maybeTempPath, {
                public_id: publicId,
                overwrite: upsert,
                resource_type: 'auto',
              })
            : file.buffer
              ? await uploadBufferToCloudinary(file.buffer, publicId, resourceType, upsert)
              : null;

          if (!result) {
            throw new Error('Upload payload is empty');
          }

          const cloudUrl = String(result.secure_url || result.url || publicUrl(bucket, safeFilePath));
          return { path: safeFilePath, fullPath: cloudUrl, publicUrl: cloudUrl };
        } catch (error: any) {
          const message = error?.message || String(error) || 'Cloudinary upload failed';
          errors.push(`${cloudName}: ${message}`);
        }
      }

      throw new Error(errors.length ? errors.join(' | ') : 'Cloudinary upload failed');
    } finally {
      if (maybeTempPath) {
        await fs.unlink(maybeTempPath).catch(() => {
          // Best effort temporary file cleanup.
        });
      }
    }
  }

  const target = path.join(bucketRoot(bucket), safeFilePath);
  const dir = path.dirname(target);

  await fs.mkdir(dir, { recursive: true });

  if (!upsert) {
    try {
      await fs.stat(target);
      throw new Error('File already exists');
    } catch (error) {
      if (error instanceof Error && error.message === 'File already exists') {
        throw error;
      }
      const fileError = error as NodeJS.ErrnoException;
      if (fileError?.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  const maybeTempPath = (file as { path?: string }).path;
  if (maybeTempPath) {
    await fs.copyFile(maybeTempPath, target);
    await fs.unlink(maybeTempPath).catch(() => {
      // Best effort temporary file cleanup.
    });
  } else if (file.buffer) {
    await fs.writeFile(target, file.buffer);
  } else {
    throw new Error('Upload payload is empty');
  }

  return { path: safeFilePath, fullPath: target, publicUrl: publicUrl(bucket, safeFilePath) };
}

export async function listFiles(bucket: string, prefix = '', limit = 100) {
  if (cloudinaryConfigured) {
    const prefixPath = sanitizePath(prefix || '');
    const basePrefix = prefixPath ? `${sanitizePath(bucket)}/${prefixPath}` : `${sanitizePath(bucket)}/`;
    const resourceTypes: Array<'image' | 'video' | 'raw'> = ['image', 'video', 'raw'];
    const results: Array<{ name: string; id: string }> = [];
    const seen = new Set<string>();

    for (const resourceType of resourceTypes) {
      try {
        const response = await cloudinary.api.resources({
          type: 'upload',
          prefix: basePrefix,
          max_results: Math.min(limit, 500),
          resource_type: resourceType,
        });

        for (const resource of response.resources || []) {
          const publicId = String(resource.public_id || '');
          if (!publicId || seen.has(publicId)) continue;
          seen.add(publicId);
          const relative = publicId.startsWith(`${sanitizePath(bucket)}/`)
            ? publicId.slice(sanitizePath(bucket).length + 1)
            : publicId;
          results.push({ name: relative, id: relative });
          if (results.length >= limit) return results;
        }
      } catch {
        // Keep compatibility with existing behavior: ignore listing errors.
      }
    }

    return results.slice(0, limit);
  }

  const root = path.join(bucketRoot(bucket), sanitizePath(prefix || ''));

  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .slice(0, limit)
      .map((entry) => ({ name: entry.name, id: entry.name }));
  } catch {
    return [];
  }
}

export async function removeFiles(bucket: string, paths: string[]) {
  const removed: string[] = [];

  if (cloudinaryConfigured) {
    for (const entry of paths) {
      const safe = sanitizePath(entry);
      const { publicId, resourceType } = cloudinaryAssetRef(bucket, safe);

      try {
        await cloudinary.uploader.destroy(publicId, {
          resource_type: resourceType,
          invalidate: true,
        });
        removed.push(safe);
      } catch {
        // Ignore not found files for compatibility.
      }
    }

    return removed;
  }

  for (const entry of paths) {
    const safe = sanitizePath(entry);
    const target = path.join(bucketRoot(bucket), safe);

    try {
      await fs.unlink(target);
      removed.push(safe);
    } catch {
      // Ignore not found files for compatibility.
    }
  }

  return removed;
}

export function publicUrl(bucket: string, filePath: string) {
  if (isHttpUrl(filePath)) {
    return filePath;
  }

  const safe = sanitizePath(filePath);

  if (cloudinaryConfigured) {
    configureCloudinaryFor(primaryCloudName);
    const { publicId, resourceType, format } = cloudinaryAssetRef(bucket, safe);
    return cloudinary.url(publicId, {
      secure: true,
      resource_type: resourceType,
      type: 'upload',
      ...(format ? { format } : {}),
    });
  }

  return `${env.publicApiUrl}/uploads/${sanitizePath(bucket)}/${safe}`;
}
