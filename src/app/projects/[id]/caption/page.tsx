'use client';

import { useState, use, useEffect, useRef } from 'react';
import { Button, Card, Input, Progress } from '@/components/ui/core';
import { Label } from '@/components/ui/label';
import { Loader2, Play, Copy, Tag, RefreshCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TagStat {
    tag: string;
    count: number;
}

interface JobStatus {
    status: 'idle' | 'starting' | 'processing' | 'completed' | 'error';
    progress: number;
    total: number;
    current_file?: string;
    error?: string;
    // Unified summary structure
    summary?: {
        mode: 'tags' | 'sentence';
        topItems: { text: string; count: number }[];
        uniqueCount: number;
        samples?: string[];
    };
    // Breakdown stats
    rawCount?: number;
    augCount?: number;
    totalCount?: number;
    excludedCount?: number;
    sourceStage?: 'processed' | 'raw+aug';
    // Legacy support
    tagStats?: TagStat[];
    totalUniqueTags?: number;
}

const PASTEL_COLORS = [
    'bg-pink-100 text-pink-700 border-pink-200 hover:bg-pink-200',
    'bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200',
    'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200',
    'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200',
    'bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-200',
    'bg-lime-100 text-lime-700 border-lime-200 hover:bg-lime-200',
    'bg-green-100 text-green-700 border-green-200 hover:bg-green-200',
    'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200',
    'bg-teal-100 text-teal-700 border-teal-200 hover:bg-teal-200',
    'bg-cyan-100 text-cyan-700 border-cyan-200 hover:bg-cyan-200',
    'bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-200',
    'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200',
    'bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200',
    'bg-violet-100 text-violet-700 border-violet-200 hover:bg-violet-200',
    'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200',
    'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200 hover:bg-fuchsia-200',
];

const getTagColor = (tag: string) => {
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
        hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % PASTEL_COLORS.length;
    return PASTEL_COLORS[index];
};

export default function CaptionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [model, setModel] = useState('wd14');
    const [triggerWord, setTriggerWord] = useState('');
    const [job, setJob] = useState<JobStatus>({ status: 'idle', progress: 0, total: 0 });
    const router = useRouter();
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch Project Details (Name) & Initial Job Status
    useEffect(() => {
        const fetchProject = async () => {
            try {
                const res = await fetch(`/api/projects/${id}`);
                const data = await res.json();
                if (data.name && !triggerWord) {
                    setTriggerWord(data.name);
                }
            } catch (e) {
                console.error("Failed to load project", e);
            }
        };
        fetchProject();

        // Check for existing job
        checkStatus();

        return () => stopPolling();
    }, [id]);

    // Polling Logic
    const startPolling = () => {
        if (pollingRef.current) return;
        pollingRef.current = setInterval(checkStatus, 1000);
    };

    const stopPolling = () => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    };

    const checkStatus = async () => {
        try {
            const res = await fetch(`/api/projects/${id}/caption`);
            if (res.ok) {
                const data: JobStatus = await res.json();
                setJob(data);

                if (data.status === 'completed' || data.status === 'error') {
                    stopPolling();
                    if (data.status === 'completed') router.refresh();
                } else if (data.status === 'processing' || data.status === 'starting') {
                    startPolling();
                }
            }
        } catch {
            // ignore
        }
    };

    const runCaptioning = async () => {
        setJob({ status: 'starting', progress: 0, total: 0 });
        try {
            const res = await fetch(`/api/projects/${id}/caption`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model, triggerWord }),
            });
            if (res.ok) {
                startPolling();
            } else {
                const err = await res.json();
                setJob(prev => ({ ...prev, status: 'error', error: err.error }));
                alert(err.error);
            }
        } catch {
            setJob(prev => ({ ...prev, status: 'error', error: 'Failed to start' }));
        }
    };

    const copyTags = () => {
        if (job.summary?.topItems) {
            const text = job.summary.topItems.map(t => t.text).join(', ');
            navigator.clipboard.writeText(text);
            toast.success(job.summary.mode === 'sentence' ? "All keywords copied" : "All tags copied");
        } else if (job.tagStats) {
            const text = job.tagStats.map(t => t.tag).join(', ');
            navigator.clipboard.writeText(text);
            toast.success("All visible tags copied to clipboard");
        }
    };

    const copySingleTag = (tag: string) => {
        navigator.clipboard.writeText(tag);
        toast.success(`Copied: ${tag}`);
    };

    const isRunning = job.status === 'starting' || job.status === 'processing';
    const progressPercent = job.total > 0 ? (job.progress / job.total) * 100 : 0;

    // Helper to get items to display
    const displayItems = job.summary?.topItems
        ? job.summary.topItems.map(i => ({ tag: i.text, count: i.count }))
        : job.tagStats || [];

    const uniqueCount = job.summary?.uniqueCount ?? job.totalUniqueTags;
    const isSentenceMode = job.summary?.mode === 'sentence';

    return (
        <div className="space-y-8 max-w-5xl mx-auto pb-20">
            <div>
                <h1 className="text-2xl font-bold">Captioning</h1>
                <p className="text-muted-foreground">Auto-label images using AI models.</p>
            </div>

            <Card className="p-6">
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <Label>Captioning Model</Label>
                            <div className="flex gap-4">
                                <div
                                    onClick={() => setModel('wd14')}
                                    className={cn(
                                        "cursor-pointer border rounded-lg p-3 flex-1 text-center transition-all",
                                        model === 'wd14' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-primary/50'
                                    )}
                                >
                                    <div className="font-bold">WD14 Tagger</div>
                                    <div className="text-xs text-muted-foreground">Booru tags (Anime/Style)</div>
                                </div>
                                <div
                                    onClick={() => setModel('blip')}
                                    className={cn(
                                        "cursor-pointer border rounded-lg p-3 flex-1 text-center transition-all",
                                        model === 'blip' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-primary/50'
                                    )}
                                >
                                    <div className="font-bold">BLIP</div>
                                    <div className="text-xs text-muted-foreground">Natural Language</div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Trigger Word (Optional)</Label>
                            <Input
                                placeholder="e.g. projectname"
                                value={triggerWord}
                                onChange={(e) => setTriggerWord(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">Prepended to every caption. Defaults to project name.</p>
                        </div>
                    </div>

                    <div className="flex flex-col justify-end space-y-4">
                        {isRunning && (
                            <div className="space-y-3 rounded-lg border bg-muted/50 p-4">
                                <div className="space-y-1">
                                    <div className="flex justify-between text-sm font-medium">
                                        <span>Captioning in progress...</span>
                                        <span className="font-mono">{job.progress} / {job.totalCount ?? job.total}</span>
                                    </div>
                                    <Progress value={progressPercent} />
                                </div>

                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground border-t pt-2">
                                    {job.sourceStage && (
                                        <div className="flex items-center gap-1">
                                            <span className="font-semibold uppercase text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">Source</span>
                                            <span>{job.sourceStage}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1">
                                        <span className="font-semibold uppercase text-[10px] bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">Breakdown</span>
                                        <span>
                                            {job.rawCount ?? 0} raw + {job.augCount ?? 0} aug
                                            {job.excludedCount ? ` (${job.excludedCount} excluded)` : ''}
                                        </span>
                                    </div>
                                </div>

                                <p className="text-[10px] text-muted-foreground truncate italic opacity-70">
                                    Current: {job.current_file || 'Initializing...'}
                                </p>
                            </div>
                        )}

                        {job.status === 'error' && (
                            <div className="rounded-lg bg-destructive/10 p-4 text-destructive text-sm">
                                {job.error || 'An error occurred'}
                            </div>
                        )}

                        <Button size="lg" className="w-full" onClick={runCaptioning} disabled={isRunning}>
                            {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                            {isRunning ? 'Running...' : 'Start Captioning'}
                        </Button>
                    </div>
                </div>
            </Card>

            {job.status === 'completed' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 space-y-8">
                    {/* Completion Summary */}
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-emerald-100 dark:bg-emerald-900/50 p-2 rounded-full text-emerald-600 dark:text-emerald-400">
                                <Tag className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">Captioning Complete</h3>
                                <p className="text-sm text-emerald-700/80 dark:text-emerald-400/80">
                                    Captioned {job.totalCount ?? job.total} images successfully
                                    ({job.rawCount ?? 0} raw, {job.augCount ?? 0} augmented)
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => router.refresh()}>
                                <RefreshCcw className="mr-2 h-4 w-4" />
                                Refresh
                            </Button>
                        </div>
                    </div>

                    {/* Stats Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-baseline gap-3">
                                <h2 className="text-xl font-semibold flex items-center gap-2">
                                    <Tag className="text-primary h-5 w-5" />
                                    {isSentenceMode ? "Top Keywords" : "Top Generated Tags"}
                                </h2>
                                {uniqueCount !== undefined && (
                                    <span className="text-sm font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">
                                        Unique: {uniqueCount}
                                    </span>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => router.refresh()}>
                                    <RefreshCcw className="mr-2 h-4 w-4" />
                                    Refresh
                                </Button>
                                <Button variant="secondary" size="sm" onClick={copyTags} disabled={displayItems.length === 0}>
                                    <Copy className="mr-2 h-4 w-4" />
                                    Copy All
                                </Button>
                            </div>
                        </div>

                        <Card className="min-h-[150px] p-6 bg-slate-50/50 dark:bg-slate-950/50">
                            {displayItems.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4 text-muted-foreground">
                                    <div className="bg-muted rounded-full p-4">
                                        <Tag className="h-8 w-8 opacity-50" />
                                    </div>
                                    <div>
                                        <p className="font-medium">No results found</p>
                                        <p className="text-sm">Run captioning to generate stats.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex flex-wrap gap-2">
                                        {displayItems.map((stat) => (
                                            <button
                                                key={stat.tag}
                                                onClick={() => copySingleTag(stat.tag)}
                                                className={cn(
                                                    "group flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-all active:scale-95",
                                                    getTagColor(stat.tag)
                                                )}
                                                title="Click to copy"
                                            >
                                                <span>{stat.tag}</span>
                                                <span className="bg-white/40 dark:bg-black/10 px-1.5 rounded-full text-[10px] min-w-[1.5em] text-center">
                                                    {stat.count}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-center text-muted-foreground pt-4">
                                        Showing top {displayItems.length} {isSentenceMode ? 'keywords' : 'tags'}.
                                    </p>
                                </div>
                            )}
                        </Card>
                    </div>

                    {/* Report / Samples Section for Sentence Mode */}
                    {isSentenceMode && job.summary?.samples && (
                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold flex items-center gap-2">
                                <span className="text-primary">📝</span>
                                Sample Captions
                            </h2>
                            <div className="grid gap-3">
                                {job.summary.samples.map((sample, idx) => (
                                    <Card key={idx} className="p-4 flex gap-4 items-start group hover:border-primary/50 transition-colors">
                                        <div className="flex-1 text-sm leading-relaxed text-muted-foreground group-hover:text-foreground">
                                            {sample}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => {
                                                navigator.clipboard.writeText(sample);
                                                toast.success("Caption copied");
                                            }}
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="mt-8 border-t pt-8 text-center text-muted-foreground">
                <p>After captioning, generated .txt files will appear in your project folder.</p>
            </div>
        </div>
    );
}
