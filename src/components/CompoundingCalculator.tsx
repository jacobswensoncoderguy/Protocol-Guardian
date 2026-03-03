import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calculator, FlaskConical, ArrowLeftRight, Scale } from 'lucide-react';

type Tab = 'weight' | 'dilution' | 'convert';

interface CalculatorResult {
  weightPerUnit?: number;
  weightUnit?: string;
  concentration?: number;
  concentrationUnit?: string;
  doseVolumeMl?: number;
  solventType?: string;
  solventVolume?: number;
}

interface CompoundingCalculatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply?: (result: CalculatorResult) => void;
}

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'weight', label: 'Weight/Dose', icon: <Scale className="w-3.5 h-3.5" /> },
  { id: 'dilution', label: 'Dilution', icon: <FlaskConical className="w-3.5 h-3.5" /> },
  { id: 'convert', label: 'Convert', icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
];

const INP = "w-full bg-secondary border border-border/50 rounded px-2 py-1.5 text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/50";
const SEL = "bg-secondary border border-border/50 rounded px-1.5 py-1.5 text-foreground font-mono text-[10px] focus:outline-none focus:ring-1 focus:ring-primary/50 min-w-[52px]";

const CompoundingCalculator = ({ open, onOpenChange, onApply }: CompoundingCalculatorProps) => {
  const [tab, setTab] = useState<Tab>('weight');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Calculator className="w-4 h-4 text-primary" />
            Compounding Calculator
          </DialogTitle>
        </DialogHeader>
        <div className="flex border-b border-border/50 px-2">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium transition-all border-b-2 ${
                tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
        <div className="px-4 pb-4">
          {tab === 'weight' && <WeightPerDoseTab onApply={onApply} onClose={() => onOpenChange(false)} />}
          {tab === 'dilution' && <DilutionTab onApply={onApply} onClose={() => onOpenChange(false)} />}
          {tab === 'convert' && <ConvertTab />}
        </div>
      </DialogContent>
    </Dialog>
  );
};

