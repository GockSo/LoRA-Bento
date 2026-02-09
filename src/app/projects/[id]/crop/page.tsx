import { notFound } from 'next/navigation';
import path from 'path';
import fs from 'fs/promises';
import { getProject } from '@/lib/projects';
import { CropClient } from '@/components/crop/crop-client';
import sharp from 'sharp';

export default async function CropPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const project = await getProject(id);

    if (!project) {
        notFound();
    }

    const projectDir = path.join(process.cwd(), 'projects', id);
    const rawDir = path.join(projectDir, 'raw');
    const croppedDir = path.join(projectDir, 'cropped');

    // Ensure directories exist
    try {
        await fs.access(rawDir);
    } catch {
        await fs.mkdir(rawDir, { recursive: true });
    }
    try {
        await fs.access(croppedDir);
    } catch {
        await fs.mkdir(croppedDir, { recursive: true });
    }

    // List raw files
    const rawFiles = await fs.readdir(rawDir);
    const imageFiles = rawFiles.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));

    // List cropped files to check status
    const croppedFiles = await fs.readdir(croppedDir);
    const croppedSet = new Set(croppedFiles);


    // Build image list
    const images = await Promise.all(imageFiles.map(async (file) => {
        const rawPath = path.join(rawDir, file);
        const croppedPath = path.join(croppedDir, file);
        // Check if cropped directory exists
        const isCropped = croppedSet.has(file);

        let mtime = Date.now();
        try {
            const stat = await fs.stat(rawPath);
            mtime = stat.mtime.getTime();
        } catch { }

        // Construct URLs
        const rawUrl = `/api/images?path=${encodeURIComponent(rawPath)}&v=${mtime}`;
        // croppedUrl is not used in sidebar anymore, and pointing it to a directory breaks things.
        // We set it to null or we could resolve the active crop if needed, but for now null is safer.
        const croppedUrl = null;

        return {
            id: file,
            rawUrl,
            croppedUrl,
            isCropped,
            width: 0,
            height: 0
        };
    }));

    return (
        <div className="h-full flex flex-col">
            <CropClient projectId={id} images={images} project={project} />
        </div>
    );
}
