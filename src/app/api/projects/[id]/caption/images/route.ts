import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Get train_data directory
        const projectDir = path.join(process.cwd(), 'projects', id);
        const trainDataDir = path.join(projectDir, 'train_data');

        // Check if train_data exists
        try {
            await fs.access(trainDataDir);
        } catch {
            // No train_data yet, return empty
            return NextResponse.json({ images: [] });
        }

        // Find subdirectories (e.g., "10_classToken")
        const entries = await fs.readdir(trainDataDir, { withFileTypes: true });
        const subDirs = entries.filter(e => e.isDirectory());

        const allImages: any[] = [];

        // Scan each subdirectory
        for (const subDir of subDirs) {
            const subDirPath = path.join(trainDataDir, subDir.name);
            const files = await fs.readdir(subDirPath);

            const imageFiles = files.filter(f =>
                f.match(/\.(jpg|jpeg|png|webp)$/i)
            );

            for (const imageFile of imageFiles) {
                const imagePath = path.join(subDirPath, imageFile);
                const txtPath = imagePath.replace(/\.(jpg|jpeg|png|webp)$/i, '.txt');

                let tags: string[] = [];
                let hasTxt = false;
                let isEdited = false;

                try {
                    const txtContent = await fs.readFile(txtPath, 'utf-8');
                    tags = txtContent.split(',').map(t => t.trim()).filter(Boolean);
                    hasTxt = true;

                    // Check if edited (simple heuristic: check file mtime)
                    const txtStat = await fs.stat(txtPath);
                    const imgStat = await fs.stat(imagePath);
                    isEdited = txtStat.mtime > imgStat.mtime;
                } catch {
                    // No .txt file
                }

                // Get image stats for cache busting
                const imgStat = await fs.stat(imagePath);
                const mtime = imgStat.mtimeMs;

                allImages.push({
                    id: `${subDir.name}/${imageFile}`,
                    filename: imageFile,
                    url: `/api/projects/${id}/caption/images/${subDir.name}/${imageFile}?v=${mtime}`,
                    tags,
                    has_caption: hasTxt,
                    is_edited: isEdited
                });
            }
        }

        return NextResponse.json({ images: allImages });
    } catch (error) {
        console.error('Failed to load caption images:', error);
        return NextResponse.json(
            { error: 'Failed to load images' },
            { status: 500 }
        );
    }
}
