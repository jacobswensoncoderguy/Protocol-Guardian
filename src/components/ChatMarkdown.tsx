import React from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import {
  CheckCircle2, AlertTriangle, AlertOctagon, Lightbulb,
  DollarSign, Clock, RefreshCw, BarChart3, Dna, Zap,
  Shield, ClipboardList, Pill, TrendingUp, FlaskConical,
  BookOpen, Target, ChevronRight,
} from 'lucide-react';

// Map [TAG] markers to Lucide icons + colors
const TAG_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  GOOD:     { icon: CheckCircle2,   color: 'text-status-good',     bg: 'bg-status-good/10' },
  WATCH:    { icon: AlertTriangle,  color: 'text-status-warning',  bg: 'bg-accent/10' },
  ALERT:    { icon: AlertOctagon,   color: 'text-status-critical', bg: 'bg-destructive/10' },
  TIP:      { icon: Lightbulb,      color: 'text-primary',         bg: 'bg-primary/10' },
  COST:     { icon: DollarSign,     color: 'text-status-warning',  bg: 'bg-accent/10' },
  TIMING:   { icon: Clock,          color: 'text-primary',         bg: 'bg-primary/10' },
  CYCLE:    { icon: RefreshCw,      color: 'text-primary',         bg: 'bg-primary/10' },
  DATA:     { icon: BarChart3,      color: 'text-primary',         bg: 'bg-primary/10' },
  SCIENCE:  { icon: Dna,            color: 'text-primary',         bg: 'bg-primary/10' },
  SYNERGY:  { icon: Zap,            color: 'text-status-good',     bg: 'bg-status-good/10' },
  SAFETY:   { icon: Shield,         color: 'text-status-warning',  bg: 'bg-accent/10' },
  PROTOCOL: { icon: ClipboardList,  color: 'text-primary',         bg: 'bg-primary/10' },
  DOSING:   { icon: Pill,           color: 'text-primary',         bg: 'bg-primary/10' },
  OUTCOMES: { icon: TrendingUp,     color: 'text-status-good',     bg: 'bg-status-good/10' },
  EVIDENCE: { icon: FlaskConical,   color: 'text-primary',         bg: 'bg-primary/10' },
  DETAIL:   { icon: BookOpen,       color: 'text-muted-foreground',bg: 'bg-secondary/30' },
  ACTION:   { icon: Target,         color: 'text-primary',         bg: 'bg-primary/10' },
};

const TAG_REGEX = /\[([A-Z]+)\]\s*/;

function renderTaggedInline(text: string): React.ReactNode {
  const match = text.match(TAG_REGEX);
  if (!match) return text;

  const tag = match[1];
  const config = TAG_CONFIG[tag];
  if (!config) return text;

  const Icon = config.icon;
  const rest = text.replace(TAG_REGEX, '');

  return (
    <>
      <span className={`inline-flex items-center gap-1 mr-1.5 ${config.color}`}>
        <Icon className="w-3.5 h-3.5" strokeWidth={2} />
      </span>
      {rest}
    </>
  );
}

function renderTaggedHeading(text: string): React.ReactNode {
  const match = text.match(TAG_REGEX);
  if (!match) return text;

  const tag = match[1];
  const config = TAG_CONFIG[tag];
  if (!config) return text;

  const Icon = config.icon;
  const rest = text.replace(TAG_REGEX, '');

  return (
    <span className="flex items-center gap-2">
      <span className={`flex items-center justify-center w-5 h-5 rounded ${config.bg}`}>
        <Icon className={`w-3 h-3 ${config.color}`} strokeWidth={2.5} />
      </span>
      <span>{rest}</span>
    </span>
  );
}

// Process children to extract text content
function extractText(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(extractText).join('');
  if (React.isValidElement(children) && children.props?.children) {
    return extractText(children.props.children);
  }
  return '';
}

const components: Components = {
  // H2 as prominent section headers with bottom border
  h2: ({ children, ...props }) => {
    const text = extractText(children);
    return (
      <h2 {...props}>
        {renderTaggedHeading(text)}
      </h2>
    );
  },
  h3: ({ children, ...props }) => {
    const text = extractText(children);
    return (
      <h3 {...props}>
        {renderTaggedHeading(text)}
      </h3>
    );
  },
  // Style summary text with tag icons
  summary: ({ children, ...props }) => {
    const text = extractText(children);
    return (
      <summary {...props}>
        {renderTaggedInline(text)}
      </summary>
    );
  },
  li: ({ children, ...props }) => {
    const text = extractText(children);
    const match = text.match(TAG_REGEX);
    if (match && TAG_CONFIG[match[1]]) {
      const config = TAG_CONFIG[match[1]];
      const Icon = config.icon;
      return (
        <li {...props} className="flex items-start gap-2 list-none -ml-5 my-1">
          <span className={`flex items-center justify-center w-4 h-4 mt-0.5 rounded-sm ${config.bg} flex-shrink-0`}>
            <Icon className={`w-2.5 h-2.5 ${config.color}`} strokeWidth={2.5} />
          </span>
          <span className="flex-1">{React.Children.map(children, child => {
            if (typeof child === 'string') return child.replace(TAG_REGEX, '');
            return child;
          })}</span>
        </li>
      );
    }
    return <li {...props}>{children}</li>;
  },
  // Style bold text that contains [ACTION] tags
  strong: ({ children, ...props }) => {
    const text = extractText(children);
    const match = text.match(TAG_REGEX);
    if (match && TAG_CONFIG[match[1]]) {
      const config = TAG_CONFIG[match[1]];
      const Icon = config.icon;
      const rest = text.replace(TAG_REGEX, '');
      return (
        <strong {...props} className="inline-flex items-center gap-1.5">
          <Icon className={`w-3.5 h-3.5 ${config.color}`} strokeWidth={2.5} />
          <span>{rest}</span>
        </strong>
      );
    }
    return <strong {...props}>{children}</strong>;
  },
};

interface ChatMarkdownProps {
  content: string;
}

const ChatMarkdown = ({ content }: ChatMarkdownProps) => (
  <div className="chat-markdown text-sm leading-relaxed max-w-none select-text">
    <ReactMarkdown rehypePlugins={[rehypeRaw]} components={components}>
      {content}
    </ReactMarkdown>
  </div>
);

export default ChatMarkdown;
