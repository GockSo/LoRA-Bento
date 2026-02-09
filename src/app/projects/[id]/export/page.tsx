'use client';

import { useState, useEffect, use } from 'react';
import { Button, Card, Progress } from '@/components/ui/core';
import { Download, Tag, FileArchive, CheckCircle2, AlertCircle, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';

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

export default function ExportPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [summary, setSummary] = useState<TrainDataStats | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchSummary = async (recompute = false) => {
        setLoading(true);
        try {
            const url = `/api/projects/${id}/train-data/stats`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setSummary(data);
                if (recompute) toast.success("Stats recomputed from disk");
            }
        } catch (e) {
            console.error("Failed to load summary", e);
            toast.error("Failed to load dataset summary");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSummary();
    }, [id]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="text-muted-foreground animate-pulse">Analyzing training set...</p>
            </div>
        );
    }

    if (!summary) return <div>Failed to load dataset details.</div>;

    const topTags = summary.topTags.slice(0, 24);

    return (
        <div className="space-y-8 max-w-5xl mx-auto pb-20">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold">Analysis & Export</h1>
                    <p className="text-muted-foreground">Review dataset statistics and export for training.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => fetchSummary(true)} disabled={loading}>
                    <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh Stats
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Analysis Column */}
                <div className="space-y-6">
                    <Card className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold flex items-center gap-2">
                                <Tag className="h-4 w-4 text-primary" />
                                {summary.mode === 'sentence' ? 'Top Keywords' : 'Top Tags'}
                            </h3>
                            <span className="text-[10px] uppercase font-bold text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded">
                                {summary.mode === 'sentence' ? 'Extracted from sentences' : 'Computed from full set'}
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {topTags.length > 0 ? topTags.map(({ tag, count }) => (
                                <div key={tag} className="bg-secondary/50 text-secondary-foreground border px-2 py-1 rounded text-sm flex items-center gap-2 transition-colors hover:bg-secondary">
                                    <span>{tag}</span>
                                    <span className="text-[10px] opacity-60 font-mono">{count}</span>
                                </div>
                            )) : (
                                <div className="py-8 text-center w-full">
                                    <p className="text-sm text-muted-foreground">No captions found in train_data.</p>
                                    <p className="text-xs text-muted-foreground/60">Run Step 5 Captioning first.</p>
                                </div>
                            )}
                        </div>
                    </Card>

                    {summary.mode === 'sentence' && summary.samples && summary.samples.length > 0 && (
                        <Card className="p-6">
                            <h3 className="font-semibold mb-3 flex items-center gap-2">
                                <FileArchive className="h-4 w-4 text-primary" />
                                Sample Captions
                            </h3>
                            <div className="space-y-2">
                                {summary.samples.map((sample, i) => (
                                    <div key={i} className="text-sm p-2 bg-muted/30 rounded border-l-2 border-primary/40 font-serif italic">
                                        "{sample}"
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}


                </div>

                {/* Export Column */}
                <div className="space-y-6">
                    <Card className="p-6 border-primary bg-primary/5 shadow-sm">
                        <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                            <FileArchive className="h-6 w-6 text-primary" />
                            Ready to Export
                        </h3>
                        <p className="text-sm text-muted-foreground mb-6">
                            Download your training dataset as a ZIP archive. Generated on-demand from train_data/ folder.
                        </p>

                        <div className="bg-background/80 rounded-lg p-4 mb-6 space-y-3 border shadow-inner">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Images (.png/.jpg)</span>
                                <span className="font-mono font-bold">{summary.trainData.images}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Captions (.txt)</span>
                                <span className="font-mono font-bold">{summary.trainData.captions}</span>
                            </div>
                            <div className="border-t pt-2 flex justify-between text-sm font-bold">
                                <span>Total Files in ZIP</span>
                                <span className="font-mono text-primary">{summary.trainData.totalFiles + 1}</span>
                            </div>
                        </div>

                        {summary.trainData.captions === 0 && (
                            <div className="mb-6 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex gap-2">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <p>Captions missing. Export will only contain images unless you complete Step 5 Captioning.</p>
                            </div>
                        )}

                        <Button
                            className="w-full shadow-lg"
                            size="lg"
                            asChild
                            onClick={() => {
                                toast.promise(
                                    new Promise((resolve) => setTimeout(resolve, 2000)),
                                    {
                                        loading: 'Generating ZIP archive...',
                                        success: `Exporting ${summary.trainData.images} images + ${summary.trainData.captions} captions`,
                                        error: 'Export failed'
                                    }
                                );
                            }}
                        >
                            <a href={`/api/projects/${id}/export`} target="_blank" rel="noopener noreferrer">
                                <Download className="mr-2 h-5 w-5" />
                                Download Dataset (.zip)
                            </a>
                        </Button>
                    </Card>

                    <div className="text-sm text-muted-foreground space-y-4">
                        <div className="space-y-2">
                            <h4 className="font-semibold text-foreground uppercase text-[11px] tracking-wider">How to train:</h4>
                            <ul className="list-decimal pl-4 space-y-2">
                                <li>Unzip the downloaded file.</li>
                                <li>The folder is structured as a standard Kohya-ss dataset.</li>
                                <li>Point your trainer (Kohya, OneTrainer, FluxGym) to the `dataset` folder.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
