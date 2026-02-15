import {
  Shield, Scale, Zap, Rocket,
  Flame, BatteryCharging, Bandage, Brain,
  Syringe, FlaskConical, Dna, Target,
  Leaf, Heart, Droplets, Activity,
  Pill, Atom, ShieldCheck, TestTube,
  CircleDot, Waves, Sun, Wind,
  Sparkles, Eye, Gauge, Beef,
  HeartPulse, Microscope, type LucideIcon,
  AlertCircle, CircleCheck, CircleAlert, Info, Lightbulb, Clock, BarChart3, RefreshCw, ArrowRightLeft,
} from 'lucide-react';

// Tolerance level icons
export const toleranceIcons: Record<string, LucideIcon> = {
  conservative: Shield,
  moderate: Scale,
  aggressive: Zap,
  performance: Rocket,
};

// Severity level icons
export const severityIcons: Record<string, LucideIcon> = {
  danger: AlertCircle,
  warning: CircleAlert,
  info: Info,
};

// Compound category icons
export const compoundIconMap: Record<string, LucideIcon> = {
  // Metabolic / fat loss
  '5-amino-1mq': Flame,
  // Vitamins & energy
  b12: BatteryCharging,
  // Healing peptides
  'bpc-157': Bandage,
  // Neuro
  cerebroprotein: Brain,
  // GH secretagogues
  'cjc-1295': Syringe,
  'ghk-cu': Dna,
  'igf1-lr3': FlaskConical,
  ipamorelin: Syringe,
  tesamorelin: Syringe,
  // Metabolic peptides
  'mots-c': Activity,
  'nad-plus': Atom,
  // Weight management
  retatrutide: Target,
  // Neuro peptides
  selank: Brain,
  semax: Brain,
  // Healing
  'tb-500': Bandage,
  // Immune
  'thymosin-a1': ShieldCheck,
  // AAS
  deca: Gauge,
  'test-cyp': Gauge,
  anavar: Gauge,
  // Adaptogens
  ashwagandha: Leaf,
  // Heart
  bergamot: Heart,
  hawthorn: HeartPulse,
  // Hormonal
  cabergoline: Scale,
  // Amino acids
  'l-arginine': Rocket,
  citrulline: Wind,
  taurine: Zap,
  // Minerals
  magnesium: Sparkles,
  // Liver support
  'milk-thistle': Leaf,
  nac: ShieldCheck,
  tudca: ShieldCheck,
  // Fatty acids
  omega3: Droplets,
  // Antioxidants
  pycnogenol: Leaf,
  ubiquinol: Sun,
  // Performance
  tadalafil: Activity,
  // Structural
  collagen: Beef,
  'collagen-peptides': Beef,
  // Misc
  creatine: Zap,
  'vitamin-d3': Sun,
  'vitamin-k2': Droplets,
  zinc: Atom,
  boron: Atom,
  dhea: FlaskConical,
  pregnenolone: FlaskConical,
  melatonin: Eye,
  // Fallback
  default: Pill,
};

// Protocol template icons
export const protocolIconMap: Record<string, LucideIcon> = {
  'Dick Protocol': Gauge,
  'GH Axis Protocol': Syringe,
  'Neuroprotection Stack': Brain,
  'Healing & Recovery Stack': Bandage,
  'Heart Health Protocol': HeartPulse,
  'Liver Cleanse Protocol': ShieldCheck,
  'Cognitive Remodeling Protocol': Brain,
  'Libido Enhancement Protocol': Flame,
  'Recovery & Repair Protocol': Bandage,
  'Body Recomposition Protocol': Target,
  'Longevity & Anti-Aging Protocol': Sparkles,
  'Immune Defense Protocol': ShieldCheck,
  default: FlaskConical,
};

// Chat marker icons
export const chatTagIcons: Record<string, LucideIcon> = {
  GOOD: CircleCheck,
  WATCH: CircleAlert,
  ALERT: AlertCircle,
  TIP: Lightbulb,
  COST: BarChart3,
  TIMING: Clock,
  CYCLE: RefreshCw,
  DATA: Microscope,
  SCIENCE: Microscope,
  SYNERGY: ArrowRightLeft,
  SAFETY: Shield,
  PROTOCOL: TestTube,
  DOSING: Syringe,
  OUTCOMES: Target,
  EVIDENCE: BarChart3,
  DETAIL: Info,
  ACTION: Target,
};

export function getCompoundIcon(key: string): LucideIcon {
  return compoundIconMap[key] || compoundIconMap.default;
}

export function getProtocolIcon(name: string): LucideIcon {
  return protocolIconMap[name] || protocolIconMap.default;
}
