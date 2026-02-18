import { useState, useCallback, useRef } from 'react';
import { Upload, FileText, Loader2, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, X, Beaker, TrendingUp, Plus, Droplets, Bone, Zap, Syringe, Heart, Bug, ClipboardList } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { UserGoal } from '@/hooks/useGoals';
import { toast } from 'sonner';

interface BiomarkerUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  goals: UserGoal[];
  onReadingsCreated: () => void;
}

interface Biomarker {
  name: string;
  value: number;
  unit: string;
  reference_low?: number;
  reference_high?: number;
  status: 'normal' | 'low' | 'high' | 'critical_low' | 'critical_high';
  category: string;
  relevant_goal_types?: string[];
}

interface Recommendation {
  biomarker: string;
  suggestion: string;
  priority: 'low' | 'medium' | 'high';
}

interface ParsedResult {
  document_type: string;
  document_date?: string;
  summary: string;
  biomarkers: Biomarker[];
  recommendations?: Recommendation[];
}

const STATUS_COLORS: Record<string, string> = {
  normal: 'text-emerald-400',
  low: 'text-amber-400',
  high: 'text-amber-400',
  critical_low: 'text-destructive',
  critical_high: 'text-destructive',
};

const STATUS_BG: Record<string, string> = {
  normal: 'bg-emerald-500/10 border-emerald-500/20',
  low: 'bg-amber-500/10 border-amber-500/20',
  high: 'bg-amber-500/10 border-amber-500/20',
  critical_low: 'bg-destructive/10 border-destructive/20',
  critical_high: 'bg-destructive/10 border-destructive/20',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'text-destructive',
  medium: 'text-amber-400',
  low: 'text-muted-foreground',
};

const DOC_TYPE_LABELS: Record<string, string> = {
  bloodwork: 'Bloodwork Panel',
  dexa_scan: 'DEXA Scan',
  metabolic_panel: 'Metabolic Panel',
  hormone_panel: 'Hormone Panel',
  lipid_panel: 'Lipid Panel',
  thyroid_panel: 'Thyroid Panel',
  other: 'Lab Results',
};

const DOC_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  bloodwork: Droplets,
  dexa_scan: Bone,
  metabolic_panel: Zap,
  hormone_panel: Syringe,
  lipid_panel: Heart,
  thyroid_panel: Bug,
  other: ClipboardList,
};

