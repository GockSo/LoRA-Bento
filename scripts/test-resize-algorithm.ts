/**
 * Test script to verify the resize algorithm works correctly
 * This creates test images and verifies they resize according to the spec
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';

interface TestCase {
    name: string;
    inputWidth: number;
    inputHeight: number;
    targetSize: number;
    expectedOutputWidth: number;
    expectedOutputHeight: number;
}

const testCases: TestCase[] = [
    // Portrait images (height > width)
    {
        name: 'Portrait 1000x2000 → 512x512',
        inputWidth: 1000,
        inputHeight: 2000,
        targetSize: 512,
        expectedOutputWidth: 512,
        expectedOutputHeight: 512
    },
    {
        name: 'Portrait 600x1200 → 1024x1024',
        inputWidth: 600,
        inputHeight: 1200,
        targetSize: 1024,
        expectedOutputWidth: 1024,
        expectedOutputHeight: 1024
    },
    // Landscape images (width > height)
    {
        name: 'Landscape 2000x1000 → 512x512',
        inputWidth: 2000,
        inputHeight: 1000,
        targetSize: 512,
        expectedOutputWidth: 512,
        expectedOutputHeight: 512
    },
    {
        name: 'Landscape 1600x800 → 768x768',
        inputWidth: 1600,
        inputHeight: 800,
        targetSize: 768,
        expectedOutputWidth: 768,
        expectedOutputHeight: 768
    },
    // Square images
    {
        name: 'Square 1000x1000 → 512x512',
        inputWidth: 1000,
        inputHeight: 1000,
        targetSize: 512,
        expectedOutputWidth: 512,
        expectedOutputHeight: 512
    },
    // Small images (upscaling)
    {
        name: 'Small 200x400 → 1024x1024 (upscale)',
        inputWidth: 200,
        inputHeight: 400,
        targetSize: 1024,
        expectedOutputWidth: 1024,
        expectedOutputHeight: 1024
    }
];

async function verifyResizeAlgorithm() {
    console.log('\n🧪 Starting Resize Algorithm Verification\n');
    console.log('='.repeat(60));

    const testDir = path.join(process.cwd(), 'test-resize-output');
    await fs.mkdir(testDir, { recursive: true });

    let passed = 0;
    let failed = 0;

    for (const test of testCases) {
        try {
            // Create test input image
            const inputBuffer = await sharp({
                create: {
                    width: test.inputWidth,
                    height: test.inputHeight,
                    channels: 4,
                    background: { r: 100, g: 150, b: 200, alpha: 1 }
                }
            })
                .png()
                .toBuffer();

            // Apply the resize algorithm
            const targetSize = test.targetSize;
            const scale = targetSize / Math.max(test.inputWidth, test.inputHeight);
            const newWidth = Math.round(test.inputWidth * scale);
            const newHeight = Math.round(test.inputHeight * scale);

            // Process with padding (transparent mode)
            const outputBuffer = await sharp(inputBuffer)
                .resize(newWidth, newHeight, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .extend({
                    top: Math.floor((targetSize - newHeight) / 2),
                    bottom: Math.ceil((targetSize - newHeight) / 2),
                    left: Math.floor((targetSize - newWidth) / 2),
                    right: Math.ceil((targetSize - newWidth) / 2),
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .png()
                .toBuffer();

            // Verify output dimensions
            const metadata = await sharp(outputBuffer).metadata();

            const dimensionsCorrect =
                metadata.width === test.expectedOutputWidth &&
                metadata.height === test.expectedOutputHeight;

            // Verify aspect ratio preserved (within rounding tolerance)
            const inputAspect = test.inputWidth / test.inputHeight;
            const processedAspect = newWidth / newHeight;
            const aspectPreserved = Math.abs(inputAspect - processedAspect) < 0.01;

            // Verify longer side matches target
            const longerInputSide = Math.max(test.inputWidth, test.inputHeight);
            const longerProcessedSide = Math.max(newWidth, newHeight);
            const expectedLongerSide = targetSize;
            const longerSideCorrect = longerProcessedSide === expectedLongerSide;

            if (dimensionsCorrect && aspectPreserved && longerSideCorrect) {
                console.log(`✅ ${test.name}`);
                console.log(`   Input: ${test.inputWidth}x${test.inputHeight}`);
                console.log(`   Resized: ${newWidth}x${newHeight}`);
                console.log(`   Final: ${metadata.width}x${metadata.height}`);
                console.log(`   Aspect ratio preserved: ${aspectPreserved ? 'Yes' : 'No'}`);
                passed++;
            } else {
                console.log(`❌ ${test.name}`);
                console.log(`   Expected: ${test.expectedOutputWidth}x${test.expectedOutputHeight}`);
                console.log(`   Got: ${metadata.width}x${metadata.height}`);
                console.log(`   Resized to: ${newWidth}x${newHeight}`);
                console.log(`   Aspect preserved: ${aspectPreserved ? 'Yes' : 'No'}`);
                console.log(`   Longer side correct: ${longerSideCorrect ? 'Yes' : 'No'}`);
                failed++;
            }

            // Save test output for visual inspection
            const filename = `${test.name.replace(/[^a-z0-9]/gi, '_')}.png`;
            await fs.writeFile(path.join(testDir, filename), outputBuffer);

        } catch (error) {
            console.log(`❌ ${test.name} - ERROR: ${error}`);
            failed++;
        }

        console.log('');
    }

    console.log('='.repeat(60));
    console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests\n`);
    console.log(`Test outputs saved to: ${testDir}\n`);

    return failed === 0;
}

// Run the verification
verifyResizeAlgorithm()
    .then((success) => {
        process.exit(success ? 0 : 1);
    })
    .catch((error) => {
        console.error('Test script error:', error);
        process.exit(1);
    });
