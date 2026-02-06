import Link from 'next/link';
import { Package } from 'lucide-react';

export function MainNav() {
    return (
        <header className="border-b bg-card">
            <div className="container flex h-16 items-center px-4">
                <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
                    <Package className="h-6 w-6 text-primary" />
                    <span>LoRA Bento</span>
                </Link>
                <nav className="ml-auto flex items-center space-x-4 lg:space-x-6">
                    <Link href="/" className="text-sm font-medium transition-colors hover:text-primary">
                        Dashboard
                    </Link>
                    <a href="https://github.com/google-deepmind/antigravity" target="_blank" rel="noreferrer" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                        GitHub
                    </a>
                </nav>
            </div>
        </header>
    );
}
