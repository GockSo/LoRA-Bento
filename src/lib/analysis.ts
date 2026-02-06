import fs from 'fs/promises';
import { getTrainingSet } from './dataset';

export interface CaptionSummary {
    mode: 'tags' | 'sentence';
    topItems: { keyword: string; count: number }[];
    samples?: string[];
    totalCaptioned: number;
    uniqueCount: number;
}

export async function analyzeCaptions(projectId: string): Promise<CaptionSummary> {
    try {
        const { items } = await getTrainingSet(projectId);
        const keywordCounts: Record<string, number> = {};
        const samples: string[] = [];
        let totalCaptioned = 0;
        let isSentenceMode = false;

        for (const item of items) {
            try {
                const content = await fs.readFile(item.captionPath, 'utf-8').catch(() => '');
                if (!content) continue;

                totalCaptioned++;

                // Heuristic: if content has no commas and > 3 words, it's likely a sentence
                // Or if it simply doesn't look like a tag list.
                // WD14 usually produces many tags. BLIP produces one sentence.
                if (!isSentenceMode && content.split(' ').length > 4 && !content.includes(',')) {
                    isSentenceMode = true;
                }

                if (isSentenceMode) {
                    // For sentences, we can still extract keywords by splitting by space and filtering small words
                    // But usually BLIP summary is more about samples.
                    const words = content.toLowerCase().replace(/[.,!?;]/g, '').split(/\s+/);
                    words.forEach((w: string) => {
                        if (w.length > 3) {
                            keywordCounts[w] = (keywordCounts[w] || 0) + 1;
                        }
                    });
                    if (samples.length < 5) samples.push(content);
                } else {
                    // Tag Mode
                    const keywords = content.split(/,\s*/).map((k: string) => k.trim()).filter((k: string) => k);
                    keywords.forEach((k: string) => {
                        keywordCounts[k] = (keywordCounts[k] || 0) + 1;
                    });
                }
            } catch {
                continue;
            }
        }

        const topItems = Object.entries(keywordCounts)
            .map(([keyword, count]) => ({ keyword, count }))
            .sort((a, b) => b.count - a.count);

        return {
            mode: isSentenceMode ? 'sentence' : 'tags',
            topItems,
            samples: isSentenceMode ? samples : undefined,
            totalCaptioned,
            uniqueCount: topItems.length
        };

    } catch (error) {
        console.error('Analysis error:', error);
        return {
            mode: 'tags',
            topItems: [],
            totalCaptioned: 0,
            uniqueCount: 0
        };
    }
}
