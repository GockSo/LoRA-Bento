'use client';

import React from 'react';
import { motion } from 'framer-motion';

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
    React.useEffect(() => {
        const timer = setTimeout(() => {
            onComplete();
        }, 2200); // slightly longer than animation
        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <motion.div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
        >
            <div className="relative">
                {/* Glow effect */}
                <motion.div
                    className="absolute -inset-8 rounded-full bg-primary/20 blur-xl"
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.5, 0.8, 0.5],
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                />

                {/* Sparkles */}
                {[...Array(6)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-2 h-2 rounded-full bg-yellow-300"
                        initial={{
                            x: 0,
                            y: 0,
                            opacity: 0,
                            scale: 0
                        }}
                        animate={{
                            x: (Math.random() - 0.5) * 100,
                            y: (Math.random() - 0.5) * 100,
                            opacity: [0, 1, 0],
                            scale: [0, 1, 0]
                        }}
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            delay: i * 0.2,
                            ease: "easeOut"
                        }}
                        style={{
                            left: '50%',
                            top: '50%'
                        }}
                    />
                ))}

                {/* Logo / Text */}
                <motion.div
                    className="relative z-10 text-center"
                    initial={{ scale: 0.8, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{
                        type: "spring",
                        stiffness: 260,
                        damping: 20
                    }}
                >
                    <h1 className="text-4xl font-bold tracking-tight text-primary md:text-6xl">
                        LoRA Bento
                    </h1>
                    <motion.p
                        className="mt-2 text-lg text-muted-foreground font-medium"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                    >
                        by Gock So
                    </motion.p>
                </motion.div>
            </div>
        </motion.div>
    );
}
