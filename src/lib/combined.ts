import fs from 'fs/promises';
import path from 'path';
import { ManifestItem } from '@/types'; // Adjust import path as needed
import { formatCanonicalName, parseCanonicalName } from './naming';

export async function ensureCombinedDirectory(projectId: string) {
    const combinedDir = path.join(process.cwd(), 'projects', projectId, 'combined');
    await fs.mkdir(combinedDir, { recursive: true });
    return combinedDir;
}

export async function syncRawToCombined(projectId: string, rawItems: ManifestItem[]) {
    const combinedDir = await ensureCombinedDirectory(projectId);

    for (const item of rawItems) {
        if (!item.groupId) continue; // Should have been migrated

        // Canonical Raw Name: group_00...00.png
        const canonicalName = formatCanonicalName(item.groupId, 0, path.extname(item.path));
        const destPath = path.join(combinedDir, canonicalName);

        try {
            // Check if exists
            await fs.access(destPath);
        } catch {
            // Doesn't exist, create link
            try {
                // Try hardlink first
                await fs.link(item.path, destPath);
            } catch (e) {
                // Fallback to copy
                await fs.copyFile(item.path, destPath);
            }
        }

        // Update item to point to combined? 
        // User wants gallery to show combined. 
        // We can update the item's path/src here or let the caller do it.
        // For now, just ensure the file exists.
    }
}

export async function getNextVariantId(projectId: string, groupId: number): Promise<number> {
    const combinedDir = path.join(process.cwd(), 'projects', projectId, 'combined');
    let maxVariant = 0;

    try {
        const files = await fs.readdir(combinedDir);
        for (const file of files) {
            const parsed = parseCanonicalName(file);
            if (parsed && parsed.groupId === groupId) {
                if (parsed.variantId > maxVariant) {
                    maxVariant = parsed.variantId;
                }
            }
        }
    } catch (e) {
        // Directory might not exist or empty
    }

    return maxVariant + 1;
}