function WeightPerDoseTab({ onApply, onClose }: { onApply?: (r: CalculatorResult) => void; onClose: () => void }) {
  const [totalWeight, setTotalWeight] = useState('');
  const [totalUnit, setTotalUnit] = useState<'mg' | 'g' | 'oz'>('g');
  const [count, setCount] = useState('');
  const [countUnit, setCountUnit] = useState('caps');

  const result = useMemo(() => {
    const tw = parseFloat(totalWeight); const c = parseFloat(count);
    if (!tw || !c || c <= 0) return null;
    let totalMg = tw;
    if (totalUnit === 'g') totalMg = tw * 1000;
    else if (totalUnit === 'oz') totalMg = tw * 28349.5;
    const perUnitMg = totalMg / c;
    return { perUnitMg, displayValue: perUnitMg >= 1000 ? perUnitMg / 1000 : perUnitMg, displayUnit: perUnitMg >= 1000 ? 'g' : 'mg' };
  }, [totalWeight, totalUnit, count]);

  return (
    <div className="space-y-3 pt-2">
      <p className="text-[10px] text-muted-foreground">Enter total container weight and number of units to calculate weight per individual pill, cap, or drop.</p>
      <CalcRow label="Total Weight">
        <input type="number" value={totalWeight} onChange={e => setTotalWeight(e.target.value)} placeholder="e.g. 1" className={`${INP} flex-1`} />
        <select value={totalUnit} onChange={e => setTotalUnit(e.target.value as any)} className={SEL}>
          <option value="mg">mg</option><option value="g">g</option><option value="oz">oz</option>
        </select>
      </CalcRow>
      <CalcRow label="# of Units">
        <input type="number" value={count} onChange={e => setCount(e.target.value)} placeholder="e.g. 60" className={`${INP} flex-1`} />
        <select value={countUnit} onChange={e => setCountUnit(e.target.value)} className={SEL}>
          {['caps','tabs','pills','drops','scoops','softgels','servings','spray','patch'].map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </CalcRow>
      {result && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Weight per {countUnit.replace(/s$/, '')}</p>
          <p className="text-lg font-bold text-primary font-mono">
            {result.displayValue < 0.01 ? result.perUnitMg.toFixed(4) : Math.round(result.displayValue * 100) / 100} {result.displayUnit}
          </p>
          {onApply && (
            <button onClick={() => { onApply({ weightPerUnit: result.perUnitMg, weightUnit: 'mg' }); onClose(); }}
              className="mt-2 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold">
              Apply to Compound
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function DilutionTab({ onApply, onClose }: { onApply?: (r: CalculatorResult) => void; onClose: () => void }) {
  const [powderAmount, setPowderAmount] = useState('');
  const [powderUnit, setPowderUnit] = useState<'mg' | 'g'>('mg');
  const [solventVol, setSolventVol] = useState('');
  const [solventType, setSolventType] = useState('Bacteriostatic Water');
  const [doseAmount, setDoseAmount] = useState('');
  const [doseUnit, setDoseUnit] = useState<'mg' | 'mcg'>('mg');

  const result = useMemo(() => {
    const pw = parseFloat(powderAmount); const sv = parseFloat(solventVol);
    if (!pw || !sv || sv <= 0) return null;
    const powderMg = powderUnit === 'g' ? pw * 1000 : pw;
    const concMgPerMl = powderMg / sv;
    const da = parseFloat(doseAmount);
    let doseVolMl: number | null = null;
    if (da && da > 0) { const doseMg = doseUnit === 'mcg' ? da / 1000 : da; doseVolMl = doseMg / concMgPerMl; }
    return { concMgPerMl, doseVolMl };
  }, [powderAmount, powderUnit, solventVol, doseAmount, doseUnit]);

  return (
    <div className="space-y-3 pt-2">
      <p className="text-[10px] text-muted-foreground">Calculate concentration after reconstitution and the volume needed per dose.</p>
      <CalcRow label="Powder">
        <input type="number" value={powderAmount} onChange={e => setPowderAmount(e.target.value)} placeholder="e.g. 5" className={`${INP} flex-1`} />
        <select value={powderUnit} onChange={e => setPowderUnit(e.target.value as any)} className={SEL}>
          <option value="mg">mg</option><option value="g">g</option>
        </select>
      </CalcRow>
      <CalcRow label="Solvent">
        <input type="number" value={solventVol} onChange={e => setSolventVol(e.target.value)} placeholder="e.g. 2" className={`${INP} flex-1`} />
        <span className="text-muted-foreground text-[10px]">mL</span>
      </CalcRow>
      <CalcRow label="Solvent Type">
        <select value={solventType} onChange={e => setSolventType(e.target.value)} className={`${INP} text-[11px]`}>
          <option>Bacteriostatic Water</option><option>Sterile Water</option><option>RO Water</option><option>Saline</option><option>Other</option>
        </select>
      </CalcRow>
      <CalcRow label="Dose">
        <input type="number" value={doseAmount} onChange={e => setDoseAmount(e.target.value)} placeholder="optional" className={`${INP} flex-1`} />
        <select value={doseUnit} onChange={e => setDoseUnit(e.target.value as any)} className={SEL}>
          <option value="mg">mg</option><option value="mcg">mcg</option>
        </select>
      </CalcRow>
      {result && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1.5 text-center">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Concentration</p>
            <p className="text-lg font-bold text-primary font-mono">{Math.round(result.concMgPerMl * 1000) / 1000} mg/mL</p>
          </div>
          {result.doseVolMl !== null && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Volume per dose</p>
              <p className="text-lg font-bold text-primary font-mono">{result.doseVolMl < 0.01 ? result.doseVolMl.toFixed(4) : Math.round(result.doseVolMl * 1000) / 1000} mL</p>
            </div>
          )}
          {onApply && (
            <button onClick={() => { onApply({ concentration: result.concMgPerMl, concentrationUnit: 'mg/mL', doseVolumeMl: result.doseVolMl ?? undefined, solventType, solventVolume: parseFloat(solventVol) }); onClose(); }}
              className="mt-2 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold">
              Apply to Compound
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ConvertTab() {
  const [value, setValue] = useState('');
  const [fromUnit, setFromUnit] = useState('mg');
  const [toUnit, setToUnit] = useState('mcg');

  const converted = useMemo(() => {
    const v = parseFloat(value);
    if (!v) return null;
    const toMg: Record<string, number> = { mg: 1, mcg: 0.001, g: 1000, kg: 1e6, oz: 28349.5, lb: 453592, mL: 1, IU: 1 };
    const fromFactor = toMg[fromUnit] ?? 1;
    const toFactor = toMg[toUnit] ?? 1;
    if (toFactor === 0) return null;
    return (v * fromFactor) / toFactor;
  }, [value, fromUnit, toUnit]);

  const units = ['mg', 'mcg', 'g', 'kg', 'oz', 'lb', 'mL', 'IU'];

  return (
    <div className="space-y-3 pt-2">
      <p className="text-[10px] text-muted-foreground">Convert between weight and volume units. Note: mL and IU conversions are 1:1 (compound-specific ratios may vary).</p>
      <CalcRow label="From">
        <input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="Enter value" className={`${INP} flex-1`} />
        <select value={fromUnit} onChange={e => setFromUnit(e.target.value)} className={SEL}>
          {units.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </CalcRow>
      <CalcRow label="To">
        <select value={toUnit} onChange={e => setToUnit(e.target.value)} className={INP}>
          {units.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </CalcRow>
      {converted !== null && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Result</p>
          <p className="text-lg font-bold text-primary font-mono">
            {converted < 0.0001 ? converted.toExponential(3) : converted >= 1e6 ? converted.toExponential(3) : Math.round(converted * 10000) / 10000} {toUnit}
          </p>
        </div>
      )}
    </div>
  );
}

function CalcRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="text-muted-foreground w-20 flex-shrink-0 text-right font-medium">{label}</span>
      <div className="flex items-center gap-1 flex-1">{children}</div>
    </div>
  );
}

export default CompoundingCalculator;
export type { CalculatorResult };
