'use client';

import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/core';
import { ExternalLink } from 'lucide-react';

export function PlatformCard() {
    const handleClick = () => {
        window.open('https://civitai.com/models/train', '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="flex items-center justify-center min-h-[400px] p-8">
            <Card
                className="
                    max-w-md w-full cursor-pointer 
                    transition-all duration-300 
                    hover:shadow-xl hover:scale-[1.02]
                    bg-gradient-to-br from-card to-card/50
                    border-2 border-muted
                "
                onClick={handleClick}
            >
                <CardContent className="flex flex-col items-center gap-6 p-8 text-center">
                    {/* Icon */}
                    <div className="relative w-24 h-24 rounded-2xl overflow-hidden shadow-lg">
                        <Image
                            src="/icons/civitai.svg"
                            alt="CivitAI"
                            fill
                            className="object-cover"
                        />
                    </div>

                    {/* Title */}
                    <div>
                        <h3 className="text-2xl font-bold mb-2 flex items-center justify-center gap-2">
                            CivitAI Train
                            <ExternalLink size={20} className="text-muted-foreground" />
                        </h3>
                        <p className="text-muted-foreground text-sm">
                            Train your LoRA on CivitAI's cloud platform
                        </p>
                    </div>

                    {/* Helper Text */}
                    <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-4 w-full">
                        <p>
                            Click to open CivitAI's cloud training platform in a new tab.
                            You'll need to upload your dataset and configure training there.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
