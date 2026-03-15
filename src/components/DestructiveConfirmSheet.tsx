import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface DestructiveConfirmSheetProps {
  title: string;
  body: string;
  confirmLabel: string;
  requiresTyping?: boolean;
  expectedText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DestructiveConfirmSheet = ({
  title,
  body,
  confirmLabel,
  requiresTyping = false,
  expectedText = '',
  onConfirm,
  onCancel,
  open,
  onOpenChange,
}: DestructiveConfirmSheetProps) => {
  const [typed, setTyped] = useState('');
  const canConfirm = !requiresTyping || typed === expectedText;

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setTyped('');
      onCancel();
    }
    onOpenChange(v);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="max-h-[60vh] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle style={{ color: 'var(--pg-crit, #f87171)' }}>{title}</SheetTitle>
        </SheetHeader>
        <div className="mt-3 space-y-4">
          <p className="text-sm" style={{ color: 'var(--pg-text-secondary, rgba(226,232,240,0.55))' }}>{body}</p>

          {requiresTyping && (
            <div className="space-y-2">
              <p className="text-xs" style={{ color: 'var(--pg-text-muted, rgba(226,232,240,0.3))' }}>
                Type "<span style={{ color: 'var(--pg-text-primary, #f1f5f9)' }} className="font-semibold">{expectedText}</span>" to confirm
              </p>
              <input
                type="text"
                value={typed}
                onChange={e => setTyped(e.target.value)}
                placeholder={expectedText}
                className="w-full px-3 py-2 rounded-lg text-sm font-mono"
                style={{
                  background: 'var(--pg-card, rgba(255,255,255,0.03))',
                  border: '1px solid var(--pg-card-border, rgba(255,255,255,0.07))',
                  color: 'var(--pg-text-primary, #f1f5f9)',
                }}
                autoFocus
              />
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => handleOpenChange(false)}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{
                background: 'var(--pg-card, rgba(255,255,255,0.03))',
                color: 'var(--pg-text-secondary)',
                border: '1px solid var(--pg-card-border)',
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onConfirm();
                setTyped('');
                onOpenChange(false);
              }}
              disabled={!canConfirm}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: canConfirm ? 'var(--pg-crit, #f87171)' : 'var(--pg-card)',
                color: canConfirm ? '#fff' : 'var(--pg-text-muted)',
                opacity: canConfirm ? 1 : 0.5,
                cursor: canConfirm ? 'pointer' : 'not-allowed',
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default DestructiveConfirmSheet;
