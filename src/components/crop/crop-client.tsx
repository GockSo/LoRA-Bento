'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Button } from '@/components/ui/core';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CheckCircle, RotateCcw, Scissors, ArrowRight } from 'lucide-react';

interface CropImage {
    id: string; // filename
    rawUrl: string;
    croppedUrl: string | null;
    isCropped: boolean;
    width: number;
    height: number;
}

interface CropClientProps {
    projectId: string;
    images: CropImage[];
}

function centerAspectCrop(
    mediaWidth: number,
    mediaHeight: number,
    aspect: number,
) {
    return centerCrop(
        makeAspectCrop(
            {
                unit: '%',
                width: 90,
            },
            aspect,
            mediaWidth,
            mediaHeight,
        ),
        mediaWidth,
        mediaHeight,
    )
}

export function CropClient({ projectId, images }: CropClientProps) {
    const router = useRouter();
    const [selectedImage, setSelectedImage] = useState<CropImage | null>(images.length > 0 ? images[0] : null);
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const imgRef = useRef<HTMLImageElement>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Sort images: uncropped first? or just by name. Let's keep original order but maybe show uncropped clearer.
    // For now simple list.

    function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
        if (aspect) {
            const { width, height } = e.currentTarget;
            setCrop(centerAspectCrop(width, height, aspect));
        }
    }

    // We don't enforce aspect ratio for general cropping unless user wants square
    const [aspect, setAspect] = useState<number | undefined>(undefined);

    const handleApplyCrop = async () => {
        if (!selectedImage || !completedCrop || !imgRef.current) return;

        setIsSaving(true);
        try {
            // Convert pixels to relative for backend safety (though backend handles relative better if we send relative)
            // But checking my API implementation:
            // const left = Math.round(bbox.x * metadata.width);
            // So API expects x, y, w, h as 0-1 or pixels?
            // "bbox": { "x": 0.1, "y": 0.2, "w": 0.6, "h": 0.7 } -> API implementation used relative:
            // const left = Math.round(bbox.x * metadata.width);

            // So I need to send relative coordinates.
            const image = imgRef.current;
            const bbox = {
                x: completedCrop.x / image.width,
                y: completedCrop.y / image.height,
                w: completedCrop.width / image.width,
                h: completedCrop.height / image.height
            };

            const res = await fetch(`/api/projects/${projectId}/crop/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageId: selectedImage.id,
                    bbox
                })
            });

            if (!res.ok) throw new Error('Failed to crop');

            toast.success('Image cropped');
            router.refresh(); // Refresh to update list and counts

            // Optimistically update current image status if we don't switch
            // But refresh should handle it.

        } catch (error) {
            console.error(error);
            toast.error('Failed to crop image');
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetCrop = async () => {
        if (!selectedImage) return;
        if (!selectedImage.isCropped) return;

        setIsSaving(true);
        try {
            const res = await fetch(`/api/projects/${projectId}/crop/reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageId: selectedImage.id
                })
            });

            if (!res.ok) throw new Error('Failed to reset crop');

            toast.success('Crop reset');
            router.refresh();

            // Clear crop selection if any
            setCrop(undefined);
            setCompletedCrop(undefined);

        } catch (error) {
            console.error(error);
            toast.error('Failed to reset crop');
        } finally {
            setIsSaving(false);
        }
    };

    // Auto-select first image if none selected
    useEffect(() => {
        if (!selectedImage && images.length > 0) {
            setSelectedImage(images[0]);
        }
    }, [images, selectedImage]);

    // When selecting a new image, reset crop
    useEffect(() => {
        setCrop(undefined);
        setCompletedCrop(undefined);
    }, [selectedImage]);

    return (
        <div className="flex h-[calc(100vh-140px)] gap-6">
            {/* Left Panel: Editor */}
            <div className="flex-1 flex flex-col bg-card rounded-lg border shadow-sm overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="font-semibold flex items-center gap-2">
                        <Scissors className="w-4 h-4" />
                        Crop Editor
                    </h3>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleResetCrop}
                            disabled={!selectedImage?.isCropped || isSaving}
                        >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Reset
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleApplyCrop}
                            disabled={!completedCrop || isSaving}
                        >
                            Apply Crop
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-muted/20 relative">
                    {selectedImage ? (
                        <ReactCrop
                            crop={crop}
                            onChange={(_, percentCrop) => setCrop(percentCrop)}
                            onComplete={(c) => setCompletedCrop(c)}
                            aspect={aspect}
                            className="max-h-full"
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                ref={imgRef}
                                src={selectedImage.rawUrl} // Always show raw for editing
                                alt="Crop target"
                                className="max-h-[600px] object-contain"
                                onLoad={onImageLoad}
                            />
                        </ReactCrop>
                    ) : (
                        <div className="text-muted-foreground">Select an image to start cropping</div>
                    )}
                </div>

                <div className="p-4 border-t bg-muted/10 text-xs text-muted-foreground">
                    {selectedImage?.id}
                    {selectedImage?.isCropped && <span className="ml-2 text-green-600 font-medium">(Cropped)</span>}
                </div>
            </div>

            {/* Right Panel: Gallery */}
            <div className="w-80 flex flex-col bg-card rounded-lg border shadow-sm">
                <div className="p-4 border-b">
                    <h3 className="font-semibold">Images ({images.length})</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {images.map(img => (
                        <div
                            key={img.id}
                            onClick={() => setSelectedImage(img)}
                            className={cn(
                                "flex items-center gap-3 p-2 rounded-md cursor-pointer border transition-colors",
                                selectedImage?.id === img.id
                                    ? "bg-accent border-primary/50"
                                    : "hover:bg-accent/50 border-transparent",
                                img.isCropped && "bg-green-50/50 dark:bg-green-900/10"
                            )}
                        >
                            <div className="relative w-12 h-12 bg-muted rounded overflow-hidden flex-shrink-0">
                                <Image
                                    src={img.croppedUrl || img.rawUrl}
                                    alt={img.id}
                                    fill
                                    sizes="48px"
                                    className="object-cover"
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate" title={img.id}>{img.id}</div>
                                <div className="flex items-center gap-2 mt-1">
                                    {img.isCropped ? (
                                        <span className="text-[10px] bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                            <CheckCircle className="w-3 h-3" />
                                            CROPPED
                                        </span>
                                    ) : (
                                        <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                                            RAW
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t">
                    <Button className="w-full" asChild>
                        <a href={`/projects/${projectId}/augmented`}>
                            Continue to Augment
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </a>
                    </Button>
                </div>
            </div>
        </div>
    );
}
