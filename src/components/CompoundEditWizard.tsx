/**
 * CompoundEditWizard — Command Cards layout
 * 5 expandable section cards: Identity → Schedule → Supply → Dosing → Cycling
 * Header with completion ring, inline expand/collapse, critical field validation.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Compound, CompoundCategory } from '@/data/compounds';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import DatePickerInput from '@/components/DatePickerInput';
import {
  Check, AlertTriangle, X,
  Syringe, Pill, FlaskConical, Droplets, ClipboardList,
  Zap, Heart, Brain, Shield, Leaf, Microscope,
  Tag, Calendar, Package, Crosshair, RefreshCw, ChevronDown,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type CardKey = 'identity' | 'schedule' | 'supply' | 'dosing' | 'cycling';

interface CriticalError {
  card: CardKey;
  field: string;
  message: string;
}

const CARD_META: { key: CardKey; label: string; icon: typeof Tag }[] = [
  { key: 'identity', label: 'Identity', icon: Tag },
  { key: 'schedule', label: 'Schedule', icon: Calendar },
  { key: 'supply',   label: 'Supply',   icon: Package },
  { key: 'dosing',   label: 'Dosing',   icon: Crosshair },
  { key: 'cycling',  label: 'Cycling',  icon: RefreshCw },
];

// ─── Category metadata ──────────────────────────────────────────────────────

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

function WizardField({
  label, value, onChange, type = 'text', placeholder, error, suffix,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; error?: string; suffix?: string;
}) {
  return (
    <div className="space-y-1">
      <label
        className="text-[11px] uppercase tracking-[0.08em] font-medium"
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
          className="w-full px-3 py-2.5 rounded-lg text-[16px] font-medium transition-colors duration-200"
          style={{
            background: '#1C1F26',
            color: '#F0F4F8',
            border: error ? '1.5px solid #FF3B3B' : '1px solid #2A2D35',
            fontFamily: type === 'number' ? "'DM Mono', monospace" : "'DM Sans', sans-serif",
          }}
          onFocus={e => { e.target.style.borderColor = '#00C2FF'; }}
          onBlur={e => { e.target.style.borderColor = error ? '#FF3B3B' : '#2A2D35'; }}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px]" style={{ color: '#6B7280', fontFamily: "'DM Mono', monospace" }}>
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

// ─── Completion Ring SVG ─────────────────────────────────────────────────────

function CompletionRing({ completed, total }: { completed: number; total: number }) {
  const size = 52;
  const stroke = 3.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? completed / total : 0;
  const offset = circumference * (1 - pct);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#1E2228" strokeWidth={stroke} />
        <circle
          cx={size/2} cy={size/2} r={radius} fill="none"
          stroke={pct >= 1 ? '#34D399' : '#00C2FF'}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-[11px] font-bold"
        style={{ color: pct >= 1 ? '#34D399' : '#F0F4F8', fontFamily: "'DM Mono', monospace" }}
      >
        {completed}/{total}
      </span>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

const TOTAL_CRITICAL_FIELDS = 9;

export default function CompoundEditWizard({
  open, onOpenChange, compound, editState, setEditState, onSave, isPeptide, isOil,
}: CompoundEditWizardProps) {
  const [expandedCards, setExpandedCards] = useState<Set<CardKey>>(new Set());
  const [shakingCard, setShakingCard] = useState<CardKey | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ─── Critical field validation ─────────────────────────────────────────────

  const criticalErrors = useMemo((): CriticalError[] => {
    const errors: CriticalError[] = [];

    if (!(editState.name || '').trim())
      errors.push({ card: 'identity', field: 'name', message: 'Required to identify this compound in your protocol' });

    const dpw = parseInt(editState.daysPerWeek || '0');
    if (isNaN(dpw) || dpw <= 0)
      errors.push({ card: 'schedule', field: 'daysPerWeek', message: 'Required to calculate how many days of supply remain' });
    const dpd = parseInt(editState.dosesPerDay || '0');
    if (isNaN(dpd) || dpd <= 0)
      errors.push({ card: 'schedule', field: 'dosesPerDay', message: 'Required to calculate daily consumption rate' });

    const qty = parseFloat(editState.currentQuantity || '');
    if (isNaN(qty) || qty < 0)
      errors.push({ card: 'supply', field: 'currentQuantity', message: 'Required to calculate how many days of supply remain' });
    const size = parseFloat(editState.unitSize || '');
    if (isNaN(size) || size <= 0)
      errors.push({ card: 'supply', field: 'unitSize', message: 'Required to determine container capacity and depletion rate' });

    const dose = parseFloat(editState.dosePerUse || '');
    if (isNaN(dose) || dose <= 0)
      errors.push({ card: 'dosing', field: 'dosePerUse', message: 'Required to calculate consumption and supply duration' });

    if (editState.cyclingEnabled === 'true') {
      const on = parseInt(editState.cycleOnDays || '');
      const off = parseInt(editState.cycleOffDays || '');
      if (isNaN(on) || on <= 0)
        errors.push({ card: 'cycling', field: 'cycleOnDays', message: 'Required to calculate your active cycle phase duration' });
      if (isNaN(off) || off <= 0)
        errors.push({ card: 'cycling', field: 'cycleOffDays', message: 'Required to calculate your rest phase duration' });
    }

    return errors;
  }, [editState]);

  const cardErrors = useCallback((c: CardKey) => criticalErrors.filter(e => e.card === c), [criticalErrors]);
  const fieldError = useCallback((field: string) => criticalErrors.find(e => e.field === field)?.message, [criticalErrors]);
  const cardHasErrors = useCallback((c: CardKey) => cardErrors(c).length > 0, [cardErrors]);
  const canSave = criticalErrors.length === 0;
  const completedFields = TOTAL_CRITICAL_FIELDS - criticalErrors.length;

  // ─── Auto-expand on open ───────────────────────────────────────────────────

  useEffect(() => {
    if (!open) { setExpandedCards(new Set()); return; }
    const brokenCards = CARD_META.map(m => m.key).filter(k => cardHasErrors(k));
    if (brokenCards.length > 0 && brokenCards.length <= 2) {
      setExpandedCards(new Set(brokenCards));
    } else {
      setExpandedCards(new Set());
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Toggle card ───────────────────────────────────────────────────────────

  const toggleCard = useCallback((key: CardKey) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        // Prevent collapse if card has errors
        if (cardHasErrors(key)) {
          setShakingCard(key);
          setTimeout(() => setShakingCard(null), 400);
          return prev;
        }
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, [cardHasErrors]);

  // ─── Day/timing helpers ────────────────────────────────────────────────────

  const toggleDay = (idx: number) => {
    const current = parseDaysFromNote(editState.timing || '', parseInt(editState.daysPerWeek || '7'));
    const currentTimings = parseTimingsFromNote(editState.timing || '');
    if (current.has(idx)) current.delete(idx); else current.add(idx);
    const newTiming = buildDayString(current, currentTimings);
    setEditState(s => ({ ...s, timing: newTiming, daysPerWeek: current.size.toString() }));
  };

  const toggleTiming = (id: string) => {
    const currentDays = parseDaysFromNote(editState.timing || '', parseInt(editState.daysPerWeek || '7'));
    const currentTimings = parseTimingsFromNote(editState.timing || '');
    if (currentTimings.has(id)) currentTimings.delete(id);
    else currentTimings.add(id);
    const newTiming = buildDayString(currentDays, currentTimings);
    setEditState(s => ({ ...s, timing: newTiming }));
  };

  const activeDaySet = useMemo(() => parseDaysFromNote(editState.timing || '', parseInt(editState.daysPerWeek || '7')), [editState.timing, editState.daysPerWeek]);
  const activeTimings = useMemo(() => parseTimingsFromNote(editState.timing || ''), [editState.timing]);

  // ─── Computed supply calc ──────────────────────────────────────────────────

  const supplyDaysCalc = useMemo(() => {
    const dose = parseFloat(editState.dosePerUse || '0');
    const size = parseFloat(editState.unitSize || '0');
    const dpd = parseInt(editState.dosesPerDay || '1');
    if (dose <= 0 || size <= 0 || dpd <= 0) return null;
    const cat = editState.category || compound.category;
    let dosesPerUnit: number;
    if (cat === 'peptide' || cat === 'injectable-oil') {
      const vialMl = parseFloat(editState.vialSizeMl || '10');
      if (cat === 'injectable-oil') {
        dosesPerUnit = (size * vialMl) / dose;
      } else {
        dosesPerUnit = size / dose * 10;
      }
    } else {
      dosesPerUnit = size / (dose > 0 ? dose : 1);
    }
    const dpw = parseInt(editState.daysPerWeek || '7');
    const dailyDoses = dpd * (dpw / 7);
    if (dailyDoses <= 0) return null;
    return Math.floor(dosesPerUnit / dailyDoses);
  }, [editState, compound.category]);

  // ─── Card summaries ────────────────────────────────────────────────────────

  const cardSummary = useCallback((key: CardKey): string => {
    switch (key) {
      case 'identity': {
        const cat = CATEGORY_META[editState.category || compound.category];
        const status = (editState.notes || '').includes('[DORMANT]') ? 'Inactive' : 'Active';
        return `${cat?.label || 'Unknown'} · ${status}`;
      }
      case 'schedule': {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const days = activeDaySet;
        const dayStr = days.size === 7 ? 'Daily' : days.size === 0 ? 'No days' : Array.from(days).sort().map(d => dayNames[d]).join(' · ');
        const timStr = activeTimings.size > 0 ? Array.from(activeTimings).map(t => TIMING_OPTIONS.find(o => o.id === t)?.label || t).join(', ') : '';
        const dpd = editState.dosesPerDay || '1';
        return [dayStr, timStr, `${dpd}x/day`].filter(Boolean).join(', ');
      }
      case 'supply': {
        const qty = editState.currentQuantity || '0';
        const size = editState.unitSize || '0';
        const unit = editState.unitLabel || 'units';
        const price = editState.unitPrice || '0';
        return `${qty} on hand · ${size} ${unit} · $${price}/ea`;
      }
      case 'dosing': {
        const dose = editState.dosePerUse || '—';
        const doseUnit = editState.editDoseUnit || 'mg';
        return `${dose} ${doseUnit} per dose`;
      }
      case 'cycling': {
        if (editState.cyclingEnabled !== 'true') return 'Off — continuous';
        const on = editState.cycleOnDays || '?';
        const off = editState.cycleOffDays || '?';
        return `${on} days on / ${off} days off`;
      }
    }
  }, [editState, compound.category, activeDaySet, activeTimings]);

  // ─── Card field renderers ──────────────────────────────────────────────────

  const renderIdentityFields = () => (
    <div className="space-y-4 pt-3">
      <div className="space-y-1">
        <label className="text-[11px] uppercase tracking-[0.08em] font-medium" style={{ color: fieldError('name') ? '#FF3B3B' : '#6B7280' }}>
          Compound Name
        </label>
        <input
          type="text"
          value={editState.name || ''}
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
        {fieldError('name') && <p className="text-[11px]" style={{ color: '#FF3B3B' }}>{fieldError('name')}</p>}
      </div>

      <div className="space-y-2">
        <label className="text-[11px] uppercase tracking-[0.08em] font-medium" style={{ color: '#6B7280' }}>Category</label>
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

      <div className="space-y-1">
        <label className="text-[11px] uppercase tracking-[0.08em] font-medium" style={{ color: '#6B7280' }}>Notes</label>
        <textarea
          value={(editState.notes || '').replace('[DORMANT]', '').trim()}
          onChange={e => {
            const isDormant = (editState.notes || '').includes('[DORMANT]');
            setEditState(s => ({ ...s, notes: isDormant ? `[DORMANT] ${e.target.value}` : e.target.value }));
          }}
          rows={3} placeholder="Usage notes, supplier info, etc."
          className="w-full px-3 py-2.5 rounded-lg text-[13px] resize-none"
          style={{ background: '#1C1F26', color: '#F0F4F8', border: '1px solid #2A2D35' }}
        />
      </div>
    </div>
  );

  const renderScheduleFields = () => (
    <div className="space-y-4 pt-3">
      <div className="space-y-2">
        <label className="text-[11px] uppercase tracking-[0.08em] font-medium" style={{ color: '#6B7280' }}>Days of Week</label>
        <div className="flex gap-1.5">
          {DAY_LABELS.map((lbl, idx) => {
            const isActive = activeDaySet.has(idx);
            return (
              <button key={idx} onClick={() => toggleDay(idx)}
                className="flex-1 py-2.5 rounded-lg text-[12px] font-semibold transition-all duration-200"
                style={{
                  background: isActive ? 'rgba(0,194,255,0.12)' : '#1C1F26',
                  color: isActive ? '#00C2FF' : '#6B7280',
                  border: isActive ? '1.5px solid rgba(0,194,255,0.4)' : '1px solid #2A2D35',
                }}>
                {lbl}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[11px] uppercase tracking-[0.08em] font-medium" style={{ color: '#6B7280' }}>Time of Day</label>
        <div className="flex flex-wrap gap-1.5">
          {TIMING_OPTIONS.map(opt => {
            const isSelected = activeTimings.has(opt.id);
            return (
              <button key={opt.id} onClick={() => toggleTiming(opt.id)}
                className="px-3 py-2 rounded-lg text-[11px] font-medium transition-all duration-200"
                style={{
                  background: isSelected ? 'rgba(0,194,255,0.12)' : '#1C1F26',
                  color: isSelected ? '#00C2FF' : '#6B7280',
                  border: isSelected ? '1.5px solid rgba(0,194,255,0.4)' : '1px solid #2A2D35',
                }}>
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <WizardField label="Timing Note" value={editState.timing || ''} onChange={v => setEditState(s => ({ ...s, timing: v }))} placeholder="e.g. daily AM, with breakfast" />
      <WizardField label="Doses per Day" value={editState.dosesPerDay || ''} onChange={v => setEditState(s => ({ ...s, dosesPerDay: v }))} type="number" placeholder="1" error={fieldError('dosesPerDay')} />
    </div>
  );

  const renderSupplyFields = () => (
    <div className="space-y-4 pt-3">
      <WizardField label={isPeptide || isOil ? 'Vials on Hand' : 'On Hand'} value={editState.currentQuantity || ''} onChange={v => setEditState(s => ({ ...s, currentQuantity: v }))} type="number" placeholder="0" error={fieldError('currentQuantity')} suffix={isPeptide || isOil ? 'vials' : editState.unitLabel || 'units'} />
      <WizardField label={isPeptide ? 'Per Vial (mg)' : isOil ? 'Concentration' : 'Per Container'} value={editState.unitSize || ''} onChange={v => setEditState(s => ({ ...s, unitSize: v }))} type="number" placeholder={isPeptide ? 'e.g. 5' : isOil ? 'e.g. 200' : 'e.g. 90'} error={fieldError('unitSize')} suffix={isOil ? 'mg/mL' : isPeptide ? 'mg' : editState.unitLabel || 'units'} />
      <WizardField label="Unit Label" value={editState.unitLabel || ''} onChange={v => setEditState(s => ({ ...s, unitLabel: v }))} placeholder="e.g. caps, mL, servings" />
      {isOil && <WizardField label="Vial Size" value={editState.vialSizeMl || ''} onChange={v => setEditState(s => ({ ...s, vialSizeMl: v }))} type="number" placeholder="10" suffix="mL" />}
      <WizardField label="Price" value={editState.unitPrice || ''} onChange={v => setEditState(s => ({ ...s, unitPrice: v }))} type="number" placeholder="0.00" suffix="$" />
      {isPeptide && editState.reorderType === 'kit' && <WizardField label="Kit Price" value={editState.kitPrice || ''} onChange={v => setEditState(s => ({ ...s, kitPrice: v }))} type="number" placeholder="0.00" suffix="$/kit" />}
      <WizardField label="Reorder Qty" value={editState.reorderQuantity || ''} onChange={v => setEditState(s => ({ ...s, reorderQuantity: v }))} type="number" placeholder="1" />
      {!isPeptide && !isOil && (
        <div className="space-y-1">
          <label className="text-[11px] uppercase tracking-[0.08em] font-medium" style={{ color: '#6B7280' }}>Purchase Date</label>
          <DatePickerInput value={editState.purchaseDate || ''} onChange={v => setEditState(s => ({ ...s, purchaseDate: v }))} className="text-[13px] py-2.5" />
        </div>
      )}
    </div>
  );

  const renderDosingFields = () => (
    <div className="space-y-4 pt-3">
      <WizardField label="Dose Amount" value={editState.dosePerUse || ''} onChange={v => setEditState(s => ({ ...s, dosePerUse: v }))} type="number" placeholder="e.g. 2.5" error={fieldError('dosePerUse')} />
      <div className="space-y-1">
        <label className="text-[11px] uppercase tracking-[0.08em] font-medium" style={{ color: '#6B7280' }}>Dose Unit</label>
        <select value={editState.editDoseUnit || 'mg'} onChange={e => setEditState(s => ({ ...s, editDoseUnit: e.target.value }))}
          className="w-full px-3 py-2.5 rounded-lg text-[14px]"
          style={{ background: '#1C1F26', color: '#F0F4F8', border: '1px solid #2A2D35', fontFamily: "'DM Mono', monospace" }}>
          <option value="mg">mg</option><option value="mcg">mcg</option><option value="g">g</option>
          <option value="iu">IU</option><option value="ml">mL</option><option value="pills">pills/caps</option>
          <option value="scoop">scoop</option><option value="drops">drops</option><option value="spray">spray</option>
          <option value="patch">patch</option><option value="softgels">softgels</option><option value="units">units</option>
          <option value="tbsp">tbsp</option><option value="tsp">tsp</option><option value="oz">oz</option><option value="floz">fl oz</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <WizardField label="Strength / Unit" value={editState.weightPerUnit || ''} onChange={v => setEditState(s => ({ ...s, weightPerUnit: v }))} type="number" placeholder="e.g. 500" />
        <div className="space-y-1">
          <label className="text-[11px] uppercase tracking-[0.08em] font-medium" style={{ color: '#6B7280' }}>Strength Unit</label>
          <select value={editState.strengthUnit || 'mg'} onChange={e => setEditState(s => ({ ...s, strengthUnit: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-lg text-[14px]"
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
            <span style={{ color: '#00C2FF' }}>{supplyDaysCalc}</span> days
          </p>
        </div>
      )}
      {(editState.category || compound.category) === 'peptide' && (
        <>
          <div className="pt-2" style={{ borderTop: '1px solid #1E2228' }}>
            <label className="text-[11px] uppercase tracking-[0.08em] font-medium" style={{ color: '#6B7280' }}>Dilution / Reconstitution</label>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-[0.08em] font-medium" style={{ color: '#6B7280' }}>Solvent</label>
            <select value={editState.solventType || ''} onChange={e => setEditState(s => ({ ...s, solventType: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg text-[13px]"
              style={{ background: '#1C1F26', color: '#F0F4F8', border: '1px solid #2A2D35', fontFamily: "'DM Mono', monospace" }}>
              <option value="">None</option><option value="Bacteriostatic Water">Bacteriostatic Water</option>
              <option value="Sterile Water">Sterile Water</option><option value="Sterile Saline">Sterile Saline</option>
              <option value="Acetic Acid 0.6%">Acetic Acid 0.6%</option><option value="Other">Other</option>
            </select>
          </div>
          {editState.solventType && <WizardField label="Volume" value={editState.solventVolume || ''} onChange={v => setEditState(s => ({ ...s, solventVolume: v }))} type="number" suffix="mL" />}
          <WizardField label="Storage" value={editState.storageInstructions || ''} onChange={v => setEditState(s => ({ ...s, storageInstructions: v }))} />
          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-[0.08em] font-medium" style={{ color: '#6B7280' }}>Prep Notes</label>
            <textarea value={editState.prepNotes || ''} onChange={e => setEditState(s => ({ ...s, prepNotes: e.target.value }))} rows={2}
              className="w-full px-3 py-2.5 rounded-lg text-[13px] resize-none"
              style={{ background: '#1C1F26', color: '#F0F4F8', border: '1px solid #2A2D35', fontFamily: "'DM Mono', monospace" }} />
          </div>
        </>
      )}
    </div>
  );

  const renderCyclingFields = () => (
    <div className="space-y-4 pt-3">
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
      {editState.cyclingEnabled === 'true' && (
        <>
          <WizardField label="ON Days" value={editState.cycleOnDays || ''} onChange={v => setEditState(s => ({ ...s, cycleOnDays: v }))} type="number" placeholder="e.g. 5" error={fieldError('cycleOnDays')} suffix="days" />
          <WizardField label="OFF Days" value={editState.cycleOffDays || ''} onChange={v => setEditState(s => ({ ...s, cycleOffDays: v }))} type="number" placeholder="e.g. 2" error={fieldError('cycleOffDays')} suffix="days" />
          <div className="space-y-1">
            <label className="text-[11px] uppercase tracking-[0.08em] font-medium" style={{ color: '#6B7280' }}>Cycle Start Date</label>
            <DatePickerInput value={editState.cycleStartDate || ''} onChange={v => setEditState(s => ({ ...s, cycleStartDate: v }))} className="text-[13px] py-2.5" />
          </div>
        </>
      )}
      {editState.cyclingEnabled !== 'true' && (
        <div className="px-3 py-4 rounded-lg text-center" style={{ background: '#1C1F26', border: '1px solid #2A2D35' }}>
          <p className="text-[12px]" style={{ color: '#6B7280' }}>Cycling is off — this compound runs continuously.</p>
        </div>
      )}
    </div>
  );

  const FIELD_RENDERERS: Record<CardKey, () => JSX.Element> = {
    identity: renderIdentityFields,
    schedule: renderScheduleFields,
    supply: renderSupplyFields,
    dosing: renderDosingFields,
    cycling: renderCyclingFields,
  };

  // ─── Category badge ────────────────────────────────────────────────────────
  const catMeta = CATEGORY_META[editState.category || compound.category];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[100dvh] max-h-[100dvh] rounded-none flex flex-col p-0 gap-0"
        style={{ background: '#0A0A0F', color: '#F0F4F8' }}
      >
        {/* ═══ HEADER ═══ */}
        <div className="flex-shrink-0 px-4 pt-3 pb-4" style={{ borderBottom: '1px solid #1E2228' }}>
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => onOpenChange(false)} className="p-1 rounded-lg" style={{ color: '#6B7280' }}>
              <X className="w-5 h-5" strokeWidth={1.5} />
            </button>
            <span className="text-[11px] uppercase tracking-[0.08em] font-medium" style={{ color: '#6B7280' }}>Edit Compound</span>
            <div className="w-7" />
          </div>

          <div className="flex items-center gap-3">
            <CompletionRing completed={completedFields} total={TOTAL_CRITICAL_FIELDS} />
            <div className="flex-1 min-w-0">
              <h2 className="text-[24px] font-semibold truncate" style={{ color: '#F0F4F8', fontFamily: "'DM Sans', sans-serif" }}>
                {editState.name || compound.name || 'Untitled'}
              </h2>
              {catMeta && (
                <span className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{ background: 'rgba(0,194,255,0.08)', color: '#00C2FF', border: '1px solid rgba(0,194,255,0.2)' }}>
                  <catMeta.icon className="w-3 h-3" strokeWidth={1.5} />
                  {catMeta.label}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ═══ CARD LIST ═══ */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {CARD_META.map(({ key, label, icon: CardIcon }) => {
            const isExpanded = expandedCards.has(key);
            const hasErrors = cardHasErrors(key);
            const errCount = cardErrors(key).length;
            const isShaking = shakingCard === key;

            return (
              <div
                key={key}
                className="rounded-xl overflow-hidden transition-all duration-200"
                style={{
                  background: isExpanded ? '#181B23' : '#13161D',
                  border: `1px solid ${hasErrors ? '#1E2228' : '#1E2228'}`,
                  borderLeft: hasErrors ? '3px solid #FF3B3B' : undefined,
                  animation: isShaking ? 'shake 0.4s ease-in-out' : undefined,
                }}
              >
                {/* Card header — always visible */}
                <button
                  onClick={() => toggleCard(key)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors duration-200"
                >
                  <CardIcon className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} style={{ color: hasErrors ? '#FF3B3B' : isExpanded ? '#00C2FF' : '#6B7280' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] uppercase tracking-[0.06em] font-semibold" style={{ color: hasErrors ? '#FF3B3B' : '#F0F4F8' }}>
                      {label}
                    </p>
                    <p className="text-[11px] truncate mt-0.5" style={{ color: '#9CA3AF' }}>
                      {cardSummary(key)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {hasErrors ? (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ background: 'rgba(255,59,59,0.12)', color: '#FF3B3B' }}>
                        <AlertTriangle className="w-3 h-3" strokeWidth={1.5} />
                        {errCount}
                      </span>
                    ) : (
                      <Check className="w-4 h-4" strokeWidth={1.5} style={{ color: '#34D399' }} />
                    )}
                    <ChevronDown
                      className="w-4 h-4 transition-transform duration-200"
                      strokeWidth={1.5}
                      style={{
                        color: '#6B7280',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    />
                  </div>
                </button>

                {/* Expanded fields */}
                <div
                  className="overflow-hidden transition-all duration-200 ease-out"
                  style={{
                    maxHeight: isExpanded ? '2000px' : '0px',
                    opacity: isExpanded ? 1 : 0,
                  }}
                >
                  <div className="px-4 pb-4" style={{ borderTop: '1px solid #1E2228' }}>
                    {FIELD_RENDERERS[key]()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ═══ BOTTOM SAVE BAR ═══ */}
        <div className="flex-shrink-0 px-4 py-3" style={{ background: '#0A0A0F', borderTop: '1px solid #1E2228' }}>
          <button
            onClick={() => canSave && onSave()}
            disabled={!canSave}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: canSave ? '#00C2FF' : '#2A2D35',
              color: canSave ? '#0A0A0F' : '#6B7280',
            }}
          >
            <Check className="w-4 h-4" strokeWidth={2} />
            Save Changes
          </button>
        </div>
      </SheetContent>

      {/* Shake animation */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(3px); }
        }
      `}</style>
    </Sheet>
  );
}
