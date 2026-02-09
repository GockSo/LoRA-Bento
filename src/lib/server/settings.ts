import 'server-only';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'app_config.json');

import { Language, Theme } from '@/types/settings';

export interface AppSettings {
    language: Language;
    theme: Theme;
    onboardingCompleted: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
    language: 'en',
    theme: 'light',
    onboardingCompleted: false,
};

async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
}

export async function getSettings(): Promise<AppSettings> {
    try {
        await ensureDataDir();
        const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
        const settings = JSON.parse(data);
        return { ...DEFAULT_SETTINGS, ...settings };
    } catch (error) {
        // Return defaults if file doesn't exist or is invalid
        return DEFAULT_SETTINGS;
    }
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    await ensureDataDir();
    const current = await getSettings();
    const newSettings = { ...current, ...settings };
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(newSettings, null, 2), 'utf-8');
    return newSettings;
}
