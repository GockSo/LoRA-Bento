'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/core';
import { UploadCloud, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploadZoneProps {
    projectId: string;
}

export function UploadZone({ projectId }: UploadZoneProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const router = useRouter();

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            await uploadFiles(e.dataTransfer.files);
        }
    }, []);

    const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            await uploadFiles(e.target.files);
        }
    };

    const uploadFiles = async (files: FileList) => {
        setIsUploading(true);
        const formData = new FormData();

        // Validate image types
        const validFiles = Array.from(files).filter(file =>
            file.type.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png|webp)$/i)
        );

        if (validFiles.length === 0) {
            alert('No valid image files found.');
            setIsUploading(false);
            return;
        }

        // Batch upload? 
        // For simplicity, upload all in one request, but might be heavy.
        // Let's do 10 image chunks if needed, but for MVP one request.
        validFiles.forEach(file => {
            formData.append('files', file);
        });

        try {
            const res = await fetch(`/api/projects/${projectId}/import`, {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) throw new Error('Upload failed');

            router.refresh();
        } catch (error) {
            console.error(error);
            alert('Failed to upload images.');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
                "border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-colors cursor-pointer",
                isDragging ? "border-primary bg-primary/10" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
                isUploading && "pointer-events-none opacity-50"
            )}
        >
            <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                id="file-upload"
                onChange={handleFileInput}
            />

            {isUploading ? (
                <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
            ) : (
                <UploadCloud className="h-10 w-10 text-muted-foreground mb-4" />
            )}

            <h3 className="text-lg font-semibold mb-1">
                {isUploading ? 'Uploading...' : 'Drop images here'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4 text-center">
                or click to browse from your computer
            </p>

            {!isUploading && (
                <Button variant="secondary" onClick={() => document.getElementById('file-upload')?.click()}>
                    Select Files
                </Button>
            )}
        </div>
    );
}
