import React from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bot,
  Brain,
  Bug,
  CheckCircle,
  Clock,
  Code,
  Code2,
  Eye,
  FileText,
  GitCompare,
  Globe,
  ListChecks,
  MessageSquare,
  ScanSearch,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Workflow,
  Zap,
} from 'lucide-react';

/** Icons named in content.js, by name. */
export const ICONS = {
  AlertTriangle,
  BarChart3,
  Bot,
  Brain,
  Bug,
  CheckCircle,
  Clock,
  Code,
  Code2,
  Eye,
  FileText,
  GitCompare,
  Globe,
  ListChecks,
  MessageSquare,
  ScanSearch,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Workflow,
  Zap,
};

/** Colour sets, spelled out in full so Tailwind keeps every class. */
export const TONES = {
  violet: { tile: 'border-violet-400/25 bg-violet-500/15', icon: 'text-violet-300', text: 'text-violet-300' },
  rose: { tile: 'border-rose-400/25 bg-rose-500/15', icon: 'text-rose-300', text: 'text-rose-300' },
  amber: { tile: 'border-amber-400/25 bg-amber-500/15', icon: 'text-amber-300', text: 'text-amber-300' },
  sky: { tile: 'border-sky-400/25 bg-sky-500/15', icon: 'text-sky-300', text: 'text-sky-300' },
  emerald: { tile: 'border-emerald-400/25 bg-emerald-500/15', icon: 'text-emerald-300', text: 'text-emerald-300' },
  yellow: { tile: 'border-yellow-400/25 bg-yellow-500/15', icon: 'text-yellow-300', text: 'text-yellow-300' },
  teal: { tile: 'border-teal-400/25 bg-teal-500/15', icon: 'text-teal-300', text: 'text-teal-300' },
  green: { tile: 'border-green-400/25 bg-green-500/15', icon: 'text-green-300', text: 'text-green-300' },
  fuchsia: { tile: 'border-fuchsia-400/25 bg-fuchsia-500/15', icon: 'text-fuchsia-300', text: 'text-fuchsia-300' },
  cyan: { tile: 'border-cyan-400/25 bg-cyan-500/15', icon: 'text-cyan-300', text: 'text-cyan-300' },
  pink: { tile: 'border-pink-400/25 bg-pink-500/15', icon: 'text-pink-300', text: 'text-pink-300' },
  indigo: { tile: 'border-indigo-400/25 bg-indigo-500/15', icon: 'text-indigo-300', text: 'text-indigo-300' },
};

/** Renders a description made of text and { code } parts. */
export function RichParts({ parts }) {
  return parts.map((part, index) =>
    typeof part === 'string' ? (
      part
    ) : (
      <code
        // eslint-disable-next-line react/no-array-index-key
        key={index}
        className="rounded-md bg-sdt-violet/10 px-1.5 py-0.5 font-code text-[0.85em] text-sdt-violet-strong"
      >
        {part.code}
      </code>
    )
  );
}

/** Smoothly scrolls to a section, or jumps there for reduced motion. */
export function scrollToSection(event, id) {
  const target = document.getElementById(id);
  if (!target) return;
  event.preventDefault();
  const reduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (typeof target.scrollIntoView === 'function') {
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }
  if (typeof window.history?.replaceState === 'function') {
    window.history.replaceState(null, '', `#${id}`);
  }
}
