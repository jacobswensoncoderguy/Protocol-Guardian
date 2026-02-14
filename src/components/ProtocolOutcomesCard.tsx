import { useState } from 'react';
import { TrendingUp, ChevronDown } from 'lucide-react';

interface OutcomeCategory {
  icon: string;
  label: string;
  items: string[];
}

const outcomes: OutcomeCategory[] = [
  {
    icon: '💪',
    label: 'Lean Mass & Strength',
    items: [
      '+15-28 lb lean mass (Test Cyp + Deca + Anavar + IGF-1 LR3)',
      '15-25% strength gains on major lifts',
      'Muscle hyperplasia in targeted areas (IGF-1 LR3)',
    ],
  },
  {
    icon: '🔥',
    label: 'Fat Loss & Recomposition',
    items: [
      '15-24% total body weight loss (Retatrutide)',
      '15-20% visceral fat reduction (Tesamorelin)',
      '2-4% additional body fat reduction (5-Amino + MOTS-C)',
      'Waist circumference −3-6" over 6 months',
    ],
  },
  {
    icon: '🍆',
    label: 'Vascular & Sexual Health',
    items: [
      'Penile blood flow +25-40% (Tadalafil)',
      'Girth +0.2-0.5" over 6-12 months (full Dick Protocol)',
      '92% normal erectile function (Arginine + Pycnogenol)',
      'Endothelial function +30-40%',
    ],
  },
  {
    icon: '🩹',
    label: 'Tissue Repair & Recovery',
    items: [
      '30-50% faster tendon/ligament healing (BPC-157)',
      '40-60% faster soft tissue repair (TB-500)',
      'Scar tissue reduction ~20-30%',
      'Collagen III density +30% (GHK-Cu)',
      'Skin elasticity +15-20% (Collagen)',
    ],
  },
  {
    icon: '🧠',
    label: 'Cognitive & Longevity',
    items: [
      'VO2 max +5-10% (MOTS-C)',
      'Cortisol reduction 14-28% (Ashwagandha)',
      'LDL cholesterol −20-30% (Bergamot)',
      'NAD+ & sirtuin activation (NAD+ IV)',
      'BDNF upregulation (Semax + Selank + Cerebroprotein)',
    ],
  },
];

const ProtocolOutcomesCard = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-card rounded-lg border border-border/50">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Combined Protocol Outcomes
          </h3>
          {!open && (
            <p className="text-[10px] text-muted-foreground mt-1 ml-6 truncate">
              +15-28 lb lean mass · 15-24% fat loss · girth +0.5" · 30-50% faster healing
            </p>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 space-y-3">
            <p className="text-[10px] text-muted-foreground">
              Projected aggregate outcomes across your full 38-compound stack at current dosages.
            </p>
            {outcomes.map((cat) => (
              <div key={cat.label}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-sm">{cat.icon}</span>
                  <span className="text-xs font-semibold text-foreground/90">{cat.label}</span>
                </div>
                <div className="space-y-0.5 ml-6">
                  {cat.items.map((item, i) => (
                    <p key={i} className="text-[11px] text-muted-foreground leading-relaxed">
                      <span className="text-primary mr-1">▸</span>{item}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProtocolOutcomesCard;
