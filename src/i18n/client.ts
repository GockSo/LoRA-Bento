'use client';

import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import { getSettings } from '@/lib/server/settings'; // This is server-only, can't use here directly for init? 
// Actually, we should probably pass the initial language from the provider.
import { fallbackLng, languages, defaultNS } from './settings';

// Initialize once
i18next
    .use(initReactI18next)
    .use(resourcesToBackend((language: string, namespace: string) => import(`./locales/${language}/${namespace}.json`)))
    .init({
        lng: undefined, // let detect or set manually
        fallbackLng,
        supportedLngs: languages,
        defaultNS,
        fallbackNS: defaultNS,
        ns: [defaultNS],
        debug: process.env.NODE_ENV === 'development',
        missingKeyHandler: (lng, ns, key, fallbackValue) => {
            if (process.env.NODE_ENV === 'development') {
                console.warn(`[i18n] Missing translation: ${lng}:${ns}:${key}`);
            }
        },
        interpolation: {
            escapeValue: false, // react already safes from xss
        },
        react: {
            useSuspense: false, // avoid suspense for now to keep it simple
        },
    });

export default i18next;
