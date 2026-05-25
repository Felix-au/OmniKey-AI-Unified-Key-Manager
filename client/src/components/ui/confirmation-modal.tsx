import React, { useEffect } from 'react';
import { Button } from './button';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'default' | 'destructive';
}

export function ConfirmationModal({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default',
}: ConfirmationModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-200" 
        onClick={onCancel}
      />
      
      {/* Content wrapper */}
      <div className="relative z-50 w-full max-w-md rounded-lg border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200 dark:bg-zinc-900 dark:border-zinc-800">
        <h3 className="text-lg font-semibold leading-none tracking-tight text-foreground mb-2">
          {title}
        </h3>
        <div className="text-sm text-muted-foreground mb-6 whitespace-pre-wrap leading-relaxed">
          {description}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button 
            variant={variant === 'destructive' ? 'destructive' : 'default'} 
            size="sm" 
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
