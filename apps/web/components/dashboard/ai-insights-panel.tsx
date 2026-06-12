'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Banknote,
  BarChart3,
  Bot,
  Brain,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  GraduationCap,
  LineChart,
  RefreshCcw,
  Search,
  ShieldAlert,
  Timer,
  Users,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AI_INSIGHTS,
  type AiCampusInsight,
  type AiInsightCategory,
  type AiInsightPriority,
  type AiInsightTrend,
} from '@/modules/dashboard/mock-data';
import { cn } from '@/utils/cn';

const CATEGORY_META: Record<AiInsightCategory, { label: string; icon: LucideIcon; color: string }> =
  {
    attendance: { label: 'Attendance', icon: ShieldAlert, color: 'text-rose-600' },
    finance: { label: 'Finance', icon: Banknote, color: 'text-amber-600' },
    academic: { label: 'Academic', icon: GraduationCap, color: 'text-blue-600' },
    infrastructure: { label: 'Infrastructure', icon: Wrench, color: 'text-indigo-600' },
    timetable: { label: 'Timetable', icon: CalendarClock, color: 'text-violet-600' },
    admissions: { label: 'Admissions', icon: Building2, color: 'text-cyan-600' },
    staff: { label: 'Staff', icon: Users, color: 'text-orange-600' },
    students: { label: 'Students', icon: Brain, color: 'text-emerald-600' },
  };

const PRIORITY_META: Record<
  AiInsightPriority,
  { label: string; classes: string; card: string; dot: string; pulse?: boolean }
> = {
  CRITICAL: {
    label: 'Critical',
    classes: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
    card: 'border-rose-500/25 bg-gradient-to-br from-rose-500/10 via-card to-card',
    dot: 'bg-rose-500',
    pulse: true,
  },
  HIGH: {
    label: 'High',
    classes: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300',
    card: 'border-orange-500/25 bg-gradient-to-br from-orange-500/10 via-card to-card',
    dot: 'bg-orange-500',
  },
  MEDIUM: {
    label: 'Medium',
    classes: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
    card: 'border-blue-500/25 bg-gradient-to-br from-blue-500/10 via-card to-card',
    dot: 'bg-blue-500',
  },
  LOW: {
    label: 'Low',
    classes: 'border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-300',
    card: 'border-border/70 bg-card/90',
    dot: 'bg-slate-400',
  },
  POSITIVE_SIGNAL: {
    label: 'Positive',
    classes: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    card: 'border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-card to-card',
    dot: 'bg-emerald-500',
  },
};

