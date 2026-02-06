'use client';

import { useState } from 'react';
import { Button, Card } from '@/components/ui/core';
import { AlertTriangle, Trash2, Maximize2, X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface BlurryReviewerProps {
    projectId: string;
    items: any[]; // Blurry items
    onUpdate: () => void;
}

export function BlurryReviewer({ projectId, items, onUpdate }: BlurryReviewerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewingIndex, setViewingIndex] = useState<number | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const router = useRouter();

    const handleClose = () => {
        setIsOpen(false);
        setViewingIndex(null);
    };

    const handleDelete = async (file: string) => {
        setDeletingId(file);
        try {
            const res = await fetch(`/api/projects/${projectId}/images/delete`, {
                method: 'POST',
                body: JSON.stringify({ files: [file] })
            });

            if (res.ok) {
                onUpdate();
                // If viewing, close viewer or move to next
                if (viewingIndex !== null) {
                    if (items.length <= 1) {
                        setViewingIndex(null); // Last one gone
                    } else if (viewingIndex >= items.length - 1) {
                        setViewingIndex(items.length - 2); // Move back if was last
                    }
                    // Else stays same index which is now next item
                }
                router.refresh();
            }
        } catch (e) {
            console.error('Failed to delete', e);
        } finally {
            setDeletingId(null);
        }
    };

    const count = items.length;
    if (count === 0) return null;

    const viewingItem = viewingIndex !== null ? items[viewingIndex] : null;

    return (
        <>
            <Button
                variant="outline"
                className="text-orange-600 border-orange-200 hover:bg-orange-50"
                onClick={() => setIsOpen(true)}
            >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Review Blurry Images ({count})
            </Button>

            {/* Generic Fullscreen Modal/Dialog for Grid */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-10">
                    <div className="bg-background border rounded-xl shadow-2xl w-full h-full max-w-6xl flex flex-col overflow-hidden relative">
                        {/* Header */}
                        <div className="p-4 border-b flex items-center justify-between bg-muted/20">
                            <div className="flex items-center gap-2 font-semibold">
                                <AlertTriangle className="w-5 h-5 text-orange-500" />
                                Review Blurry Images
                                <span className="bg-muted px-2 py-0.5 rounded text-xs text-muted-foreground">{count} remaining</span>
                            </div>
                            <Button variant="ghost" size="icon" onClick={handleClose}>
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        {/* Grid Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {items.map((img, idx) => (
                                    <Card key={img.id} className="group relative overflow-hidden aspect-square border-orange-200/50 bg-muted/10">
                                        <img
                                            src={img.src}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />

                                        {/* Overlay */}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                            <Button size="sm" variant="secondary" onClick={() => setViewingIndex(idx)}>
                                                <Maximize2 className="w-4 h-4 mr-2" /> View
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => handleDelete(img.displayName)}
                                                disabled={deletingId === img.displayName}
                                            >
                                                {deletingId === img.displayName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                                                Delete
                                            </Button>
                                        </div>

                                        {/* Score Badge */}
                                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 px-2 font-mono flex justify-between">
                                            <span className="truncate">{img.displayName}</span>
                                            {img.blurScore !== undefined && (
                                                <span className="text-orange-300">Score: {img.blurScore}</span>
                                            )}
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Lightbox Viewer */}
            {viewingItem && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95">
                    {/* Navigation */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute left-4 text-white hover:bg-white/10"
                        disabled={viewingIndex! <= 0}
                        onClick={() => setViewingIndex(viewingIndex! - 1)}
                    >
                        <ChevronLeft className="w-8 h-8" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-4 text-white hover:bg-white/10"
                        disabled={viewingIndex! >= items.length - 1}
                        onClick={() => setViewingIndex(viewingIndex! + 1)}
                    >
                        <ChevronRight className="w-8 h-8" />
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-4 right-4 text-white hover:bg-white/10"
                        onClick={() => setViewingIndex(null)}
                    >
                        <X className="w-6 h-6" />
                    </Button>

                    {/* Main Image */}
                    <div className="flex flex-col items-center gap-4 max-h-screen p-8">
                        <img
                            src={viewingItem.src}
                            className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl border border-white/10"
                        />
                        <div className="flex items-center gap-4">
                            <div className="text-white text-sm font-mono opacity-80">
                                {viewingItem.displayName} • Blur Score: {viewingItem.blurScore}
                            </div>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDelete(viewingItem.displayName)}
                                disabled={deletingId === viewingItem.displayName}
                            >
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
