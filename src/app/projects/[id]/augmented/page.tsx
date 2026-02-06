'use client';

import { useState, useEffect, use } from 'react';
import { Button, Card, Input } from '@/components/ui/core';
import { Label } from '@/components/ui/label';
import { Loader2, Wand2, RefreshCcw, Image as ImageIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
// Assuming getProject is a utility function that needs to be imported
// import { getProject } from '@/lib/data'; // Placeholder for actual import path

export default function AugmentationPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    // const project = await getProject(id); // Uncomment and import getProject if needed

    // if (!project) return <div>Project not found</div>; // Uncomment if project check is needed

    const [settings, setSettings] = useState({
        rotate: 0,
        flipH: false,
        zoom: 1,
    });
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const projectId = id; // Changed from params.id to id
    const router = useRouter();

    // Load initial preview
    useEffect(() => {
        updatePreview();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settings]); // Debounce?

    const updatePreview = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/projects/${projectId}/preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings }),
            });
            if (res.ok) {
                const blob = await res.blob();
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                setPreviewUrl(URL.createObjectURL(blob));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const runAugmentation = async () => {
        setProcessing(true);
        try {
            const res = await fetch(`/api/projects/${projectId}/augment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings }),
            });

            if (res.ok) {
                // Poll or just show message
                alert('Augmentation started! Check the sidebar for progress.');
                router.refresh();
            }
        } catch (e) {
            alert('Failed to start augmentation');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Augmentation</h1>
                    <p className="text-muted-foreground">Adjust settings to generate variations.</p>
                </div>

                <Card className="p-6 space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Rotation ({settings.rotate}°)</label>
                            <input
                                type="range" min="-15" max="15" step="1"
                                value={settings.rotate}
                                onChange={(e) => setSettings({ ...settings, rotate: parseInt(e.target.value) })}
                                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>-15°</span>
                                <span>0°</span>
                                <span>+15°</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Zoom ({settings.zoom}x)</label>
                            <input
                                type="range" min="1" max="1.5" step="0.05"
                                value={settings.zoom}
                                onChange={(e) => setSettings({ ...settings, zoom: parseFloat(e.target.value) })}
                                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>1x</span>
                                <span>1.5x</span>
                            </div>
                        </div>

                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="flipH"
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                checked={settings.flipH}
                                onChange={(e) => setSettings({ ...settings, flipH: e.target.checked })}
                            />
                            <label htmlFor="flipH" className="text-sm font-medium">Horizontal Flip</label>
                        </div>
                    </div>

                    <div className="pt-4 border-t">
                        <Button className="w-full" onClick={runAugmentation} disabled={processing}>
                            {processing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Wand2 className="mr-2 h-4 w-4" />
                                    Run Augmentation
                                </>
                            )}
                        </Button>
                    </div>
                </Card>
            </div>

            <div className="lg:col-span-2">
                <Card className="h-full min-h-[400px] flex items-center justify-center bg-muted/20 relative overflow-hidden">
                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10 transition-opacity">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    )}
                    {previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={previewUrl}
                            alt="Preview"
                            className="max-h-[500px] max-w-full object-contain shadow-lg rounded-md"
                        />
                    ) : (
                        <div className="flex flex-col items-center text-muted-foreground">
                            <ImageIcon className="h-10 w-10 mb-2" />
                            <p>No preview available</p>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
