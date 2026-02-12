'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/core';
import { Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { UpdateModal } from './update-modal';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

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
    const { t } = useTranslation('common');
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

    // Requirements:
    // 1. Always visible if we have updateInfo (git/repo info)
    // 2. If !updateAvailable, show "Up to date" and disabled button.

    // We only return null if we haven't fetched info yet.
    if (!updateInfo) return null;

    const { updateAvailable, latestTag, currentTag, currentHash, branch } = updateInfo;

    // Determine display version
    const displayVersion = updateAvailable
        ? (latestTag || 'New version')
        : (currentTag || `${branch || 'HEAD'} (${currentHash?.substring(0, 7)})`);

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={cn(
                    "mx-3 mb-3 p-3 rounded-lg border shadow-sm relative overflow-hidden group transition-colors",
                    updateAvailable
                        ? "bg-primary/10 border-primary/20"
                        : "bg-muted/30 border-border/50 opacity-80 hover:opacity-100"
                )}
            >
                {/* Background accent only for updates */}
                {updateAvailable && (
                    <div className="absolute -right-4 -top-4 w-12 h-12 bg-primary/10 rounded-full blur-xl group-hover:bg-primary/20 transition-colors" />
                )}

                <div className="flex items-start justify-between gap-2 relative z-10">
                    <div className="flex flex-col gap-1">
                        <div className={cn(
                            "flex items-center gap-2 font-medium text-xs",
                            updateAvailable ? "text-primary" : "text-muted-foreground"
                        )}>
                            {updateAvailable ? <Download className="h-3 w-3" /> : <div className="h-3 w-3 rounded-full bg-green-500/50" />}
                            <span>{updateAvailable ? t('update.available') : t('update.uptodate')}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]" title={displayVersion}>
                            {updateAvailable ? t('update.version_ready', { version: displayVersion }) : displayVersion}
                        </p>
                    </div>
                    {/* Hide close button if we want it always visible, or leave it to hide temporarily? 
                        User said: "The Auto Update section/button must not disappear". 
                        So removing the close button is safer. */}
                </div>

                <Button
                    size="sm"
                    disabled={!updateAvailable}
                    className={cn(
                        "w-full mt-2 h-7 text-xs shadow-sm",
                        !updateAvailable && "opacity-50 cursor-not-allowed"
                    )}
                    onClick={() => setShowModal(true)}
                >
                    {updateAvailable ? t('update.update_now') : t('update.no_updates')}
                </Button>
            </motion.div>

            <UpdateModal
                open={showModal}
                onOpenChange={setShowModal}
                updateInfo={updateInfo}
            />
        </>
    );
}

