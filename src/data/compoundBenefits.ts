export interface CompoundBenefit {
  icon: string; // emoji
  benefits: string[];
}

export const compoundBenefits: Record<string, CompoundBenefit> = {
  '5-amino-1mq': {
    icon: '🔥',
    benefits: [
      'Inhibits NNMT enzyme → boosts NAD+ levels & fat oxidation',
      'At 30 IU 3x/wk: expect noticeable body recomposition within 6-8 weeks',
      'Enhances metabolic rate without stimulant side effects',
      'Synergizes with exercise for visceral fat reduction',
      'May improve insulin sensitivity over 30-day ON cycles',
    ],
  },
  b12: {
    icon: '⚡',
    benefits: [
      'Supports red blood cell formation → better oxygen delivery',
      'At 1mg/wk injection: maintains optimal serum B12 (>600 pg/mL)',
      'Enhances energy, mood, and cognitive function',
      'Injectable bypasses absorption issues common with oral B12',
    ],
  },
  'bpc-157': {
    icon: '🩹',
    benefits: [
      'Body Protection Compound — accelerates tendon, ligament & gut healing',
      'At 10 IU nightly: expect joint/tendon relief within 2-4 weeks',
      'Promotes angiogenesis (new blood vessel growth) at injury sites',
      'Protects GI lining — counteracts NSAID & stress-related damage',
      'Synergizes with TB-500 for systemic tissue repair',
    ],
  },
  cerebroprotein: {
    icon: '🧠',
    benefits: [
      'Brain-derived neurotrophic peptide complex → neuroprotection',
      'At 30 IU M-F: improved focus, memory & mental clarity in 3-4 weeks',
      'Supports neuroplasticity and learning capacity',
      'May enhance recovery from cognitive fatigue',
    ],
  },
  'cjc-1295': {
    icon: '📈',
    benefits: [
      'Growth Hormone Releasing Hormone analog → sustained GH pulses',
      'At 10 IU 2x/day M-F: elevated IGF-1 within 2-3 weeks',
      'Improves deep sleep quality, recovery & body composition',
      'Paired with Ipamorelin for synergistic GH release',
      'No DAC version = cleaner pulsatile release pattern',
    ],
  },
  'ghk-cu': {
    icon: '✨',
    benefits: [
      'Copper peptide — master regulator of tissue remodeling',
      'At 10 IU 6x/wk: visible skin quality improvement in 4-6 weeks',
      'Stimulates collagen III synthesis & reduces fine lines',
      'Anti-inflammatory and antioxidant gene activation',
      'Promotes hair follicle health and wound healing',
    ],
  },
  'igf1-lr3': {
    icon: '💪',
    benefits: [
      'Long-acting IGF-1 → drives muscle hyperplasia (new muscle cells)',
      'At 15 IU post-workout 4x/wk: enhanced recovery & lean mass gains',
      'Promotes satellite cell activation for muscle repair',
      'Improves nutrient partitioning toward muscle tissue',
    ],
  },
  ipamorelin: {
    icon: '🌙',
    benefits: [
      'Selective GH secretagogue — mimics ghrelin for clean GH pulses',
      'At 10 IU nightly: improved sleep depth & recovery within 1-2 weeks',
      'Minimal hunger/cortisol side effects vs other GHRPs',
      'Supports fat loss, skin elasticity & joint health',
      'Stacks perfectly with CJC-1295 for amplified GH output',
    ],
  },
  'mots-c': {
    icon: '⚙️',
    benefits: [
      'Mitochondrial-derived peptide → metabolic optimizer',
      'At 50 IU 3x/wk: improved exercise capacity in 3-4 weeks',
      'Enhances glucose metabolism & insulin sensitivity',
      'Activates AMPK pathway → cellular energy homeostasis',
      'Anti-aging effects via mitochondrial function preservation',
    ],
  },
  'nad-plus': {
    icon: '🔋',
    benefits: [
      'Direct NAD+ replenishment → cellular energy & DNA repair',
      'At 1000mg 2x/wk IV: sustained energy, mental clarity within days',
      'Activates sirtuins (longevity genes) and PARP repair enzymes',
      'Supports healthy aging and neuroprotection',
      'Injectable route achieves ~100% bioavailability vs oral (~2%)',
    ],
  },
  retatrutide: {
    icon: '🎯',
    benefits: [
      'Triple agonist: GLP-1 + GIP + Glucagon receptor activation',
      'At 15 IU weekly: significant fat loss (up to 24% body weight in trials)',
      'Superior appetite regulation and metabolic enhancement',
      'Glucagon component drives additional energy expenditure',
      '112-day ON cycles allow sustained, progressive fat loss',
    ],
  },
  selank: {
    icon: '🧘',
    benefits: [
      'Synthetic analog of tuftsin → anxiolytic & nootropic',
      'At 15 IU nightly: reduced anxiety & improved mood in 1-2 weeks',
      'Modulates GABA and serotonin for calm focus',
      'Enhances BDNF expression → neuroplasticity support',
      'Non-sedating and non-addictive anti-anxiety effect',
    ],
  },
  semax: {
    icon: '🎓',
    benefits: [
      'Synthetic ACTH fragment → cognitive enhancer & neuroprotectant',
      'At 10 IU daily AM: sharper focus & mental stamina in 5-7 days',
      'Increases BDNF and NGF (nerve growth factor)',
      'Supports attention, learning, and stress resilience',
      'Synergizes with Selank for balanced cognitive optimization',
    ],
  },
  'tb-500': {
    icon: '🔧',
    benefits: [
      'Thymosin Beta-4 fragment → systemic tissue repair',
      'At 100 IU 2x/wk: accelerated injury recovery within 3-4 weeks',
      'Promotes cell migration to damaged tissue sites',
      'Reduces inflammation and fibrosis (scar tissue)',
      'Synergizes with BPC-157 for comprehensive healing',
    ],
  },
  tesamorelin: {
    icon: '🏋️',
    benefits: [
      'GHRH analog → targets visceral adipose tissue specifically',
      'At 20 IU nightly: measurable visceral fat reduction in 6-8 weeks',
      'FDA-approved for lipodystrophy — well-studied safety profile',
      'Elevates IGF-1 for improved body composition',
      'Supports cognitive function via GH pathway activation',
    ],
  },
  'thymosin-a1': {
    icon: '🛡️',
    benefits: [
      'Immune modulator — enhances T-cell and NK cell function',
      'At 40 IU 3x/wk: strengthened immune surveillance in 2-4 weeks',
      'Balances Th1/Th2 response for optimal immune regulation',
      'Supports vaccine efficacy and infection resistance',
      'Anti-tumor immune activity documented in clinical trials',
    ],
  },
  deca: {
    icon: '🦴',
    benefits: [
      'Nandrolone — anabolic for joint, bone & lean mass support',
      'At 83mg 2x/wk (~166mg/wk): significant joint relief in 3-4 weeks',
      'Stimulates collagen synthesis → healthier connective tissue',
      'Moderate anabolic effect with favorable side profile at this dose',
      'Supports bone mineral density during intense training',
    ],
  },
  'test-cyp': {
    icon: '🐂',
    benefits: [
      'Testosterone replacement → foundational hormone optimization',
      'At 35mg daily (~245mg/wk): stable supraphysiological levels, no peaks/troughs',
      'Enhanced muscle protein synthesis, recovery & strength',
      'Improved mood, motivation, libido & cognitive function',
      'Daily micro-dosing minimizes estrogen conversion vs weekly injections',
    ],
  },
  anavar: {
    icon: '💎',
    benefits: [
      'Oxandrolone — mild oral anabolic with strong strength gains',
      'At 25mg daily: noticeable strength & hardness within 2-3 weeks',
      'Excellent for body recomposition with minimal water retention',
      'Low androgenic profile → favorable side effect ratio',
      '56-day cycles with liver support (TUDCA/NAC) protect hepatic function',
    ],
  },
  ashwagandha: {
    icon: '🌿',
    benefits: [
      'KSM-66 — gold-standard adaptogen for stress & performance',
      'At 600mg daily: reduced cortisol (14-28%) within 4-8 weeks',
      'Supports testosterone, thyroid function & sleep quality',
      'Enhances endurance, VO2 max & recovery from training',
    ],
  },
  bergamot: {
    icon: '🍊',
    benefits: [
      'Citrus Bergamot — natural statin alternative for lipid management',
      'At 600mg daily: LDL reduction of 20-30% within 8-12 weeks',
      'Supports healthy HDL/LDL ratio and cardiovascular health',
      'Antioxidant and anti-inflammatory polyphenol profile',
    ],
  },
  cabergoline: {
    icon: '⚖️',
    benefits: [
      'Dopamine agonist — controls prolactin from Deca/Nandrolone use',
      'At 250mcg weekly: maintains prolactin in normal range',
      'Prevents gynecomastia and sexual side effects from 19-nors',
      'Synced with Deca cycle (112 on / 56 off) for targeted support',
    ],
  },
  hawthorn: {
    icon: '❤️',
    benefits: [
      'Hawthorn Berry — cardiovascular protection & blood pressure support',
      'At 500mg daily: supports healthy blood pressure within 4-6 weeks',
      'Rich in flavonoids → antioxidant protection for heart tissue',
      'Supports healthy cardiac output during intense training',
    ],
  },
  'l-arginine': {
    icon: '🚀',
    benefits: [
      'Nitric oxide precursor → vasodilation & blood flow enhancement',
      'At 5g daily: improved pumps, erectile quality & cardiovascular function',
      'Part of "Dick Protocol" stack with Tadalafil + Pycnogenol + Citrulline',
      'Supports endothelial function and healthy blood pressure',
    ],
  },
  magnesium: {
    icon: '😴',
    benefits: [
      'Glycinate form — highly bioavailable, calming magnesium',
      'At 240mg nightly: improved sleep onset & muscle relaxation',
      'Supports 300+ enzymatic reactions including ATP production',
      'Prevents cramps and supports recovery from intense training',
    ],
  },
  'milk-thistle': {
    icon: '🌼',
    benefits: [
      'Silymarin — hepatoprotective antioxidant for liver health',
      'At 300mg daily: supports liver detoxification pathways',
      'Essential liver support during Anavar and oral compound use',
      'Anti-inflammatory and antifibrotic effects on liver tissue',
    ],
  },
  nac: {
    icon: '🛡️',
    benefits: [
      'N-Acetyl Cysteine — master antioxidant precursor (glutathione)',
      'At 1g daily: enhanced detoxification & liver protection',
      'Critical support for oral anabolic compounds (Anavar)',
      'Supports respiratory health and mucus clearance',
      'Neuroprotective via glutamate modulation',
    ],
  },
  omega3: {
    icon: '🐟',
    benefits: [
      'EPA/DHA — anti-inflammatory fatty acids for systemic health',
      'At 2 softgels daily: reduced inflammation markers in 4-6 weeks',
      'Supports cardiovascular health, joint mobility & brain function',
      'Helps manage lipid profile during anabolic compound use',
    ],
  },
  pycnogenol: {
    icon: '🌲',
    benefits: [
      'French Maritime Pine Bark — powerful antioxidant & NO booster',
      'At 150mg daily: enhanced erectile function within 4-6 weeks',
      'Part of "Dick Protocol" — synergizes with L-Arginine for NO production',
      'Supports endothelial function and blood flow',
      'Additional benefits: skin health, joint support & cognitive function',
    ],
  },
  tadalafil: {
    icon: '💊',
    benefits: [
      'PDE5 inhibitor — daily low-dose for vascular & erectile health',
      'At 5mg daily: consistent erectile quality & blood flow improvement',
      'Part of "Dick Protocol" with L-Arginine, Pycnogenol & Citrulline',
      'Cardioprotective: improves endothelial function & reduces blood pressure',
      'Half-life of 17.5h → smooth, continuous vascular support',
    ],
  },
  tudca: {
    icon: '🫁',
    benefits: [
      'Tauroursodeoxycholic acid — premium liver & bile acid support',
      'At 500mg daily: superior hepatoprotection during oral anabolic use',
      'Prevents bile acid toxicity and cholestasis',
      'Neuroprotective properties via ER stress reduction',
    ],
  },
  ubiquinol: {
    icon: '🔆',
    benefits: [
      'Active form of CoQ10 — mitochondrial energy production',
      'At 200mg daily: supports heart function & cellular energy',
      'Critical supplement for anyone on statins or bergamot',
      'Powerful antioxidant protecting cell membranes',
    ],
  },
  collagen: {
    icon: '🦵',
    benefits: [
      'Type I & III collagen peptides — connective tissue support',
      'At 11g daily: improved skin elasticity & joint comfort in 4-8 weeks',
      'Supports tendon, ligament & cartilage repair during heavy training',
      'Synergizes with Vitamin C for optimal collagen synthesis',
    ],
  },
  citrulline: {
    icon: '🍉',
    benefits: [
      'L-Citrulline Malate — superior NO precursor (better than L-Arginine alone)',
      'At 9g pre-workout: massive pumps, improved endurance & reduced soreness',
      'Part of "Dick Protocol" — converts to L-Arginine for sustained NO production',
      'Reduces ammonia buildup during intense exercise',
      'Malate form supports ATP regeneration via Krebs cycle',
    ],
  },
  taurine: {
    icon: '⚡',
    benefits: [
      'Semi-essential amino acid — cardioprotective & performance support',
      'At 5g daily (split AM/PM): supports heart health during anabolic use',
      'Prevents taurine depletion caused by androgen receptor activation',
      'Supports electrolyte balance, hydration & muscle contractility',
    ],
  },
  'vitamin-c': {
    icon: '🍋',
    benefits: [
      'Ascorbic acid — essential cofactor for collagen synthesis',
      'At 1g daily: supports immune function & antioxidant defense',
      'Synergizes with collagen peptides for optimal tissue repair',
      'Supports iron absorption and adrenal function',
    ],
  },
};

// Protocol groupings for schedule display
export const PROTOCOL_GROUPS: Record<string, { label: string; icon: string; compoundIds: string[] }> = {
  dickProtocol: {
    label: '🍆 Dick Protocol',
    icon: '🍆',
    compoundIds: ['tadalafil', 'l-arginine', 'pycnogenol', 'citrulline'],
  },
};
