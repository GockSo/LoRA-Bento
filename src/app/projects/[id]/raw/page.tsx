'use client';

import { UploadZone } from '@/components/upload-zone';
import { Card, Button } from '@/components/ui/core';
import { useState, useEffect, use, useRef } from 'react';
import { AlertTriangle, Eye, EyeOff, Layers, Zap, Play, RotateCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DuplicateManager } from '@/components/qa/duplicate-manager';
import { BlurryManager } from '@/components/qa/blurry-manager';
import { useTranslation } from 'react-i18next';

export default function ImportPage({ params }: { params: Promise<{ id: string }> }) {
    const { t } = useTranslation('common');
    const { id } = use(params);
    const projectId = id;
    const router = useRouter();

    const [items, setItems] = useState<any[]>([]);
    const [stats, setStats] = useState({ duplicates: 0, blurry: 0, total: 0 });
    const [isQAJobRunning, setIsQAJobRunning] = useState(false);
    const [qaProgress, setQaProgress] = useState<string>('');
    const [qaJobId, setQaJobId] = useState<string | null>(null);

    const pollInterval = useRef<NodeJS.Timeout>(null);

    useEffect(() => {
        fetchManifest();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]);

    // Poll for QA job status if we have an ID
    useEffect(() => {
        if (qaJobId) {
            const check = async () => {
                try {
                    const res = await fetch(`/api/projects/${projectId}/jobs/${qaJobId}`);
                    if (res.ok) {
                        const job = await res.json();
                        if (job.status === 'running') {
                            setIsQAJobRunning(true);
                            setQaProgress(`${job.progress.current} (${job.progress.processed}/${job.progress.total})`);
                        } else {
                            // Done or Error
                            setIsQAJobRunning(false);
                            setQaProgress('');
                            setQaJobId(null);
                            fetchManifest(); // Refresh results
                        }
                    }
                } catch {
                    // ignore
                }
            };
            pollInterval.current = setInterval(check, 1000);
        }

        return () => {
            if (pollInterval.current) clearInterval(pollInterval.current as any);
        }
    }, [qaJobId]);


    const fetchManifest = async () => {
        try {
            const res = await fetch(`/api/projects/${projectId}/manifest`);
            if (res.ok) {
                const data = await res.json();
                const rawItems = (data.items || []).filter((i: any) => i.stage === 'raw');
                setItems(rawItems);

                // Calculate stats
                let dups = 0;
                let blurry = 0;
                rawItems.forEach((i: any) => {
                    if (i.flags?.isDuplicate) dups++;
                    if (i.flags?.isBlurry) blurry++;
                });
                setStats({ duplicates: dups, blurry, total: rawItems.length });
            }
        } catch (e) {
            console.error(e);
        }
    };

    const runQA = async () => {
        try {
            setIsQAJobRunning(true);
            const res = await fetch(`/api/projects/${projectId}/qa/run`, { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                setQaJobId(data.jobId);
            } else {
                setIsQAJobRunning(false);
            }
        } catch (e) {
            setIsQAJobRunning(false);
            console.error(e);
        }
    };

    const toggleExclude = async (file: string, currentlyExcluded: boolean) => {
        // Optimistic
        setItems(prev => prev.map(i => i.displayName === file ? { ...i, excluded: !currentlyExcluded } : i));

        try {
            await fetch(`/api/projects/${projectId}/images/exclude`, {
                method: 'POST',
                body: JSON.stringify({ file, excluded: !currentlyExcluded })
            });
            await fetchManifest(); // Refresh
            router.refresh();
        } catch (e) {
            console.error('Failed to toggle exclude', e);
            fetchManifest(); // Revert
        }
    };

    // Determine if we should show "Run QA" button
    // Show if items exist AND (no QA flags populated OR user explicitly wants to re-run)
    // Actually, simple heuristic: If items > 0 and not running, show button.
    // Ideally auto-run on upload.
    const handleUploadComplete = () => {
        fetchManifest();
        runQA(); // Auto-start QA on new upload
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">{t('raw.title')}</h1>
                    <p className="text-muted-foreground">{t('raw.desc')}</p>
                </div>
                <div className="flex gap-4 items-center">
                    {/* Progress Indicator */}
                    {isQAJobRunning && (
                        <div className="flex items-center text-primary text-sm bg-primary/10 px-3 py-1.5 rounded-full animate-pulse">
                            <RotateCw className="w-4 h-4 mr-2 animate-spin" />
                            {t('raw.analyzing')} {qaProgress}
                        </div>
                    )}

                    {!isQAJobRunning && items.length > 0 && (
                        <Button size="sm" variant="outline" onClick={runQA}>
                            <Play className="w-4 h-4 mr-2" /> {t('raw.rescan')}
                        </Button>
                    )}

                    <div className="text-sm text-muted-foreground border-l pl-4 ml-2">
                        {t('raw.total')} {stats.total}
                    </div>
                </div>
            </div>

            <UploadZone projectId={projectId} onUploadComplete={handleUploadComplete} />

            {/* QA Dashboard */}
            {(stats.duplicates > 0 || stats.blurry > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DuplicateManager projectId={projectId} items={items} onUpdate={fetchManifest} />
                    <BlurryManager projectId={projectId} items={items} onUpdate={fetchManifest} />
                </div>
            )}

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">{t('raw.library')}</h2>
                </div>

                {items.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 pb-20">
                        {items.sort((a, b) => (a.groupId || 0) - (b.groupId || 0)).map((img) => (
                            <Card key={img.id} className={`overflow-hidden group relative aspect-[1/1] border-2 transition-all ${img.excluded ? 'opacity-50 border-destructive/20' : 'border-transparent hover:border-primary/50'}`}>
                                {/* Image */}
                                <img
                                    src={img.src}
                                    alt={img.displayName}
                                    className={`w-full h-full object-cover transition-transform group-hover:scale-105 ${img.excluded ? 'grayscale' : ''}`}
                                    loading="lazy"
                                />

                                {/* Flags */}
                                <div className="absolute top-2 left-2 flex flex-col gap-1">
                                    {img.flags?.isDuplicate && (
                                        <span className="bg-yellow-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm flex items-center">
                                            <Layers className="w-3 h-3 mr-1" /> {t('raw.duplicate_short')}
                                        </span>
                                    )}
                                    {img.flags?.isBlurry && (
                                        <span className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm flex items-center">
                                            <Zap className="w-3 h-3 mr-1" /> {t('raw.blur_short')}
                                        </span>
                                    )}
                                </div>

                                {/* Filename & ID Overlay */}
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 flex justify-between items-center px-2 backdrop-blur-sm">
                                    <span className="truncate flex-1 font-mono">{img.displayName}</span>
                                    {img.originalName && (
                                        <span className="text-[9px] text-white/50 truncate max-w-[60px] text-right ml-2" title={img.originalName}>
                                            {img.originalName}
                                        </span>
                                    )}
                                </div>

                                {/* Hover Overlay Actions */}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Button
                                        size="sm"
                                        variant={img.excluded ? "secondary" : "destructive"}
                                        className="h-8 text-xs"
                                        onClick={() => toggleExclude(img.displayName, !!img.excluded)}
                                    >
                                        {img.excluded ? (
                                            <> <Eye className="w-3 h-3 mr-1" /> {t('raw.restore')} </>
                                        ) : (
                                            <> <EyeOff className="w-3 h-3 mr-1" /> {t('raw.exclude')} </>
                                        )}
                                    </Button>
                                    {/* Quick Delete */}
                                </div>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/5">
                        {t('raw.no_images')}
                    </div>
                )}
            </div>
        </div>
    );
}
