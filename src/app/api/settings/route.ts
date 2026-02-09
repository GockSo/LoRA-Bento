import { NextResponse } from 'next/server';
import { getSettings, saveSettings } from '@/lib/server/settings';

export async function GET() {
    const settings = await getSettings();
    return NextResponse.json(settings);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const settings = await saveSettings(body);
        return NextResponse.json(settings);
    } catch (error) {
        console.error('Failed to save settings:', error);
        return NextResponse.json(
            { error: 'Failed to save settings' },
            { status: 500 }
        );
    }
}
