'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button, Input } from '@/components/ui/core';
import { Plus } from 'lucide-react';
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

// Re-implementing Dialog here locally for speed to avoid separate files if possible, 
// but sticking to distinct files is cleaner. 
// I'll create the dialog component file next.
// For now, I'll assume it exists or use a simple implementation inline?
// No, I'll create `src/components/ui/dialog.tsx` in a separate tool call.
// So this file will depend on it.

// WAIT. I haven't created `src/components/ui/dialog.tsx` yet.
// I should use `src/components/ui/core.tsx` if I put it there, or just use radix directly here.
// I'll implement a simple Dialog using Radix directly here to save file count, or assume I'll create `ui/dialog.tsx`.
// I'll creates `ui/dialog.tsx` properly.

export function NewProjectDialog() {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setLoading(true);
        try {
            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });

            if (!res.ok) throw new Error('Failed to create');

            const project = await res.json();
            setOpen(false);
            setName('');
            router.refresh(); // Refresh list
            router.push(`/projects/${project.id}/raw`);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
            <DialogPrimitive.Trigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Project
                </Button>
            </DialogPrimitive.Trigger>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg">
                    <div className="flex flex-col space-y-1.5 text-center sm:text-left">
                        <h2 className="text-lg font-semibold leading-none tracking-tight">Create Project</h2>
                        <p className="text-sm text-muted-foreground">Name your new dataset project.</p>
                    </div>
                    <form onSubmit={handleCreate}>
                        <div className="grid gap-4 py-4">
                            <Input
                                placeholder="My Awesome LoRA"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create'}</Button>
                        </div>
                    </form>
                    <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                    </DialogPrimitive.Close>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