export default function BiomarkerUploadDialog({
  open,
  onOpenChange,
  userId,
  goals,
  onReadingsCreated,
}: BiomarkerUploadDialogProps) {
  const [step, setStep] = useState<'upload' | 'parsing' | 'results'>('upload');
  const [parsedResult, setParsedResult] = useState<ParsedResult | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [selectedBiomarkers, setSelectedBiomarkers] = useState<Set<string>>(new Set());
  const [savingReadings, setSavingReadings] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [parseProgress, setParseProgress] = useState<{ current: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const resetState = () => {
    setStep('upload');
    setParsedResult(null);
    setExpandedCategory(null);
    setSelectedBiomarkers(new Set());
    setSavingReadings(false);
    setDragOver(false);
    setParseProgress(null);
  };

  const handleClose = (open: boolean) => {
    if (!open) resetState();
    onOpenChange(open);
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip data URL prefix to get raw base64
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const parseSingleFile = useCallback(async (content: string, fileType?: string, pdfBase64?: string): Promise<ParsedResult | null> => {
    try {
      const body: any = {
        fileType: fileType || 'medical document',
        goalContext: goals.filter(g => g.status === 'active').map(g => ({
          title: g.title,
          goal_type: g.goal_type,
          target_value: g.target_value,
          target_unit: g.target_unit,
        })),
      };

      if (pdfBase64) {
        body.pdfBase64 = pdfBase64;
      } else {
        body.fileContent = content.substring(0, 30000);
      }

      const { data, error } = await supabase.functions.invoke('parse-biomarkers', { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as ParsedResult;
    } catch (e: any) {
      console.error('Parse error:', e);
      toast.error(e.message || 'Failed to parse document');
      return null;
    }
  }, [goals]);

  const parseContent = useCallback(async (content: string, fileType?: string, pdfBase64?: string) => {
    setStep('parsing');
    const result = await parseSingleFile(content, fileType, pdfBase64);
    if (!result) { setStep('upload'); return; }
    setParsedResult(result);
    const outOfRange = new Set<string>(
      (result.biomarkers || []).filter((b: Biomarker) => b.status !== 'normal').map((b: Biomarker) => b.name)
    );
    setSelectedBiomarkers(outOfRange);
    setStep('results');
  }, [parseSingleFile]);

  const parseMultipleFiles = useCallback(async (files: File[]) => {
    setStep('parsing');
    setParseProgress({ current: 0, total: files.length });

    const mergedBiomarkers: Biomarker[] = [];
    let mergedResult: ParsedResult | null = null;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setParseProgress({ current: i + 1, total: files.length });

      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name}: File too large (max 10MB), skipping.`);
        continue;
      }

      try {
        const ext = file.name.split('.').pop()?.toLowerCase();
        let fileType = 'medical document';
        if (file.name.toLowerCase().includes('dexa')) fileType = 'DEXA scan';
        else if (file.name.toLowerCase().includes('blood')) fileType = 'bloodwork';
        else if (ext === 'csv') fileType = 'CSV lab data';
        else if (ext === 'pdf') fileType = file.name.toLowerCase().includes('dexa') ? 'DEXA scan' : 'PDF lab report';

        let result: ParsedResult | null;
        if (ext === 'pdf') {
          const base64 = await readFileAsBase64(file);
          result = await parseSingleFile('', fileType, base64);
        } else {
          const text = await readFileAsText(file);
          result = await parseSingleFile(text, fileType);
        }

        if (result) {
          if (!mergedResult) {
            mergedResult = { ...result };
          } else {
            // Merge biomarkers (avoid duplicates by name)
            const existingNames = new Set(mergedBiomarkers.map(b => b.name));
            result.biomarkers.forEach(b => { if (!existingNames.has(b.name)) mergedBiomarkers.push(b); });
            if (result.recommendations) {
              mergedResult.recommendations = [...(mergedResult.recommendations || []), ...result.recommendations];
            }
          }
          // Add new biomarkers from this file
          if (mergedResult === result) {
            mergedBiomarkers.push(...result.biomarkers);
          }
        }
      } catch {
        toast.error(`Could not read ${file.name}, skipping.`);
      }
    }

    if (mergedResult && mergedBiomarkers.length > 0) {
      mergedResult.biomarkers = mergedBiomarkers;
      mergedResult.summary = files.length > 1
        ? `Merged results from ${files.length} files · ${mergedBiomarkers.length} biomarkers found`
        : mergedResult.summary;
      setParsedResult(mergedResult);
      const outOfRange = new Set<string>(
        mergedBiomarkers.filter(b => b.status !== 'normal').map(b => b.name)
      );
      setSelectedBiomarkers(outOfRange);
      setStep('results');
    } else {
      toast.error('No biomarkers could be extracted from the selected files.');
      setStep('upload');
    }
    setParseProgress(null);
  }, [parseSingleFile, readFileAsBase64, readFileAsText]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 1) {
      parseMultipleFiles([files[0]]);
    } else if (files.length > 1) {
      parseMultipleFiles(files);
    }
  };

  const handlePasteSubmit = () => {
    const text = textAreaRef.current?.value?.trim();
    if (!text) {
      toast.error('Please paste your lab results first');
      return;
    }
    parseContent(text);
  };

  const saveSelectedAsReadings = async () => {
    if (!userId || !parsedResult) return;
    setSavingReadings(true);
    try {
      const selectedMarkers = parsedResult.biomarkers.filter(b => selectedBiomarkers.has(b.name));
      const readingDate = parsedResult.document_date || new Date().toISOString().split('T')[0];

      // Match biomarkers to existing goals and create readings
      const matchedReadings: Array<{ goalId: string; value: number; unit: string; notes: string }> = [];

      for (const marker of selectedMarkers) {
        // Find matching goals by type or by unit similarity
        const matchingGoals = goals.filter(g => {
          if (g.status !== 'active') return false;
          if (marker.relevant_goal_types?.includes(g.goal_type)) return true;
          if (g.target_unit && g.target_unit.toLowerCase() === marker.unit.toLowerCase()) return true;
          return false;
        });

        for (const goal of matchingGoals) {
          matchedReadings.push({
            goalId: goal.id!,
            value: marker.value,
            unit: marker.unit,
            notes: `${marker.name} from ${parsedResult.document_type} (${marker.status})`,
          });
        }
      }

      // Save as goal readings
      if (matchedReadings.length > 0) {
        const inserts = matchedReadings.map(r => ({
          user_id: userId,
          user_goal_id: r.goalId,
          value: r.value,
          unit: r.unit,
          reading_date: readingDate,
          notes: r.notes,
          source: parsedResult.document_type,
        }));

        const { error } = await supabase.from('user_goal_readings').insert(inserts);
        if (error) throw error;

        toast.success(`${matchedReadings.length} reading(s) linked to goals`);
      }

      // Save the upload record
      const activeGoalId = goals.find(g => g.status === 'active')?.id;
      if (activeGoalId) {
        await supabase.from('user_goal_uploads').insert({
          user_id: userId,
          user_goal_id: activeGoalId,
          file_name: `${parsedResult.document_type}_${readingDate}`,
          file_url: 'parsed_text',
          upload_type: parsedResult.document_type,
          reading_date: readingDate,
          ai_extracted_data: parsedResult as any,
        });
      }

      onReadingsCreated();
      handleClose(false);
      
      if (matchedReadings.length === 0) {
        toast.info('Biomarkers saved but no matching goals found. Create goals to track these metrics.');
      }
    } catch (e: any) {
      console.error('Save error:', e);
      toast.error('Failed to save readings');
    } finally {
      setSavingReadings(false);
    }
  };

  // Group biomarkers by category
  const groupedBiomarkers = parsedResult?.biomarkers.reduce((acc, b) => {
    const cat = b.category || 'other';
    (acc[cat] = acc[cat] || []).push(b);
    return acc;
  }, {} as Record<string, Biomarker[]>) || {};

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Beaker className="w-5 h-5 text-primary" />
            {step === 'upload' && 'Upload Lab Results'}
            {step === 'parsing' && 'Analyzing...'}
            {step === 'results' && (parsedResult ? DOC_TYPE_LABELS[parsedResult.document_type] || 'Results' : 'Results')}
          </DialogTitle>
        </DialogHeader>

        {/* Upload Step */}
        {step === 'upload' && (
          <div className="space-y-4">
            {/* Drag & Drop Zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                ${dragOver
                  ? 'border-primary bg-primary/10'
                  : 'border-border/50 hover:border-primary/40 hover:bg-secondary/30'
                }
              `}
            >
              <Upload className={`w-8 h-8 mx-auto mb-3 ${dragOver ? 'text-primary' : 'text-muted-foreground'}`} />
              <p className="text-sm font-medium text-foreground">Drop file here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">Supports PDF, .txt, .csv, or text-based files</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.csv,.tsv,.text,.md"
                multiple
                className="hidden"
                onChange={e => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 0) parseMultipleFiles(files);
                }}
              />
            </div>

            {/* Or divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border/50" />
              <span className="text-xs text-muted-foreground">or paste text</span>
              <div className="flex-1 h-px bg-border/50" />
            </div>

            {/* Paste area */}
            <textarea
              ref={textAreaRef}
              placeholder="Paste your bloodwork results, DEXA scan data, or lab report text here..."
              className="w-full h-36 px-3 py-2.5 rounded-xl border border-border/50 bg-secondary/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 resize-none font-mono"
            />

            <button
              onClick={handlePasteSubmit}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              <Beaker className="w-4 h-4" />
              Parse with AI
            </button>

            <p className="text-[10px] text-muted-foreground text-center">
              Your data is processed securely and never stored externally.
            </p>
          </div>
        )}

        {/* Parsing Step */}
        {step === 'parsing' && (
          <div className="py-12 text-center space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
            <div>
              <p className="text-sm font-medium text-foreground">Analyzing your lab results...</p>
              {parseProgress && parseProgress.total > 1 ? (
                <p className="text-xs text-muted-foreground mt-1">
                  File {parseProgress.current} of {parseProgress.total} · Extracting biomarkers
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">Extracting biomarkers and reference ranges</p>
              )}
            </div>
          </div>
        )}

        {/* Results Step */}
        {step === 'results' && parsedResult && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-secondary/30 rounded-xl p-3 border border-border/30">
              <p className="text-xs text-foreground">{parsedResult.summary}</p>
              {parsedResult.document_date && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Test date: {new Date(parsedResult.document_date).toLocaleDateString()}
                </p>
              )}
              <div className="flex items-center gap-3 mt-2">
                <span className="text-[10px] text-muted-foreground">
                  {parsedResult.biomarkers.length} biomarkers found
                </span>
                <span className="text-[10px] text-emerald-400">
                  {parsedResult.biomarkers.filter(b => b.status === 'normal').length} normal
                </span>
                <span className="text-[10px] text-amber-400">
                  {parsedResult.biomarkers.filter(b => b.status === 'low' || b.status === 'high').length} flagged
                </span>
                <span className="text-[10px] text-destructive">
                  {parsedResult.biomarkers.filter(b => b.status.startsWith('critical')).length} critical
                </span>
              </div>
            </div>

            {/* Biomarker categories */}
            <div className="space-y-1.5">
              {Object.entries(groupedBiomarkers).map(([category, markers]) => {
                const isExpanded = expandedCategory === category;
                const flaggedCount = markers.filter(m => m.status !== 'normal').length;
                return (
                  <div key={category} className="bg-card rounded-lg border border-border/50 overflow-hidden">
                    <button
                      onClick={() => setExpandedCategory(isExpanded ? null : category)}
                      className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-secondary/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-foreground capitalize">
                          {category.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {markers.length} markers
                        </span>
                        {flaggedCount > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {flaggedCount} flagged
                          </span>
                        )}
                      </div>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                    </button>

                    {isExpanded && (
                      <div className="px-3 pb-2 space-y-1">
                        {markers.map((marker, i) => (
                          <div
                            key={i}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border ${STATUS_BG[marker.status]}`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <input
                                type="checkbox"
                                checked={selectedBiomarkers.has(marker.name)}
                                onChange={e => {
                                  const next = new Set(selectedBiomarkers);
                                  e.target.checked ? next.add(marker.name) : next.delete(marker.name);
                                  setSelectedBiomarkers(next);
                                }}
                                className="rounded border-border/50 accent-primary"
                              />
                              <span className="text-xs text-foreground truncate">{marker.name}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-xs font-mono font-semibold text-foreground">
                                {marker.value}
                              </span>
                              <span className="text-[10px] text-muted-foreground">{marker.unit}</span>
                              <span className={`text-[10px] font-medium ${STATUS_COLORS[marker.status]}`}>
                                {marker.status === 'normal' ? '✓' : marker.status.replace('_', ' ').toUpperCase()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Recommendations */}
            {parsedResult.recommendations && parsedResult.recommendations.length > 0 && (
              <div className="bg-secondary/20 rounded-xl p-3 border border-border/30">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  AI Recommendations
                </p>
                <div className="space-y-1.5">
                  {parsedResult.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <AlertCircle className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${PRIORITY_COLORS[rec.priority]}`} />
                      <div>
                        <span className="text-xs text-foreground font-medium">{rec.biomarker}: </span>
                        <span className="text-xs text-muted-foreground">{rec.suggestion}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => { resetState(); }}
                className="flex-1 py-2 rounded-xl border border-border/50 text-xs text-muted-foreground hover:bg-secondary/30 transition-colors"
              >
                Upload Another
              </button>
              <button
                onClick={saveSelectedAsReadings}
                disabled={savingReadings || selectedBiomarkers.size === 0}
                className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                {savingReadings ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                Save {selectedBiomarkers.size} to Goals
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
