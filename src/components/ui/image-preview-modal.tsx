'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'; // Ensure correct imports
import { Button } from '@/components/ui/core'; // Assuming core exists or use button from ui/button
import { ChevronLeft, ChevronRight, Check, Trash2, X, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
// import { VisuallyHidden } from '@radix-ui/react-visually-hidden'; // Module not found, using sr-only class

export interface PreviewImage {
    file: string;
    url?: string;
    thumbUrl?: string; // Fallback or use for strip
    source?: string;
    confidence?: number;
    // ... any other metadata
}

interface ImagePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    images: PreviewImage[];
    selectedIndex: number;
    onIndexChange: (index: number) => void;
    onSetActive?: (file: string) => Promise<void>;
    onDelete?: (file: string) => Promise<void>;
    activeCropFile?: string | null;
}

export function ImagePreviewModal({
    isOpen,
    onClose,
    images,
    selectedIndex,
    onIndexChange,
    onSetActive,
    onDelete,
    activeCropFile
}: ImagePreviewModalProps) {
    const { t } = useTranslation('common');
    const [isProcessing, setIsProcessing] = useState(false);

    const currentImage = images[selectedIndex];

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                if (selectedIndex > 0) onIndexChange(selectedIndex - 1);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                if (selectedIndex < images.length - 1) onIndexChange(selectedIndex + 1);
            } else if (e.key === 'Escape') {
                // Dialog handles this typically, but good to ensure
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, selectedIndex, images.length, onIndexChange]);

    if (!currentImage) return null;

    const displayUrl = currentImage.url || currentImage.thumbUrl;

    const handleSetActiveClick = async () => {
        if (!onSetActive) return;
        setIsProcessing(true);
        try {
            await onSetActive(currentImage.file);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteClick = async () => {
        if (!onDelete) return;
        if (!confirm(t('crop.delete_variant_confirm'))) return;
        setIsProcessing(true);
        try {
            await onDelete(currentImage.file);
            // If we delete, the parent might shift index or close.
            // We'll let parent handle the logic of what to show next via props update
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-[90vw] h-[90vh] p-0 gap-0 bg-background/95 backdrop-blur-sm border-none flex flex-col">
                <span className="sr-only">
                    <DialogTitle>{t('crop.preview_title')}</DialogTitle>
                </span>
                <span className="sr-only">
                    <DialogDescription>{t('crop.preview_desc')}</DialogDescription>
                </span>

                {/* Header / Top Bar */}
                <div className="absolute top-0 left-0 right-0 z-50 flex justify-between items-center p-4 bg-gradient-to-b from-black/50 to-transparent pointer-events-none">
                    <div className="pointer-events-auto text-white">
                        <h4 className="font-medium text-lg drop-shadow-md">{currentImage.file}</h4>
                        <div className="text-sm opacity-80 flex gap-2">
                            <span>{currentImage.source}</span>
                            {currentImage.confidence && <span>{Math.round(currentImage.confidence * 100)}%</span>}
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="pointer-events-auto text-white hover:bg-white/20 rounded-full"
                        onClick={onClose}
                    >
                        <X className="w-6 h-6" />
                    </Button>
                </div>

                {/* Main Content: Image + Nav */}
                <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black/80">

                    {/* Previous Button */}
                    {selectedIndex > 0 && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute left-4 z-40 text-white hover:bg-white/20 rounded-full h-12 w-12"
                            onClick={() => onIndexChange(selectedIndex - 1)}
                        >
                            <ChevronLeft className="w-8 h-8" />
                        </Button>
                    )}

                    {/* Image */}
                    {displayUrl && (
                        <div className="relative w-full h-full p-4">
                            <Image
                                src={displayUrl}
                                alt={currentImage.file}
                                fill
                                className="object-contain"
                                unoptimized={!!displayUrl.includes('?v=')} // Respect our cache busting
                            />
                        </div>
                    )}

                    {/* Next Button */}
                    {selectedIndex < images.length - 1 && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-4 z-40 text-white hover:bg-white/20 rounded-full h-12 w-12"
                            onClick={() => onIndexChange(selectedIndex + 1)}
                        >
                            <ChevronRight className="w-8 h-8" />
                        </Button>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-4 bg-background border-t flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">
                        {selectedIndex + 1} / {images.length}
                    </div>

                    <div className="flex gap-2">
                        {onSetActive && activeCropFile !== currentImage.file && (
                            <Button
                                variant="secondary"
                                onClick={handleSetActiveClick}
                                disabled={isProcessing}
                            >
                                <Star className="w-4 h-4 mr-2" />
                                {t('actions.set_active')}
                            </Button>
                        )}
                        {activeCropFile === currentImage.file && (
                            <Button variant="outline" disabled className="bg-primary/10 text-primary border-primary/20">
                                <Check className="w-4 h-4 mr-2" />
                                {t('actions.active')}
                            </Button>
                        )}

                        {onDelete && (
                            <Button
                                variant="destructive"
                                size="icon"
                                onClick={handleDeleteClick}
                                disabled={isProcessing}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
