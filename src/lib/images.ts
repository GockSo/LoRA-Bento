import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { ImageFile, ProjectSettings } from '@/types';

export async function getImageMetadata(filePath: string): Promise<ImageFile> {
    const metadata = await sharp(filePath).metadata();
    const stats = await fs.stat(filePath);

    return {
        name: path.basename(filePath),
        path: filePath,
        url: `/api/images?path=${encodeURIComponent(filePath)}`, // Helper API will serve this
        width: metadata.width || 0,
        height: metadata.height || 0,
        size: stats.size
    };
}

export async function processImage(
    inputPath: string,
    outputPath: string,
    settings: ProjectSettings
) {
    const { targetSize, padMode, padColor } = settings;
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
        throw new Error('Invalid image metadata');
    }

    // Calculate new dimensions ensuring aspect ratio is preserved
    // Scale so the LONGER side becomes exactly targetSize
    const scale = targetSize / Math.max(metadata.width, metadata.height);
    const newWidth = Math.round(metadata.width * scale);
    const newHeight = Math.round(metadata.height * scale);

    let pipeline = image.resize(newWidth, newHeight, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent initially
    });

    // Extension/Padding logic
    if (padMode === 'transparent' || padMode === 'solid') {
        let background: any = { r: 0, g: 0, b: 0, alpha: 0 };

        if (padMode === 'solid' && padColor) {
            // Parse hex color to RGB
            const hex = padColor.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            background = { r, g, b, alpha: 1 };
        }

        pipeline = pipeline.extend({
            top: Math.floor((targetSize - newHeight) / 2),
            bottom: Math.ceil((targetSize - newHeight) / 2),
            left: Math.floor((targetSize - newWidth) / 2),
            right: Math.ceil((targetSize - newWidth) / 2),
            background: background
        });
    } else if (padMode === 'blur') {
        // For blur, we create a blurred version of the background and composite the resized image on top
        // This is more complex, for V1 we can fallback to extend or do a composite
        // A simple approximation is extending with a blurred version of the edge pixels, 
        // but sharp's extend doesn't verify blur. 
        // Alternative: Resize original to cover targetSize (crop), blur it, then composite the 'contain' resize on top.

        // 1. Create blurred background
        const bgScale = Math.max(targetSize / metadata.width, targetSize / metadata.height);
        const bgWidth = Math.round(metadata.width * bgScale);
        const bgHeight = Math.round(metadata.height * bgScale);

        const bgBuffer = await sharp(inputPath)
            .resize(bgWidth, bgHeight, { fit: 'cover' })
            .blur(20)
            .extract({
                left: Math.floor((bgWidth - targetSize) / 2),
                top: Math.floor((bgHeight - targetSize) / 2),
                width: targetSize,
                height: targetSize
            })
            .toBuffer();

        // 2. Resize foreground
        const fgBuffer = await sharp(inputPath)
            .resize(newWidth, newHeight, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .toBuffer();

        // 3. Composite
        pipeline = sharp(bgBuffer).composite([{ input: fgBuffer }]);
    }

    // Ensure output is png
    await pipeline.png().toFile(outputPath);
}

export async function augmentImage(
    inputPath: string,
    outputPath: string,
    options: { rotate?: number; flipH?: boolean; zoom?: number }
) {
    let pipeline = sharp(inputPath).ensureAlpha();

    // 1. Horizontal flip (LEFT<->RIGHT)
    // Must be done BEFORE rotation to act as a pure mirror of the source
    if (options.flipH) {
        pipeline = pipeline.flop();
    }

    // 2. Rotation with transparent background
    if (options.rotate && options.rotate !== 0) {
        pipeline = pipeline.rotate(options.rotate, {
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        });
    }
    // Zoom implementation requires extracting a crop. 
    // Zoom > 1 means cropping. Zoom < 1 means adding padding (which we can leave to resize step, or handle here).
    // For simplicity, let's handle mild zoom in (cropping) here.
    if (options.zoom && options.zoom !== 1) {
        const metadata = await sharp(inputPath).metadata();
        if (metadata.width && metadata.height) {
            const width = metadata.width;
            const height = metadata.height;

            // If zoom = 1.1, we crop the center 1/1.1 of the image
            if (options.zoom > 1) {
                const cropWidth = Math.round(width / options.zoom);
                const cropHeight = Math.round(height / options.zoom);
                const left = Math.round((width - cropWidth) / 2);
                const top = Math.round((height - cropHeight) / 2);

                pipeline = pipeline.extract({ left, top, width: cropWidth, height: cropHeight })
                    .resize(width, height); // Resize back to original dimensions? Or let the next step handle it?
                // Usually augmentation preserves resolution or lets the downstream resize handle it.
                // Let's keep it simple: just crop.
            }
        }
    }

    // Force PNG output to preserve transparency
    await pipeline.png().toFile(outputPath);
}

export function getRandomAugmentationParams(settings: {
    rotationRandom: boolean;
    rotationRange: [number, number];
    flipEnabled: boolean;
}) {
    let rotate = 0;
    let flipH = false;

    if (settings.rotationRandom) {
        const [min, max] = settings.rotationRange;
        rotate = Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Deterministic flip if enabled
    if (settings.flipEnabled) {
        flipH = true;
    }

    return { rotate, flipH };
}
