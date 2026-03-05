import { WizardFormData, CompoundType } from '../types';
import { calculateConcentration } from '@/data/dilutionDefaults';

interface StepConfigurationProps {
  formData: WizardFormData;
  onUpdate: (data: Partial<WizardFormData>) => void;
  onNext: () => void;
  onBack: () => void;
  accentColor: string;
}

function NumericField({ label, value, onChange, unit, unitOptions, onUnitChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  unit?: string; unitOptions?: string[]; onUnitChange?: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <div className="flex gap-1.5">
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || '0'}
          className="flex-1 rounded-lg border border-border/50 bg-secondary px-3 py-2.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 min-w-0"
        />
        {unitOptions && onUnitChange ? (
          <select
            value={unit}
            onChange={e => onUnitChange(e.target.value)}
            className="rounded-lg border border-border/50 bg-secondary px-2 py-2.5 text-xs text-muted-foreground focus:outline-none"
          >
            {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        ) : unit ? (
          <span className="flex items-center px-2 text-xs text-muted-foreground">{unit}</span>
        ) : null}
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, multiline }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="w-full rounded-lg border border-border/50 bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-border/50 bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      )}
    </div>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg border border-border/50 bg-secondary px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function CalcDisplay({ lines, accentColor }: { lines: string[]; accentColor: string }) {
  if (lines.length === 0) return null;
  return (
    <div
      className="rounded-xl p-3 space-y-1 border"
      style={{
        borderColor: `hsl(${accentColor} / 0.3)`,
        backgroundColor: `hsl(${accentColor} / 0.06)`,
      }}
    >
      {lines.map((line, i) => (
        <p key={i} className="text-sm font-mono" style={{ color: `hsl(${accentColor})` }}>{line}</p>
      ))}
    </div>
  );
}

// ─── Peptide Configuration ───────────────────────────────────────────────────

function PeptideConfig({ formData, onUpdate, accentColor }: { formData: WizardFormData; onUpdate: (d: Partial<WizardFormData>) => void; accentColor: string }) {
  const powder = parseFloat(formData.powderWeightPerVial) || 0;
  const solvent = parseFloat(formData.solventVolume) || 0;
  const dose = parseFloat(formData.targetDose) || 0;

  const calcLines: string[] = [];
  if (powder > 0 && solvent > 0) {
    const conc = calculateConcentration(powder, `${formData.powderWeightUnit} vial`, solvent, 'mL');
    if (conc) {
      calcLines.push(`Concentration: ${conc.value} ${conc.unit}`);
      if (dose > 0) {
        let doseMg = dose;
        if (formData.targetDoseUnit === 'mcg') doseMg = dose / 1000;
        let concMg = conc.value;
        if (conc.unit === 'mcg/mL') concMg = conc.value / 1000;
        if (concMg > 0) {
          const mlPerDose = doseMg / concMg;
          calcLines.push(`Draw ${mlPerDose.toFixed(2)} mL per injection`);
        }
      } else {
        calcLines.push('— enter dose in Step 3 to see draw volume');
      }
    }
  }

  const solventOptions = ['Bacteriostatic Water', 'Sterile Saline', 'Acetic Acid (0.6%)', 'Sterile Water'];

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">We'll use these values to calculate your exact draw volume per dose.</p>
      <NumericField label="Powder weight per vial" value={formData.powderWeightPerVial} onChange={v => onUpdate({ powderWeightPerVial: v })} unitOptions={['mg', 'mcg', 'IU', 'g']} unit={formData.powderWeightUnit} onUnitChange={v => onUpdate({ powderWeightUnit: v })} />
      <NumericField label="Vials in current supply" value={formData.vialsInSupply} onChange={v => onUpdate({ vialsInSupply: v })} />
      <SelectField label="Solvent type" value={formData.solventType} onChange={v => onUpdate({ solventType: v })} options={solventOptions} />
      <NumericField label="Solvent volume to add" value={formData.solventVolume} onChange={v => onUpdate({ solventVolume: v })} unit="mL" />
      <CalcDisplay lines={calcLines} accentColor={accentColor} />
      <TextField label="Storage pre-reconstitution" value={formData.storagePreRecon} onChange={v => onUpdate({ storagePreRecon: v })} placeholder="e.g. Freeze, protect from light" />
      <TextField label="Storage post-reconstitution" value={formData.storagePostRecon} onChange={v => onUpdate({ storagePostRecon: v })} placeholder="e.g. Refrigerate, use within 30 days" />
      <NumericField label="Expiry after reconstitution" value={formData.expiryAfterRecon} onChange={v => onUpdate({ expiryAfterRecon: v })} unitOptions={['days', 'weeks']} unit={formData.expiryAfterReconUnit} onUnitChange={v => onUpdate({ expiryAfterReconUnit: v })} />
      <TextField label="Syringe recommendation" value={formData.syringeRecommendation} onChange={v => onUpdate({ syringeRecommendation: v })} placeholder="e.g. 29g insulin syringe, 0.5mL" />
      <TextField label="Prep notes" value={formData.prepNotes} onChange={v => onUpdate({ prepNotes: v })} placeholder="Any special reconstitution notes…" multiline />
    </div>
  );
}

