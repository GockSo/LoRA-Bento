'use client';

import React from 'react';
import { useSettings } from './settings-provider';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription, // Added DialogDescription import
} from '@/components/ui/dialog';
import { Button, Card, CardContent } from '@/components/ui/core';
import { cn } from '@/lib/utils';
import { Check, Monitor, Moon, Sun, Github, Copy } from 'lucide-react';
import { CivitAIIconV2 } from '@/components/icons/brand-icons';
import { toast } from 'sonner';

export function SettingsModal() {
    const { isSettingsOpen, closeSettings, language, theme, setLanguage, setTheme } = useSettings();
    const { t } = useTranslation('common');

    return (
        <Dialog open={isSettingsOpen} onOpenChange={(open) => !open && closeSettings()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{t('settings.title')}</DialogTitle>
                    <DialogDescription className="sr-only">
                        {t('settings.title')}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    {/* Language Section */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            {t('settings.language')}
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
                            {t('settings.theme')}
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
                                        {t('settings.theme.light')}
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
                                        {t('settings.theme.dark')}
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
                                        {t('settings.theme.gockso')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* About / Credits Section */}
                    <div className="space-y-3 pt-4 border-t">
                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            {t('credits.title')}
                        </label>
                        <Card>
                            <CardContent className="p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                            <CivitAIIconV2 className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium">{t('credits.created_by')} GockSo</div>
                                            <a
                                                href="https://civitai.com/user/GockSo"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-muted-foreground hover:text-primary hover:underline"
                                            >
                                                civitai.com/user/GockSo
                                            </a>
                                        </div>
                                    </div>
                                    <a
                                        href="https://github.com/GockSo/LoRA-Bento"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <Button variant="ghost" size="icon">
                                            <Github className="w-5 h-5" />
                                        </Button>
                                    </a>
                                </div>

                                <div className="space-y-2">
                                    <div className="text-xs font-medium text-muted-foreground">
                                        {t('credits.donate_label')}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-xs w-full truncate border">
                                            {t('credits.wallet_address')}
                                        </code>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8 shrink-0"
                                            onClick={() => {
                                                navigator.clipboard.writeText(t('credits.wallet_address'));
                                                toast.success(t('credits.copied'));
                                            }}
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
