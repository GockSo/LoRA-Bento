'use client';

import { useState, useEffect, use } from 'react';
import { Button, Card, Input } from '@/components/ui/core';
import { Label } from '@/components/ui/label';
import { Loader2, Scaling, Play, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ProcessPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    // Layout handles project existence check
    const projectId = id;

    const [settings, setSettings] = useState({
        targetSize: 512,
        padMode: 'transparent',
        padColor: '#000000'
    });
    const [manifestItems, setManifestItems] = useState<any[]>([]);
    const [jobId, setJobId] = useState<string | null>(null);
    const [jobStatus, setJobStatus] = useState<'idle' | 'running' | 'completed'>('idle');
    const [progress, setProgress] = useState({ processed: 0, total: 0 });
    const [itemStates, setItemStates] = useState<Record<string, any>>({});
    const router = useRouter();

    // Load Manifest
    useEffect(() => {
        fetchManifest();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]);

    const fetchManifest = async () => {
        try {
            const res = await fetch(`/api/projects/${projectId}/manifest`);
            if (res.ok) {
                const data = await res.json();
                setManifestItems(data.items || []);
            }
        } catch (e) {
            console.error('Failed to load manifest', e);
        }
    };

    const runProcessing = async () => {
        setJobStatus('running');
        setItemStates({}); // Clear old states
        try {
            const res = await fetch(`/api/projects/${projectId}/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings }),
            });

            if (res.ok) {
                const data = await res.json();
                setJobId(data.jobId);
            } else {
                const err = await res.json();
                alert(`Error: ${err.error}`);
                setJobStatus('idle');
            }
        } catch (e) {
            alert('Failed to start processing');
            setJobStatus('idle');
        }
    };

    // Poll Job
    useEffect(() => {
        if (!jobId || jobStatus === 'completed') return;

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/projects/${projectId}/jobs/${jobId}`);
                if (res.ok) {
                    const job = await res.json();
                    setProgress(job.progress);
                    setItemStates(job.results || {});

                    if (job.status === 'completed') {
                        setJobStatus('completed');
                        router.refresh();
                    }
                }
            } catch (e) {
                console.error('Poll error', e);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [jobId, jobStatus, projectId, router]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-120px)]">
            <div className="lg:col-span-1 space-y-6 overflow-y-auto pr-2">
                <div>
                    <h1 className="text-2xl font-bold">Resize & Pad</h1>
                    <p className="text-muted-foreground">Prepare images for training by resizing to standard buckets.</p>
                </div>

                <Card className="p-6 space-y-6">
                    <div className="grid gap-6">
                        <div className="space-y-2">
                            <Label>Target Resolution</Label>
                            <div className="grid grid-cols-3 gap-4">
                                {[512, 768, 1024].map((size) => (
                                    <div
                                        key={size}
                                        onClick={() => setSettings({ ...settings, targetSize: size })}
                                        className={`
                        cursor-pointer border rounded-lg p-4 text-center transition-all
                        ${settings.targetSize === size ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-primary/50'}
                      `}
                                    >
                                        <div className="font-bold text-lg">{size}</div>
                                        <div className="text-xs text-muted-foreground">x {size}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Padding Mode</Label>
                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    { id: 'transparent', label: 'Transparent' },
                                    { id: 'solid', label: 'Solid Color' },
                                    { id: 'blur', label: 'Blur (Smart)' }
                                ].map((mode) => (
                                    <div
                                        key={mode.id}
                                        onClick={() => setSettings({ ...settings, padMode: mode.id })}
                                        className={`
                        cursor-pointer border rounded-lg p-4 text-center transition-all
                        ${settings.padMode === mode.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-primary/50'}
                      `}
                                    >
                                        <div className="font-medium text-xs">{mode.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {settings.padMode === 'solid' && (
                            <div className="space-y-2">
                                <Label>Pad Color</Label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="color"
                                        value={settings.padColor}
                                        onChange={(e) => setSettings({ ...settings, padColor: e.target.value })}
                                        className="h-10 w-20 p-1 rounded border cursor-pointer"
                                    />
                                    <span className="text-sm font-mono">{settings.padColor}</span>
                                </div>
                            </div>
                        )}

                        <div className="pt-4 border-t">
                            <Button className="w-full" size="lg" onClick={runProcessing} disabled={jobStatus === 'running'}>
                                {jobStatus === 'running' ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Processing... ({progress.processed}/{progress.total})
                                    </>
                                ) : (
                                    <>
                                        <Play className="mr-2 h-4 w-4" />
                                        Start Processing
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>

            <div className="lg:col-span-2 space-y-4 flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between shrink-0">
                    <h2 className="text-lg font-semibold">
                        Processing Queue ({manifestItems.length})
                    </h2>
                    {jobStatus === 'running' && (
                        <span className="text-sm text-muted-foreground animate-pulse">
                            Processing...
                        </span>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 pr-2">
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 pb-10">
                        {manifestItems.length > 0 ? (
                            manifestItems.map((item: any) => {
                                const state = itemStates[item.id];
                                const isDone = state?.status === 'done';
                                const isProcessing = state?.status === 'processing';
                                const isError = state?.status === 'error';

                                return (
                                    <Card key={item.id} className={`overflow-hidden group relative ${item.stage === 'raw' ? 'bg-background border-dashed' : 'bg-muted/20'}`}>
                                        <div className="aspect-square relative transition-opacity duration-200">
                                            {/* Processed/Status Overlay */}
                                            {isDone && (
                                                <div className="absolute top-2 right-2 z-10 animate-in zoom-in-50 duration-300">
                                                    <div className="bg-green-500 text-white rounded-full p-1 shadow-md">
                                                        <CheckCircle className="h-4 w-4" />
                                                    </div>
                                                </div>
                                            )}
                                            {isProcessing && (
                                                <div className="absolute inset-0 z-10 bg-background/50 flex items-center justify-center">
                                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                </div>
                                            )}
                                            {isError && (
                                                <div className="absolute inset-0 z-10 bg-destructive/20 flex items-center justify-center">
                                                    <span className="text-xs font-bold text-destructive">Failed</span>
                                                </div>
                                            )}

                                            {/* Image */}
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={item.src}
                                                alt={item.displayName}
                                                className={`w-full h-full object-contain p-2 ${isDone ? 'opacity-50' : ''}`} // Dim if done? Or keep sharp? Maybe slight dim or 'grayscale-0' check
                                                loading="lazy"
                                            />
                                        </div>
                                        <div className="p-2 space-y-1 bg-background/90 text-[10px] border-t">
                                            <div className="truncate text-muted-foreground w-full" title={item.displayName}>
                                                {item.displayName}
                                            </div>
                                            {item.stage === 'augmented' && (
                                                <span className="inline-block px-1.5 py-0.5 bg-primary/10 text-primary rounded-sm text-[9px]">
                                                    AUG
                                                </span>
                                            )}
                                            {item.stage === 'raw' && (
                                                <span className="inline-block px-1.5 py-0.5 bg-muted text-muted-foreground rounded-sm text-[9px]">
                                                    RAW
                                                </span>
                                            )}
                                        </div>
                                    </Card>
                                );
                            })
                        ) : (
                            <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                                No images found to process.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
