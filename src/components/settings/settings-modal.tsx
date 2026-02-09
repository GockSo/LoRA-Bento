'use client';

import React from 'react';
import { useSettings } from './settings-provider';
import { t } from '@/lib/i18n';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription, // Added DialogDescription import
} from '@/components/ui/dialog';
import { Button, Card, CardContent } from '@/components/ui/core';
import { cn } from '@/lib/utils';
import { Check, Monitor, Moon, Sun } from 'lucide-react';

export function SettingsModal() {
    const { isSettingsOpen, closeSettings, language, theme, setLanguage, setTheme } = useSettings();

    return (
        <Dialog open={isSettingsOpen} onOpenChange={(open) => !open && closeSettings()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{t('settings.title', language)}</DialogTitle>
                    <DialogDescription className="sr-only">
                        {t('settings.title', language)}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    {/* Language Section */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            {t('settings.language', language)}
                        </label>
                        <div className="flex rounded-md shadow-sm">
                            <Button
                                variant={language === 'en' ? 'default' : 'outline'}
                                size="sm"
                                className="rounded-r-none flex-1"
                                onClick={() => setLanguage('en')}
                            >
                                EN
                            </Button>
                            <Button
                                variant={language === 'ja' ? 'default' : 'outline'}
                                size="sm"
                                className="rounded-none border-l-0 flex-1"
                                onClick={() => setLanguage('ja')}
                            >
                                日本語
                            </Button>
                            <Button
                                variant={language === 'zh' ? 'default' : 'outline'}
                                size="sm"
                                className="rounded-l-none border-l-0 flex-1"
                                onClick={() => setLanguage('zh')}
                            >
                                中文
                            </Button>
                        </div>
                    </div>

                    {/* Theme Section */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            {t('settings.theme', language)}
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {/* Light Theme */}
                            <div
                                className={cn(
                                    "cursor-pointer rounded-xl border-2 p-2 hover:bg-accent transition-all",
                                    theme === 'light' ? "border-primary bg-accent/50" : "border-transparent"
                                )}
                                onClick={() => setTheme('light')}
                            >
                                <div className="space-y-2">
                                    <div className="h-20 rounded-lg bg-[#ffffff] border border-gray-200 shadow-sm relative overflow-hidden">
                                        <div className="absolute top-2 left-2 w-12 h-2 bg-gray-100 rounded-full"></div>
                                        <div className="absolute top-6 left-2 right-2 h-10 bg-gray-50 rounded"></div>
                                    </div>
                                    <div className="flex items-center justify-center gap-2 text-xs font-medium">
                                        <Sun className="h-3 w-3" />
                                        {t('settings.theme.light', language)}
                                    </div>
                                </div>
                            </div>

                            {/* Dark Theme */}
                            <div
                                className={cn(
                                    "cursor-pointer rounded-xl border-2 p-2 hover:bg-accent transition-all",
                                    theme === 'dark' ? "border-primary bg-accent/50" : "border-transparent"
                                )}
                                onClick={() => setTheme('dark')}
                            >
                                <div className="space-y-2">
                                    <div className="h-20 rounded-lg bg-[#0f172a] border border-gray-800 shadow-sm relative overflow-hidden">
                                        <div className="absolute top-2 left-2 w-12 h-2 bg-gray-800 rounded-full"></div>
                                        <div className="absolute top-6 left-2 right-2 h-10 bg-gray-900 rounded"></div>
                                    </div>
                                    <div className="flex items-center justify-center gap-2 text-xs font-medium">
                                        <Moon className="h-3 w-3" />
                                        {t('settings.theme.dark', language)}
                                    </div>
                                </div>
                            </div>

                            {/* Gock So Theme */}
                            <div
                                className={cn(
                                    "cursor-pointer rounded-xl border-2 p-2 hover:bg-accent transition-all",
                                    theme === 'gockso' ? "border-primary bg-accent/50" : "border-transparent"
                                )}
                                onClick={() => setTheme('gockso')}
                            >
                                <div className="space-y-2">
                                    <div className="h-20 rounded-lg bg-[#FFF7FB] border border-[#F2D6E6] shadow-sm relative overflow-hidden">
                                        <div className="absolute top-2 left-2 w-12 h-2 bg-[#FFE3F0] rounded-full"></div>
                                        <div className="absolute top-6 left-2 right-2 h-10 bg-[#FFFFFF] rounded border border-[#F2D6E6]"></div>
                                        <div className="absolute bottom-2 right-2 h-4 w-4 bg-[#FF6FAE] rounded-full opacity-50"></div>
                                    </div>
                                    <div className="flex items-center justify-center gap-2 text-xs font-medium">
                                        <span className="text-[10px] leading-none">✨</span>
                                        {t('settings.theme.gockso', language)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
