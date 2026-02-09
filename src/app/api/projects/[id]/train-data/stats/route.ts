import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

interface TrainDataStats {
    trainData: {
        images: number;
        captions: number;
        totalFiles: number;
    };
    topTags: { tag: string; count: number }[];
    mode: 'tags' | 'sentence';
    samples?: string[];
    source: string;
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const projectDir = path.join(process.cwd(), 'projects', id);
        const trainDataDir = path.join(projectDir, 'train_data');

        // Check if train_data/ exists
        try {
            await fs.access(trainDataDir);
        } catch {
            return NextResponse.json({
                trainData: { images: 0, captions: 0, totalFiles: 0 },
                topTags: [],
                mode: 'tags',
                source: 'train_data'
            });
        }

        // Read all files from train_data/
        const files = await fs.readdir(trainDataDir);

        // Count images and captions
        const imageFiles = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
        const captionFiles = files.filter(f => f.endsWith('.txt'));

        const imagesCount = imageFiles.length;
        const captionsCount = captionFiles.length;
        const totalFiles = imagesCount + captionsCount;

        // Parse tags from caption files
        const tagCounts: Record<string, number> = {};
        const samples: string[] = [];
        let isSentenceMode = false;

        for (const captionFile of captionFiles) {
            try {
                const captionPath = path.join(trainDataDir, captionFile);
                const content = await fs.readFile(captionPath, 'utf-8');

                if (!content.trim()) continue;

                // Detect mode: if content has no commas and > 4 words, likely BLIP sentence
                if (!isSentenceMode && content.split(' ').length > 4 && !content.includes(',')) {
                    isSentenceMode = true;
                }

                if (isSentenceMode) {
                    // For sentences, extract keywords (words > 3 chars)
                    const words = content.toLowerCase().replace(/[.,!?;]/g, '').split(/\s+/);
                    words.forEach(w => {
                        if (w.length > 3) {
                            tagCounts[w] = (tagCounts[w] || 0) + 1;
                        }
                    });
                    if (samples.length < 5) samples.push(content);
                } else {
                    // Tag mode: split by comma
                    const tags = content.split(/,\s*/).map(t => t.trim()).filter(t => t);
                    tags.forEach(tag => {
                        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                    });
                }
            } catch (err) {
                console.error(`Failed to read caption ${captionFile}:`, err);
                continue;
            }
        }

        // Sort tags by count
        const topTags = Object.entries(tagCounts)
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 50); // Return top 50 tags

        return NextResponse.json({
            trainData: {
                images: imagesCount,
                captions: captionsCount,
                totalFiles
            },
            topTags,
            mode: isSentenceMode ? 'sentence' : 'tags',
            samples: isSentenceMode ? samples : undefined,
            source: 'train_data'
        } as TrainDataStats);

    } catch (error) {
        console.error('Train data stats error:', error);
        return NextResponse.json(
            { error: 'Failed to compute train data stats' },
            { status: 500 }
        );
    }
}
