'use client';

import { useState, use } from 'react';
import { Button, Card, Input } from '@/components/ui/core';
import { Label } from '@/components/ui/label';
import { Loader2, Play, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CaptionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [model, setModel] = useState('wd14');
    const [triggerWord, setTriggerWord] = useState('');
    const [running, setRunning] = useState(false);
    const router = useRouter();

    const runCaptioning = async () => {
        setRunning(true);
        try {
            const res = await fetch(`/api/projects/${id}/caption`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model, triggerWord }),
            });
            if (res.ok) {
                alert('Captioning started. This may take a moment.');
                router.refresh();
            } else {
                const err = await res.json();
                alert(err.error);
            }
        } catch {
            alert('Failed to start captioning');
        } finally {
            setRunning(false);
        }
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold">Captioning</h1>
                <p className="text-muted-foreground">Auto-label images using AI models.</p>
            </div>

            <Card className="p-6">
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
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
                                placeholder="e.g. ohwx woman"
                                value={triggerWord}
                                onChange={(e) => setTriggerWord(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">Prepended to every caption.</p>
                        </div>
                    </div>

                    <div className="flex items-end justify-end">
                        <Button size="lg" className="w-full md:w-auto" onClick={runCaptioning} disabled={running}>
                            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                            Run Captioning
                        </Button>
                    </div>
                </div>
            </Card>

            <div className="mt-8 border-t pt-8 text-center text-muted-foreground">
                <p>After captioning, generated .txt files will appear in your project folder.</p>
                <p className="text-sm">(Editor UI coming in next update)</p>
            </div>
        </div>
    );
}
