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
        const isCropped = croppedSet.has(file);

        // Get dimensions (optional, helpful for UI aspect ratio but not strictly required if client loads image)
        // We can skip this to save time, client will get undefined dimensions until image loads
        let width = 0;
        let height = 0;

        // Construct URLs
        // Note: we need to use absolute paths for the API route we saw earlier
        const rawUrl = `/api/images?path=${encodeURIComponent(rawPath)}`;
        const croppedUrl = isCropped ? `/api/images?path=${encodeURIComponent(croppedPath)}` : null;

        return {
            id: file,
            rawUrl,
            croppedUrl,
            isCropped,
            width,
            height
        };
    }));

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Crop Images</h1>
                <p className="text-muted-foreground">
                    Optionally crop images to focus on the subject.
                    Cropped versions will be preferred for augmentation.
                </p>
            </div>

            <CropClient projectId={id} images={images} />
        </div>
    );
}
