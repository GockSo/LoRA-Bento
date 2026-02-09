'use client';

import { useState, useEffect, use } from 'react';
import { Button, Card, Progress } from '@/components/ui/core';
import { Download, Tag, FileArchive, CheckCircle2, AlertCircle, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';

interface SummaryData {
    rawCount: number;
    augCount: number;
    totalCount: number;
    excludedCount: number;
    sourceStage: 'processed' | 'raw+aug';
    hasCaptions: boolean;
    mode: 'tags' | 'sentence';
    keywordStats: {
        top: { keyword: string; count: number }[];
        rare: { keyword: string; count: number }[];
    };
    samples?: string[];
}

export default function ExportPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [summary, setSummary] = useState<SummaryData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchSummary = async (recompute = false) => {
        setLoading(true);
        try {
            const url = `/api/projects/${id}/training-set/summary${recompute ? '?recompute=true' : ''}`;
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

    const topKeywords = summary.keywordStats.top.slice(0, 24);

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
                            {topKeywords.length > 0 ? topKeywords.map(({ keyword, count }) => (
                                <div key={keyword} className="bg-secondary/50 text-secondary-foreground border px-2 py-1 rounded text-sm flex items-center gap-2 transition-colors hover:bg-secondary">
                                    <span>{keyword}</span>
                                    <span className="text-[10px] opacity-60 font-mono">{count}</span>
                                </div>
                            )) : (
                                <div className="py-8 text-center w-full">
                                    <p className="text-sm text-muted-foreground">No captions found in training set.</p>
                                    <p className="text-xs text-muted-foreground/60">Complete Step 4 to generate keywords.</p>
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

                    <Card className="p-6 bg-slate-50/50 dark:bg-slate-950/20">
                        <h3 className="font-semibold mb-4">Training Set Breakdown</h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground uppercase font-bold">Raw Images</p>
                                    <p className="text-2xl font-mono">{summary.rawCount}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground uppercase font-bold">Augmented</p>
                                    <p className="text-2xl font-mono">{summary.augCount}</p>
                                </div>
                            </div>

                            <div className="pt-4 border-t">
                                <div className="flex justify-between items-end mb-1">
                                    <p className="text-sm font-medium">Ready for Training</p>
                                    <p className="text-sm font-mono font-bold text-primary">{summary.totalCount} total</p>
                                </div>
                                <Progress value={100} className="h-2" />
                                <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                    Source: <span className="font-semibold">{summary.sourceStage === 'processed' ? 'Processed Folder (Optimized)' : 'Raw + Augmented'}</span>
                                </p>
                            </div>

                            {summary.excludedCount > 0 && (
                                <p className="text-[10px] text-orange-600 dark:text-orange-400 flex items-center gap-1 bg-orange-50 dark:bg-orange-950/20 p-2 rounded">
                                    <AlertCircle className="h-3 w-3" />
                                    {summary.excludedCount} images excluded from training set via manifest.
                                </p>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Export Column */}
                <div className="space-y-6">
                    <Card className="p-6 border-primary bg-primary/5 shadow-sm">
                        <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                            <FileArchive className="h-6 w-6 text-primary" />
                            Ready to Export
                        </h3>
                        <p className="text-sm text-muted-foreground mb-6">
                            Download your unified dataset formatted for LoRA training (Kohya-ss compatible).
                        </p>

                        <div className="bg-background/80 rounded-lg p-4 mb-6 space-y-3 border shadow-inner">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Images (.png/.jpg)</span>
                                <span className="font-mono font-bold">{summary.totalCount}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Captions (.txt)</span>
                                <span className="font-mono font-bold">{summary.hasCaptions ? summary.totalCount : 0}</span>
                            </div>
                            <div className="border-t pt-2 flex justify-between text-sm font-bold">
                                <span>Total Files in ZIP</span>
                                <span className="font-mono text-primary">{(summary.totalCount * (summary.hasCaptions ? 2 : 1)) + 1}</span>
                            </div>
                        </div>

                        {!summary.hasCaptions && (
                            <div className="mb-6 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex gap-2">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <p>Captions missing. Export will only contain images unless you complete Step 5. but if you ok can export without captions </p>
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
                                        success: `Exporting ${summary.totalCount} images + ${summary.hasCaptions ? summary.totalCount : 0} captions`,
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
