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

    const [manifestItems, setManifestItems] = useState<any[]>([]);

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

    const [jobId, setJobId] = useState<string | null>(null);
    const [jobStatus, setJobStatus] = useState<'idle' | 'running' | 'completed'>('idle');
    const [progress, setProgress] = useState({ processed: 0, total: 0 });
    const [results, setResults] = useState<any[]>([]);

    const runAugmentation = async () => {
        setJobStatus('running');
        // keep old results? or clear?
        // Actually, for combined view, we might want to just show the manifest as is + placeholders?
        // But user wants "populates as job runs".
        // Strategy: We have manifestItems (persistent).
        // Job returns `results` (ephemeral).
        // We can just concatenate them for display? 
        // Or efficient way: 
        // 1. Initial State: Manifest Items.
        // 2. Job Running: Manifest Items + Job Results (filtered to avoid dupes if any).
        // 3. Job Done: Fetch Manifest (which now contains everything).
        setResults([]); // Clear ephemeral results

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
                        await fetchManifest(); // Reload full manifest
                        setResults([]); // Clear ephemeral
                        router.refresh(); // Update sidebar counts
                    }
                }
            } catch (e) {
                console.error('Poll error', e);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [jobId, jobStatus, projectId, router]);

    // Combine Manifest + Ephemeral Results for View
    // BUT we want to enforce adjacency.
    // If job is running, we have Raw items (in manifest) and Aug items (in results).
    // We should try to interleave them if possible for the preview.
    // Simplifying for now: Just show Manifest, then append Results?
    // User requested "Combined gallery (Raw + Augmented) ... Raw 1.png instantly followed by 2.png".
    // This requires sorting logic on the client side if we strictly want live interleaving.

    // Let's build a unified list for rendering.
    const displayItems = [...manifestItems];

    // If running, merge results into displayItems
    if (jobStatus === 'running' && results.length > 0) {
        // Transform result to match manifest shape roughly for sorting
        const ephemeralItems = results.map(r => ({
            id: r.file, // temp id
            stage: 'augmented',
            src: r.url,
            displayName: r.file,
            groupKey: r.file.replace('aug_', ''), // Extract raw name from aug_filename?
            aug: { rotate: r.angle, flip: r.flipped },
            isEphemeral: true
        }));

        displayItems.push(...ephemeralItems);
    }

    // Sort displayItems by groupKey then stage
    const sortedDisplayItems = displayItems.sort((a, b) => {
        // Hacky groupKey extraction if missing (results might not have it perfectly set)
        const keyA = a.groupKey || a.displayName.replace('aug_', '');
        const keyB = b.groupKey || b.displayName.replace('aug_', '');

        if (keyA < keyB) return -1;
        if (keyA > keyB) return 1;

        // Stage: Raw < Augmented
        // Ephemeral items are 'augmented'.
        if (a.stage === 'raw' && b.stage !== 'raw') return -1;
        if (a.stage !== 'raw' && b.stage === 'raw') return 1;

        return 0;
    });

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-120px)]">
            <div className="lg:col-span-1 space-y-6 overflow-y-auto pr-2">
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

            <div className="lg:col-span-2 space-y-4 flex flex-col h-full overflow-hidden">
                <div className="flex items-center justify-between shrink-0">
                    <h2 className="text-lg font-semibold">
                        Preview Gallery ({sortedDisplayItems.length})
                    </h2>
                    {jobStatus === 'running' && (
                        <span className="text-sm text-muted-foreground animate-pulse">
                            Processing...
                        </span>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 pr-2">
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 pb-10">
                        {sortedDisplayItems.length > 0 ? (
                            sortedDisplayItems.map((item: any, idx: number) => (
                                <Card key={item.id + idx} className={`overflow-hidden group relative ${item.stage === 'raw' ? 'bg-background border-dashed' : 'bg-muted/20'} ${item.isEphemeral ? 'animate-in fade-in zoom-in-95 duration-300' : ''}`}>
                                    <div className="aspect-square relative">
                                        {item.error ? (
                                            <div className="absolute inset-0 flex items-center justify-center text-destructive p-4 text-center text-xs">
                                                {item.error}
                                            </div>
                                        ) : (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={item.src}
                                                alt={item.displayName}
                                                className={`w-full h-full object-contain p-2 ${item.stage === 'raw' ? 'opacity-80' : ''}`}
                                                loading="lazy"
                                            />
                                        )}
                                        {item.stage === 'raw' && (
                                            <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-background/80 text-[10px] font-mono border rounded-sm shadow-sm">
                                                RAW
                                            </div>
                                        )}
                                        {item.stage === 'augmented' && (
                                            <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-sm shadow-sm">
                                                AUG
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-2 space-y-1 bg-background/90 text-[10px] border-t">
                                        {item.stage === 'augmented' ? (
                                            <div className="flex gap-1 flex-wrap">
                                                {item.aug?.rotate !== 0 && (
                                                    <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded-sm">
                                                        Rot: {item.aug?.rotate}°
                                                    </span>
                                                )}
                                                {item.aug?.flip && (
                                                    <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded-sm">
                                                        Flip: Yes
                                                    </span>
                                                )}
                                                {item.aug?.rotate === 0 && !item.aug?.flip && !item.error && (
                                                    <span className="px-1.5 py-0.5 bg-muted text-muted-foreground rounded-sm">
                                                        No Change
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="h-[21px] flex items-center">
                                                <span className="text-muted-foreground">Original Source</span>
                                            </div>
                                        )}
                                        <div className="truncate text-muted-foreground max-w-full" title={item.displayName}>
                                            {item.displayName}
                                        </div>
                                    </div>
                                </Card>
                            ))
                        ) : (
                            <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                                {jobStatus === 'idle' ? 'No images found. Import some raw images first.' : 'Waiting for results...'}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
