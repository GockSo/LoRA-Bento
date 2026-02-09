import fs from 'fs/promises';
import path from 'path';
import { getManifest } from './manifest';

export interface TrainingSetItem {
    id: string;
    type: 'raw' | 'augmented';
    sourceRawId?: string;
    imagePath: string;
    captionPath: string;
    fileName: string;
}

export interface TrainingSetStats {
    raw: number;
    aug: number;
    total: number;
    excluded: number;
}

export interface TrainingSet {
    items: TrainingSetItem[];
    stats: TrainingSetStats;
    sourceStage: 'resized' | 'raw+aug';
}

export async function getTrainingSet(projectId: string): Promise<TrainingSet> {
    const projectDir = path.join(process.cwd(), 'projects', projectId);
    const resizedDir = path.join(projectDir, 'resized');
    const manifest = await getManifest(projectId);

    // 1. Discovery
    const allItems = manifest.items || [];
    const includedItems = allItems.filter(item => !item.excluded);

    const rawCount = includedItems.filter(item => item.stage === 'raw').length;
    const augCount = includedItems.filter(item => item.stage === 'augmented').length;
    const totalCount = includedItems.length;
    const excludedCount = allItems.length - totalCount;

    // 2. Determine Source
    // We prefer 'resized' if it contains images. 
    // Resize&Pad step generates PNGs in 'resized/'.
    const resizedFiles = await fs.readdir(resizedDir).catch(() => []);
    const hasResized = resizedFiles.some(f => /\.(jpg|jpeg|png|webp)$/i.test(f));

    const sourceStage = hasResized ? 'resized' : 'raw+aug';
    const trainingItems: TrainingSetItem[] = [];

    for (const item of includedItems) {
        const baseName = path.parse(item.path).name;

        let imagePath = item.path;
        let captionPath = '';

        if (hasResized) {
            // Resized naming: ${baseName}_${shortId}.png
            const shortId = item.id.slice(0, 8);
            const resizedImgPath = path.join(resizedDir, `${baseName}_${shortId}.png`);

            // Check if it exists
            const exists = await fs.access(resizedImgPath).then(() => true).catch(() => false);
            if (exists) {
                imagePath = resizedImgPath;
                // CAPTION PATH: ${baseName}_${shortId}.txt
                captionPath = path.join(resizedDir, `${baseName}_${shortId}.txt`);
            } else if (item.stage === 'augmented') {
                // If it's an augmented item but not in resized, it might be an issue
                // but we should still try to find it in augmented folder if hasResized is false or it's missing
                // However, the rule is source-of-truth is resized/ if it contains images.
            }
        }

        if (!captionPath) {
            // Fallback for raw + aug folders
            const currentDir = path.dirname(imagePath);
            captionPath = path.join(currentDir, `${baseName}.txt`);
        }

        trainingItems.push({
            id: item.id,
            type: item.stage as 'raw' | 'augmented',
            sourceRawId: item.groupKey !== item.id ? item.groupKey : undefined,
            imagePath,
            captionPath,
            fileName: baseName // This is the original name without ext
        });
    }

    return {
        items: trainingItems,
        stats: {
            raw: rawCount,
            aug: augCount,
            total: totalCount,
            excluded: excludedCount
        },
        sourceStage
    };
}
