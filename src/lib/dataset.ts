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
    sourceStage: 'processed' | 'raw+aug';
}

export async function getTrainingSet(projectId: string): Promise<TrainingSet> {
    const projectDir = path.join(process.cwd(), 'projects', projectId);
    const processedDir = path.join(projectDir, 'processed');
    const manifest = await getManifest(projectId);

    // 1. Discovery
    const allItems = manifest.items || [];
    const includedItems = allItems.filter(item => !item.excluded);

    const rawCount = includedItems.filter(item => item.stage === 'raw').length;
    const augCount = includedItems.filter(item => item.stage === 'augmented').length;
    const totalCount = includedItems.length;
    const excludedCount = allItems.length - totalCount;

    // 2. Determine Source
    // We prefer 'processed' if it contains images. 
    // Resize&Pad step generates PNGs in 'processed/'.
    const processedFiles = await fs.readdir(processedDir).catch(() => []);
    const hasProcessed = processedFiles.some(f => /\.(jpg|jpeg|png|webp)$/i.test(f));

    const sourceStage = hasProcessed ? 'processed' : 'raw+aug';
    const trainingItems: TrainingSetItem[] = [];

    for (const item of includedItems) {
        const baseName = path.parse(item.path).name;

        let imagePath = item.path;
        let captionPath = '';

        if (hasProcessed) {
            // Updated unique naming: ${baseName}_${id_slice}.png
            const shortId = item.id.slice(0, 8);
            const processedImgPath = path.join(processedDir, `${baseName}_${shortId}.png`);
            // Check if it exists
            const exists = await fs.access(processedImgPath).then(() => true).catch(() => false);
            if (exists) {
                imagePath = processedImgPath;
                // CAPTION PATH MUST MATCH: ${baseName}_${shortId}.txt
                captionPath = path.join(processedDir, `${baseName}_${shortId}.txt`);
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
