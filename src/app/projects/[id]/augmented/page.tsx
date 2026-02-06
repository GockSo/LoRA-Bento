'use client';

import { useState, useEffect, use } from 'react';
import { Button, Card, Switch } from '@/components/ui/core';
import { Label } from '@/components/ui/label';
import { Loader2, Wand2, RefreshCcw, Image as ImageIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AugmentationPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const projectId = id;
    const router = useRouter();

    const [settings, setSettings] = useState({
        rotationRandom: false,
        rotationRange: [-35, 35] as [number, number],
        flipRandom: false,
        // Legacy support if needed, or remove
        zoom: 1
    });

    const [jobId, setJobId] = useState<string | null>(null);
    const [jobStatus, setJobStatus] = useState<'idle' | 'running' | 'completed'>('idle');
    const [progress, setProgress] = useState({ processed: 0, total: 0 });
    const [results, setResults] = useState<any[]>([]);

    const runAugmentation = async () => {
        setJobStatus('running');
        setResults([]);
        try {
            const res = await fetch(`/api/projects/${projectId}/augment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings }),
            });

            if (res.ok) {
                const data = await res.json();
                setJobId(data.jobId);
            } else {
                alert('Failed to start job');
                setJobStatus('idle');
            }
        } catch (e) {
            console.error(e);
            alert('Failed to start job');
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
                    setResults(job.results || []);
                    if (job.status === 'completed') {
                        setJobStatus('completed');
                        router.refresh(); // Update sidebar counts
                    }
                }
            } catch (e) {
                console.error('Poll error', e);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [jobId, jobStatus, projectId, router]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Augmentation</h1>
                    <p className="text-muted-foreground">Randomize dataset to improve training generalization.</p>
                </div>

                <Card className="p-6 space-y-6">
                    <div className="space-y-6">
                        {/* Rotation Settings */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label className="text-base">Random Rotation</Label>
                                <Switch
                                    checked={settings.rotationRandom}
                                    onCheckedChange={(c) => setSettings({ ...settings, rotationRandom: c })}
                                />
                            </div>

                            {settings.rotationRandom && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Min Degrees</Label>
                                        <input
                                            type="number"
                                            value={settings.rotationRange[0]}
                                            onChange={(e) => setSettings({
                                                ...settings,
                                                rotationRange: [parseInt(e.target.value), settings.rotationRange[1]]
                                            })}
                                            className="w-full text-sm p-2 bg-secondary rounded-md"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Max Degrees</Label>
                                        <input
                                            type="number"
                                            value={settings.rotationRange[1]}
                                            onChange={(e) => setSettings({
                                                ...settings,
                                                rotationRange: [settings.rotationRange[0], parseInt(e.target.value)]
                                            })}
                                            className="w-full text-sm p-2 bg-secondary rounded-md"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Flip Settings */}
                        <div className="flex items-center justify-between pt-4 border-t">
                            <Label className="text-base">Random Horizontal Flip</Label>
                            <Switch
                                checked={settings.flipRandom}
                                onCheckedChange={(c) => setSettings({ ...settings, flipRandom: c })}
                            />
                        </div>
                    </div>

                    <div className="pt-6 border-t mt-6">
                        <Button
                            className="w-full"
                            size="lg"
                            onClick={runAugmentation}
                            disabled={jobStatus === 'running'}
                        >
                            {jobStatus === 'running' ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Running... ({progress.processed}/{progress.total})
                                </>
                            ) : (
                                <>
                                    <Wand2 className="mr-2 h-4 w-4" />
                                    {jobStatus === 'completed' ? 'Re-Run Augmentation' : 'Confirm & Run'}
                                </>
                            )}
                        </Button>
                    </div>
                </Card>
            </div>

            <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Results Preview</h2>
                    {jobStatus === 'running' && (
                        <span className="text-sm text-muted-foreground animate-pulse">
                            Processing {progress.processed} of {progress.total}...
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
                    {results.length > 0 ? (
                        results.map((res: any, idx: number) => (
                            <Card key={idx} className="overflow-hidden group relative bg-muted/20">
                                <div className="aspect-square relative">
                                    {res.error ? (
                                        <div className="absolute inset-0 flex items-center justify-center text-destructive p-4 text-center text-xs">
                                            {res.error}
                                        </div>
                                    ) : (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={res.url}
                                            alt={res.file}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    )}
                                </div>
                                <div className="p-2 space-y-1 bg-background/90 text-[10px] border-t">
                                    <div className="flex gap-1 flex-wrap">
                                        {res.angle !== 0 && (
                                            <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded-sm">
                                                Rot: {res.angle}°
                                            </span>
                                        )}
                                        {res.flipped && (
                                            <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded-sm">
                                                Flip: Yes
                                            </span>
                                        )}
                                        {res.angle === 0 && !res.flipped && !res.error && (
                                            <span className="px-1.5 py-0.5 bg-muted text-muted-foreground rounded-sm">
                                                No Change
                                            </span>
                                        )}
                                    </div>
                                    <div className="truncate text-muted-foreground max-w-full">
                                        {res.file}
                                    </div>
                                </div>
                            </Card>
                        ))
                    ) : (
                        <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                            {jobStatus === 'idle' ? 'Ready to augment.' : 'Waiting for results...'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
