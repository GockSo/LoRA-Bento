'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/core';
import { Badge } from '@/components/ui/badge';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CaptionImage } from '@/types/wd-models';
import { cn, stringToColor } from '@/lib/utils';

interface ImageBrowserPanelProps {
    images: CaptionImage[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    editedIds: Set<string>;
}

type ViewMode = 'compact' | 'review';

export function ImageBrowserPanel({ images, selectedId, onSelect, editedIds }: ImageBrowserPanelProps) {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState<ViewMode>('compact');

    const filteredImages = images.filter(img =>
        img.filename.toLowerCase().includes(search.toLowerCase()) ||
        img.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()))
    );

    const getStatusBadge = (img: CaptionImage) => {
        if (editedIds.has(img.id)) {
            return (
                <Badge variant="default" className="bg-blue-500 text-white text-xs">
                    {t('caption.browser.status_edited')}
                </Badge>
            );
        }
        if (img.has_caption) {
            return (
                <Badge variant="default" className="bg-green-500 text-white text-xs">
                    {t('caption.browser.status_tagged')}
                </Badge>
            );
        }
        return (
            <Badge variant="secondary" className="text-xs">
                {t('caption.browser.status_missing')}
            </Badge>
        );
    };

    const displayTag = (tag: string) => tag.replace(/_/g, ' ');

    return (
        <div className="h-full flex flex-col space-y-4">
            {/* View Mode Toggle */}
            <div className="flex gap-2">
                <button
                    onClick={() => setViewMode('compact')}
                    className={cn(
                        "px-3 py-1.5 text-sm font-medium rounded transition-colors",
                        viewMode === 'compact'
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
                    )}
                >
                    {t('caption.browser.view_mode_compact')}
                </button>
                <button
                    onClick={() => setViewMode('review')}
                    className={cn(
                        "px-3 py-1.5 text-sm font-medium rounded transition-colors",
                        viewMode === 'review'
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
                    )}
                >
                    {t('caption.browser.view_mode_review')}
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search images or tags..."
                    className="pl-9"
                />
            </div>

            {/* Image Count */}
            <div className="text-sm text-gray-600 dark:text-gray-400">
                {filteredImages.length} / {images.length} images
            </div>

            {/* Image List */}
            <div className="flex-1 overflow-y-auto">
                {images.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-4 text-gray-500">
                        <p>{t('caption.browser.no_images', 'No images found')}</p>
                    </div>
                ) : viewMode === 'compact' ? (
                    <div className="grid grid-cols-2 gap-3">
                        {filteredImages.map((img) => (
                            <div
                                key={img.id}
                                onClick={() => onSelect(img.id)}
                                className={cn(
                                    "relative cursor-pointer rounded-lg overflow-hidden transition-all",
                                    "border-2 hover:border-blue-400 dark:hover:border-blue-500",
                                    selectedId === img.id
                                        ? "border-blue-600 dark:border-blue-400 ring-2 ring-blue-500/50"
                                        : "border-transparent"
                                )}
                            >
                                <div className="aspect-square bg-gray-100 dark:bg-gray-800">
                                    <img
                                        src={img.url}
                                        alt={img.filename}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="absolute top-2 right-2">
                                    {getStatusBadge(img)}
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                                    <p className="text-xs text-white truncate">{img.filename}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredImages.map((img) => (
                            <div
                                key={img.id}
                                onClick={() => onSelect(img.id)}
                                className={cn(
                                    "flex gap-3 p-3 rounded-lg cursor-pointer transition-all",
                                    "border-2 hover:border-blue-400 dark:hover:border-blue-500",
                                    selectedId === img.id
                                        ? "border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-950/20"
                                        : "border-gray-200 dark:border-gray-700"
                                )}
                            >
                                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden flex-shrink-0">
                                    <img
                                        src={img.url}
                                        alt={img.filename}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="text-sm font-medium truncate">{img.filename}</p>
                                        {editedIds.has(img.id) && (
                                            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" title="Edited" />
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {img.tags.slice(0, 12).map((tag, idx) => (
                                            <span
                                                key={idx}
                                                className="text-xs px-2 py-0.5 rounded text-white"
                                                style={{ backgroundColor: stringToColor(tag) }}
                                            >
                                                {displayTag(tag)}
                                            </span>
                                        ))}
                                        {img.tags.length > 12 && (
                                            <span className="text-xs px-2 py-0.5 text-gray-500">
                                                +{img.tags.length - 12} more
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex-shrink-0">
                                    {getStatusBadge(img)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
