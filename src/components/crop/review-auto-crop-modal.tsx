'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/core';
import { Badge } from '@/components/ui/badge';
import { Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface Proposal {
    file: string; // imageId
    bbox: { x: number; y: number; w: number; h: number };
    confidence: number;
    label: string;
}

interface ReviewAutoCropModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    proposals: Proposal[];
    imageMap: Record<string, string>; // imageId -> rawUrl
    onApply: () => void;
}

export function ReviewAutoCropModal({ isOpen, onClose, projectId, proposals, imageMap, onApply }: ReviewAutoCropModalProps) {
    const { t } = useTranslation('common');
    const [isApplying, setIsApplying] = useState(false);
    const [selectedProposals, setSelectedProposals] = useState<Set<number>>(new Set(proposals.map((_, i) => i))); // Default select all

    const toggleSelection = (index: number) => {
        const next = new Set(selectedProposals);
        if (next.has(index)) {
            next.delete(index);
        } else {
            next.add(index);
        }
        setSelectedProposals(next);
    };

    const handleApplySelected = async () => {
        setIsApplying(true);
        try {
            const toApply = proposals.filter((_, i) => selectedProposals.has(i)).map(p => ({
                imageId: p.file,
                bbox: p.bbox,
                confidence: p.confidence,
                source: 'auto'
            }));

            // Make batch request
            const res = await fetch(`/api/projects/${projectId}/crop/auto/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ proposals: toApply })
            });

            if (!res.ok) throw new Error('Failed to apply proposals');

            const result = await res.json();
            // result.results is array of { status, ... }
            const successCount = result.results.filter((r: any) => r.status === 'success').length;

            toast.success(`Applied ${successCount} crops`);
            onApply();
            onClose();

        } catch (error) {
            console.error(error);
            toast.error('Failed to apply crops');
        } finally {
            setIsApplying(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{t('crop.review_auto_title', { count: proposals.length })}</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto min-h-[400px] p-2">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {proposals.map((p, i) => {
                            const rawUrl = imageMap[p.file];
                            const isSelected = selectedProposals.has(i);
                            return (
                                <div key={i}
                                    className={`relative border rounded-lg overflow-hidden group cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary border-primary' : 'opacity-70 hover:opacity-100'}`}
                                    onClick={() => toggleSelection(i)}
                                >
                                    <div className="aspect-square relative bg-muted">
                                        {rawUrl ? (
                                            <div className="relative w-full h-full">
                                                <Image src={rawUrl} alt={p.file} fill className="object-contain" />
                                                {/* Overlay BBox */}
                                                <div
                                                    className="absolute border-2 border-green-500 bg-green-500/10 z-10"
                                                    style={{
                                                        left: `${p.bbox.x * 100}%`,
                                                        top: `${p.bbox.y * 100}%`,
                                                        width: `${p.bbox.w * 100}%`,
                                                        height: `${p.bbox.h * 100}%`
                                                    }}
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">{t('crop.no_preview')}</div>
                                        )}

                                        <div className="absolute top-2 right-2 z-20">
                                            {isSelected ? (
                                                <div className="bg-primary text-primary-foreground rounded-full p-1 shadow-sm"><Check className="w-3 h-3" /></div>
                                            ) : (
                                                <div className="bg-muted/80 text-muted-foreground rounded-full p-1 shadow-sm"><X className="w-3 h-3" /></div>
                                            )}
                                        </div>

                                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-1 text-[10px] flex justify-between">
                                            <span className="truncate max-w-[80px]" title={p.file}>{p.file}</span>
                                            <span>{Math.round(p.confidence * 100)}%</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <DialogFooter className="flex justify-between items-center border-t p-2">
                    <div className="text-sm text-muted-foreground">
                        {t('crop.selected_count', { count: selectedProposals.size })}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose}>{t('actions.cancel')}</Button>
                        <Button onClick={handleApplySelected} disabled={isApplying || selectedProposals.size === 0}>
                            {isApplying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            {t('crop.apply_selected')}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
