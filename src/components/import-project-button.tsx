"use client";

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/core';
import { Upload, Loader2 } from 'lucide-react';


export function ImportProjectButton() {
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/projects/import-zip', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Import failed');
            }

            // Success
            // Clear input
            if (fileInputRef.current) fileInputRef.current.value = '';
            router.refresh();
        } catch (error) {
            console.error(error);
            alert(error instanceof Error ? error.message : 'Failed to import project');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <>
            <input
                type="file"
                accept=".zip"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
            />
            <Button variant="outline" onClick={handleClick} disabled={isUploading}>
                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Import ZIP
            </Button>
        </>
    );
}
