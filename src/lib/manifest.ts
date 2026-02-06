import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ProjectManifest, ManifestItem } from '@/types';
import { getProject } from './projects';

const PROJECTS_DIR = path.join(process.cwd(), 'projects');

export async function getManifestPath(projectId: string) {
    return path.join(PROJECTS_DIR, projectId, 'manifest.json');
}

export async function getManifest(projectId: string): Promise<ProjectManifest> {
    const manifestPath = await getManifestPath(projectId);
    try {
        const data = await fs.readFile(manifestPath, 'utf-8');
        return JSON.parse(data);
    } catch {
        // If no manifest, try to create one from raw files (bootstrap)
        return await bootstrapManifest(projectId);
    }
}

export async function saveManifest(projectId: string, manifest: ProjectManifest) {
    const manifestPath = await getManifestPath(projectId);
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
}

async function bootstrapManifest(projectId: string): Promise<ProjectManifest> {
    const projectDir = path.join(PROJECTS_DIR, projectId);
    const rawDir = path.join(projectDir, 'raw');

    // Ensure raw dir exists
    try {
        await fs.access(rawDir);
    } catch {
        return { version: 1, items: [] };
    }

    const files = await fs.readdir(rawDir);
    const imageFiles = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));

    const items: ManifestItem[] = imageFiles.map(file => ({
        id: uuidv4(),
        stage: 'raw',
        src: `/api/images?path=${encodeURIComponent(path.join(rawDir, file))}`,
        path: path.join(rawDir, file),
        displayName: file,
        groupKey: file // Group by itself
    }));

    const manifest: ProjectManifest = {
        version: 1,
        items
    };

    await saveManifest(projectId, manifest);
    return manifest;
}

export async function addToManifest(projectId: string, newItems: ManifestItem[]) {
    // We need to lock this ideally, but for simple MVP fs is file
    const manifest = await getManifest(projectId);

    // Merge: If item with same path exists, update it? 
    // Or just append? User said: "augmented filenames to be literally 2.png next to 1.png".
    // We append.

    // Check for duplicates based on path to avoid double adding on re-runs if we don't clear
    const existingPaths = new Set(manifest.items.map(i => i.path));
    const uniqueNewItems = newItems.filter(i => !existingPaths.has(i.path));

    manifest.items.push(...uniqueNewItems);

    // Save
    await saveManifest(projectId, manifest);
}

// Sorting logic helper
// Enforce adjacency: Raw first, then Augments, grouped by groupKey
export function sortManifestItems(items: ManifestItem[]) {
    return [...items].sort((a, b) => {
        // Primary sort: Group Key (Raw Filename)
        if (a.groupKey < b.groupKey) return -1;
        if (a.groupKey > b.groupKey) return 1;

        // Secondary sort: Stage (Raw < Augmented)
        if (a.stage === 'raw' && b.stage !== 'raw') return -1;
        if (a.stage !== 'raw' && b.stage === 'raw') return 1;

        // Tertiary: Display Name (for multiple augments of same raw)
        return a.displayName.localeCompare(b.displayName, undefined, { numeric: true, sensitivity: 'base' });
    });
}
