'use client';

import { useState, useEffect } from 'react';
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
    const [selectedIndex, setSelectedIndex] = useState(0);

    const blurryItems = items.filter(i => i.flags?.isBlurry);

    // Sync selection when opening viewer manually (clicking a specific card)
    const handleOpenViewer = (item: ManifestItem, index: number) => {
        setSelectedIndex(index);
        setViewingItem(item);
    };

    // Keyboard Navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input
            if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

            if (e.key === 'ArrowRight') {
                e.preventDefault();
                const newIndex = (selectedIndex + 1) % blurryItems.length;
                setSelectedIndex(newIndex);
                if (viewingItem) setViewingItem(blurryItems[newIndex]);
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                const newIndex = (selectedIndex - 1 + blurryItems.length) % blurryItems.length;
                setSelectedIndex(newIndex);
                if (viewingItem) setViewingItem(blurryItems[newIndex]);
            } else if (e.key === 'Delete') {
                e.preventDefault();
                if (blurryItems[selectedIndex]) {
                    handleDelete(blurryItems[selectedIndex].path);
                }
            } else if (e.key === 'Escape') {
                // If viewer is open, it handles its own escape usually, but we want to ensure consistent behavior
                // Let Dialog handle Escape for closing itself if viewer is not open
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, blurryItems, selectedIndex, viewingItem]);

    if (blurryItems.length === 0) return null;

    const handleDelete = async (path: string) => {
        try {
            await fetch(`/api/projects/${projectId}/files`, {
                method: 'DELETE',
                body: JSON.stringify({ path }),
            });

            // Calculate new index before update happens (optimistic-ish logical update)
            // But we rely on onUpdate to refresh 'items' prop

            // Adjust selection logic:
            // If deleting last item, move back one.
            // If list becomes empty, close (handled by parent re-render return null)
            if (blurryItems.length <= 1) {
                setIsOpen(false);
                setViewingItem(null);
            } else if (selectedIndex >= blurryItems.length - 1) {
                setSelectedIndex(Math.max(0, blurryItems.length - 2)); // Move to previous (now last)
            }
            // else: keep same index, which will point to next item effectively

            onUpdate();

            if (viewingItem?.path === path) {
                // If there are items left, update viewer to new item at index
                if (blurryItems.length > 1) {
                    // We need to wait for state update or predict it. 
                    // Since 'items' comes from parent, we can't instantly set viewingItem to the 'next' object reference 
                    // because it might change. Ideally we wait for effect.
                    // For UI responsiveness, we can close viewer or try to find neighbor.
                    // Simple approach: Close viewer for now to avoid stale state, or let effect sync it.
                    setViewingItem(null);
                } else {
                    setViewingItem(null);
                }
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
                <DialogHeader className="flex flex-row items-center justify-between border-b pb-4">
                    <DialogTitle>Review Blurry Images</DialogTitle>
                    <div className="text-sm font-mono text-muted-foreground mr-8">
                        {selectedIndex + 1} / {blurryItems.length}
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-auto p-1">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {blurryItems.map((item, idx) => (
                            <Card
                                key={item.id}
                                className={cn(
                                    "group relative overflow-hidden aspect-square border-orange-200 transition-all",
                                    selectedIndex === idx ? "ring-4 ring-orange-500 ring-offset-2 scale-[1.02] z-10" : ""
                                )}
                                onClick={() => setSelectedIndex(idx)} // Allow clicking to select without opening
                            >
                                <img src={item.src} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                <div className={cn(
                                    "absolute inset-0 bg-black/40 transition-opacity flex items-center justify-center gap-2",
                                    selectedIndex === idx ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                )}>
                                    <Button size="icon" variant="secondary" className="h-8 w-8 text-xs" onClick={(e) => { e.stopPropagation(); handleOpenViewer(item, idx); }}>
                                        <Maximize2 className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant="destructive" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleDelete(item.path); }}>
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

                <div className="p-2 border-t text-xs text-muted-foreground text-center">
                    Use <span className="font-mono bg-muted px-1 rounded">←</span> <span className="font-mono bg-muted px-1 rounded">→</span> to navigate, <span className="font-mono bg-muted px-1 rounded">Delete</span> to remove.
                </div>
            </DialogContent>

            {/* Full Screen Viewer */}
            {viewingItem && (
                <Dialog open={!!viewingItem} onOpenChange={(o: boolean) => {
                    if (!o) setViewingItem(null);
                }}>
                    <DialogContent className="max-w-screen-xl w-full h-[90vh] bg-black/95 border-none p-0 flex flex-col focus:outline-none" onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()}>
                        <DialogTitle className="sr-only">Full Screen Image Viewer</DialogTitle>
                        {/* We prevent propagation so parent dialog doesn't double-handle, but actually our window listener handles it. */}
                        <div className="absolute top-2 right-2 z-50 flex gap-2">
                            <div className="text-white/50 font-mono text-sm self-center mr-4">
                                {selectedIndex + 1} / {blurryItems.length}
                            </div>
                            <Button variant="destructive" onClick={() => handleDelete(viewingItem.path)}>
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </Button>
                            <Button variant="secondary" onClick={() => setViewingItem(null)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="flex-1 flex items-center justify-center overflow-hidden relative">
                            {/* Navigation Arrows for Mouse Users */}
                            <Button
                                variant="ghost"
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white hover:bg-white/10 h-12 w-12 rounded-full"
                                onClick={() => {
                                    const newIndex = (selectedIndex - 1 + blurryItems.length) % blurryItems.length;
                                    setSelectedIndex(newIndex);
                                    setViewingItem(blurryItems[newIndex]);
                                }}
                            >
                                <ArrowLeft className="h-8 w-8" />
                            </Button>

                            <img src={viewingItem.src} className="max-w-full max-h-full object-contain" />

                            <Button
                                variant="ghost"
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white hover:bg-white/10 h-12 w-12 rounded-full"
                                onClick={() => {
                                    const newIndex = (selectedIndex + 1) % blurryItems.length;
                                    setSelectedIndex(newIndex);
                                    setViewingItem(blurryItems[newIndex]);
                                }}
                            >
                                <ArrowRight className="h-8 w-8" />
                            </Button>
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
