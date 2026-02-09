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
import { ImagePreviewModal } from '@/components/ui/image-preview-modal';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslation } from 'react-i18next';

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
    project: any;
    initialStats?: any;
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

export function CropClient({ projectId, images, project, initialStats }: CropClientProps) {
    const { t } = useTranslation('common');
    const router = useRouter();
    const [stats, setStats] = useState(initialStats);
    const [isProcessing, setIsProcessing] = useState(false);
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

    // Preview Modal State
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewIndex, setPreviewIndex] = useState(0);

    // Skip Crop State
    const [isSkipCropEnabled, setIsSkipCropEnabled] = useState(project?.crop?.mode === 'skip');
    const [isSkipConfirmOpen, setIsSkipConfirmOpen] = useState(false);

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

    const handleEnableSkipCrop = async () => {
        setIsProcessing(true);
        try {
            const res = await fetch(`/api/projects/${projectId}/crop/skip/enable`, { method: 'POST' });
            if (!res.ok) throw new Error('Failed to enable skip crop');
            const data = await res.json();
            setIsSkipCropEnabled(true);
            toast.success(`Skip Crop enabled! Copied ${data.count} images.`);
            setIsSkipConfirmOpen(false);
            router.refresh(); // Refresh to update downstream if needed
        } catch (error) {
            console.error(error);
            toast.error('Failed to enable Skip Crop');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDisableSkipCrop = async () => {
        if (!confirm("Are you sure you want to disable Skip Crop? This will return to using cropped images.")) return;

        setIsProcessing(true);
        try {
            const res = await fetch(`/api/projects/${projectId}/crop/skip/disable`, { method: 'POST' });
            if (!res.ok) throw new Error('Failed to disable skip crop');
            setIsSkipCropEnabled(false);
            toast.success('Skip Crop disabled. Returning to normal workflow.');
            router.refresh();
        } catch (error) {
            console.error(error);
            toast.error('Failed to disable Skip Crop');
        } finally {
            setIsProcessing(false);
        }
    };

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

            console.log('[CropClient] Creating variant for:', selectedImage.id);

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
        <div className="space-y-6 h-full flex flex-col">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">{t('crop.title')}</h1>
                <p className="text-muted-foreground">{t('crop.desc')}</p>
            </div>

            <div className="flex h-[calc(100vh-180px)] gap-6">
                {/* Left Panel: Editor */}
                <div className="flex-1 flex flex-col bg-card rounded-lg border shadow-sm overflow-hidden">
                    <div className="p-4 border-b flex justify-between items-center bg-muted/20">
                        <h3 className="font-semibold flex items-center gap-2">
                            <Scissors className="w-4 h-4" />
                            {t('crop.editor_title')}
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
                                        {t('actions.processing')}
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4 mr-2 text-purple-500" />
                                        {t('crop.auto_crop')}
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
                                    {t('actions.manage')} ({variants.length})
                                </Button>
                            )}
                            <Button
                                size="sm"
                                onClick={handleApplyCrop}
                                disabled={!completedCrop || isSaving}
                            >
                                {variants.length > 0 ? t('crop.add_crop') : t('crop.apply_crop')}
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
                            <div className="text-muted-foreground">{t('crop.select_image')}</div>
                        )}
                    </div>

                    <div className="p-4 border-t bg-muted/10 text-xs text-muted-foreground flex justify-between">
                        <div>
                            {selectedImage?.id}
                            {variants.length > 0 && (
                                <span className="ml-2 text-green-600 font-medium">({variants.length} {t('crop.variants')})</span>
                            )}
                        </div>
                        {/* Mini thumbnails of crops */}
                        <div className="flex gap-1">
                            {variants.slice(0, 5).map((v, idx) => (
                                <button
                                    key={v.file}
                                    title={v.file}
                                    onClick={() => {
                                        setPreviewIndex(idx);
                                        setIsPreviewOpen(true);
                                    }}
                                    className={cn(
                                        "w-6 h-6 relative rounded overflow-hidden border transition-all hover:ring-2 hover:ring-primary/50",
                                        activeCropFile === v.file ? "border-primary" : "border-transparent"
                                    )}
                                >
                                    {v.url && <Image src={v.url} alt={v.file} fill className="object-cover" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Panel: Gallery */}
                <div className="w-80 flex flex-col bg-card rounded-lg border shadow-sm h-full">
                    <div className="p-4 border-b flex-shrink-0">
                        <h3 className="font-semibold whitespace-nowrap">{t('crop.images_count', { count: images.length })}</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
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
                                        src={img.rawUrl}
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
                                                {t('sidebar.cropped')}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                                                {t('crop.raw')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Sticky Footer */}
                    <div className="flex-shrink-0 p-3 border-t bg-card space-y-2">
                        {/* Skip Crop Row */}
                        {isSkipCropEnabled ? (
                            <div className="flex items-center justify-center gap-2 bg-yellow-500/10 px-3 py-2 rounded-lg border border-yellow-500/20">
                                <span className="text-xs font-medium text-yellow-500 flex items-center gap-1.5 flex-1 min-w-0">
                                    <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                                    <span className="truncate">{t('crop.skip_enabled')}</span>
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-muted-foreground hover:text-white flex-shrink-0"
                                    onClick={handleDisableSkipCrop}
                                    disabled={isProcessing}
                                >
                                    {t('crop.disable')}
                                </Button>
                            </div>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsSkipConfirmOpen(true)}
                                disabled={isProcessing}
                                className="w-full text-muted-foreground border-dashed whitespace-nowrap"
                            >
                                {t('crop.skip_desc')}
                            </Button>
                        )}

                        {/* Navigation Buttons Row */}
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => router.push(`/projects/${projectId}`)}
                                className="flex-1 whitespace-nowrap"
                            >
                                {t('actions.back')}
                            </Button>
                            <Button
                                onClick={() => router.push(`/projects/${projectId}/augmented`)}
                                className="flex-1 whitespace-nowrap"
                            >
                                {t('actions.continue')}
                                <ArrowRight className="w-4 h-4 ml-1.5" />
                            </Button>
                        </div>
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

                {selectedImage && (
                    <ImagePreviewModal
                        isOpen={isPreviewOpen}
                        onClose={() => setIsPreviewOpen(false)}
                        images={variants}
                        selectedIndex={previewIndex}
                        onIndexChange={setPreviewIndex}
                        onSetActive={async (file) => {
                            // Re-implement set active logic here or abstract it?
                            // Let's duplicate the fetch call for now as it's simple
                            const res = await fetch(`/api/projects/${projectId}/crop/variant/set-active`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ imageId: selectedImage.id, variantFile: file })
                            });
                            if (!res.ok) throw new Error('Failed to set active');
                            toast.success('Active crop updated');
                            handleRefresh();
                        }}
                        onDelete={async (file) => {
                            const res = await fetch(`/api/projects/${projectId}/crop/variant/delete`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ imageId: selectedImage.id, variantFile: file })
                            });
                            if (!res.ok) throw new Error('Failed to delete');
                            toast.success('Variant deleted');
                            handleRefresh();
                            // If we deleted the only variant, close
                            if (variants.length <= 1) {
                                setIsPreviewOpen(false);
                            } else {
                                // Adjust index if needed
                                if (previewIndex >= variants.length - 1) {
                                    setPreviewIndex(Math.max(0, variants.length - 2));
                                }
                            }
                        }}
                        activeCropFile={activeCropFile}
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

                <AlertDialog open={isSkipConfirmOpen} onOpenChange={setIsSkipConfirmOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t('crop.skip_confirm_title')}</AlertDialogTitle>
                            <AlertDialogDescription className="space-y-3">
                                <p>
                                    {t('crop.skip_confirm_desc')}
                                </p>
                                <div className="text-sm bg-muted p-3 rounded-md border text-muted-foreground">
                                    <p>• {t('crop.skip_confirm_note_1')}</p>
                                    <p>• {t('crop.skip_confirm_note_2')}</p>
                                </div>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={handleEnableSkipCrop} className="bg-primary text-primary-foreground">
                                {t('crop.enable_skip')}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
}
