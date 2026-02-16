import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import FeatureSelectionStep from './FeatureSelectionStep';
import { AppFeatures } from '@/lib/appFeatures';

interface FeatureManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  features: AppFeatures;
  onToggle: (key: keyof AppFeatures) => void;
  onRequestFeature: (text: string) => void;
}

const FeatureManagerDialog = ({ open, onOpenChange, features, onToggle, onRequestFeature }: FeatureManagerDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">App Features</DialogTitle>
          <p className="text-sm text-muted-foreground">Enable or disable features to customize your experience.</p>
        </DialogHeader>
        <FeatureSelectionStep
          features={features}
          onToggle={onToggle}
          onRequestFeature={onRequestFeature}
          compact
        />
      </DialogContent>
    </Dialog>
  );
};

export default FeatureManagerDialog;
