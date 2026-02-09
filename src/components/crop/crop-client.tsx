'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Button } from '@/components/ui/core';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CheckCircle, RotateCcw, Scissors, ArrowRight, Settings2, Sparkles, Loader2 } from 'lucide-react';
import { ManageCropsModal } from './manage-crops-modal';
import { ReviewAutoCropModal } from './review-auto-crop-modal';

interface CropVariant {
    file: string;
    bbox: { x: number; y: number; w: number; h: number };
    source: string;
    confidence?: number;
    createdAt: string;
    url?: string;
}

interface CropImage {
    id: string; // filename
    rawUrl: string;
    croppedUrl: string | null; // active crop url
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

    // Multi-crop state
    const [variants, setVariants] = useState<CropVariant[]>([]);
    const [activeCropFile, setActiveCropFile] = useState<string | null>(null);
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);

    // Auto Crop State
    const [isAutoCropping, setIsAutoCropping] = useState(false);
    const [autoCropJobId, setAutoCropJobId] = useState<string | null>(null);
    const [autoCropProposals, setAutoCropProposals] = useState<any[]>([]);
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

    // Fetch crop variants when image selected
    const fetchVariants = useCallback(async () => {
        if (!selectedImage) return;
        try {
            const res = await fetch(`/api/projects/${projectId}/crop/variants?imageId=${selectedImage.id}`);
            if (res.ok) {
                const data = await res.json();
                setVariants(data.variants || []);
                setActiveCropFile(data.activeCrop || null);
            }
        } catch (e) {
            console.error('Failed to fetch variants', e);
        }
    }, [projectId, selectedImage]);

    useEffect(() => {
        if (selectedImage) {
            fetchVariants();
        } else {
            setVariants([]);
            setActiveCropFile(null);
        }
    }, [selectedImage, fetchVariants]);

    // Cleanup crop selection on image change
    useEffect(() => {
        setCrop(undefined);
        setCompletedCrop(undefined);
    }, [selectedImage]);

    // Poll for auto crop job
    useEffect(() => {
        if (!autoCropJobId) return;

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/projects/${projectId}/crop/auto/results?jobId=${autoCropJobId}`);
                if (res.ok) {
                    const job = await res.json();
                    if (job.status === 'completed') {
                        setIsAutoCropping(false);
                        setAutoCropJobId(null);
                        if (job.result && job.result.proposals) {
                            setAutoCropProposals(job.result.proposals);
                            setIsReviewModalOpen(true);
                            toast.success('Auto Crop completed');
                        } else {
                            toast.error('Auto Crop completed but no proposals found');
                        }
                    } else if (job.status === 'failed') {
                        setIsAutoCropping(false);
                        setAutoCropJobId(null);
                        toast.error(`Auto Crop failed: ${job.error}`);
                    }
                    // else pending/processing, continue polling
                }
            } catch (e) {
                console.error(e);
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [autoCropJobId, projectId]);

    function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
        const aspect = undefined; // local var for now
        if (aspect) {
            const { width, height } = e.currentTarget;
            setCrop(centerAspectCrop(width, height, aspect));
        }
    }

    const handleApplyCrop = async () => {
        if (!selectedImage || !completedCrop || !imgRef.current) return;

        setIsSaving(true);
        try {
            const image = imgRef.current;
            const bbox = {
                x: completedCrop.x / image.width,
                y: completedCrop.y / image.height,
                w: completedCrop.width / image.width,
                h: completedCrop.height / image.height
            };

            const res = await fetch(`/api/projects/${projectId}/crop/variant/create`, {
                method: 'POST', // Now creates a new variant
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageId: selectedImage.id,
                    bbox,
                    source: 'manual'
                })
            });

            if (!res.ok) throw new Error('Failed to crop');

            toast.success('New crop variant created');

            // Refresh variants locally and router (for stats/badging)
            await fetchVariants();
            router.refresh();

            setCrop(undefined);
            setCompletedCrop(undefined);

        } catch (error) {
            console.error(error);
            toast.error('Failed to create crop variant');
        } finally {
            setIsSaving(false);
        }
    };

    const handleRefresh = async () => {
        await fetchVariants();
        router.refresh();
    };

    const handleStartAutoCrop = async () => {
        setIsAutoCropping(true);
        try {
            const res = await fetch(`/api/projects/${projectId}/crop/auto/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'auto'
                })
            });

            if (!res.ok) throw new Error('Failed to start auto crop');

            const data = await res.json();
            setAutoCropJobId(data.jobId);
            toast.info('Auto Crop job started...');

        } catch (error) {
            console.error(error);
            toast.error('Failed to start auto crop');
            setIsAutoCropping(false);
        }
    };

    // Helper to Create Map
    const imageMap = images.reduce((acc, img) => {
        acc[img.id] = img.rawUrl;
        return acc;
    }, {} as Record<string, string>);

    return (
        <div className="flex h-[calc(100vh-140px)] gap-6">
            {/* Left Panel: Editor */}
            <div className="flex-1 flex flex-col bg-card rounded-lg border shadow-sm overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center bg-muted/20">
                    <h3 className="font-semibold flex items-center gap-2">
                        <Scissors className="w-4 h-4" />
                        Crop Editor
                    </h3>
                    <div className="flex gap-2 items-center">
                        {/* Auto Crop Button */}
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleStartAutoCrop}
                            disabled={isAutoCropping}
                            className={cn(isAutoCropping && "opacity-80")}
                        >
                            {isAutoCropping ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4 mr-2 text-purple-500" />
                                    Auto Crop
                                </>
                            )}
                        </Button>

                        <div className="w-[1px] h-6 bg-border mx-1"></div>

                        {variants.length > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsManageModalOpen(true)}
                            >
                                <Settings2 className="w-4 h-4 mr-2" />
                                Manage ({variants.length})
                            </Button>
                        )}
                        <Button
                            size="sm"
                            onClick={handleApplyCrop}
                            disabled={!completedCrop || isSaving}
                        >
                            {variants.length > 0 ? 'Add New Crop' : 'Apply Crop'}
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-muted/20 relative">
                    {selectedImage ? (
                        <ReactCrop
                            crop={crop}
                            onChange={(_, percentCrop) => setCrop(percentCrop)}
                            onComplete={(c) => setCompletedCrop(c)}
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

                <div className="p-4 border-t bg-muted/10 text-xs text-muted-foreground flex justify-between">
                    <div>
                        {selectedImage?.id}
                        {variants.length > 0 && (
                            <span className="ml-2 text-green-600 font-medium">({variants.length} variants)</span>
                        )}
                    </div>
                    {/* Mini thumbnails of crops */}
                    <div className="flex gap-1">
                        {variants.slice(0, 5).map(v => (
                            <div key={v.file} title={v.file} className={cn(
                                "w-6 h-6 relative rounded overflow-hidden border",
                                activeCropFile === v.file ? "border-primary" : "border-transparent"
                            )}>
                                {v.url && <Image src={v.url} alt={v.file} fill className="object-cover" />}
                            </div>
                        ))}
                    </div>
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

            {selectedImage && (
                <ManageCropsModal
                    isOpen={isManageModalOpen}
                    onClose={() => setIsManageModalOpen(false)}
                    projectId={projectId}
                    imageId={selectedImage.id}
                    variants={variants}
                    activeCrop={activeCropFile}
                    onUpdate={handleRefresh}
                />
            )}

            <ReviewAutoCropModal
                isOpen={isReviewModalOpen}
                onClose={() => setIsReviewModalOpen(false)}
                projectId={projectId}
                proposals={autoCropProposals}
                imageMap={imageMap}
                onApply={handleRefresh}
            />
        </div>
    );
}
