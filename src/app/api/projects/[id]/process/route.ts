import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { processImage } from '@/lib/images';
import { updateProject, updateProjectStats, getProject } from '@/lib/projects';
import { ProjectSettings } from '@/types';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const body = await req.json();
        const { settings } = body;
        const { id } = await params;
        // settings: { targetSize: 512, padMode: 'transparent', padColor: '#000000' }

        if (!settings.targetSize) {
            return NextResponse.json({ error: 'Target size required' }, { status: 400 });
        }

        // Save settings to project
        await updateProject(id, { settings: { ...settings } });

        const projectDir = path.join(process.cwd(), 'projects', id);

        // Source: use augmented folder if it has images, otherwise raw
        // Logic: if user skipped augmentation, source is raw. If user did augmentation, source is augmented.
        // BUT, user might want to process raw even if augmented folder exists? 
        // Usually standard flow is Raw -> Augmented -> Processed.
        // Let's check augmented count.

        // Better logic: Source from 'augmented' if not empty, else 'raw'.
        const rawDir = path.join(projectDir, 'raw');
        const augDir = path.join(projectDir, 'augmented');
        const processedDir = path.join(projectDir, 'processed');

        const augFiles = await fs.readdir(augDir).catch(() => []);
        const rawFiles = await fs.readdir(rawDir).catch(() => []);

        const useAugmented = augFiles.length > 0;
        const sourceDir = useAugmented ? augDir : rawDir;
        const sourceFiles = useAugmented ? augFiles : rawFiles;

        const imageFiles = sourceFiles.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));

        if (imageFiles.length === 0) {
            return NextResponse.json({ error: 'No source images found' }, { status: 400 });
        }

        // Clear processed dir?
        try {
            const oldFiles = await fs.readdir(processedDir);
            for (const f of oldFiles) {
                await fs.unlink(path.join(processedDir, f));
            }
        } catch { }

        // Async batch process
        (async () => {
            console.log(`Starting processing for project ${id} from ${useAugmented ? 'augmented' : 'raw'}`);
            for (const file of imageFiles) {
                try {
                    const inputPath = path.join(sourceDir, file);
                    // Output always png for training best practice (lossless)
                    const nameWithoutExt = path.parse(file).name;
                    const outputPath = path.join(processedDir, `${nameWithoutExt}.png`);

                    await processImage(inputPath, outputPath, settings as ProjectSettings);
                } catch (e) {
                    console.error(`Failed to process ${file}`, e);
                }
            }
            await updateProjectStats(id);
            console.log(`Finished processing for project ${id}`);
        })();

        return NextResponse.json({
            status: 'processing',
            total: imageFiles.length,
            source: useAugmented ? 'augmented' : 'raw'
        });

    } catch (error) {
        console.error('Process error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
