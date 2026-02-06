import { NextRequest, NextResponse } from 'next/server';
import { getTrainingSet } from '@/lib/dataset';
import { analyzeCaptions } from '@/lib/analysis';
import fs from 'fs/promises';
import path from 'path';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const searchParams = req.nextUrl.searchParams;
        const recompute = searchParams.get('recompute') === 'true';

        const { stats, sourceStage, items } = await getTrainingSet(id);
        const projectDir = path.join(process.cwd(), 'projects', id);
        const statsPath = path.join(projectDir, 'caption_stats.json');

        let captionData: any = null;

        if (!recompute) {
            try {
                const statsJson = await fs.readFile(statsPath, 'utf-8');
                captionData = JSON.parse(statsJson);
            } catch {
                // Ignore and recompute below
            }
        }

        if (!captionData) {
            captionData = await analyzeCaptions(id);
            // Save for cache
            await fs.writeFile(statsPath, JSON.stringify(captionData, null, 2));
        }

        return NextResponse.json({
            rawCount: stats.raw,
            augCount: stats.aug,
            totalCount: stats.total,
            excludedCount: stats.excluded,
            sourceStage,
            hasCaptions: captionData.totalCaptioned > 0,
            mode: captionData.mode,
            keywordStats: {
                top: captionData.topItems.slice(0, 50),
                rare: [...captionData.topItems].reverse().slice(0, 20)
            },
            samples: captionData.samples
        });
    } catch (error) {
        console.error('Training set summary error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
