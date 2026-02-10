'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Language, Theme } from '@/types/settings';
import type { AppSettings } from '@/lib/server/settings'; // Type only import is safe

interface SettingsContextType {
    language: Language;
    theme: Theme;
    setLanguage: (lang: Language) => Promise<void>;
    setTheme: (theme: Theme) => Promise<void>;
    onboardingCompleted: boolean;
    setOnboardingCompleted: (completed: boolean) => Promise<void>;
    isLoading: boolean;
    openSettings: () => void;
    closeSettings: () => void;
    isSettingsOpen: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function useSettings() {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}

import i18n from '@/i18n/client';
import { I18nextProvider } from 'react-i18next';

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    useEffect(() => {
        // Fetch settings on mount
        fetch('/api/settings')
            .then((res) => res.json())
            .then((data) => {
                setSettings(data);
                applyTheme(data.theme);
                // Sync to localStorage for next load (FOUC prevention)
                if (data.theme) {
                    localStorage.setItem('theme', data.theme);
                }
                // Sync i18n language
                if (data.language) {
                    i18n.changeLanguage(data.language);
                }
            })
            .catch((err) => console.error('Failed to load settings', err));
    }, []);

    const applyTheme = (theme: Theme) => {
        const root = document.documentElement;

        // IMPORTANT: set for ALL themes (including light)
        root.dataset.theme = theme; // "light" | "dark" | "gockso"

        // Tailwind dark variant
        root.classList.toggle("dark", theme === "dark");

        // Force browser UI scheme (Safari/Chrome macOS)
        root.style.colorScheme = theme === "dark" ? "dark" : "light";


        root.classList.remove('dark');
        root.removeAttribute('data-theme');

        if (theme === 'dark') {
            root.classList.add('dark');
            root.style.colorScheme = 'dark';
            root.dataset.theme = 'dark';
        } else if (theme === 'gockso') {
            root.setAttribute('data-theme', 'gockso');
            root.style.colorScheme = 'light';

        } else {
            // Light theme
            root.style.colorScheme = 'light';
            root.dataset.theme = 'light';
        }
    };

    const updateSettings = async (newSettings: Partial<AppSettings>) => {
        if (!settings) return;

        // Optimistic update
        const updated = { ...settings, ...newSettings };
        setSettings(updated);

        if (newSettings.theme) {
            applyTheme(newSettings.theme);
            localStorage.setItem('theme', newSettings.theme);
        }

        if (newSettings.language) {
            i18n.changeLanguage(newSettings.language);
        }

        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSettings),
            });
        } catch (err) {
            console.error('Failed to save settings', err);
            // Revert on failure (could improve this)
        }
    };

    const setLanguage = async (language: Language) => {
        await updateSettings({ language });
    };

    const setTheme = async (theme: Theme) => {
        await updateSettings({ theme });
    };

    const setOnboardingCompleted = async (completed: boolean) => {
        await updateSettings({ onboardingCompleted: completed });
    };

    if (!settings) {
        return null; // or a loading spinner to avoid flicker
    }

    return (
        <SettingsContext.Provider
            value={{
                language: settings.language,
                theme: settings.theme,
                setLanguage,
                setTheme,
                onboardingCompleted: settings.onboardingCompleted ?? false,
                setOnboardingCompleted,
                isLoading: !settings,
                openSettings: () => setIsSettingsOpen(true),
                closeSettings: () => setIsSettingsOpen(false),
                isSettingsOpen,
            }}
        >
            <I18nextProvider i18n={i18n}>
                {children}
            </I18nextProvider>
        </SettingsContext.Provider>
    );
}
