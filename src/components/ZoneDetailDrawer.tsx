import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { BodyZone, BODY_ZONES, getCompoundsForZone } from '@/data/bodyZoneMapping';
import { Compound } from '@/data/compounds';
import { compoundBenefits } from '@/data/compoundBenefits';

interface ZoneDetailDrawerProps {
  zone: BodyZone | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compounds: Compound[];
}

function normalizeBenefitKey(name: string): string {
  return name.toLowerCase()
    .replace(/\s*\d+\s*m[cg]g?\s*/gi, '')
    .replace(/\s*\d+\s*i\.?u\.?\s*/gi, '')
    .replace(/\s*\(.*?\)\s*/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const ZoneDetailDrawer = ({ zone, open, onOpenChange, compounds }: ZoneDetailDrawerProps) => {
  if (!zone) return null;

  const info = BODY_ZONES[zone];
  // Use compound names for zone mapping (not UUIDs)
  const compoundNameIds = compounds.map(c => c.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
  const zoneCompounds = getCompoundsForZone(zone, compoundNameIds);

  // Map back to full compound objects
  const compoundDetails = zoneCompounds.map(zc => {
    const compound = compounds.find(c => 
      c.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') === zc.id
    );
    const benefitKey = compound ? normalizeBenefitKey(compound.name) : zc.id;
    const benefits = compoundBenefits[benefitKey];
    return { ...zc, compound, benefits };
  });

  const intensityLabel = (w: number) => w >= 0.8 ? 'Primary' : w >= 0.5 ? 'Strong' : 'Supporting';
  const intensityColor = (w: number) => w >= 0.8 ? 'text-emerald-400' : w >= 0.5 ? 'text-primary' : 'text-muted-foreground';

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: info.color, boxShadow: `0 0 10px ${info.color}` }}
            />
            <DrawerTitle className="text-base">{info.label}</DrawerTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{info.description}</p>
        </DrawerHeader>

        <div className="px-4 pb-6 overflow-y-auto scrollbar-thin space-y-3">
          {compoundDetails.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No compounds targeting this zone</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Add compounds to your protocol to improve coverage</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground/60 px-1">
                <span>{compoundDetails.length} compounds</span>
                <span>Impact</span>
              </div>
              {compoundDetails.map((item, i) => (
                <div
                  key={i}
                  className="bg-secondary/30 rounded-lg border border-border/30 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {item.benefits && <span className="text-sm">{item.benefits.icon}</span>}
                      <span className="text-sm font-medium text-foreground">
                        {item.compound?.name || item.id}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-mono font-semibold ${intensityColor(item.weight)}`}>
                        {intensityLabel(item.weight)}
                      </span>
                      <div className="w-12 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${item.weight * 100}%`,
                            backgroundColor: info.color,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Dosing info */}
                  {item.compound && (
                    <p className="text-[10px] font-mono text-muted-foreground/70">
                      {item.compound.dosePerUse} {item.compound.doseLabel} · {item.compound.dosesPerDay}x/day · {item.compound.daysPerWeek}d/wk
                    </p>
                  )}

                  {/* Key benefits */}
                  {item.benefits && (
                    <div className="space-y-1">
                      {item.benefits.benefits.slice(0, 3).map((b, j) => (
                        <p key={j} className="text-[11px] text-muted-foreground leading-tight">
                          {b.startsWith('📊') ? (
                            <span className="text-primary font-medium">{b}</span>
                          ) : (
                            <>• {b}</>
                          )}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default ZoneDetailDrawer;
