'use client';

import { useState } from 'react';
import { Button, Card } from '@/components/ui/core';
import { Zap, Trash2, X, Maximize2, ArrowLeft, ArrowRight } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { ManifestItem } from '@/types';
import { cn } from '@/lib/utils';

interface BlurryManagerProps {
    projectId: string;
    items: ManifestItem[];
    onUpdate: () => void;
}

export function BlurryManager({ projectId, items, onUpdate }: BlurryManagerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewingItem, setViewingItem] = useState<ManifestItem | null>(null);

    const blurryItems = items.filter(i => i.flags?.isBlurry);

    if (blurryItems.length === 0) return null;

    const handleDelete = async (path: string) => {
        try {
            await fetch(`/api/projects/${projectId}/files`, {
                method: 'DELETE',
                body: JSON.stringify({ path }),
            });
            onUpdate();
            // If viewing this item, close viewer or move next
            if (viewingItem?.path === path) {
                setViewingItem(null);
            }
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-orange-500/15 transition-colors">
                    <div className="flex items-center gap-2 text-orange-600">
                        <Zap className="h-5 w-5" />
                        <div>
                            <div className="font-semibold text-sm">Blurry Images Detected</div>
                            <div className="text-xs opacity-80">{blurryItems.length} images might be blurry.</div>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" className="bg-background text-orange-600 hover:text-orange-700 border-orange-200">
                        Review
                    </Button>
                </div>
            </DialogTrigger>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Review Blurry Images ({blurryItems.length})</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-auto p-1">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {blurryItems.map(item => (
                            <Card key={item.id} className="group relative overflow-hidden aspect-square border-orange-200">
                                <img src={item.src} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <Button size="icon" variant="secondary" className="h-8 w-8 text-xs" onClick={() => setViewingItem(item)}>
                                        <Maximize2 className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => handleDelete(item.path)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 text-center font-mono">
                                    Score: {Math.round(item.blurScore || 0)}
                                </div>
                            </Card>
                        ))}
                    </div>
                    {blurryItems.length === 0 && (
                        <div className="h-full flex items-center justify-center text-muted-foreground">
                            No blurry images left!
                        </div>
                    )}
                </div>
            </DialogContent>

            {/* Full Screen Viewer */}
            {viewingItem && (
                <Dialog open={!!viewingItem} onOpenChange={(o) => !o && setViewingItem(null)}>
                    <DialogContent className="max-w-screen-xl w-full h-[90vh] bg-black/95 border-none p-0 flex flex-col">
                        <div className="absolute top-2 right-2 z-50 flex gap-2">
                            <Button variant="destructive" onClick={() => handleDelete(viewingItem.path)}>
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </Button>
                            <Button variant="secondary" onClick={() => setViewingItem(null)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="flex-1 flex items-center justify-center overflow-hidden">
                            <img src={viewingItem.src} className="max-w-full max-h-full object-contain" />
                        </div>
                        <div className="p-4 text-center text-white/50 font-mono text-sm">
                            {viewingItem.displayName} — Blur Score: {Math.round(viewingItem.blurScore || 0)}
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </Dialog>
    );
}
