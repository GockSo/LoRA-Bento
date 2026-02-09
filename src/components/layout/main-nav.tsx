'use client';

import Link from 'next/link';
import { Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function MainNav() {
    const { t } = useTranslation('common');

    return (
        <header className="border-b bg-card">
            <div className="container flex h-16 items-center px-4">
                <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
                    <Package className="h-6 w-6 text-primary" />
                    <span>{t('app.title')}</span>
                </Link>
                <nav className="ml-auto flex items-center space-x-4 lg:space-x-6">
                    <Link href="/" className="text-sm font-medium transition-colors hover:text-primary">
                        {t('nav.dashboard')}
                    </Link>
                    <a href="https://github.com/GockSo/LoRA-Bento" target="_blank" rel="noreferrer" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                        {t('nav.github')}
                    </a>
                </nav>
            </div>
        </header>
    );
}
