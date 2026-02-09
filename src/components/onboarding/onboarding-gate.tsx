'use client';

import React, { useEffect, useState } from 'react';
import { useSettings } from '@/components/settings/settings-provider';
import { SplashScreen } from './splash-screen';
import { OnboardingModal } from './onboarding-modal';
import { AnimatePresence } from 'framer-motion';

export function OnboardingGate({ children }: { children: React.ReactNode }) {
    const { onboardingCompleted, isLoading } = useSettings();
    const [showSplash, setShowSplash] = useState(false);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        if (!isLoading) {
            if (!onboardingCompleted) {
                setShowSplash(true);
            }
            setIsInitialized(true);
        }
    }, [isLoading, onboardingCompleted]);

    const handleSplashComplete = () => {
        setShowSplash(false);
        setShowOnboarding(true);
    };

    const handleOnboardingComplete = () => {
        setShowOnboarding(false);
    };

    // Prevent hydration mismatch or flash by waiting for settings to load
    if (!isInitialized) {
        return <div className="invisible">{children}</div>;
    }

    return (
        <>
            <AnimatePresence>
                {showSplash && (
                    <SplashScreen key="splash" onComplete={handleSplashComplete} />
                )}
                {showOnboarding && (
                    <OnboardingModal key="onboarding" onComplete={handleOnboardingComplete} />
                )}
            </AnimatePresence>
            {children}
        </>
    );
}
