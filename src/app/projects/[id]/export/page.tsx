import { Button, Card, Input } from '@/components/ui/core';
import { Label } from '@/components/ui/label';
import { analyzeCaptions } from '@/lib/analysis';
import { getProject } from '@/lib/projects';
import { Download, Copy, FileArchive } from 'lucide-react';
import Link from 'next/link';

export default async function ExportPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const project = await getProject(id);
    const keywords = await analyzeCaptions(id);

    if (!project) return <div>Project not found</div>;

    const topKeywords = keywords.slice(0, 20);
    const trigger = project.settings.triggerWord || '';
    const commonPrompt = [trigger, ...topKeywords.map(k => k.keyword).slice(0, 5)].filter(Boolean).join(', ');

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold">Analysis & Export</h1>
                <p className="text-muted-foreground">Review dataset statistics and export for training.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Analysis Column */}
                <div className="space-y-6">
                    <Card className="p-6">
                        <h3 className="font-semibold mb-4">Top Keywords</h3>
                        <div className="flex flex-wrap gap-2">
                            {topKeywords.length > 0 ? topKeywords.map(({ keyword, count }) => (
                                <div key={keyword} className="bg-secondary text-secondary-foreground px-2 py-1 rounded text-sm flex items-center gap-2">
                                    <span>{keyword}</span>
                                    <span className="text-xs opacity-50 bg-background px-1 rounded-full">{count}</span>
                                </div>
                            )) : (
                                <p className="text-sm text-muted-foreground">No captions found yet.</p>
                            )}
                        </div>
                    </Card>

                    <Card className="p-6">
                        <h3 className="font-semibold mb-4">Prompt Helper</h3>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Standard Generation Prompt</label>
                                <div className="relative">
                                    <div className="p-3 bg-muted rounded-md text-sm pr-10 font-mono break-all min-h-[40px] flex items-center">
                                        {commonPrompt || '(Complete captioning to see prompts)'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Export Column */}
                <div className="space-y-6">
                    <Card className="p-6 border-primary/20 bg-primary/5">
                        <h3 className="font-semibold mb-2 flex items-center gap-2">
                            <FileArchive className="h-5 w-5" />
                            Ready to Export
                        </h3>
                        <p className="text-sm text-muted-foreground mb-6">
                            Download your dataset formatted for LoRA training (Kohya-ss compatible).
                            Includes {project.stats.processed} processed images and {project.stats.captions} text files.
                        </p>

                        <Button className="w-full" size="lg" asChild>
                            <a href={`/api/projects/${id}/export`} target="_blank" rel="noopener noreferrer">
                                <Download className="mr-2 h-4 w-4" />
                                Download Dataset (.zip)
                            </a>
                        </Button>
                    </Card>

                    <div className="text-sm text-muted-foreground space-y-2">
                        <h4 className="font-medium text-foreground">Next Steps:</h4>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>Unzip the downloaded file.</li>
                            <li>Open your trainer (Kohya_ss GUI, OneTrainer, etc).</li>
                            <li>Point "Image Folder" to the unzipped `dataset` folder.</li>
                            <li>Start training!</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
