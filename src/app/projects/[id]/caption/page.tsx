'use client';

import { useState, use, useEffect, useRef } from 'react';
import { Button, Card, Input, Progress } from '@/components/ui/core';
import { Label } from '@/components/ui/label';
import { Loader2, Play, Save, CheckCircle2, Copy } from 'lucide-react';
import { useRouter } from 'next/navigation';

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
    tagStats?: TagStat[];
}

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
        if (job.tagStats) {
            const text = job.tagStats.map(t => t.tag).join(', ');
            navigator.clipboard.writeText(text);
            alert('Top tags copied to clipboard');
        }
    };

    const isRunning = job.status === 'starting' || job.status === 'processing';
    const progressPercent = job.total > 0 ? (job.progress / job.total) * 100 : 0;

    return (
        <div className="space-y-8">
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
                                    className={`cursor-pointer border rounded-lg p-3 flex-1 text-center transition-all ${model === 'wd14' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-primary/50'}`}
                                >
                                    <div className="font-bold">WD14 Tagger</div>
                                    <div className="text-xs text-muted-foreground">Booru tags (Anime/Style)</div>
                                </div>
                                <div
                                    onClick={() => setModel('blip')}
                                    className={`cursor-pointer border rounded-lg p-3 flex-1 text-center transition-all ${model === 'blip' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-primary/50'}`}
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
                            <div className="space-y-2 rounded-lg border bg-muted/50 p-4">
                                <div className="flex justify-between text-sm">
                                    <span>Processing...</span>
                                    <span className="font-mono">{job.progress} / {job.total}</span>
                                </div>
                                <Progress value={progressPercent} />
                                <p className="text-xs text-muted-foreground truncate">{job.current_file || 'Initializing...'}</p>
                            </div>
                        )}

                        {job.status === 'error' && (
                            <div className="rounded-lg bg-destructive/10 p-4 text-destructive text-sm">
                                {job.error || 'An error occurred'}
                            </div>
                        )}

                        <Button size="lg" className="w-full" onClick={runCaptioning} disabled={isRunning}>
                            {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                            {isRunning ? 'Running...' : 'Run Captioning'}
                        </Button>
                    </div>
                </div>
            </Card>

            {job.status === 'completed' && job.tagStats && (
                <div className="animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <CheckCircle2 className="text-green-500 h-5 w-5" />
                            Captioning Completed
                        </h2>
                        <Button variant="outline" size="sm" onClick={copyTags}>
                            <Copy className="mr-2 h-4 w-4" />
                            Copy top tags
                        </Button>
                    </div>

                    <Card className="p-6">
                        <Label className="mb-4 block">Top Generated Tags</Label>
                        <div className="flex flex-wrap gap-2">
                            {job.tagStats.length === 0 && <p className="text-muted-foreground">No tags generated.</p>}
                            {job.tagStats.map((stat) => (
                                <div key={stat.tag} className="flex items-center gap-2 rounded-full border bg-secondary/50 px-3 py-1 text-sm">
                                    <span className="font-medium">{stat.tag}</span>
                                    <span className="text-xs text-muted-foreground bg-background px-1.5 rounded-full">{stat.count}</span>
                                </div>
                            ))}
                        </div>
                        {job.tagStats.length >= 20 && (
                            <p className="mt-4 text-xs text-muted-foreground">Showing top 20 tags.</p>
                        )}
                    </Card>
                </div>
            )}

            <div className="mt-8 border-t pt-8 text-center text-muted-foreground">
                <p>After captioning, generated .txt files will appear in your project folder.</p>
                <p className="text-sm">(Editor UI coming in next update)</p>
            </div>
        </div>
    );
}
