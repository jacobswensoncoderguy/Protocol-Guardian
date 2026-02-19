import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, FileText, Loader2, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, X, Beaker, Droplets, Bone, Zap, Syringe, Heart, Bug, ClipboardList, FlaskConical, Calendar, Tag } from 'lucide-react';
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

/** Build a human-friendly default label from doc type + date */
function buildDefaultLabel(docType: string, docDate?: string): string {
  const typeLabel = DOC_TYPE_LABELS[docType] || 'Lab Results';
  if (!docDate) return typeLabel;
  try {
    const d = new Date(docDate);
    const month = d.toLocaleString('en-US', { month: 'long' });
    const year = d.getFullYear();
    return `${typeLabel} ${month} ${year}`;
  } catch {
    return typeLabel;
  }
}

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
  const [savingReadings, setSavingReadings] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [parseProgress, setParseProgress] = useState<{ current: number; total: number } | null>(null);
  const [uploadLabel, setUploadLabel] = useState('');
  const [uploadDate, setUploadDate] = useState('');
  // Store the first image file as a data URL for inline preview, and the raw file for storage upload
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [rawFileForStorage, setRawFileForStorage] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Pre-fill label and date when result arrives
  useEffect(() => {
    if (parsedResult) {
      setUploadLabel(buildDefaultLabel(parsedResult.document_type, parsedResult.document_date));
      setUploadDate(parsedResult.document_date || new Date().toISOString().split('T')[0]);
    }
  }, [parsedResult]);

  const resetState = () => {
    setStep('upload');
    setParsedResult(null);
    setExpandedCategory(null);
    setSavingReadings(false);
    setDragOver(false);
    setParseProgress(null);
    setUploadLabel('');
    setUploadDate('');
    setImageDataUrl(null);
    setRawFileForStorage(null);
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
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const parseSingleFile = useCallback(async (content: string, fileType?: string, pdfBase64?: string): Promise<ParsedResult | null> => {
    try {
      const body: any = { fileType: fileType || 'medical document' };
      if (pdfBase64) body.pdfBase64 = pdfBase64;
      else body.fileContent = content.substring(0, 30000);

      const { data, error } = await supabase.functions.invoke('parse-biomarkers', { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as ParsedResult;
    } catch (e: any) {
      console.error('Parse error:', e);
      toast.error(e.message || 'Failed to parse document');
      return null;
    }
  }, []);

  const parseContent = useCallback(async (content: string, fileType?: string, pdfBase64?: string) => {
    setStep('parsing');
    const result = await parseSingleFile(content, fileType, pdfBase64);
    if (!result) { setStep('upload'); return; }
    setParsedResult(result);
    setStep('results');
  }, [parseSingleFile]);

  const parseMultipleFiles = useCallback(async (files: File[]) => {
    setStep('parsing');
    setParseProgress({ current: 0, total: files.length });

    const mergedBiomarkers: Biomarker[] = [];
    let mergedResult: ParsedResult | null = null;
    let capturedImageDataUrl: string | null = null;
    let capturedRawFile: File | null = null;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setParseProgress({ current: i + 1, total: files.length });

      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name}: File too large (max 10MB), skipping.`);
        continue;
      }

      try {
        const ext = file.name.split('.').pop()?.toLowerCase();
        const isImg = ['jpg','jpeg','png','gif','webp'].includes(ext || '');
        let fileType = 'medical document';
        if (file.name.toLowerCase().includes('dexa')) fileType = 'DEXA scan';
        else if (file.name.toLowerCase().includes('blood')) fileType = 'bloodwork';
        else if (ext === 'csv') fileType = 'CSV lab data';
        else if (ext === 'pdf') fileType = file.name.toLowerCase().includes('dexa') ? 'DEXA scan' : 'PDF lab report';

        // Capture first file for storage upload (prefer PDF, then image)
        if (!capturedRawFile) {
          capturedRawFile = file;
        }

        // Capture the first image file for inline preview
        if (isImg && !capturedImageDataUrl) {
          capturedImageDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        }

        let result: ParsedResult | null;
        if (ext === 'pdf') {
          const base64 = await readFileAsBase64(file);
          result = await parseSingleFile('', fileType, base64);
        } else if (isImg) {
          const base64 = await readFileAsBase64(file);
          result = await parseSingleFile('', fileType, base64);
        } else {
          const text = await readFileAsText(file);
          result = await parseSingleFile(text, fileType);
        }

        if (result) {
          if (!mergedResult) {
            mergedResult = { ...result };
            mergedBiomarkers.push(...result.biomarkers);
          } else {
            const existingNames = new Set(mergedBiomarkers.map(b => b.name));
            result.biomarkers.forEach(b => { if (!existingNames.has(b.name)) mergedBiomarkers.push(b); });
            if (result.recommendations) {
              mergedResult.recommendations = [...(mergedResult.recommendations || []), ...result.recommendations];
            }
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
      if (capturedImageDataUrl) setImageDataUrl(capturedImageDataUrl);
      if (capturedRawFile) setRawFileForStorage(capturedRawFile);
      setStep('results');
    } else {
      toast.error('No biomarkers could be extracted from the selected files.');
      setStep('upload');
    }
    setParseProgress(null);
  }, [parseSingleFile]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) parseMultipleFiles(files);
  };

  const handlePasteSubmit = () => {
    const text = textAreaRef.current?.value?.trim();
    if (!text) { toast.error('Please paste your lab results first'); return; }
    parseContent(text);
  };

  /** Save the upload record — upload file to storage first if available */
  const saveAndClose = async () => {
    if (!parsedResult || !userId) return;
    setSavingReadings(true);
    try {
      const label = uploadLabel.trim() || buildDefaultLabel(parsedResult.document_type, parsedResult.document_date);
      const date = uploadDate || parsedResult.document_date || new Date().toISOString().split('T')[0];

      let fileUrl = imageDataUrl || 'parsed_text';

      // Upload file to storage so users can open the original
      if (rawFileForStorage) {
        try {
          // Ensure bucket exists (calls the create-lab-bucket edge function)
          await supabase.functions.invoke('create-lab-bucket');

          const ext = rawFileForStorage.name.split('.').pop()?.toLowerCase() || 'bin';
          const storagePath = `${userId}/${Date.now()}-${label.replace(/[^a-zA-Z0-9]/g, '_')}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from('lab-uploads')
            .upload(storagePath, rawFileForStorage, { upsert: true });

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('lab-uploads')
              .getPublicUrl(storagePath);
            if (urlData?.publicUrl) {
              fileUrl = urlData.publicUrl;
            }
          }
        } catch {
          // Storage upload failed — fall back to data URL or parsed_text
        }
      }

      const { error } = await supabase.from('user_goal_uploads').insert({
        user_id: userId,
        user_goal_id: null,
        file_name: label,
        file_url: fileUrl,
        upload_type: parsedResult.document_type,
        reading_date: date,
        ai_extracted_data: parsedResult as any,
      });
      if (error) throw error;

      toast.success(`Saved "${label}" to Labs`);
      onReadingsCreated();
      handleClose(false);
    } catch (e: any) {
      console.error('Save error:', e);
      toast.error('Failed to save — please try again');
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

  const flaggedCount = parsedResult?.biomarkers.filter(b => b.status !== 'normal').length ?? 0;
  const criticalCount = parsedResult?.biomarkers.filter(b => b.status.startsWith('critical')).length ?? 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <FlaskConical className="w-5 h-5 text-primary" />
            {step === 'upload' && 'Upload Lab Results'}
            {step === 'parsing' && 'Analyzing…'}
            {step === 'results' && (parsedResult ? (DOC_TYPE_LABELS[parsedResult.document_type] || 'Lab Results') + ' — Review & Save' : 'Results')}
          </DialogTitle>
        </DialogHeader>

        {/* ── Upload Step ── */}
        {step === 'upload' && (
          <div className="space-y-4">
            {/* Primary drop zone — bold, prominent */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all group ${
                dragOver
                  ? 'border-primary bg-primary/10 scale-[1.01]'
                  : 'border-border hover:border-primary/60 hover:bg-secondary/20'
              }`}
            >
              {/* Animated upload arrow */}
              <div className={`mx-auto mb-4 w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                dragOver ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
              }`}>
                <Upload className={`w-7 h-7 transition-transform ${dragOver ? 'scale-110' : 'group-hover:-translate-y-0.5'}`} />
              </div>

              <p className="text-sm font-semibold text-foreground mb-1">
                {dragOver ? 'Drop to analyze' : 'Drop lab files here'}
              </p>
              <p className="text-xs text-muted-foreground">
                or <span className="text-primary font-medium underline underline-offset-2">click to browse</span>
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-3">
                PDF, .txt, .csv, images · Select multiple files at once
              </p>

              {/* Multi-file badge */}
              <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[9px] font-semibold text-primary">
                <FileText className="w-2.5 h-2.5" />
                Multi-file
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.csv,.tsv,.text,.md,image/*"
                multiple
                className="hidden"
                onChange={e => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 0) parseMultipleFiles(files);
                }}
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border/50" />
              <span className="text-xs text-muted-foreground">or paste text</span>
              <div className="flex-1 h-px bg-border/50" />
            </div>

            <textarea
              ref={textAreaRef}
              placeholder="Paste your bloodwork results, DEXA scan data, or lab report text here…"
              className="w-full h-32 px-3 py-2.5 rounded-xl border border-border/50 bg-secondary/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 resize-none font-mono"
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

        {/* ── Parsing Step ── */}
        {step === 'parsing' && (
          <div className="py-12 text-center space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
            <div>
              <p className="text-sm font-medium text-foreground">Analyzing your lab results…</p>
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

        {/* ── Results Step ── */}
        {step === 'results' && parsedResult && (
          <div className="space-y-4">

            {/* ── Label & Date ── */}
            <div className="bg-secondary/30 rounded-xl p-3.5 border border-border/40 space-y-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Name this record</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 bg-card rounded-lg border border-border/50 px-3 py-2">
                  <Tag className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <input
                    type="text"
                    value={uploadLabel}
                    onChange={e => setUploadLabel(e.target.value)}
                    placeholder="e.g. DEXA January 2025"
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 bg-card rounded-lg border border-border/50 px-3 py-2">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <input
                    type="date"
                    value={uploadDate}
                    onChange={e => setUploadDate(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-foreground focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* ── AI Summary preview ── */}
            <div className="bg-secondary/20 rounded-xl p-3 border border-border/30">
              <p className="text-xs text-foreground leading-relaxed">{parsedResult.summary}</p>
              <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                <span className="text-[10px] text-muted-foreground">{parsedResult.biomarkers.length} markers extracted</span>
                <span className="text-[10px] text-emerald-400">
                  {parsedResult.biomarkers.filter(b => b.status === 'normal').length} normal
                </span>
                {flaggedCount > 0 && (
                  <span className="text-[10px] text-amber-400">{flaggedCount} flagged</span>
                )}
                {criticalCount > 0 && (
                  <span className="text-[10px] text-destructive font-semibold">{criticalCount} critical</span>
                )}
              </div>
            </div>

            {/* ── Critical alerts preview ── */}
            {criticalCount > 0 && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-1.5">
                <p className="text-[10px] font-semibold text-destructive uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> Critical Alerts
                </p>
                {parsedResult.biomarkers.filter(b => b.status.startsWith('critical')).map((m, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-foreground font-medium">{m.name}</span>
                    <span className="font-mono text-destructive">{m.value} {m.unit}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Biomarker categories (read-only preview) ── */}
            <div className="space-y-1.5">
              {Object.entries(groupedBiomarkers).map(([category, markers]) => {
                const isExpanded = expandedCategory === category;
                const flagged = markers.filter(m => m.status !== 'normal').length;
                return (
                  <div key={category} className="bg-card rounded-lg border border-border/50 overflow-hidden">
                    <button
                      onClick={() => setExpandedCategory(isExpanded ? null : category)}
                      className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-secondary/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-foreground capitalize">{category.replace(/_/g, ' ')}</span>
                        <span className="text-[10px] text-muted-foreground">{markers.length} markers</span>
                        {flagged > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-status-warning/10 text-status-warning border border-status-warning/20">
                            {flagged} flagged
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
                            <span className="text-xs text-foreground truncate">{marker.name}</span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-xs font-mono font-semibold text-foreground">{marker.value}</span>
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

            {/* ── Actions ── */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={resetState}
                className="flex-1 py-2.5 rounded-xl border border-border/50 text-xs text-muted-foreground hover:bg-secondary/30 transition-colors"
              >
                Upload Another
              </button>
              <button
                onClick={saveAndClose}
                disabled={savingReadings || !uploadLabel.trim()}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                {savingReadings ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                Save to Labs
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center -mt-1">
              Full insights and goal alignment are available after saving.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
