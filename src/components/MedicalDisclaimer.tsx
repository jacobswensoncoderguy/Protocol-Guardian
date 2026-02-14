import { AlertTriangle } from 'lucide-react';

const MedicalDisclaimer = () => (
  <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 mt-4">
    <div className="flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground/80">Disclaimer:</span> Your health and final decisions are your full responsibility. Consult with your healthcare professional before taking any substances. This site is for tracking and comparisons only and should not be trusted as knowing what's best for every individual. All suggested doses default to performance-grade dosing to maximize supra-human outcomes — use the tolerance selector to match your risk profile.
      </p>
    </div>
  </div>
);

export default MedicalDisclaimer;
