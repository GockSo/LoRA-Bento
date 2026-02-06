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
    const [processing, setProcessing] = useState(false);
    // const projectId = id; // Already declared above
    const router = useRouter();

    // Load project settings eventually? For now default.

    const runProcessing = async () => {
        setProcessing(true);
        try {
            const res = await fetch(`/api/projects/${projectId}/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings }),
            });

            if (res.ok) {
                const data = await res.json();
                alert(`Processing started for ${data.total} images from ${data.source}. Check sidebar for progress.`);
                router.refresh(); // Update stats
            } else {
                const err = await res.json();
                alert(`Error: ${err.error}`);
            }
        } catch (e) {
            alert('Failed to start processing');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold">Resize & Pad</h1>
                <p className="text-muted-foreground">Prepare images for training by resizing to standard buckets.</p>
            </div>

            <Card className="p-6 max-w-2xl">
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
                                    <div className="font-medium">{mode.label}</div>
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
                        <Button className="w-full" size="lg" onClick={runProcessing} disabled={processing}>
                            {processing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Processing...
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
    );
}
