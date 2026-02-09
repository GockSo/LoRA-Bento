'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/core';
import { Trash2, Check, Star } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils'; // Assuming utils exists

interface CropVariant {
    file: string;
    bbox: { x: number; y: number; w: number; h: number };
    source: string;
    confidence?: number;
    createdAt: string;
    url?: string;
    thumbUrl?: string;
}

interface ManageCropsModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    imageId: string;
    variants: CropVariant[];
    activeCrop: string | null;
    onUpdate: () => void; // Refresh parent
}

export function ManageCropsModal({ isOpen, onClose, projectId, imageId, variants, activeCrop, onUpdate }: ManageCropsModalProps) {
    const [isProcessing, setIsProcessing] = useState(false);

    const handleDelete = async (variantFile: string) => {
        if (!confirm('Are you sure you want to delete this crop variant?')) return;

        setIsProcessing(true);
        try {
            const res = await fetch(`/api/projects/${projectId}/crop/variant/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageId, variantFile })
            });
            if (!res.ok) throw new Error('Failed to delete');
            toast.success('Variant deleted');
            onUpdate();
        } catch (e) {
            console.error(e);
            toast.error('Failed to delete variant');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSetActive = async (variantFile: string) => {
        setIsProcessing(true);
        try {
            const res = await fetch(`/api/projects/${projectId}/crop/variant/set-active`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageId, variantFile })
            });
            if (!res.ok) throw new Error('Failed to set active');
            toast.success('Active crop updated');
            onUpdate();
        } catch (e) {
            console.error(e);
            toast.error('Failed to update active crop');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Manage Crops: {imageId}</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto min-h-[300px] p-2">
                    {variants.length === 0 ? (
                        <div className="text-center text-muted-foreground py-10">
                            No crop variants found.
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {variants.map((v) => {
                                // Use thumbUrl if available, else fallback
                                const displayUrl = v.thumbUrl || v.url;
                                // Unique key using file + url (which includes version) to force re-render if version changes
                                const uniqueKey = `${v.file}-${displayUrl}`;

                                return (
                                    <div key={uniqueKey} className={cn(
                                        "relative group border rounded-lg p-2 transition-all",
                                        activeCrop === v.file ? "ring-2 ring-primary border-primary bg-primary/5" : "hover:border-primary/50"
                                    )}>
                                        <div className="aspect-square relative bg-muted rounded overflow-hidden">
                                            {displayUrl ? (
                                                <Image
                                                    src={displayUrl}
                                                    alt={v.file}
                                                    fill
                                                    className="object-contain"
                                                    unoptimized // Important for local blob/api serving sometimes, but here we want next image optim? Actually API serves headers.
                                                // Actually, "unoptimized" might be safer for API routes if Next tries to optimize them again.
                                                // But let's try without first or with unoptimized=true to be safe given the dynamic nature.
                                                // Given we put cache control headers, let's let browser handle it.
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                                                    No Preview
                                                </div>
                                            )}

                                            {activeCrop === v.file && (
                                                <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1 shadow-sm">
                                                    <Check className="w-3 h-3" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-2 text-xs flex justify-between items-center">
                                            <div className="truncate font-medium">{v.file}</div>
                                            <div className="text-muted-foreground">{v.source}</div>
                                        </div>

                                        <div className="mt-2 flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                            {activeCrop !== v.file && (
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-6 w-6"
                                                    onClick={() => handleSetActive(v.file)}
                                                    title="Set Active"
                                                    disabled={isProcessing}
                                                >
                                                    <Star className="w-3 h-3" />
                                                </Button>
                                            )}
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-6 w-6 text-destructive hover:text-destructive"
                                                onClick={() => handleDelete(v.file)}
                                                title="Delete"
                                                disabled={isProcessing}
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
