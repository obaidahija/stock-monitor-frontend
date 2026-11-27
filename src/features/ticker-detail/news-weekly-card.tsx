import { useState } from "react";
import { ChevronDown, ExternalLink, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { NewsAnalysisBadge } from "@/components/shared/news-analysis-badge";
import {
  DIRECTION_COLOR_CLASSES,
  type ImpactDirection,
} from "@/lib/direction-colors";
import {
  formatBucketDay,
  formatEasternDate,
  formatEasternDateTimeWithYear,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  NewsWeeklyDayOut,
  NewsWeeklyStoryOut,
  NewsWeeklySummaryOut,
} from "@/types/api";
import { useGenerateNewsWeekly, useNewsWeekly } from "./hooks";

const LEAN_DIRECTION: Record<string, ImpactDirection> = {
  mostly_positive: "positive",
  leaning_positive: "positive",
  mixed: "mixed",
  leaning_negative: "negative",
  mostly_negative: "negative",
};

function dayLabel(date: string): string {
  return formatBucketDay(`${date}T00:00:00Z`);
}

function Counts({ totals }: { totals: Record<string, number> }) {
  const positive = (totals.strong_positive ?? 0) + (totals.positive ?? 0);
  const negative = (totals.strong_negative ?? 0) + (totals.negative ?? 0);
  const chips: [string, number, ImpactDirection][] = [
    ["positive", positive, "positive"],
    ["negative", negative, "negative"],
    ["neutral", totals.neutral ?? 0, "uncertain"],
  ];
  return (
    <span className="flex flex-wrap gap-1.5 text-[11px] font-medium">
      {chips.map(([name, count, direction]) =>
        count > 0 ? (
          <span
            key={name}
            className={cn(
              "rounded px-1.5 py-0.5",
              DIRECTION_COLOR_CLASSES[direction],
            )}
          >
            {count} {name}
          </span>
        ) : null,
      )}
    </span>
  );
}

/** One line: each day's positive / negative story counts. */
function DayStrip({ days }: { days: NewsWeeklyDayOut[] }) {
  return (
    <div className="text-muted-foreground mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] tabular-nums">
      {days.map((day) => {
        const positive = day.strong_positive + day.positive;
        const negative = day.strong_negative + day.negative;
        return (
          <span
            key={day.date}
            title={`${day.neutral} neutral${day.not_read ? `, ${day.not_read} not read` : ""}`}
          >
            {dayLabel(day.date)}{" "}
            <span
              className={cn(
                positive > 0 && "text-emerald-600 dark:text-emerald-400",
              )}
            >
              +{positive}
            </span>{" "}
            <span
              className={cn(negative > 0 && "text-red-600 dark:text-red-400")}
            >
              −{negative}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function StoryRow({
  story,
  onOpen,
}: {
  story: NewsWeeklyStoryOut;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="py-2">
      <button
        type="button"
        className="flex w-full items-start gap-2 text-left"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <NewsAnalysisBadge label={story.label} className="shrink-0" />
        <span className="min-w-0 flex-1 text-sm font-medium">
          {story.title}
        </span>
        <span className="text-muted-foreground shrink-0 text-xs">
          {formatEasternDate(story.published_at)}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "text-muted-foreground mt-0.5 size-4 shrink-0",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="text-muted-foreground mt-2 space-y-1.5 pl-1 text-sm">
          {story.quote && <p className="font-serif">“{story.quote}”</p>}
          <button
            type="button"
            className="text-primary inline-flex items-center gap-1 text-xs underline underline-offset-4"
            onClick={onOpen}
          >
            Open the full analysis{" "}
            <ExternalLink aria-hidden className="size-3" />
          </button>
        </div>
      )}
    </li>
  );
}

function caveat(weekly: NewsWeeklySummaryOut): string {
  const parts = ["One count per story, from the local news model."];
  if (weekly.totals.not_read)
    parts.push(`${weekly.totals.not_read} could not be downloaded.`);
  if (weekly.totals.skipped) {
    parts.push(
      `${weekly.totals.skipped} template stories (fund-holding filings, roundups) skipped.`,
    );
  }
  parts.push(
    weekly.overview.method === "bart-large-cnn"
      ? "The summary’s second part is written by BART from quoted business factors."
      : "The summary’s second part quotes the strongest business factor.",
  );
  parts.push(
    "Describes the news, not the stock’s direction; not investment advice.",
  );
  return parts.join(" ");
}

/** Last 7 days of news for a ticker from the full-article analyses, generated on request. */
export function NewsWeeklyCard({
  ticker,
  onOpenArticle,
}: {
  ticker: string;
  onOpenArticle: (itemId: number) => void;
}) {
  const query = useNewsWeekly(ticker);
  const generate = useGenerateNewsWeekly(ticker);
  const weekly = query.data;

  return (
    <section
      aria-label="Last 7 days"
      className="bg-muted/30 rounded-xl border p-4"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Last 7 days</h2>
          <p className="text-muted-foreground text-xs">
            {weekly ? (
              <>
                From this app’s article analysis · Updated{" "}
                <time dateTime={weekly.generated_at}>
                  {formatEasternDateTimeWithYear(weekly.generated_at)}
                </time>
              </>
            ) : (
              "This week’s stories counted positive or negative from the full articles, with a short summary"
            )}
          </p>
          {weekly && <Counts totals={weekly.totals} />}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={generate.isPending || query.isPending}
          onClick={() => generate.mutate()}
        >
          {generate.isPending ? (
            <Spinner />
          ) : weekly ? (
            <RefreshCw />
          ) : (
            <Sparkles />
          )}
          {generate.isPending ? "Generating…" : weekly ? "Refresh" : "Generate"}
        </Button>
      </div>

      {generate.isPending && (
        <p role="status" className="text-muted-foreground text-sm">
          Reading this week’s unread articles, then summarizing — the first time
          can take a few minutes…
        </p>
      )}
      {!generate.isPending && generate.isError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Generating the summary failed. Please retry.
        </p>
      )}
      {query.isPending ? (
        <p
          className="text-muted-foreground animate-pulse text-sm"
          role="status"
        >
          Loading saved summary…
        </p>
      ) : weekly ? (
        <>
          <div
            aria-label="Summary"
            className={cn(
              "mb-2 rounded-lg px-3 py-2 text-sm",
              DIRECTION_COLOR_CLASSES[
                LEAN_DIRECTION[weekly.lean] ?? "uncertain"
              ],
            )}
          >
            {weekly.summary}
          </div>
          <DayStrip days={weekly.days} />
          <ul className="divide-border divide-y">
            {weekly.stories.map((story) => (
              <StoryRow
                key={story.item_id}
                story={story}
                onOpen={() => onOpenArticle(story.item_id)}
              />
            ))}
          </ul>
          <p className="text-muted-foreground mt-2 text-[11px]">
            {caveat(weekly)}
          </p>
        </>
      ) : (
        !generate.isPending &&
        !generate.isError && (
          <p className="text-muted-foreground text-sm">
            No summary yet. Generate one to count this week’s positive and
            negative stories.
          </p>
        )
      )}
    </section>
  );
}
