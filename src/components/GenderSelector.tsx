import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import bodyMaleImg from '@/assets/body-male.jpeg';
import bodyFemaleImg from '@/assets/body-female.jpeg';

interface GenderSelectorProps {
  currentGender?: string | null;
  onGenderChange: (gender: string, temporary: boolean) => void;
  locked?: boolean;
}

const GenderSelector = ({ currentGender, onGenderChange, locked = false }: GenderSelectorProps) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingGender, setPendingGender] = useState<string | null>(null);

  const handleSelect = (gender: string) => {
    if (gender === currentGender) return;
    if (locked && currentGender) {
      // Already has a permanent gender — ask temp or replace
      setPendingGender(gender);
      setShowConfirm(true);
    } else {
      // First time or not locked — set permanently
      onGenderChange(gender, false);
    }
  };

  const genders = [
    { id: 'male', label: 'Male', img: bodyMaleImg },
    { id: 'female', label: 'Female', img: bodyFemaleImg },
  ];

  return (
    <>
      <div className="flex gap-1.5">
        {genders.map(g => (
          <button
            key={g.id}
            onClick={() => handleSelect(g.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all ${
              currentGender === g.id
                ? 'bg-primary/15 border-primary/40 text-primary'
                : 'bg-secondary/30 border-border/30 text-muted-foreground hover:border-primary/30'
            }`}
          >
            <img src={g.img} alt={g.label} className="w-5 h-7 rounded object-cover" />
            <span className="text-[11px] font-semibold">{g.label}</span>
          </button>
        ))}
      </div>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Gender View</DialogTitle>
            <DialogDescription>
              Would you like to temporarily view as {pendingGender}, or permanently replace your profile gender?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 sm:flex-col">
            <Button
              variant="outline"
              onClick={() => {
                if (pendingGender) onGenderChange(pendingGender, true);
                setShowConfirm(false);
              }}
            >
              View Temporarily
            </Button>
            <Button
              onClick={() => {
                if (pendingGender) onGenderChange(pendingGender, false);
                setShowConfirm(false);
              }}
            >
              Replace Permanently
            </Button>
            <Button variant="ghost" onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GenderSelector;
