/**
 * CompoundEditWizard — Clinical Sheet (Single Scroll)
 * Full-screen bottom sheet, continuous scroll, colored section accents,
 * sticky header with Protocol Health pill, auto-save on edits.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Compound, CompoundCategory } from '@/data/compounds';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import DatePickerInput from '@/components/DatePickerInput';
import {
  Check, AlertTriangle, X, ChevronUp,
  Syringe, Pill, FlaskConical, Droplets, ClipboardList,
  Zap, Heart, Brain, Shield, Leaf, Microscope,
  Tag, Calendar, Package, Crosshair, RefreshCw,
} from 'lucide-react';

// ─── Types & Constants ───────────────────────────────────────────────────────

type SectionKey = 'identity' | 'schedule' | 'supply' | 'dosing' | 'cycling';

interface CriticalError {
  section: SectionKey;
  field: string;
  message: string;
}

const SECTION_META: { key: SectionKey; label: string; icon: typeof Tag; accent: string }[] = [
  { key: 'identity', label: 'Identity',  icon: Tag,       accent: '#00C2FF' },
  { key: 'schedule', label: 'Schedule',  icon: Calendar,  accent: '#7C6FF7' },
  { key: 'supply',   label: 'Supply',    icon: Package,   accent: '#F59E0B' },
  { key: 'dosing',   label: 'Dosing',    icon: Crosshair, accent: '#10B981' },
  { key: 'cycling',  label: 'Cycling',   icon: RefreshCw, accent: '#F97316' },
];

const CATEGORY_META: Record<string, { label: string; icon: typeof Pill }> = {
  peptide:              { label: 'Peptides',     icon: Syringe },
  'injectable-oil':     { label: 'Injectable Oils', icon: Syringe },
  oral:                 { label: 'Oral',         icon: Pill },
  powder:               { label: 'Powders',      icon: FlaskConical },
  prescription:         { label: 'Prescription', icon: ClipboardList },
  vitamin:              { label: 'Vitamins',     icon: Zap },
  holistic:             { label: 'Holistic',     icon: Leaf },
  adaptogen:            { label: 'Adaptogens',   icon: Shield },
  nootropic:            { label: 'Nootropics',   icon: Brain },
  'essential-oil':      { label: 'Essential Oils', icon: Droplets },
  'alternative-medicine': { label: 'Alt. Medicine', icon: Heart },
  probiotic:            { label: 'Probiotics',   icon: Microscope },
  topical:              { label: 'Topical',      icon: Droplets },
};

const CATEGORY_ORDER: string[] = ['peptide', 'injectable-oil', 'prescription', 'oral', 'powder', 'vitamin', 'holistic', 'adaptogen', 'nootropic', 'essential-oil', 'alternative-medicine', 'probiotic', 'topical'];
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const TIMING_OPTIONS = [
  { id: 'morning', label: 'AM' },
  { id: 'evening', label: 'PM' },
  { id: 'midday', label: 'Midday' },
  { id: 'pre-workout', label: 'Pre-WO' },
  { id: 'pre-sleep', label: 'Pre-Sleep' },
  { id: 'with-meal', label: 'W/ Meal' },
  { id: 'fasted', label: 'Fasted' },
];

const timingIdToKeyword: Record<string, string> = {
  morning: 'morning', evening: 'evening', midday: 'midday',
  'pre-workout': 'pre-workout', 'pre-sleep': 'pre-sleep',
  'with-meal': 'with meal', fasted: 'fasted',
};

// ─── Timing/Day parsers ─────────────────────────────────────────────────────

function parseDaysFromNote(note: string, daysPerWeek?: number): Set<number> {
  const lower = note.toLowerCase();
  const days = new Set<number>();
  if (/\bdaily\b|\bnightl?y?\b|\bevery\s*day\b/i.test(lower)) { [0,1,2,3,4,5,6].forEach(i => days.add(i)); return days; }
  const patterns: [RegExp, number[]][] = [[/\bm[\/-]f\b|mon[\s-]*fri/i, [1,2,3,4,5]], [/\bm\/w\/f\b/i, [1,3,5]], [/\bt\/th\b/i, [2,4]]];
  for (const [pat, idxs] of patterns) { if (pat.test(note)) idxs.forEach(i => days.add(i)); }
  const dayMap: Record<string, number> = { su: 0, sun: 0, mo: 1, mon: 1, tu: 2, tue: 2, tues: 2, we: 3, wed: 3, th: 4, thu: 4, thurs: 4, fr: 5, fri: 5, sa: 6, sat: 6 };
  const matches = lower.match(/\b(su(?:n)?|mo(?:n)?|tu(?:e(?:s)?)?|we(?:d)?|th(?:u(?:rs)?)?|fr(?:i)?|sa(?:t)?)\b/gi);
  if (matches) matches.forEach(m => { const i = dayMap[m.toLowerCase()]; if (i !== undefined) days.add(i); });
  if (days.size === 0 && (daysPerWeek ?? 0) === 7) [0,1,2,3,4,5,6].forEach(i => days.add(i));
  return days;
}

function parseTimingsFromNote(note: string): Set<string> {
  const lower = note.toLowerCase();
  const timings = new Set<string>();
  if (/\b(morning|am)\b/.test(lower)) timings.add('morning');
  if (/\b(evening|pm|nightl?y?|night)\b/.test(lower)) timings.add('evening');
  if (/\b(midday|noon)\b/.test(lower)) timings.add('midday');
  if (/\b(pre[- ]?workout)\b/.test(lower)) timings.add('pre-workout');
  if (/\b(pre[- ]?sleep|bedtime)\b/.test(lower)) timings.add('pre-sleep');
  if (/\b(with[- ]?meal|with food)\b/.test(lower)) timings.add('with-meal');
  if (/\b(fasted|empty stomach)\b/.test(lower)) timings.add('fasted');
  return timings;
}

function buildDayString(days: Set<number>, timings?: Set<string>): string {
  const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  let dayPart = '';
  if (days.size === 7) dayPart = 'daily';
  else if (days.size === 0) dayPart = '';
  else {
    const sorted = Array.from(days).sort();
    if (sorted.join(',') === '1,2,3,4,5') dayPart = 'M-F';
    else if (sorted.join(',') === '1,3,5') dayPart = 'M/W/F';
    else if (sorted.join(',') === '2,4') dayPart = 'T/Th';
    else dayPart = sorted.map(d => DAY_KEYS[d]).join('/');
  }
  const timingPart = timings && timings.size > 0
    ? Array.from(timings).map(t => timingIdToKeyword[t] || t).join(', ')
    : '';
  return [dayPart, timingPart].filter(Boolean).join(' ');
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface CompoundEditWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compound: Compound;
  editState: Record<string, string>;
  setEditState: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSave: () => void;
  isPeptide: boolean;
  isOil: boolean;
}

// ─── Field Component ─────────────────────────────────────────────────────────

function ClinicalField({
  label, value, onChange, type = 'text', placeholder, error, suffix, className = '',
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; error?: string; suffix?: string; className?: string;
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label
        className="text-[11px] uppercase tracking-[0.08em] font-medium block"
        style={{ color: error ? '#FF3B3B' : '#6B7280' }}
      >
        {label}
      </label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || `Enter ${label.toLowerCase()}`}
          className="w-full px-3 py-2 rounded-lg text-[15px] font-medium transition-colors duration-200"
          style={{
            background: '#1C1F26',
            color: '#F0F4F8',
            border: error ? '1.5px solid #FF3B3B' : '1px solid #2A2D35',
            borderBottom: error ? '2px solid #FF3B3B' : undefined,
            fontFamily: type === 'number' ? "'DM Mono', monospace" : "'DM Sans', sans-serif",
          }}
          onFocus={e => { e.target.style.borderColor = '#00C2FF'; }}
          onBlur={e => { e.target.style.borderColor = error ? '#FF3B3B' : '#2A2D35'; }}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px]" style={{ color: '#6B7280', fontFamily: "'DM Mono', monospace" }}>
            {suffix}
          </span>
        )}
      </div>
      {error && (
        <p className="text-[11px] leading-tight" style={{ color: '#FF3B3B' }}>{error}</p>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

const TOTAL_CRITICAL_FIELDS = 10;

export default function CompoundEditWizard({
  open, onOpenChange, compound, editState, setEditState, onSave, isPeptide, isOil,
}: CompoundEditWizardProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const fieldRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [errorCycleIdx, setErrorCycleIdx] = useState(0);


  // ─── Critical field validation ─────────────────────────────────────────────

  const criticalErrors = useMemo((): CriticalError[] => {
    const errors: CriticalError[] = [];
    if (!(editState.name || '').trim())
      errors.push({ section: 'identity', field: 'name', message: 'Required to identify this compound in your protocol' });
    const dpw = parseInt(editState.daysPerWeek || '0');
    if (isNaN(dpw) || dpw <= 0)
      errors.push({ section: 'schedule', field: 'daysPerWeek', message: 'Required to calculate how many days of supply remain' });
    const dpd = parseInt(editState.dosesPerDay || '0');
    if (isNaN(dpd) || dpd <= 0)
      errors.push({ section: 'schedule', field: 'dosesPerDay', message: 'Required to calculate daily consumption rate' });
    const qty = parseFloat(editState.currentQuantity || '');
    if (isNaN(qty) || qty < 0)
      errors.push({ section: 'supply', field: 'currentQuantity', message: 'Required to calculate how many days of supply remain' });
    const size = parseFloat(editState.unitSize || '');
    if (isNaN(size) || size <= 0)
      errors.push({ section: 'supply', field: 'unitSize', message: 'Required to determine container capacity and depletion rate' });
     const wpu = parseFloat(editState.weightPerUnit || '');
    if (isNaN(wpu) || wpu <= 0)
      errors.push({ section: 'dosing', field: 'weightPerUnit', message: 'Depletion countdown won\'t work without this — needed to convert dose units to container units' });
    const dose = parseFloat(editState.dosePerUse || '');
    if (isNaN(dose) || dose <= 0)
      errors.push({ section: 'dosing', field: 'dosePerUse', message: 'Required to calculate consumption and supply duration' });
    if (editState.cyclingEnabled === 'true') {
      const on = parseInt(editState.cycleOnDays || '');
      const off = parseInt(editState.cycleOffDays || '');
      if (isNaN(on) || on <= 0)
        errors.push({ section: 'cycling', field: 'cycleOnDays', message: 'Required to calculate your active cycle phase duration' });
      if (isNaN(off) || off <= 0)
        errors.push({ section: 'cycling', field: 'cycleOffDays', message: 'Required to calculate your rest phase duration' });
    }
    return errors;
  }, [editState]);

  const fieldError = useCallback((field: string) => criticalErrors.find(e => e.field === field)?.message, [criticalErrors]);
  const canSave = criticalErrors.length === 0;
  const completedFields = TOTAL_CRITICAL_FIELDS - criticalErrors.length;

  // ─── Scroll to error ──────────────────────────────────────────────────────

  const scrollToError = useCallback(() => {
    if (criticalErrors.length === 0) return;
    const idx = errorCycleIdx % criticalErrors.length;
    const err = criticalErrors[idx];
    const el = fieldRefs.current.get(err.field);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('clinical-pulse');
      setTimeout(() => el.classList.remove('clinical-pulse'), 1200);
    }
    setErrorCycleIdx(idx + 1);
  }, [criticalErrors, errorCycleIdx]);

  // Reset cycle on open
  useEffect(() => { if (open) setErrorCycleIdx(0); }, [open]);

  // ─── Day/timing helpers ────────────────────────────────────────────────────

  const toggleDay = (idx: number) => {
    const current = parseDaysFromNote(editState.timing || '', parseInt(editState.daysPerWeek || '7'));
    const currentTimings = parseTimingsFromNote(editState.timing || '');
    if (current.has(idx)) current.delete(idx); else current.add(idx);
    setEditState(s => ({ ...s, timing: buildDayString(current, currentTimings), daysPerWeek: current.size.toString() }));
  };

  const toggleTiming = (id: string) => {
    const currentDays = parseDaysFromNote(editState.timing || '', parseInt(editState.daysPerWeek || '7'));
    const currentTimings = parseTimingsFromNote(editState.timing || '');
    if (currentTimings.has(id)) currentTimings.delete(id); else currentTimings.add(id);
    setEditState(s => ({ ...s, timing: buildDayString(currentDays, currentTimings) }));
  };

  const activeDaySet = useMemo(() => parseDaysFromNote(editState.timing || '', parseInt(editState.daysPerWeek || '7')), [editState.timing, editState.daysPerWeek]);
  const activeTimings = useMemo(() => parseTimingsFromNote(editState.timing || ''), [editState.timing]);

  // ─── Supply calc ──────────────────────────────────────────────────────────

  const supplyDaysCalc = useMemo(() => {
    const dose = parseFloat(editState.dosePerUse || '0');
    const size = parseFloat(editState.unitSize || '0');
    const dpd = parseInt(editState.dosesPerDay || '1');
    if (dose <= 0 || size <= 0 || dpd <= 0) return null;
    const cat = editState.category || compound.category;
    let dosesPerUnit: number;
    if (cat === 'peptide' || cat === 'injectable-oil') {
      const vialMl = parseFloat(editState.vialSizeMl || '10');
      dosesPerUnit = cat === 'injectable-oil' ? (size * vialMl) / dose : size / dose * 10;
    } else {
      dosesPerUnit = size / (dose > 0 ? dose : 1);
    }
    const dpw = parseInt(editState.daysPerWeek || '7');
    const dailyDoses = dpd * (dpw / 7);
    if (dailyDoses <= 0) return null;
    return Math.floor(dosesPerUnit / dailyDoses);
  }, [editState, compound.category]);

  // ─── Category badge ────────────────────────────────────────────────────────
  const catMeta = CATEGORY_META[editState.category || compound.category];

  // ─── Section renderers ─────────────────────────────────────────────────────

  const renderIdentity = () => (
    <div className="space-y-4">
      <div ref={el => { if (el) fieldRefs.current.set('name', el); }}>
        <label className="text-[11px] uppercase tracking-[0.08em] font-medium block mb-1" style={{ color: fieldError('name') ? '#FF3B3B' : '#6B7280' }}>
          Compound Name
        </label>
        <input
          type="text" value={editState.name || ''}
          onChange={e => setEditState(s => ({ ...s, name: e.target.value }))}
          placeholder="e.g. BPC-157"
          className="w-full px-3 py-3 rounded-lg transition-colors duration-200"
          style={{
            background: '#1C1F26', color: '#F0F4F8',
            border: fieldError('name') ? '1.5px solid #FF3B3B' : '1px solid #2A2D35',
            fontSize: '24px', fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
          }}
          onFocus={e => { e.target.style.borderColor = '#00C2FF'; }}
          onBlur={e => { e.target.style.borderColor = fieldError('name') ? '#FF3B3B' : '#2A2D35'; }}
        />
        {fieldError('name') && <p className="text-[11px] mt-1" style={{ color: '#FF3B3B' }}>{fieldError('name')}</p>}
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-[0.08em] font-medium block mb-2" style={{ color: '#6B7280' }}>Category</label>
        <div className="grid grid-cols-3 gap-1.5">
          {CATEGORY_ORDER.map(cat => {
            const meta = CATEGORY_META[cat];
            if (!meta) return null;
            const Icon = meta.icon;
            const selected = (editState.category || compound.category) === cat;
            return (
              <button key={cat} onClick={() => setEditState(s => ({ ...s, category: cat }))}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all duration-200 text-left"
                style={{
                  background: selected ? 'rgba(0,194,255,0.08)' : '#1C1F26',
                  border: selected ? '1.5px solid rgba(0,194,255,0.5)' : '1px solid #2A2D35',
                }}>
                <Icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} style={{ color: selected ? '#00C2FF' : '#6B7280' }} />
                <span className="text-[10px] font-medium truncate" style={{ color: selected ? '#F0F4F8' : '#6B7280' }}>{meta.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ background: '#1C1F26', border: '1px solid #2A2D35' }}>
        <span className="text-[11px] uppercase tracking-[0.08em] font-medium" style={{ color: '#6B7280' }}>Status</span>
        <button
          onClick={() => {
            const isDormant = (editState.notes || '').includes('[DORMANT]');
            if (isDormant) setEditState(s => ({ ...s, notes: (s.notes || '').replace('[DORMANT]', '').trim() }));
            else setEditState(s => ({ ...s, notes: `[DORMANT] ${s.notes || ''}`.trim() }));
          }}
          className="px-3 py-1 rounded-full text-[11px] font-medium transition-all"
          style={{
            background: (editState.notes || '').includes('[DORMANT]') ? 'rgba(107,114,128,0.15)' : 'rgba(52,211,153,0.12)',
            color: (editState.notes || '').includes('[DORMANT]') ? '#6B7280' : '#34D399',
            border: `1px solid ${(editState.notes || '').includes('[DORMANT]') ? '#2A2D35' : 'rgba(52,211,153,0.3)'}`,
          }}
        >
          {(editState.notes || '').includes('[DORMANT]') ? 'Inactive' : 'Active'}
        </button>
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-[0.08em] font-medium block mb-1" style={{ color: '#6B7280' }}>Notes</label>
        <textarea
          value={(editState.notes || '').replace('[DORMANT]', '').trim()}
          onChange={e => {
            const isDormant = (editState.notes || '').includes('[DORMANT]');
            setEditState(s => ({ ...s, notes: isDormant ? `[DORMANT] ${e.target.value}` : e.target.value }));
          }}
          rows={2} placeholder="Usage notes, supplier info, etc."
          className="w-full px-3 py-2 rounded-lg text-[13px] resize-none"
          style={{ background: '#1C1F26', color: '#F0F4F8', border: '1px solid #2A2D35' }}
        />
      </div>
    </div>
  );

  const renderSchedule = () => (
    <div className="space-y-4">
      <div ref={el => { if (el) fieldRefs.current.set('daysPerWeek', el); }}>
        <label className="text-[11px] uppercase tracking-[0.08em] font-medium block mb-2" style={{ color: fieldError('daysPerWeek') ? '#FF3B3B' : '#6B7280' }}>Days of Week</label>
        <div className="flex gap-1.5">
          {DAY_LABELS.map((lbl, idx) => {
            const isActive = activeDaySet.has(idx);
            return (
              <button key={idx} onClick={() => toggleDay(idx)}
                className="flex-1 py-2.5 rounded-lg text-[12px] font-semibold transition-all duration-200"
                style={{
                  background: isActive ? 'rgba(124,111,247,0.12)' : '#1C1F26',
                  color: isActive ? '#7C6FF7' : '#6B7280',
                  border: isActive ? '1.5px solid rgba(124,111,247,0.4)' : '1px solid #2A2D35',
                }}>
                {lbl}
              </button>
            );
          })}
        </div>
        {fieldError('daysPerWeek') && <p className="text-[11px] mt-1" style={{ color: '#FF3B3B' }}>{fieldError('daysPerWeek')}</p>}
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-[0.08em] font-medium block mb-2" style={{ color: '#6B7280' }}>Time of Day</label>
        <div className="flex flex-wrap gap-1.5">
          {TIMING_OPTIONS.map(opt => {
            const isSelected = activeTimings.has(opt.id);
            return (
              <button key={opt.id} onClick={() => toggleTiming(opt.id)}
                className="px-3 py-2 rounded-lg text-[11px] font-medium transition-all duration-200"
                style={{
                  background: isSelected ? 'rgba(124,111,247,0.12)' : '#1C1F26',
                  color: isSelected ? '#7C6FF7' : '#6B7280',
                  border: isSelected ? '1.5px solid rgba(124,111,247,0.4)' : '1px solid #2A2D35',
                }}>
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <ClinicalField label="Timing Note" value={editState.timing || ''} onChange={v => setEditState(s => ({ ...s, timing: v }))} placeholder="e.g. daily AM, with breakfast" />

      <div ref={el => { if (el) fieldRefs.current.set('dosesPerDay', el); }}>
        <ClinicalField label="Doses per Day" value={editState.dosesPerDay || ''} onChange={v => setEditState(s => ({ ...s, dosesPerDay: v }))} type="number" placeholder="1" error={fieldError('dosesPerDay')} />
      </div>
    </div>
  );

  const renderSupply = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div ref={el => { if (el) fieldRefs.current.set('currentQuantity', el); }}>
          <ClinicalField label={isPeptide || isOil ? 'Vials on Hand' : 'On Hand'} value={editState.currentQuantity || ''} onChange={v => setEditState(s => ({ ...s, currentQuantity: v }))} type="number" placeholder="0" error={fieldError('currentQuantity')} suffix={isPeptide || isOil ? 'vials' : editState.unitLabel || 'units'} />
        </div>
        <div ref={el => { if (el) fieldRefs.current.set('unitSize', el); }}>
          <ClinicalField label={isPeptide ? 'Per Vial (mg)' : isOil ? 'Concentration' : 'Per Container'} value={editState.unitSize || ''} onChange={v => setEditState(s => ({ ...s, unitSize: v }))} type="number" placeholder={isPeptide ? '5' : isOil ? '200' : '90'} error={fieldError('unitSize')} suffix={isOil ? 'mg/mL' : isPeptide ? 'mg' : editState.unitLabel || 'units'} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ClinicalField label="Unit Label" value={editState.unitLabel || ''} onChange={v => setEditState(s => ({ ...s, unitLabel: v }))} placeholder="caps, mL, servings" />
        {isOil && <ClinicalField label="Vial Size" value={editState.vialSizeMl || ''} onChange={v => setEditState(s => ({ ...s, vialSizeMl: v }))} type="number" placeholder="10" suffix="mL" />}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ClinicalField label="Price" value={editState.unitPrice || ''} onChange={v => setEditState(s => ({ ...s, unitPrice: v }))} type="number" placeholder="0.00" suffix="$" />
        {isPeptide && editState.reorderType === 'kit' && <ClinicalField label="Kit Price" value={editState.kitPrice || ''} onChange={v => setEditState(s => ({ ...s, kitPrice: v }))} type="number" placeholder="0.00" suffix="$/kit" />}
        <ClinicalField label="Reorder Qty" value={editState.reorderQuantity || ''} onChange={v => setEditState(s => ({ ...s, reorderQuantity: v }))} type="number" placeholder="1" />
      </div>

      {!isPeptide && !isOil && (
        <div>
          <label className="text-[11px] uppercase tracking-[0.08em] font-medium block mb-1" style={{ color: '#6B7280' }}>Purchase Date</label>
          <DatePickerInput value={editState.purchaseDate || ''} onChange={v => setEditState(s => ({ ...s, purchaseDate: v }))} className="text-[13px] py-2" />
        </div>
      )}
    </div>
  );

  const renderDosing = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div ref={el => { if (el) fieldRefs.current.set('dosePerUse', el); }}>
          <ClinicalField label="Dose Amount" value={editState.dosePerUse || ''} onChange={v => setEditState(s => ({ ...s, dosePerUse: v }))} type="number" placeholder="2.5" error={fieldError('dosePerUse')} />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-[0.08em] font-medium block mb-1" style={{ color: '#6B7280' }}>Dose Unit</label>
          <select value={editState.editDoseUnit || 'mg'} onChange={e => setEditState(s => ({ ...s, editDoseUnit: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg text-[14px]"
            style={{ background: '#1C1F26', color: '#F0F4F8', border: '1px solid #2A2D35', fontFamily: "'DM Mono', monospace" }}>
            <option value="mg">mg</option><option value="mcg">mcg</option><option value="g">g</option>
            <option value="iu">IU</option><option value="ml">mL</option><option value="pills">pills/caps</option>
            <option value="scoop">scoop</option><option value="drops">drops</option><option value="spray">spray</option>
            <option value="patch">patch</option><option value="softgels">softgels</option><option value="units">units</option>
            <option value="tbsp">tbsp</option><option value="tsp">tsp</option><option value="oz">oz</option><option value="floz">fl oz</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ClinicalField label="Strength / Unit" value={editState.weightPerUnit || ''} onChange={v => setEditState(s => ({ ...s, weightPerUnit: v }))} type="number" placeholder="500" />
        <div>
          <label className="text-[11px] uppercase tracking-[0.08em] font-medium block mb-1" style={{ color: '#6B7280' }}>Strength Unit</label>
          <select value={editState.strengthUnit || 'mg'} onChange={e => setEditState(s => ({ ...s, strengthUnit: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg text-[14px]"
            style={{ background: '#1C1F26', color: '#F0F4F8', border: '1px solid #2A2D35', fontFamily: "'DM Mono', monospace" }}>
            <option value="mg">mg</option><option value="mcg">mcg</option><option value="g">g</option><option value="oz">oz</option><option value="lb">lb</option>
          </select>
        </div>
      </div>

      {supplyDaysCalc !== null && supplyDaysCalc > 0 && (
        <div className="px-3 py-3 rounded-lg" style={{ background: '#1C1F26', border: '1px solid #2A2D35' }}>
          <p className="text-[11px] uppercase tracking-[0.08em] font-medium mb-1" style={{ color: '#6B7280' }}>Calculated</p>
          <p className="text-[15px] font-medium" style={{ color: '#F0F4F8', fontFamily: "'DM Mono', monospace" }}>
            At this dose, 1 {isPeptide || isOil ? 'vial' : 'container'} lasts{' '}
            <span style={{ color: '#10B981' }}>{supplyDaysCalc}</span> days
          </p>
        </div>
      )}

      {(editState.category || compound.category) === 'peptide' && (
        <>
          <div className="pt-2" style={{ borderTop: '1px solid #1E2228' }}>
            <label className="text-[11px] uppercase tracking-[0.08em] font-medium" style={{ color: '#6B7280' }}>Dilution / Reconstitution</label>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-[0.08em] font-medium block mb-1" style={{ color: '#6B7280' }}>Solvent</label>
            <select value={editState.solventType || ''} onChange={e => setEditState(s => ({ ...s, solventType: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-[13px]"
              style={{ background: '#1C1F26', color: '#F0F4F8', border: '1px solid #2A2D35', fontFamily: "'DM Mono', monospace" }}>
              <option value="">None</option><option value="Bacteriostatic Water">Bacteriostatic Water</option>
              <option value="Sterile Water">Sterile Water</option><option value="Sterile Saline">Sterile Saline</option>
              <option value="Acetic Acid 0.6%">Acetic Acid 0.6%</option><option value="Other">Other</option>
            </select>
          </div>
          {editState.solventType && <ClinicalField label="Volume" value={editState.solventVolume || ''} onChange={v => setEditState(s => ({ ...s, solventVolume: v }))} type="number" suffix="mL" />}
          <ClinicalField label="Storage" value={editState.storageInstructions || ''} onChange={v => setEditState(s => ({ ...s, storageInstructions: v }))} />
          <div>
            <label className="text-[11px] uppercase tracking-[0.08em] font-medium block mb-1" style={{ color: '#6B7280' }}>Prep Notes</label>
            <textarea value={editState.prepNotes || ''} onChange={e => setEditState(s => ({ ...s, prepNotes: e.target.value }))} rows={2}
              className="w-full px-3 py-2 rounded-lg text-[13px] resize-none"
              style={{ background: '#1C1F26', color: '#F0F4F8', border: '1px solid #2A2D35', fontFamily: "'DM Mono', monospace" }} />
          </div>
        </>
      )}
    </div>
  );

  const renderCycling = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-3 py-3 rounded-lg" style={{ background: '#1C1F26', border: '1px solid #2A2D35' }}>
        <span className="text-[11px] uppercase tracking-[0.08em] font-medium" style={{ color: '#6B7280' }}>Cycling Protocol</span>
        <button onClick={() => setEditState(s => ({ ...s, cyclingEnabled: s.cyclingEnabled === 'true' ? 'false' : 'true' }))}
          className="px-4 py-1.5 rounded-full text-[12px] font-semibold transition-all duration-200"
          style={{
            background: editState.cyclingEnabled === 'true' ? 'rgba(52,211,153,0.12)' : '#1C1F26',
            color: editState.cyclingEnabled === 'true' ? '#34D399' : '#6B7280',
            border: `1.5px solid ${editState.cyclingEnabled === 'true' ? 'rgba(52,211,153,0.3)' : '#2A2D35'}`,
          }}>
          {editState.cyclingEnabled === 'true' ? 'ON' : 'OFF'}
        </button>
      </div>
      {editState.cyclingEnabled === 'true' ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div ref={el => { if (el) fieldRefs.current.set('cycleOnDays', el); }}>
              <ClinicalField label="ON Days" value={editState.cycleOnDays || ''} onChange={v => setEditState(s => ({ ...s, cycleOnDays: v }))} type="number" placeholder="5" error={fieldError('cycleOnDays')} suffix="days" />
            </div>
            <div ref={el => { if (el) fieldRefs.current.set('cycleOffDays', el); }}>
              <ClinicalField label="OFF Days" value={editState.cycleOffDays || ''} onChange={v => setEditState(s => ({ ...s, cycleOffDays: v }))} type="number" placeholder="2" error={fieldError('cycleOffDays')} suffix="days" />
            </div>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-[0.08em] font-medium block mb-1" style={{ color: '#6B7280' }}>Cycle Start Date</label>
            <DatePickerInput value={editState.cycleStartDate || ''} onChange={v => setEditState(s => ({ ...s, cycleStartDate: v }))} className="text-[13px] py-2" />
          </div>
        </>
      ) : (
        <div className="px-3 py-4 rounded-lg text-center" style={{ background: '#1C1F26', border: '1px solid #2A2D35' }}>
          <p className="text-[12px]" style={{ color: '#6B7280' }}>Cycling is off — this compound runs continuously.</p>
        </div>
      )}
    </div>
  );

  const SECTION_RENDERERS: Record<SectionKey, () => JSX.Element> = {
    identity: renderIdentity,
    schedule: renderSchedule,
    supply: renderSupply,
    dosing: renderDosing,
    cycling: renderCycling,
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[100dvh] max-h-[100dvh] rounded-none flex flex-col p-0 gap-0"
        style={{ background: '#0A0A0F', color: '#F0F4F8' }}
      >
        {/* ═══ STICKY HEADER ═══ */}
        <div className="flex-shrink-0 px-4 pt-3 pb-3 z-10" style={{ borderBottom: '1px solid #1E2228', background: '#0A0A0F' }}>
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => onOpenChange(false)} className="p-1 rounded-lg" style={{ color: '#6B7280' }}>
              <X className="w-5 h-5" strokeWidth={1.5} />
            </button>
            <span className="text-[11px] uppercase tracking-[0.08em] font-medium" style={{ color: '#6B7280' }}>Edit Compound</span>
            <div className="w-7" />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <h2 className="text-[20px] font-semibold truncate" style={{ color: '#F0F4F8' }}>
                {editState.name || compound.name || 'Untitled'}
              </h2>
              {catMeta && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0"
                  style={{ background: 'rgba(0,194,255,0.08)', color: '#00C2FF', border: '1px solid rgba(0,194,255,0.2)' }}>
                  <catMeta.icon className="w-3 h-3" strokeWidth={1.5} />
                  {catMeta.label}
                </span>
              )}
            </div>

            {/* Protocol Health pill */}
            <button
              onClick={scrollToError}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium flex-shrink-0 transition-all"
              style={{
                background: canSave ? 'rgba(52,211,153,0.1)' : 'rgba(255,59,59,0.1)',
                color: canSave ? '#34D399' : '#FF3B3B',
                border: `1px solid ${canSave ? 'rgba(52,211,153,0.3)' : 'rgba(255,59,59,0.3)'}`,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: canSave ? '#34D399' : '#FF3B3B' }} />
              {canSave ? 'Complete' : `${criticalErrors.length} field${criticalErrors.length > 1 ? 's' : ''} need attention`}
            </button>
          </div>
        </div>

        {/* ═══ ERROR BANNER ═══ */}
        {criticalErrors.length > 0 && (
          <button
            onClick={scrollToError}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 text-left"
            style={{ background: 'rgba(255,59,59,0.06)', borderBottom: '1px solid rgba(255,59,59,0.15)' }}
          >
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} style={{ color: '#FF3B3B' }} />
            <span className="text-[12px] font-medium flex-1" style={{ color: '#FF3B3B' }}>
              {criticalErrors.length} required field{criticalErrors.length > 1 ? 's are' : ' is'} missing — tap to jump
            </span>
            <ChevronUp className="w-3.5 h-3.5 flex-shrink-0 rotate-90" strokeWidth={1.5} style={{ color: '#FF3B3B' }} />
          </button>
        )}

        {/* ═══ SCROLLABLE CONTENT ═══ */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-24">
          {SECTION_META.map(({ key, label, icon: SectionIcon, accent }) => (
            <div key={key} ref={el => { if (el) sectionRefs.current.set(key, el); }} className="pt-5">
              {/* Section divider */}
              <div className="mb-4">
                <div className="w-full h-px mb-3" style={{ background: '#1E2128' }} />
                <div className="flex items-center gap-2">
                  <SectionIcon className="w-4 h-4" strokeWidth={1.5} style={{ color: accent }} />
                  <span className="text-[11px] uppercase tracking-[0.1em] font-semibold" style={{ color: '#9CA3AF' }}>
                    {label}
                  </span>
                  {criticalErrors.filter(e => e.section === key).length > 0 && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: 'rgba(255,59,59,0.12)', color: '#FF3B3B' }}>
                      <AlertTriangle className="w-3 h-3" strokeWidth={1.5} />
                      {criticalErrors.filter(e => e.section === key).length}
                    </span>
                  )}
                </div>
              </div>

              {/* Section body with left accent border */}
              <div className="pl-4" style={{ borderLeft: `3px solid ${accent}` }}>
                {SECTION_RENDERERS[key]()}
              </div>
            </div>
          ))}
          <div className="h-8" />
        </div>

        {/* ═══ BOTTOM BAR ═══ */}
        <div className="flex-shrink-0 flex gap-3 px-4 py-3 absolute bottom-0 left-0 right-0" style={{ background: '#0A0A0F', borderTop: '1px solid #1E2228' }}>
          <button
            onClick={() => onOpenChange(false)}
            className="flex-1 py-3 rounded-xl text-[14px] font-semibold transition-all"
            style={{ background: '#1C1F26', color: '#9CA3AF', border: '1px solid #2A2D35' }}
          >
            Close
          </button>
          <button
            onClick={() => canSave && onSave()}
            disabled={!canSave}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98]"
            style={{
              background: canSave ? '#00C2FF' : '#2A2D35',
              color: canSave ? '#0A0A0F' : '#6B7280',
            }}
          >
            <Check className="w-4 h-4" strokeWidth={2} />
            Save
          </button>
        </div>
      </SheetContent>

      {/* Pulse animation for scrollToError */}
      <style>{`
        @keyframes clinical-pulse {
          0%, 100% { box-shadow: none; }
          50% { box-shadow: 0 0 0 3px rgba(255,59,59,0.4); }
        }
        .clinical-pulse {
          animation: clinical-pulse 0.6s ease-in-out 2;
          border-radius: 8px;
        }
      `}</style>
    </Sheet>
  );
}
