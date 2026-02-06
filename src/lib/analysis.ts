import fs from 'fs/promises';
import path from 'path';

export interface KeywordStats {
    keyword: string;
    count: number;
}

export async function analyzeCaptions(projectId: string): Promise<KeywordStats[]> {
    const projectDir = path.join(process.cwd(), 'projects', projectId);
    const processedDir = path.join(projectDir, 'processed');

    try {
        const files = await fs.readdir(processedDir);
        const txtFiles = files.filter(f => f.endsWith('.txt'));

        const keywordCounts: Record<string, number> = {};

        for (const file of txtFiles) {
            const content = await fs.readFile(path.join(processedDir, file), 'utf-8');
            // Split by comma+space or just comma
            const keywords = content.split(/,\s*/).map(k => k.trim()).filter(k => k);

            keywords.forEach(k => {
                keywordCounts[k] = (keywordCounts[k] || 0) + 1;
            });
        }

        return Object.entries(keywordCounts)
            .map(([keyword, count]) => ({ keyword, count }))
            .sort((a, b) => b.count - a.count);

    } catch (error) {
        console.error('Analysis error:', error);
        return [];
    }
}
