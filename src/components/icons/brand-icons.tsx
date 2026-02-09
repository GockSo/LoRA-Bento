import React from 'react';
import { cn } from '@/lib/utils';

interface IconProps extends React.SVGProps<SVGSVGElement> {
    className?: string;
}

export const CivitAIIcon: React.FC<IconProps> = ({ className, ...props }) => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={cn("w-4 h-4", className)}
            {...props}
        >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
        </svg>
    );
};
// Note: CivitAI icon is usually a blue hexagon-like C, but I'll use a generic "Globe/Network" placeholder shape if I can't find exact paths, 
// OR better yet, let's use a simplified "C" or similar.
// Actually, let's try to make something that looks like their logo (a C with a dot).
// Retrying with a better approximation.
export const CivitAIIconV2: React.FC<IconProps> = ({ className, ...props }) => {
    return (
        <svg
            viewBox="0 0 16 16"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            className={cn("w-4 h-4", className)}
            {...props}
        >
            <path d="M3.5 8C3.5 5.51472 5.51472 3.5 8 3.5C9.48744 3.5 10.8124 4.22171 11.666 5.33398L13.7844 3.66797C12.3964 1.95663 10.3162 0.833333 8 0.833333C4.04167 0.833333 0.833333 4.04167 0.833333 8C0.833333 11.9583 4.04167 15.1667 8 15.1667C10.3162 15.1667 12.3964 14.0434 13.7844 12.332L11.666 10.666C10.8124 11.7783 9.48744 12.5 8 12.5C5.51472 12.5 3.5 10.4853 3.5 8Z" />
            <circle cx="11.5" cy="8" r="1.5" />
        </svg>
    )
}

export const TetherIcon: React.FC<IconProps> = ({ className, ...props }) => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={cn("w-4 h-4", className)}
            {...props}
        >
            <path d="M12 0C5.372 0 0 5.373 0 12s5.372 12 12 12 12-5.373 12-12S18.628 0 12 0zm1.25 15.62v3.75h-2.5v-3.75H5.807v-2.28h4.943v-3.61c-2.906-.15-5.18-.84-5.18-1.655 0-.814 2.274-1.503 5.18-1.654V5h2.5v1.416c2.906.15 5.18.84 5.18 1.654 0 .815-2.274 1.504-5.18 1.655v3.61h4.944v2.28H13.25z" />
        </svg>
    );
};
