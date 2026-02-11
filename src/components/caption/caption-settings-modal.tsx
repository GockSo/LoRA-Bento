'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button, Input, Slider } from '@/components/ui/core';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X, RefreshCcw, HelpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CaptionConfig, DEFAULT_CAPTION_CONFIG } from '@/types/caption';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    config: CaptionConfig;
    onSave: (newConfig: CaptionConfig) => void;
}

export function CaptionSettingsModal({ open, onOpenChange, config, onSave }: Props) {
    const { t } = useTranslation();
    const [localConfig, setLocalConfig] = useState<CaptionConfig>(config);
    const [excludeInput, setExcludeInput] = useState('');

    // Sync state when opening
    useEffect(() => {
        if (open) {
            setLocalConfig(JSON.parse(JSON.stringify(config))); // Deep copy to avoid ref issues
        }
    }, [open, config]);

    const handleSave = () => {
        onSave(localConfig);
        onOpenChange(false);
    };

    const handleReset = () => {
        if (window.confirm("Reset all settings to defaults?")) {
            setLocalConfig({
                ...DEFAULT_CAPTION_CONFIG,
                wdModel: localConfig.wdModel, // Keep selected model
                triggerWord: localConfig.triggerWord // Keep trigger word? Maybe reset if default has empty.
            });
        }
    };

    // Helper to update advanced settings
    const updateAdvanced = (key: keyof typeof localConfig.advanced, value: any) => {
        setLocalConfig(prev => ({
            ...prev,
            advanced: { ...prev.advanced, [key]: value }
        }));
    };

    // Exclude Tags Logic
    const excludeTagsList = localConfig.advanced.excludeTags
        ? localConfig.advanced.excludeTags.split(',').map(t => t.trim()).filter(Boolean)
        : [];

    const handleAddExcludeTag = (tag: string) => {
        const cleanTag = tag.trim();
        if (!cleanTag) return;
        if (excludeTagsList.includes(cleanTag)) return;

        const newList = [...excludeTagsList, cleanTag];
        updateAdvanced('excludeTags', newList.join(', '));
        setExcludeInput('');
    };

    const handleRemoveExcludeTag = (tagToRemove: string) => {
        const newList = excludeTagsList.filter(t => t !== tagToRemove);
        updateAdvanced('excludeTags', newList.join(', '));
    };

    const handleExcludeKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            handleAddExcludeTag(excludeInput);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 pb-4 border-b shrink-0">
                    <DialogTitle className="text-xl">WD Tagger Settings</DialogTitle>
                    <DialogDescription>
                        Configure parameters for Auto Tag All and Regenerate.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 overscroll-contain">
                    <div className="space-y-8 pb-4">

                        {/* Section A: Tagging Quality */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b">
                                <h3 className="font-semibold text-lg">Tagging Quality</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Threshold */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <Label>Tag Threshold</Label>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger><HelpCircle className="w-4 h-4 text-muted-foreground" /></TooltipTrigger>
                                                    <TooltipContent>Tags with confidence below this value are ignored.</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                        <span className="font-mono text-sm">{localConfig.advanced.tagThreshold.toFixed(2)}</span>
                                    </div>
                                    <Slider
                                        value={[localConfig.advanced.tagThreshold]}
                                        onValueChange={([val]) => updateAdvanced('tagThreshold', val)}
                                        min={0.1} max={0.9} step={0.01}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Lower = more tags, Higher = precise tags
                                    </p>
                                </div>

                                {/* Max Tags */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Label>Max Tags</Label>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger><HelpCircle className="w-4 h-4 text-muted-foreground" /></TooltipTrigger>
                                                <TooltipContent>Hard limit on number of tags generated (after thresholding).</TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                    <Input
                                        type="number"
                                        value={localConfig.advanced.maxTags}
                                        onChange={(e) => updateAdvanced('maxTags', parseInt(e.target.value) || 50)}
                                        min={1} max={200}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Limits top confidence tags.
                                    </p>
                                </div>
                            </div>

                            {/* Mode Info */}
                            <div className="bg-muted/50 p-4 rounded-lg flex items-start gap-3 text-sm">
                                <div className="mt-0.5 font-semibold text-muted-foreground uppercase text-xs tracking-wider">
                                    Current Mode:
                                </div>
                                <div>
                                    <span className={`font-bold ${localConfig.taggingMode === 'override' ? 'text-red-500' : 'text-blue-500'}`}>
                                        {localConfig.taggingMode === 'override' ? 'OVERRIDE' : 'APPEND'}
                                    </span>
                                    <p className="text-muted-foreground mt-1 text-xs">
                                        {localConfig.taggingMode === 'override'
                                            ? "Replaces all existing tags. Dangerous!"
                                            : "Adds new tags without removing existing ones."
                                        }
                                        <br />
                                        (Change mode in the main toolbar)
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Section B: Filtering & Exclusion */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b">
                                <h3 className="font-semibold text-lg">Filtering</h3>
                            </div>

                            <div className="space-y-3">
                                <Label>Exclude Tags</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={excludeInput}
                                        onChange={(e) => setExcludeInput(e.target.value)}
                                        onKeyDown={handleExcludeKeyDown}
                                        placeholder="Type tag and press Enter"
                                        className="flex-1"
                                    />
                                    <Button onClick={() => handleAddExcludeTag(excludeInput)} variant="secondary">
                                        Add
                                    </Button>
                                </div>

                                <div className="flex flex-wrap gap-2 min-h-[40px] p-2 bg-secondary/20 rounded-md border border-dashed border-border/50">
                                    {excludeTagsList.length === 0 && (
                                        <span className="text-sm text-muted-foreground italic p-1">No tags excluded</span>
                                    )}
                                    {excludeTagsList.map(tag => (
                                        <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                                            {tag}
                                            <button
                                                onClick={() => handleRemoveExcludeTag(tag)}
                                                className="hover:bg-destructive/10 rounded-full p-0.5 transition-colors"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    These tags will never be generated. Case-insensitive.
                                </p>
                            </div>
                        </div>

                        {/* Section C: Output Format */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b">
                                <h3 className="font-semibold text-lg">Output Format</h3>
                            </div>

                            <div className="space-y-3">
                                <Label>Trigger Word (Optional)</Label>
                                <Input
                                    value={localConfig.triggerWord}
                                    onChange={(e) => setLocalConfig(prev => ({ ...prev, triggerWord: e.target.value }))}
                                    placeholder="e.g. ohwx style"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Added to the start of every caption.
                                </p>
                            </div>

                            <div className="pt-2">
                                <div className="flex items-center justify-between text-sm p-3 bg-secondary/30 rounded-md">
                                    <span>Format</span>
                                    <span className="font-mono text-muted-foreground">Comma-separated (Standard)</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                <DialogFooter className="p-6 pt-4 border-t gap-2 sm:justify-between shrink-0 bg-background">
                    <Button variant="ghost" onClick={handleReset} className="text-muted-foreground hover:text-foreground">
                        <RefreshCcw className="w-4 h-4 mr-2" />
                        Reset Defaults
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave}>
                            Done
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
