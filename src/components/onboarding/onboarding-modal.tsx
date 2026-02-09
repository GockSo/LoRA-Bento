'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '@/components/settings/settings-provider';
import { Button } from '@/components/ui/core';
import { cn } from '@/lib/utils';
import { Check, ArrowRight, ArrowLeft, Monitor, Moon, Sun } from 'lucide-react';
import { Language, Theme } from '@/types/settings';
import { useTranslation } from 'react-i18next';

// Define steps
type Step = 'language' | 'theme';

interface OnboardingModalProps {
    onComplete: () => void;
}

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
    const { language, setLanguage, theme, setTheme, setOnboardingCompleted } = useSettings();
    const [step, setStep] = useState<Step>('language');
    const { t } = useTranslation('common');

    const handleNext = () => {
        if (step === 'language') {
            setStep('theme');
        } else {
            handleFinish();
        }
    };

    const handleBack = () => {
        if (step === 'theme') {
            setStep('language');
        }
    };

    const handleFinish = async () => {
        await setOnboardingCompleted(true);
        onComplete();
    };

    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 100 : -100,
            opacity: 0
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1
        },
        exit: (direction: number) => ({
            zIndex: 0,
            x: direction < 0 ? 100 : -100,
            opacity: 0
        })
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <motion.div
                className="w-full max-w-lg overflow-hidden rounded-2xl border bg-card p-6 shadow-2xl relative"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
            >
                {/* Progress Indicators */}
                <div className="mb-8 flex justify-center gap-2">
                    <div className={cn("h-2 w-12 rounded-full transition-colors", step === 'language' ? "bg-primary" : "bg-muted")} />
                    <div className={cn("h-2 w-12 rounded-full transition-colors", step === 'theme' ? "bg-primary" : "bg-muted")} />
                </div>

                <div className="min-h-[300px] relative">
                    <AnimatePresence mode="wait">
                        {step === 'language' && (
                            <motion.div
                                key="language"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="space-y-6"
                            >
                                <div className="text-center">
                                    <h2 className="text-2xl font-bold">Select Language</h2>
                                    <p className="text-muted-foreground">Choose your preferred language</p>
                                </div>

                                <div className="grid gap-4">
                                    <LanguageOption
                                        lang="en"
                                        label="English"
                                        flag="🇺🇸"
                                        selected={language === 'en'}
                                        onClick={() => setLanguage('en')}
                                    />
                                    <LanguageOption
                                        lang="ja"
                                        label="日本語"
                                        flag="🇯🇵"
                                        selected={language === 'ja'}
                                        onClick={() => setLanguage('ja')}
                                    />
                                    <LanguageOption
                                        lang="zh"
                                        label="中文"
                                        flag="🇨🇳"
                                        selected={language === 'zh'}
                                        onClick={() => setLanguage('zh')}
                                    />
                                </div>
                            </motion.div>
                        )}

                        {step === 'theme' && (
                            <motion.div
                                key="theme"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="text-center">
                                    <h2 className="text-2xl font-bold">{t('settings.theme_label', 'Theme')}</h2>
                                    <p className="text-muted-foreground">Choose your vibe</p>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <ThemeOption
                                        theme="light"
                                        label="Light"
                                        icon={<Sun className="h-4 w-4" />}
                                        selected={theme === 'light'}
                                        onClick={() => setTheme('light')}
                                        previewColor="#ffffff"
                                    />
                                    <ThemeOption
                                        theme="dark"
                                        label="Dark"
                                        icon={<Moon className="h-4 w-4" />}
                                        selected={theme === 'dark'}
                                        onClick={() => setTheme('dark')}
                                        previewColor="#0f172a"
                                    />
                                    <ThemeOption
                                        theme="gockso"
                                        label="Gock So"
                                        icon={<span>✨</span>}
                                        selected={theme === 'gockso'}
                                        onClick={() => setTheme('gockso')}
                                        previewColor="#FFF7FB"
                                        isSpecial
                                    />
                                </div>
                                <div className="rounded-lg border bg-card p-4 shadow-sm mt-4 opacity-75 grayscale-[0.2] pointer-events-none select-none">
                                    <div className="flex gap-4">
                                        <div className="w-16 h-full bg-muted/50 rounded-md p-2 space-y-2">
                                            <div className="w-8 h-8 rounded-full bg-primary/20" />
                                            <div className="w-full h-2 bg-muted rounded" />
                                        </div>
                                        <div className="flex-1 space-y-2 py-2">
                                            <div className="w-3/4 h-4 bg-foreground/10 rounded" />
                                            <div className="w-1/2 h-4 bg-foreground/10 rounded" />
                                            <div className="mt-4 flex gap-2">
                                                <div className="w-20 h-8 bg-primary rounded" />
                                                <div className="w-20 h-8 bg-secondary rounded" />
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-xs text-center mt-2 text-muted-foreground">(Theme Preview)</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="flex justify-between mt-8">
                    <Button
                        variant="ghost"
                        onClick={handleBack}
                        disabled={step === 'language'}
                        className={cn("transition-opacity", step === 'language' ? "opacity-0 pointer-events-none" : "opacity-100")}
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>

                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={handleFinish} className="text-muted-foreground hover:text-foreground">
                            Skip
                        </Button>
                        <Button onClick={handleNext}>
                            {step === 'theme' ? "Get Started" : "Next"}
                            {step !== 'theme' && <ArrowRight className="ml-2 h-4 w-4" />}
                        </Button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

function LanguageOption({ lang, label, flag, selected, onClick }: { lang: string, label: string, flag: string, selected: boolean, onClick: () => void }) {
    return (
        <motion.button
            className={cn(
                "flex items-center justify-between p-4 rounded-xl border-2 transition-all w-full text-left",
                selected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-transparent bg-muted/50 hover:bg-muted"
            )}
            onClick={onClick}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
        >
            <span className="flex items-center gap-3 text-lg font-medium">
                <span className="text-2xl">{flag}</span>
                {label}
            </span>
            {selected && (
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-primary"
                >
                    <Check className="h-5 w-5" />
                </motion.div>
            )}
        </motion.button>
    );
}

function ThemeOption({ theme, label, icon, selected, onClick, previewColor, isSpecial }: { theme: string, label: string, icon: React.ReactNode, selected: boolean, onClick: () => void, previewColor: string, isSpecial?: boolean }) {
    return (
        <motion.button
            className={cn(
                "relative flex flex-col items-center gap-3 rounded-xl border-2 p-4 transition-all overflow-hidden",
                selected
                    ? "border-primary bg-accent/50 shadow-md ring-2 ring-primary/20"
                    : "border-muted hover:border-primary/50 hover:bg-accent/10"
            )}
            onClick={onClick}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
        >
            <div
                className={cn(
                    "h-16 w-full rounded-lg shadow-inner border relative overflow-hidden",
                    // Simple representation of the theme
                )}
                style={{ backgroundColor: previewColor }}
            >
                {isSpecial && <div className="absolute inset-0 bg-gradient-to-br from-pink-100/50 to-purple-100/50" />}
                <div className="absolute top-2 left-2 w-8 h-2 bg-black/10 rounded-full" />
                <div className="absolute top-6 left-2 right-2 h-6 bg-white/50 rounded border border-black/5" />
            </div>

            <div className="flex items-center gap-2 font-medium text-sm">
                {icon}
                {label}
            </div>

            {selected && (
                <motion.div
                    layoutId="theme-check"
                    className="absolute top-2 right-2 text-primary"
                >
                    <div className="h-2 w-2 rounded-full bg-primary" />
                </motion.div>
            )}
        </motion.button>
    );
}