const CATEGORY_OPTIONS: Array<'all' | AiInsightCategory> = [
  'all',
  'attendance',
  'finance',
  'academic',
  'infrastructure',
  'timetable',
  'admissions',
  'staff',
  'students',
];
const PRIORITY_OPTIONS = ['all', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'POSITIVE_SIGNAL'] as const;

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function AiInsightsPanel() {
  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number]>('all');
  const [priority, setPriority] = useState<(typeof PRIORITY_OPTIONS)[number]>('all');
  const [sortBy, setSortBy] = useState('risk');
  const [dateRange, setDateRange] = useState('7d');
  const [department, setDepartment] = useState('all');
  const [query, setQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(AI_INSIGHTS[0]?.id ?? null);
  const greeting = getTimeGreeting();

  const filteredInsights = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return AI_INSIGHTS.filter((insight) => {
      const matchesCategory = category === 'all' || insight.category === category;
      const matchesPriority = priority === 'all' || insight.priority === priority;
      const matchesDepartment =
        department === 'all' ||
        insight.affectedEntities.some((entity) =>
          entity.toLowerCase().includes(department.toLowerCase()),
        );
      const matchesDateRange = isInsideDateRange(insight.updatedAt, dateRange);
      const matchesQuery =
        !normalizedQuery ||
        [insight.title, insight.summary, insight.impact, ...insight.affectedEntities]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      return (
        matchesCategory && matchesPriority && matchesDepartment && matchesDateRange && matchesQuery
      );
    }).sort((left, right) => {
      if (sortBy === 'confidence') return right.confidence - left.confidence;
      if (sortBy === 'newest')
        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      if (sortBy === 'impacted')
        return right.affectedEntities.length - left.affectedEntities.length;
      return priorityRank(left.priority) - priorityRank(right.priority);
    });
  }, [category, dateRange, department, priority, query, sortBy]);

  const summary = useMemo(() => buildSummary(AI_INSIGHTS), []);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-background via-card to-primary/5 p-4 shadow-sm sm:p-5"
      aria-labelledby="ai-campus-intelligence-title"
    >
      <div className="pointer-events-none absolute -right-12 top-0 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-accent/10 blur-3xl" />

      <div className="relative space-y-4">
        <CopilotSummaryPanel summary={summary} autoRefresh={autoRefresh} greeting={greeting} />
        <InsightKpiStrip summary={summary} />
        <InsightControlBar
          category={category}
          setCategory={setCategory}
          priority={priority}
          setPriority={setPriority}
          sortBy={sortBy}
          setSortBy={setSortBy}
          dateRange={dateRange}
          setDateRange={setDateRange}
          department={department}
          setDepartment={setDepartment}
          query={query}
          setQuery={setQuery}
          autoRefresh={autoRefresh}
          setAutoRefresh={setAutoRefresh}
        />

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {filteredInsights.map((insight, index) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              index={index}
              expanded={expandedId === insight.id}
              onToggle={() =>
                setExpandedId((current) => (current === insight.id ? null : insight.id))
              }
            />
          ))}
        </div>

        {!filteredInsights.length ? (
          <div className="rounded-2xl border border-dashed border-border bg-background/70 p-8 text-center text-sm text-muted-foreground">
            No AI insights match the selected filters.
          </div>
        ) : null}
      </div>
    </motion.section>
  );
}

function CopilotSummaryPanel({
  summary,
  autoRefresh,
  greeting,
}: {
  summary: InsightSummary;
  autoRefresh: boolean;
  greeting: string;
}) {
  return (
    <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card/95 to-accent/10 p-4 shadow-sm backdrop-blur sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <Bot className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              AI Campus Intelligence Center
            </p>
            <h3
              id="ai-campus-intelligence-title"
              className="mt-1 text-lg font-semibold tracking-tight"
            >
              {greeting} Admin. {summary.risks} operational risks detected.
            </h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Attendance, fee collection, timetable load, and campus capacity signals have been
              analyzed. Recommended actions are prepared for the highest-impact items.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="rounded-xl">
            Generate Action Plan
          </Button>
          <Button size="sm" variant="outline" className="rounded-xl">
            Open Full Insights
          </Button>
          <Button size="sm" variant="outline" className="rounded-xl">
            <RefreshCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Refresh AI Analysis
          </Button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-700 dark:text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {autoRefresh ? 'Live Analysis Enabled' : 'Live Analysis Paused'}
        </span>
        <span>Updated {formatRelativeTime(AI_INSIGHTS[0]?.updatedAt)}</span>
        <span>Average confidence {summary.averageConfidence}%</span>
      </div>
    </div>
  );
}

