import sharp from 'sharp';
import fs from 'fs/promises';

// Simple perceptual hash (dHash equivalent)
// Resize to 9x8, grayscale. Compare adjacent pixels.
export async function calculatePHash(path: string): Promise<string> {
    try {
        const buffer = await sharp(path)
            .greyscale()
            .resize(9, 8, { fit: 'fill' })
            .raw()
            .toBuffer();

        let hash = '';
        // 8 rows
        for (let y = 0; y < 8; y++) {
            // 8 cols comparisons (row has 9 pixels)
            for (let x = 0; x < 8; x++) {
                const left = buffer[y * 9 + x];
                const right = buffer[y * 9 + x + 1];
                hash += left > right ? '1' : '0';
            }
        }

        // Convert binary string to hex for compactness
        return BigInt('0b' + hash).toString(16);
    } catch (e) {
        console.error('Hash calculation failed', e);
        return '0000000000000000'; // fallback
    }
}

// Blur detection using Laplacian Variance
// Higher variance = sharper edges = less blurry.
// Lower variance = blurry.
export async function detectBlur(path: string): Promise<{ score: number, isBlurry: boolean }> {
    try {
        // Greyscale first
        const image = sharp(path).greyscale();

        // Laplacian kernel
        const kernel = {
            width: 3,
            height: 3,
            kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0]
        };

        const { data, info } = await image
            .convolve(kernel)
            .raw()
            .toBuffer({ resolveWithObject: true });

        // Calculate variance
        let sum = 0;
        let sumSq = 0;
        const len = data.length;

        for (let i = 0; i < len; i++) {
            const val = data[i];
            sum += val;
            sumSq += val * val;
        }

        const mean = sum / len;
        const variance = (sumSq / len) - (mean * mean);

        // Threshold tuning is tricky.
        // Usually < 100 is quite blurry. < 300 is soft.
        // Let's set a conservative threshold.
        const BLUR_THRESHOLD = 300;

        return {
            score: Math.round(variance),
            isBlurry: variance < BLUR_THRESHOLD
        };
    } catch (e) {
        console.error('Blur detection failed', e);
        return { score: 0, isBlurry: false };
    }
}
