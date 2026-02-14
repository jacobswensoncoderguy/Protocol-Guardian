export interface TimelineEvent {
  week: number;
  label: string;
}

export interface CompoundBenefit {
  icon: string; // emoji
  benefits: string[];
  timeline?: TimelineEvent[];
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
      '📊 Projected: 2-4% body fat reduction per 8-week cycle; ~1-2 lb visceral fat loss/month when paired with training',
    ],
    timeline: [
      { week: 1, label: 'NAD+ levels begin rising' },
      { week: 3, label: 'Increased metabolic rate noticeable' },
      { week: 6, label: 'Visible body recomposition' },
      { week: 8, label: '2-4% body fat reduction achieved' },
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
    timeline: [
      { week: 1, label: 'Energy & mood lift' },
      { week: 4, label: 'Serum B12 optimized (>600 pg/mL)' },
      { week: 8, label: 'Sustained cognitive clarity' },
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
      '📊 Projected: 30-50% faster tendon/ligament healing vs baseline; measurable pain reduction (VAS -3 to -5 points) within 3 weeks',
    ],
    timeline: [
      { week: 1, label: 'GI lining protection begins' },
      { week: 2, label: 'Joint/tendon pain reduction' },
      { week: 3, label: 'Measurable healing acceleration' },
      { week: 6, label: '30-50% faster tissue repair' },
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
    timeline: [
      { week: 2, label: 'Improved focus & mental stamina' },
      { week: 4, label: 'Enhanced memory & learning' },
      { week: 6, label: 'Neuroplasticity gains plateau' },
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
      '📊 Projected: IGF-1 increase of 50-150 ng/mL; 1-3 lb lean mass gain & 1-2% body fat reduction over 12 weeks with training',
    ],
    timeline: [
      { week: 1, label: 'Deeper sleep quality' },
      { week: 3, label: 'IGF-1 elevation measurable' },
      { week: 6, label: 'Body composition shifts' },
      { week: 12, label: '1-3 lb lean mass gain' },
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
      '📊 Projected: ~30% increase in collagen III density at 8 weeks; measurable skin thickness increase of 10-15% via ultrasound',
    ],
    timeline: [
      { week: 2, label: 'Wound healing acceleration' },
      { week: 4, label: 'Visible skin quality improvement' },
      { week: 8, label: '30% collagen III density increase' },
    ],
  },
  'igf1-lr3': {
    icon: '💪',
    benefits: [
      'Long-acting IGF-1 → drives muscle hyperplasia (new muscle cells)',
      'At 15 IU post-workout 4x/wk: enhanced recovery & lean mass gains',
      'Promotes satellite cell activation for muscle repair',
      'Improves nutrient partitioning toward muscle tissue',
      '📊 Projected: 2-5 lb lean muscle gain over 8-12 weeks; localized muscle fullness increase of ~5-10% in injected areas',
    ],
    timeline: [
      { week: 1, label: 'Enhanced post-workout recovery' },
      { week: 3, label: 'Localized muscle fullness (+5%)' },
      { week: 8, label: '2-5 lb lean muscle gain' },
      { week: 12, label: 'Visible hyperplasia in target areas' },
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
      '📊 Projected (with CJC stack): GH output 2-3x above baseline; 1-2% body fat loss & improved skin elasticity over 12 weeks',
    ],
    timeline: [
      { week: 1, label: 'Improved sleep depth' },
      { week: 2, label: 'Recovery speed increase' },
      { week: 6, label: 'Skin elasticity improvement' },
      { week: 12, label: '1-2% body fat reduction' },
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
      '📊 Projected: VO2 max improvement of 5-10% over 8 weeks; fasting glucose reduction of 5-15 mg/dL; 1-2% body fat reduction',
    ],
    timeline: [
      { week: 2, label: 'Exercise endurance improves' },
      { week: 4, label: 'Fasting glucose drops 5-15 mg/dL' },
      { week: 8, label: 'VO2 max +5-10%' },
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
    timeline: [
      { week: 0.5, label: 'Immediate energy & clarity boost' },
      { week: 2, label: 'Sustained cognitive improvement' },
      { week: 8, label: 'Sirtuin-mediated anti-aging effects' },
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
      '📊 Projected: 15-24% total body weight loss over 48 weeks; ~2-4 lb fat loss/month; waist circumference reduction of 3-6 inches over 6 months',
    ],
    timeline: [
      { week: 1, label: 'Appetite suppression kicks in' },
      { week: 4, label: '~4-8 lb fat loss' },
      { week: 12, label: 'Waist circumference −2-3"' },
      { week: 24, label: '15-20% total body weight loss' },
      { week: 48, label: 'Up to 24% body weight reduction' },
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
    timeline: [
      { week: 1, label: 'Anxiety reduction & calm focus' },
      { week: 2, label: 'Mood stabilization' },
      { week: 4, label: 'BDNF-driven neuroplasticity gains' },
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
    timeline: [
      { week: 1, label: 'Sharper focus & mental stamina' },
      { week: 3, label: 'BDNF & NGF upregulation' },
      { week: 6, label: 'Sustained cognitive enhancement' },
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
      '📊 Projected: 40-60% faster soft tissue repair; reduced scar tissue formation by ~20-30%; measurable joint ROM improvement in 4-6 weeks',
    ],
    timeline: [
      { week: 1, label: 'Inflammation reduction' },
      { week: 3, label: 'Accelerated tissue repair' },
      { week: 6, label: 'Joint ROM improvement & scar reduction' },
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
      '📊 Projected: 15-20% visceral fat reduction over 6 months; trunk fat decrease of ~1.5-2.5 cm via CT measurement; IGF-1 increase of 40-100 ng/mL',
    ],
    timeline: [
      { week: 2, label: 'IGF-1 begins rising' },
      { week: 6, label: 'Measurable visceral fat reduction' },
      { week: 12, label: 'Trunk fat −1.5 cm' },
      { week: 24, label: '15-20% visceral fat gone' },
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
    timeline: [
      { week: 2, label: 'T-cell & NK cell upregulation' },
      { week: 4, label: 'Immune surveillance strengthened' },
      { week: 8, label: 'Full Th1/Th2 balance' },
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
      '📊 Projected: 4-8 lb lean mass gain per 16-week cycle; collagen synthesis increase of ~200%; bone mineral density +2-3% annually; joint pain reduction of 50-70%',
    ],
    timeline: [
      { week: 3, label: 'Joint pain relief (50-70%)' },
      { week: 6, label: 'Collagen synthesis +200%' },
      { week: 12, label: '4-6 lb lean mass gain' },
      { week: 16, label: 'Full cycle: 4-8 lb lean mass' },
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
      '📊 Projected: 8-15 lb lean mass gain in first 6 months; 2-4% body fat reduction; total T levels 900-1400 ng/dL; strength gains of 15-25% on major lifts',
    ],
    timeline: [
      { week: 1, label: 'Mood & libido improvement' },
      { week: 3, label: 'Strength gains begin (5-10%)' },
      { week: 8, label: 'Visible body recomposition' },
      { week: 16, label: '8-12 lb lean mass gained' },
      { week: 24, label: 'Full 8-15 lb lean mass + 2-4% BF loss' },
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
      '📊 Projected: 3-6 lb lean mass gain per 8-week cycle; strength increase of 10-20%; 1-2% body fat reduction with visible muscle hardening & vascularity',
    ],
    timeline: [
      { week: 2, label: 'Strength & hardness increase' },
      { week: 4, label: 'Visible vascularity & muscle definition' },
      { week: 6, label: '3-4 lb lean mass gained' },
      { week: 8, label: 'Full cycle: 3-6 lb lean mass + 1-2% BF loss' },
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
    timeline: [
      { week: 2, label: 'Stress & sleep improvement' },
      { week: 4, label: 'Cortisol reduction 14-28%' },
      { week: 8, label: 'Testosterone & endurance gains' },
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
    timeline: [
      { week: 4, label: 'Lipid panel begins improving' },
      { week: 8, label: 'LDL reduction 15-20%' },
      { week: 12, label: 'Full 20-30% LDL reduction' },
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
    timeline: [
      { week: 1, label: 'Prolactin suppression begins' },
      { week: 2, label: 'Prolactin normalized' },
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
    timeline: [
      { week: 2, label: 'Antioxidant protection active' },
      { week: 4, label: 'Blood pressure support' },
      { week: 8, label: 'Cardiac output optimization' },
    ],
  },
  'l-arginine': {
    icon: '🚀',
    benefits: [
      'Nitric oxide precursor → vasodilation & blood flow enhancement',
      'At 5g daily: improved pumps, erectile quality & cardiovascular function',
      'Part of libido enhancement stack with Tadalafil + Pycnogenol + Citrulline',
      'Supports endothelial function and healthy blood pressure',
      '📊 Projected: NO production increase of 30-50%; penile blood flow improvement contributing to +0.2-0.5" girth over 6-12 months (full protocol); BP reduction of 2-5 mmHg',
    ],
    timeline: [
      { week: 1, label: 'Improved pumps & blood flow' },
      { week: 4, label: 'Erectile quality improvement' },
      { week: 12, label: 'BP reduction 2-5 mmHg' },
      { week: 24, label: 'Penile girth +0.2-0.3" (full protocol)' },
      { week: 48, label: 'Girth gains +0.3-0.5" (full protocol)' },
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
    timeline: [
      { week: 0.5, label: 'Improved sleep onset' },
      { week: 2, label: 'Reduced cramps & tension' },
      { week: 4, label: 'Full relaxation & recovery support' },
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
    timeline: [
      { week: 2, label: 'Liver enzyme support active' },
      { week: 6, label: 'Hepatoprotection fully established' },
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
    timeline: [
      { week: 1, label: 'Glutathione production boost' },
      { week: 4, label: 'Liver protection optimized' },
      { week: 8, label: 'Systemic antioxidant defense' },
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
    timeline: [
      { week: 4, label: 'Inflammation markers decrease' },
      { week: 8, label: 'Joint mobility improvement' },
      { week: 12, label: 'Lipid profile support' },
    ],
  },
  pycnogenol: {
    icon: '🌲',
    benefits: [
      'French Maritime Pine Bark — powerful antioxidant & NO booster',
      'At 150mg daily: enhanced erectile function within 4-6 weeks',
      'Part of libido enhancement protocol — synergizes with L-Arginine for NO production',
      'Supports endothelial function and blood flow',
      'Additional benefits: skin health, joint support & cognitive function',
      '📊 Projected: 92% of men achieve normal erectile function when combined with L-Arginine (Stanislavov study); endothelial function improvement of 30-40%',
    ],
    timeline: [
      { week: 2, label: 'NO production boost' },
      { week: 4, label: 'Erectile function improvement' },
      { week: 8, label: 'Endothelial function +30-40%' },
      { week: 12, label: 'Skin & joint benefits' },
    ],
  },
  tadalafil: {
    icon: '💊',
    benefits: [
      'PDE5 inhibitor — daily low-dose for vascular & erectile health',
      'At 5mg daily: consistent erectile quality & blood flow improvement',
      'Part of libido enhancement protocol with L-Arginine, Pycnogenol & Citrulline',
      'Cardioprotective: improves endothelial function & reduces blood pressure',
      'Half-life of 17.5h → smooth, continuous vascular support',
      '📊 Projected: erectile hardness score improvement from 3→4 (EHS scale); penile blood flow increase of 25-40%; systolic BP reduction of 3-5 mmHg',
    ],
    timeline: [
      { week: 0.5, label: 'Erectile quality improvement' },
      { week: 2, label: 'Blood flow increase 25-40%' },
      { week: 4, label: 'BP reduction 3-5 mmHg' },
      { week: 12, label: 'Endothelial remodeling benefits' },
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
    timeline: [
      { week: 1, label: 'Bile acid regulation active' },
      { week: 4, label: 'Full hepatoprotection' },
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
    timeline: [
      { week: 2, label: 'Cellular energy improvement' },
      { week: 4, label: 'Heart function support' },
      { week: 8, label: 'Mitochondrial optimization' },
    ],
  },
  collagen: {
    icon: '🦵',
    benefits: [
      'Type I & III collagen peptides — connective tissue support',
      'At 11g daily: improved skin elasticity & joint comfort in 4-8 weeks',
      'Supports tendon, ligament & cartilage repair during heavy training',
      'Synergizes with Vitamin C for optimal collagen synthesis',
      '📊 Projected: skin elasticity improvement of 15-20% at 8 weeks; joint pain reduction of 25-40%; tendon cross-sectional area increase of ~5% over 6 months',
    ],
    timeline: [
      { week: 4, label: 'Skin elasticity improvement' },
      { week: 6, label: 'Joint comfort & pain reduction' },
      { week: 8, label: 'Skin elasticity +15-20%' },
      { week: 24, label: 'Tendon cross-section +5%' },
    ],
  },
  citrulline: {
    icon: '🍉',
    benefits: [
      'L-Citrulline Malate — superior NO precursor (better than L-Arginine alone)',
      'At 9g pre-workout: massive pumps, improved endurance & reduced soreness',
      'Part of libido enhancement protocol — converts to L-Arginine for sustained NO production',
      'Reduces ammonia buildup during intense exercise',
      'Malate form supports ATP regeneration via Krebs cycle',
      '📊 Projected: plasma arginine increase of 227% (vs 70% from arginine alone); erectile hardness improvement synergistic with full protocol; exercise endurance +12-15%',
    ],
    timeline: [
      { week: 0.5, label: 'Immediate pump & endurance boost' },
      { week: 2, label: 'Sustained NO production elevated' },
      { week: 4, label: 'Endurance +12-15%' },
      { week: 8, label: 'Erectile synergy with full protocol' },
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
    timeline: [
      { week: 1, label: 'Electrolyte balance restored' },
      { week: 3, label: 'Taurine depletion prevented' },
      { week: 6, label: 'Cardioprotective effects steady' },
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
    timeline: [
      { week: 1, label: 'Immune defense active' },
      { week: 4, label: 'Collagen synthesis cofactor saturated' },
    ],
  },
};

// Protocol groupings are now user-defined via the user_protocols table.
// The old hardcoded PROTOCOL_GROUPS has been removed.