function InsightKpiStrip({ summary }: { summary: InsightSummary }) {
  const tiles = [
    {
      label: 'Active Insights',
      value: summary.total,
      icon: Brain,
      tone: 'text-primary',
      line: [3, 4, 4, 6, 7, 8],
    },
    {
      label: 'Critical Risks',
      value: summary.critical,
      icon: ShieldAlert,
      tone: 'text-rose-600',
      line: [1, 1, 2, 3, 4, 4],
    },
    {
      label: 'Predictions',
      value: summary.predictions,
      icon: LineChart,
      tone: 'text-blue-600',
      line: [4, 5, 7, 8, 8, 9],
    },
    {
      label: 'Positive Signals',
      value: summary.positive,
      icon: CheckCircle2,
      tone: 'text-emerald-600',
      line: [7, 8, 9, 10, 11, 12],
    },
    {
      label: 'Actions Pending',
      value: summary.pendingActions,
      icon: Timer,
      tone: 'text-orange-600',
      line: [6, 5, 5, 4, 4, 3],
    },
    {
      label: 'Avg Confidence',
      value: `${summary.averageConfidence}%`,
      icon: Activity,
      tone: 'text-violet-600',
      line: [82, 84, 86, 87, 88, summary.averageConfidence],
    },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <div
            key={tile.label}
            className="rounded-2xl border border-border/70 bg-background/75 p-3 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-xl bg-muted',
                  tile.tone,
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <MiniSparkline values={tile.line} className="mt-1 w-16" />
            </div>
            <p className="mt-3 text-lg font-semibold leading-none">{tile.value}</p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {tile.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function InsightControlBar({
  category,
  setCategory,
  priority,
  setPriority,
  sortBy,
  setSortBy,
  dateRange,
  setDateRange,
  department,
  setDepartment,
  query,
  setQuery,
  autoRefresh,
  setAutoRefresh,
}: {
  category: (typeof CATEGORY_OPTIONS)[number];
  setCategory: (value: (typeof CATEGORY_OPTIONS)[number]) => void;
  priority: (typeof PRIORITY_OPTIONS)[number];
  setPriority: (value: (typeof PRIORITY_OPTIONS)[number]) => void;
  sortBy: string;
  setSortBy: (value: string) => void;
  dateRange: string;
  setDateRange: (value: string) => void;
  department: string;
  setDepartment: (value: string) => void;
  query: string;
  setQuery: (value: string) => void;
  autoRefresh: boolean;
  setAutoRefresh: (value: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/85 p-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          <label className="relative min-w-56 flex-1">
            <span className="sr-only">Search insights</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Search insights, departments, risks..."
            />
          </label>
          <FilterSelect
            label="Category"
            value={category}
            onChange={(value) => setCategory(value as typeof category)}
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === 'all' ? 'All' : CATEGORY_META[option].label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Priority"
            value={priority}
            onChange={(value) => setPriority(value as typeof priority)}
          >
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === 'all' ? 'All priorities' : PRIORITY_META[option].label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Department" value={department} onChange={setDepartment}>
            {['all', 'Commerce', 'Arts', 'Science', 'Garo', 'English', 'Computer'].map((option) => (
              <option key={option} value={option}>
                {option === 'all' ? 'All departments' : option}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Date range" value={dateRange} onChange={setDateRange}>
            <option value="24h">Last 24h</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </FilterSelect>
          <FilterSelect label="Sort" value={sortBy} onChange={setSortBy}>
            <option value="risk">Highest risk</option>
            <option value="confidence">Highest confidence</option>
            <option value="impacted">Most impacted</option>
            <option value="newest">Newest</option>
          </FilterSelect>
        </div>
        <button
          type="button"
          aria-pressed={autoRefresh}
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={cn(
            'inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-primary/30',
            autoRefresh
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-border bg-background text-muted-foreground',
          )}
        >
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              autoRefresh ? 'bg-emerald-500' : 'bg-muted-foreground',
            )}
          />
          Auto refresh
        </button>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="min-w-36">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-xl border border-border bg-background px-3 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      >
        {children}
      </select>
    </label>
  );
}

function InsightCard({
  insight,
  index,
  expanded,
  onToggle,
}: {
  insight: AiCampusInsight;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const category = CATEGORY_META[insight.category];
  const priority = PRIORITY_META[insight.priority];
  const Icon = category.icon;
  const TrendIcon = trendIcon(insight.trend);

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.18) }}
      className={cn(
        'group rounded-2xl border p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-within:ring-2 focus-within:ring-primary/20',
        priority.card,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border bg-background/80',
              category.color,
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {category.label}
            </p>
            <h4 className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug">
              {insight.title}
            </h4>
          </div>
        </div>
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide',
            priority.classes,
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              priority.dot,
              priority.pulse && 'animate-pulse',
            )}
          />
          {priority.label}
        </span>
      </div>

      <p className="mt-3 line-clamp-3 min-h-[3.75rem] text-xs leading-5 text-muted-foreground">
        {insight.summary}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-border/70 bg-background/70 p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Confidence</span>
            <span className="font-semibold">{insight.confidence}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${insight.confidence}%` }}
            />
          </div>
        </div>
        <div className="rounded-xl border border-border/70 bg-background/70 p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Trend</span>
            <span
              className={cn(
                'inline-flex items-center gap-1 font-semibold',
                trendClass(insight.trend),
              )}
            >
              <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {insight.trend}
            </span>
          </div>
          <MiniSparkline values={insight.sparkline} className="mt-2 w-full" trend={insight.trend} />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            window.location.href = insight.href;
          }}
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {insight.action}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={`${insight.id}-details`}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          Details
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition', expanded && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>{insight.impact}</span>
        <span>{formatRelativeTime(insight.updatedAt)}</span>
      </div>

      {expanded ? (
        <div
          id={`${insight.id}-details`}
          className="mt-3 space-y-3 rounded-2xl border border-border/70 bg-background/75 p-3 text-xs"
        >
          <DetailBlock title="Affected">
            <div className="flex flex-wrap gap-1.5">
              {insight.affectedEntities.map((entity) => (
                <span key={entity} className="rounded-full border border-border bg-card px-2 py-1">
                  {entity}
                </span>
              ))}
            </div>
          </DetailBlock>
          <DetailBlock title="Predictions">
            <ul className="space-y-1 text-muted-foreground">
              {insight.predictions.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </DetailBlock>
          <DetailBlock title="Recommendations">
            <ul className="space-y-1 text-muted-foreground">
              {insight.recommendations.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </DetailBlock>
          <p className="rounded-xl bg-muted/60 p-2 leading-5 text-muted-foreground">
            <span className="font-semibold text-foreground">AI reasoning:</span> {insight.reasoning}
          </p>
        </div>
      ) : null}
    </motion.article>
  );
}

function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function MiniSparkline({
  values,
  className,
  trend = 'stable',
}: {
  values: number[];
  className?: string;
  trend?: AiInsightTrend;
}) {
  const points = toSparklinePoints(values);
  return (
    <svg viewBox="0 0 100 24" className={cn('h-6', className)} aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(
          trend === 'improving' && 'text-emerald-500',
          trend === 'worsening' && 'text-rose-500',
          trend === 'stable' && 'text-primary',
        )}
      />
    </svg>
  );
}

function toSparklinePoints(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * 100;
      const y = 22 - ((value - min) / range) * 20;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

type InsightSummary = {
  total: number;
  risks: number;
  critical: number;
  predictions: number;
  positive: number;
  pendingActions: number;
  averageConfidence: number;
};

function buildSummary(insights: AiCampusInsight[]): InsightSummary {
  const averageConfidence = insights.length
    ? Math.round(insights.reduce((sum, insight) => sum + insight.confidence, 0) / insights.length)
    : 0;
  return {
    total: insights.length,
    risks: insights.filter((insight) => ['CRITICAL', 'HIGH'].includes(insight.priority)).length,
    critical: insights.filter((insight) => insight.priority === 'CRITICAL').length,
    predictions: insights.reduce((sum, insight) => sum + insight.predictions.length, 0),
    positive: insights.filter((insight) => insight.priority === 'POSITIVE_SIGNAL').length,
    pendingActions: insights.filter((insight) => insight.priority !== 'POSITIVE_SIGNAL').length,
    averageConfidence,
  };
}

function priorityRank(priority: AiInsightPriority) {
  const order: Record<AiInsightPriority, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
    POSITIVE_SIGNAL: 4,
  };
  return order[priority];
}

function trendIcon(trend: AiInsightTrend) {
  if (trend === 'improving') return ArrowUp;
  if (trend === 'worsening') return ArrowDown;
  return BarChart3;
}

function trendClass(trend: AiInsightTrend) {
  if (trend === 'improving') return 'text-emerald-600 dark:text-emerald-300';
  if (trend === 'worsening') return 'text-rose-600 dark:text-rose-300';
  return 'text-muted-foreground';
}

function isInsideDateRange(value: string, range: string) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return true;
  const hours = range === '24h' ? 24 : range === '30d' ? 24 * 30 : 24 * 7;
  return Date.now() - timestamp <= hours * 60 * 60 * 1000;
}

function formatRelativeTime(value?: string) {
  if (!value) return 'just now';
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return value;
  const minutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
