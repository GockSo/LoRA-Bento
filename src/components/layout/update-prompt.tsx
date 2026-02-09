'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/core';
import { Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { UpdateModal } from './update-modal';
import { cn } from '@/lib/utils';

interface UpdateInfo {
    ok: boolean;
    repo: boolean;
    gitInstalled: boolean;
    branch: string;
    currentHash: string;
    currentTag: string | null;
    latestTag: string | null;
    behind: number;
    updateAvailable: boolean;
    message?: string;
}

export function UpdatePrompt() {
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        // Check for updates on mount
        const checkUpdate = async () => {
            try {
                const res = await fetch('/api/update/check');
                const data = await res.json();
                if (data.updateAvailable) {
                    setUpdateInfo(data);
                    // Check if user dismissed it this session? 
                    // Requirement says "Later" hides it for the current session.
                    // We can just use local component state for session.
                    setShowPrompt(true);
                }
            } catch (err) {
                console.error('Failed to check for updates', err);
            }
        };

        // Run once on mount
        // Maybe add a small delay to not compete with initial load
        const timer = setTimeout(checkUpdate, 2000);
        return () => clearTimeout(timer);
    }, []);

    if (!updateInfo || !showPrompt) return null;

    return (
        <>
            <AnimatePresence>
                {showPrompt && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="mx-3 mb-3 p-3 rounded-lg bg-primary/10 border border-primary/20 shadow-sm relative overflow-hidden group"
                    >
                        {/* Cute background accent */}
                        <div className="absolute -right-4 -top-4 w-12 h-12 bg-primary/10 rounded-full blur-xl group-hover:bg-primary/20 transition-colors" />

                        <div className="flex items-start justify-between gap-2 relative z-10">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2 text-primary font-medium text-xs">
                                    <Download className="h-3 w-3" />
                                    <span>Update available</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground font-mono">
                                    {updateInfo.latestTag || 'New version'} ready
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 -mt-1 -mr-1 text-muted-foreground hover:text-foreground"
                                onClick={() => setShowPrompt(false)}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </div>

                        <Button
                            size="sm"
                            className="w-full mt-2 h-7 text-xs shadow-sm"
                            onClick={() => setShowModal(true)}
                        >
                            Update Now
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>

            <UpdateModal
                open={showModal}
                onOpenChange={setShowModal}
                updateInfo={updateInfo}
            />
        </>
    );
}
