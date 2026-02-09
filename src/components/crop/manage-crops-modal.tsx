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
                            {variants.map((v) => (
                                <div key={v.file} className={cn(
                                    "relative group border rounded-lg p-2 transition-all",
                                    activeCrop === v.file ? "ring-2 ring-primary border-primary bg-primary/5" : "hover:border-primary/50"
                                )}>
                                    <div className="aspect-square relative bg-muted rounded overflow-hidden">
                                        {/* We need a way to serve the specific variant. 
                                            The API structure implies we can access them. 
                                            Earlier code showed: /api/images?path=...
                                            We need to construct the path or have an endpoint.
                                            Let's assume a helper or use the same list logic.
                                            Actually, projects.ts implies we might access them via standard image API if we know the path.
                                            The path is projects/<id>/cropped/<imageId>/<variantFile>
                                         */}
                                        <Image
                                            src={`/api/images?path=${encodeURIComponent(`projects/${projectId}/cropped/${imageId}/${v.file}`)}`} // Construct path relative to project root? API needs absolute or relative? 
                                            // The image API usually takes an absolute path. 
                                            // Let's rely on the parent component passing a base URL or construct it if we know the root.
                                            // Wait, the client doesn't know the absolute server path.
                                            // The `api/images` route likely handles security.
                                            // Let's fetch the list with URLs from the server instead of constructing here, OR
                                            // Use a dedicated endpoint for serving variants if `api/images` requires absolute path.
                                            // Checking `CropClient`, it uses `rawUrl` which comes from `page.tsx`.
                                            // `page.tsx` constructed `api/images?path=...absolute...`.
                                            // We need the absolute path here.
                                            // For now, let's try to assume we can get it from the parent or the `list` endpoint returns URLs.
                                            // I will update the `list` endpoint to return URLs or the client to resolve them.
                                            // Update: `page.tsx` calculates absolute path.
                                            // I'll update the component to accept a `basePath` or similar, OR update `list` endpoint to return usable URLs.
                                            // Let's assume the `list` endpoint returns usable URLs.
                                            // For this step I'll put a placeholder and fix it in integration.
                                            alt={v.file}
                                            fill
                                            className="object-contain"
                                        />
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
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