// ─── Injectable Oil Configuration ────────────────────────────────────────────

function OilConfig({ formData, onUpdate, accentColor }: { formData: WizardFormData; onUpdate: (d: Partial<WizardFormData>) => void; accentColor: string }) {
  const conc = parseFloat(formData.concentration) || 0;
  const vialMl = parseFloat(formData.vialSizeMl) || 0;
  const vials = parseFloat(formData.oilVialsInSupply) || 0;
  const dose = parseFloat(formData.targetDose) || 0;

  const calcLines: string[] = [];
  if (conc > 0 && vialMl > 0) {
    const totalMg = conc * vialMl * vials;
    calcLines.push(`Total mg in supply: ${totalMg.toLocaleString()} mg`);
    if (dose > 0) {
      const dosesPerVial = Math.floor((conc * vialMl) / dose);
      calcLines.push(`Each vial contains ~${dosesPerVial} doses`);
    }
  }

  return (
    <div className="space-y-4">
      <NumericField label="Concentration" value={formData.concentration} onChange={v => onUpdate({ concentration: v })} unit="mg/mL" />
      <NumericField label="Vial size" value={formData.vialSizeMl} onChange={v => onUpdate({ vialSizeMl: v })} unit="mL" />
      <NumericField label="Vials in current supply" value={formData.oilVialsInSupply} onChange={v => onUpdate({ oilVialsInSupply: v })} />
      <CalcDisplay lines={calcLines} accentColor={accentColor} />
      <div className="flex items-center justify-between">
        <label className="text-xs text-muted-foreground">Injection site rotation</label>
        <button
          type="button"
          onClick={() => onUpdate({ injectionSiteRotation: !formData.injectionSiteRotation })}
          className={`w-10 h-5 rounded-full transition-colors duration-200 ${formData.injectionSiteRotation ? '' : 'bg-muted'}`}
          style={formData.injectionSiteRotation ? { backgroundColor: `hsl(${accentColor})` } : {}}
        >
          <div className={`w-4 h-4 rounded-full bg-foreground transition-transform duration-200 ${formData.injectionSiteRotation ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>
      <TextField label="Carrier oil" value={formData.carrierOil} onChange={v => onUpdate({ carrierOil: v })} placeholder="e.g. Grapeseed, MCT, Cottonseed" />
      <TextField label="Notes" value={formData.notes} onChange={v => onUpdate({ notes: v })} placeholder="e.g. Warm vial before drawing" multiline />
    </div>
  );
}

// ─── Oral Pill Configuration ─────────────────────────────────────────────────

function OralPillConfig({ formData, onUpdate, accentColor }: { formData: WizardFormData; onUpdate: (d: Partial<WizardFormData>) => void; accentColor: string }) {
  const dosePerUnit = parseFloat(formData.doseAmountPerUnit) || 0;
  const unitsPerDose = parseFloat(formData.unitsPerDose) || 1;
  const countPerContainer = parseFloat(formData.countPerContainer) || 0;
  const containers = parseFloat(formData.containersInSupply) || 1;

  const calcLines: string[] = [];
  if (dosePerUnit > 0) {
    calcLines.push(`Each dose = ${(dosePerUnit * unitsPerDose).toLocaleString()} ${formData.doseAmountPerUnitUnit} total`);
  }
  if (countPerContainer > 0 && unitsPerDose > 0) {
    const dosesPerContainer = Math.floor(countPerContainer / unitsPerDose);
    calcLines.push(`Each container = ${dosesPerContainer} doses`);
    calcLines.push(`Total supply = ${dosesPerContainer * containers} doses`);
  }

  return (
    <div className="space-y-4">
      <SelectField label="Form factor" value={formData.formFactor} onChange={v => onUpdate({ formFactor: v })} options={['Capsule', 'Tablet', 'Softgel', 'Sublingual', 'Enteric Coated', 'Chewable']} />
      <SelectField label="Container type" value={formData.containerType} onChange={v => onUpdate({ containerType: v })} options={['Bottle', 'Blister Pack', 'Box', 'Bag', 'Other']} />
      <NumericField label="Count per container" value={formData.countPerContainer} onChange={v => onUpdate({ countPerContainer: v })} placeholder="e.g. 90" />
      <NumericField label="Containers in current supply" value={formData.containersInSupply} onChange={v => onUpdate({ containersInSupply: v })} />
      <NumericField label="Dose amount per unit" value={formData.doseAmountPerUnit} onChange={v => onUpdate({ doseAmountPerUnit: v })} unitOptions={['mg', 'mcg', 'IU', 'g']} unit={formData.doseAmountPerUnitUnit} onUnitChange={v => onUpdate({ doseAmountPerUnitUnit: v })} />
      <NumericField label="Units per dose" value={formData.unitsPerDose} onChange={v => onUpdate({ unitsPerDose: v })} placeholder="e.g. 2" />
      <CalcDisplay lines={calcLines} accentColor={accentColor} />
      <SelectField label="Take with food" value={formData.takeWithFood} onChange={v => onUpdate({ takeWithFood: v })} options={['With Food', 'Without Food', 'Either']} />
      <TextField label="Notes" value={formData.notes} onChange={v => onUpdate({ notes: v })} placeholder="e.g. Take with fat for absorption" multiline />
    </div>
  );
}

// ─── Oral Powder Configuration ───────────────────────────────────────────────

function OralPowderConfig({ formData, onUpdate, accentColor }: { formData: WizardFormData; onUpdate: (d: Partial<WizardFormData>) => void; accentColor: string }) {
  const containerSize = parseFloat(formData.containerSize) || 0;
  const doseWeight = parseFloat(formData.doseWeightPerServing) || 0;
  const containers = parseFloat(formData.powderContainersInSupply) || 1;

  const calcLines: string[] = [];
  if (containerSize > 0 && doseWeight > 0) {
    // Normalize to same units
    let containerG = containerSize;
    if (formData.containerSizeUnit === 'kg') containerG = containerSize * 1000;
    let doseG = doseWeight;
    if (formData.doseWeightUnit === 'mg') doseG = doseWeight / 1000;
    if (containerG > 0 && doseG > 0) {
      const dosesPerContainer = Math.floor(containerG / doseG);
      calcLines.push(`Doses per container: ${dosesPerContainer}`);
      calcLines.push(`Total doses in supply: ${dosesPerContainer * containers}`);
    }
  }

  return (
    <div className="space-y-4">
      <NumericField label="Container size" value={formData.containerSize} onChange={v => onUpdate({ containerSize: v })} unitOptions={['g', 'kg']} unit={formData.containerSizeUnit} onUnitChange={v => onUpdate({ containerSizeUnit: v })} />
      <NumericField label="Containers in current supply" value={formData.powderContainersInSupply} onChange={v => onUpdate({ powderContainersInSupply: v })} />
      <NumericField label="Dose weight per serving" value={formData.doseWeightPerServing} onChange={v => onUpdate({ doseWeightPerServing: v })} unitOptions={['mg', 'g']} unit={formData.doseWeightUnit} onUnitChange={v => onUpdate({ doseWeightUnit: v })} />
      <SelectField label="Measuring method" value={formData.measuringMethod} onChange={v => onUpdate({ measuringMethod: v })} options={['Digital Scale', 'Scoop']} />
      {formData.measuringMethod === 'Scoop' && (
        <>
          <NumericField label="Scoop size" value={formData.scoopSize} onChange={v => onUpdate({ scoopSize: v })} unitOptions={['mL', 'g', 'cc']} unit={formData.scoopSizeUnit} onUnitChange={v => onUpdate({ scoopSizeUnit: v })} />
          <NumericField label="Scoops per dose" value={formData.scoopCountPerDose} onChange={v => onUpdate({ scoopCountPerDose: v })} />
        </>
      )}
      <CalcDisplay lines={calcLines} accentColor={accentColor} />
      <TextField label="Mix instructions" value={formData.mixInstructions} onChange={v => onUpdate({ mixInstructions: v })} placeholder="e.g. Mix in 250mL cold water, stir well" />
      <SelectField label="Take with food" value={formData.powderTakeWithFood} onChange={v => onUpdate({ powderTakeWithFood: v })} options={['With Food', 'Without Food', 'Either']} />
      <TextField label="Notes" value={formData.notes} onChange={v => onUpdate({ notes: v })} multiline />
    </div>
  );
}

// ─── Topical Configuration ───────────────────────────────────────────────────

function TopicalConfig({ formData, onUpdate, accentColor }: { formData: WizardFormData; onUpdate: (d: Partial<WizardFormData>) => void; accentColor: string }) {
  const containerSize = parseFloat(formData.topicalContainerSize) || 0;
  const dosePerApp = parseFloat(formData.dosePerApplication) || 1;
  const containers = parseFloat(formData.topicalContainersInSupply) || 1;
  const dosesPerContainer = parseFloat(formData.dosesPerContainer) || 0;
  const dosesPerDay = parseFloat(formData.dosesPerDay) || 1;

  const calcLines: string[] = [];
  if (dosesPerContainer > 0) {
    calcLines.push(`Applications per container: ${dosesPerContainer}`);
    if (dosesPerDay > 0) {
      const daysSupply = Math.floor((dosesPerContainer * containers) / dosesPerDay);
      calcLines.push(`Days of supply: ${daysSupply} (at ${dosesPerDay} applications/day)`);
    }
  }

  return (
    <div className="space-y-4">
      <SelectField label="Form" value={formData.topicalForm} onChange={v => onUpdate({ topicalForm: v })} options={['Cream', 'Gel', 'Oil', 'Patch', 'Spray', 'Serum']} />
      <NumericField label="Container size" value={formData.topicalContainerSize} onChange={v => onUpdate({ topicalContainerSize: v })} unitOptions={['mL', 'g', 'oz']} unit={formData.topicalContainerSizeUnit} onUnitChange={v => onUpdate({ topicalContainerSizeUnit: v })} />
      <NumericField label="Containers in current supply" value={formData.topicalContainersInSupply} onChange={v => onUpdate({ topicalContainersInSupply: v })} />
      <SelectField label="Application unit" value={formData.applicationUnit} onChange={v => onUpdate({ applicationUnit: v })} options={['Pump', 'Gram', 'Fingertip Unit', 'Drop', 'Patch', 'Spray']} />
      <NumericField label={`${formData.applicationUnit}s per dose`} value={formData.dosePerApplication} onChange={v => onUpdate({ dosePerApplication: v })} />
      <NumericField label="Doses per container" value={formData.dosesPerContainer} onChange={v => onUpdate({ dosesPerContainer: v })} placeholder="e.g. 60" />
      <CalcDisplay lines={calcLines} accentColor={accentColor} />
      <TextField label="Application site" value={formData.applicationSite} onChange={v => onUpdate({ applicationSite: v })} placeholder="e.g. Inner wrist, rotate daily" />
      <TextField label="Absorption window" value={formData.absorptionWindow} onChange={v => onUpdate({ absorptionWindow: v })} placeholder="e.g. Allow 10 min before clothing contact" />
      <TextField label="Notes" value={formData.notes} onChange={v => onUpdate({ notes: v })} multiline />
    </div>
  );
}

// ─── Prescription Configuration ──────────────────────────────────────────────

function PrescriptionConfig({ formData, onUpdate, accentColor }: { formData: WizardFormData; onUpdate: (d: Partial<WizardFormData>) => void; accentColor: string }) {
  const renderFormFields = () => {
    if (formData.prescriptionForm === 'Injectable') return <OilConfig formData={formData} onUpdate={onUpdate} accentColor={accentColor} />;
    if (formData.prescriptionForm === 'Topical') return <TopicalConfig formData={formData} onUpdate={onUpdate} accentColor={accentColor} />;
    return <OralPillConfig formData={formData} onUpdate={onUpdate} accentColor={accentColor} />;
  };

  return (
    <div className="space-y-4">
      <SelectField label="Prescription form" value={formData.prescriptionForm} onChange={v => onUpdate({ prescriptionForm: v })} options={['Pill/Capsule', 'Injectable', 'Topical', 'Other']} />
      {renderFormFields()}
      <div className="border-t border-border/30 pt-4 space-y-4">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Prescription Details</p>
        <TextField label="Prescriber" value={formData.prescriber} onChange={v => onUpdate({ prescriber: v })} />
        <TextField label="Pharmacy" value={formData.pharmacy} onChange={v => onUpdate({ pharmacy: v })} />
        <TextField label="Rx number" value={formData.rxNumber} onChange={v => onUpdate({ rxNumber: v })} />
        <NumericField label="Days supply per fill" value={formData.daysSupplyPerFill} onChange={v => onUpdate({ daysSupplyPerFill: v })} />
        <div className="flex items-center justify-between">
          <label className="text-xs text-muted-foreground">Controlled substance</label>
          <button
            type="button"
            onClick={() => onUpdate({ controlledSubstance: !formData.controlledSubstance })}
            className={`w-10 h-5 rounded-full transition-colors duration-200 ${formData.controlledSubstance ? '' : 'bg-muted'}`}
            style={formData.controlledSubstance ? { backgroundColor: `hsl(${accentColor})` } : {}}
          >
            <div className={`w-4 h-4 rounded-full bg-foreground transition-transform duration-200 ${formData.controlledSubstance ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
        <TextField label="Insurance notes" value={formData.insuranceNotes} onChange={v => onUpdate({ insuranceNotes: v })} />
      </div>
    </div>
  );
}

// ─── Main Step 2 Component ───────────────────────────────────────────────────

const STEP_TITLES: Record<CompoundType, string> = {
  'lyophilized-peptide': 'Reconstitution Setup',
  'injectable-oil': 'Vial Configuration',
  'oral-pill': 'Container Setup',
  'oral-powder': 'Powder Setup',
  'topical': 'Application Setup',
  'prescription': 'Prescription Details',
};

export default function StepConfiguration({ formData, onUpdate, onNext, onBack, accentColor }: StepConfigurationProps) {
  const type = formData.compoundType || 'oral-pill';
  const title = STEP_TITLES[type];

  const renderConfig = () => {
    switch (type) {
      case 'lyophilized-peptide': return <PeptideConfig formData={formData} onUpdate={onUpdate} accentColor={accentColor} />;
      case 'injectable-oil': return <OilConfig formData={formData} onUpdate={onUpdate} accentColor={accentColor} />;
      case 'oral-pill': return <OralPillConfig formData={formData} onUpdate={onUpdate} accentColor={accentColor} />;
      case 'oral-powder': return <OralPowderConfig formData={formData} onUpdate={onUpdate} accentColor={accentColor} />;
      case 'topical': return <TopicalConfig formData={formData} onUpdate={onUpdate} accentColor={accentColor} />;
      case 'prescription': return <PrescriptionConfig formData={formData} onUpdate={onUpdate} accentColor={accentColor} />;
    }
  };

  return (
    <div className="space-y-5 px-4 pb-6">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {renderConfig()}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack} className="flex-1 py-3 rounded-xl text-sm font-medium text-muted-foreground border border-border/50 hover:bg-secondary transition-colors">
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all duration-200"
          style={{ backgroundColor: `hsl(${accentColor})`, color: 'hsl(var(--background))' }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
