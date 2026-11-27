import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { cn } from "@/lib/utils";
import { useSentimentHistory } from "./hooks";
import { formatBucketDay, formatEasternHour } from "@/lib/format";
import type {
  SentimentBucketGranularity,
  SentimentBucketOut,
} from "@/types/api";

const BUCKET_OPTIONS: {
  label: string;
  bucket: SentimentBucketGranularity;
  periods: number;
}[] = [
  { label: "48h", bucket: "hour", periods: 48 },
  { label: "30d", bucket: "day", periods: 30 },
  { label: "12w", bucket: "week", periods: 12 },
];

const CHART_WIDTH = 640;
const CHART_HEIGHT = 120;
const BAR_GAP = 2;
const MAX_BAR_THICKNESS = 24;
const MID_Y = CHART_HEIGHT / 2;
const PLOT_HALF_HEIGHT = MID_Y - 10;

function formatBucketLabel(
  bucketStart: string,
  bucket: SentimentBucketGranularity,
): string {
  return bucket === "hour"
    ? formatEasternHour(bucketStart)
    : formatBucketDay(bucketStart);
}

function BucketDetail({
  bucket,
  granularity,
}: {
  bucket: SentimentBucketOut | null;
  granularity: SentimentBucketGranularity;
}) {
  if (!bucket) {
    return (
      <p className="text-muted-foreground text-xs">
        Hover or focus a bar for details.
      </p>
    );
  }
  if (bucket.avg_net_score === null) {
    return (
      <p className="text-xs">
        <span className="font-medium">
          {formatBucketLabel(bucket.bucket_start, granularity)}
        </span>
        <span className="text-muted-foreground"> — no news</span>
      </p>
    );
  }
  return (
    <p className="text-xs">
      <span className="font-medium">
        {formatBucketLabel(bucket.bucket_start, granularity)}
      </span>
      <span className="text-muted-foreground">
        {" "}
        — avg {bucket.avg_net_score >= 0 ? "+" : ""}
        {bucket.avg_net_score.toFixed(2)} · {bucket.positive_count} positive /{" "}
        {bucket.negative_count} negative / {bucket.neutral_count} neutral
      </span>
    </p>
  );
}

export function SentimentTrendChart({ ticker }: { ticker: string }) {
  const [optionIndex, setOptionIndex] = useState(1);
  const option = BUCKET_OPTIONS[optionIndex];
  const { data, isPending, isError, error, refetch } = useSentimentHistory(
    ticker,
    option.bucket,
    option.periods,
  );
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const barSlot = CHART_WIDTH / option.periods;
  const barWidth = Math.max(1, Math.min(MAX_BAR_THICKNESS, barSlot - BAR_GAP));
  const hoveredBucket =
    data && hoveredIndex !== null ? data.buckets[hoveredIndex] : null;
  const maxCount = Math.max(
    1,
    ...(data?.buckets ?? []).flatMap((b) => [
      b.positive_count,
      b.negative_count,
    ]),
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>News sentiment trend</CardTitle>
        <div className="flex items-center gap-1">
          {BUCKET_OPTIONS.map((opt, i) => (
            <Button
              key={opt.label}
              size="sm"
              variant={i === optionIndex ? "secondary" : "ghost"}
              onClick={() => {
                setOptionIndex(i);
                setHoveredIndex(null);
              }}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isPending && <Skeleton className="h-32 rounded-lg" />}
        {isError && <ErrorState error={error} onRetry={() => refetch()} />}

        {data && (
          <>
            <svg
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              className="w-full"
              role="img"
              aria-label={`News sentiment trend for ${ticker}, last ${option.label}`}
            >
              <line
                x1={0}
                y1={MID_Y}
                x2={CHART_WIDTH}
                y2={MID_Y}
                className="stroke-border"
                strokeWidth={1}
              />
              {data.buckets.map((bucket, i) => {
                const x = i * barSlot + (barSlot - barWidth) / 2;
                const isHovered = hoveredIndex === i;
                // Positive articles rise above the midline and negative ones fall below
                // it, each scaled by count: an average would let a day's few negatives
                // vanish under its positives.
                const positiveHeight =
                  (bucket.positive_count / maxCount) * PLOT_HALF_HEIGHT;
                const negativeHeight =
                  (bucket.negative_count / maxCount) * PLOT_HALF_HEIGHT;

                return (
                  <g
                    key={bucket.bucket_start}
                    tabIndex={0}
                    aria-label={`${formatBucketLabel(bucket.bucket_start, option.bucket)}: ${bucket.positive_count} positive, ${bucket.negative_count} negative, ${bucket.neutral_count} neutral`}
                    onPointerEnter={() => setHoveredIndex(i)}
                    onPointerLeave={() => setHoveredIndex(null)}
                    onFocus={() => setHoveredIndex(i)}
                    onBlur={() => setHoveredIndex(null)}
                    className={cn("outline-none", isHovered && "opacity-75")}
                  >
                    <rect
                      x={i * barSlot}
                      y={0}
                      width={barSlot}
                      height={CHART_HEIGHT}
                      fill="transparent"
                    />
                    {positiveHeight === 0 && negativeHeight === 0 ? (
                      <circle
                        cx={x + barWidth / 2}
                        cy={MID_Y}
                        r={2}
                        className={cn(
                          "fill-muted-foreground/40",
                          isHovered && "fill-muted-foreground",
                        )}
                      />
                    ) : (
                      <>
                        {positiveHeight > 0 && (
                          <rect
                            x={x}
                            y={MID_Y - positiveHeight}
                            width={barWidth}
                            height={positiveHeight}
                            rx={2}
                            className="fill-[#2a78d6] dark:fill-[#3987e5]"
                          />
                        )}
                        {negativeHeight > 0 && (
                          <rect
                            x={x}
                            y={MID_Y}
                            width={barWidth}
                            height={negativeHeight}
                            rx={2}
                            className="fill-[#e34948] dark:fill-[#e66767]"
                          />
                        )}
                      </>
                    )}
                  </g>
                );
              })}
            </svg>
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>
                {formatBucketLabel(data.buckets[0].bucket_start, option.bucket)}
              </span>
              <span>
                {formatBucketLabel(
                  data.buckets[data.buckets.length - 1].bucket_start,
                  option.bucket,
                )}
              </span>
            </div>
            <p className="text-muted-foreground text-xs">
              Bars count articles: positive above the line, negative below.
            </p>
            <BucketDetail bucket={hoveredBucket} granularity={option.bucket} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
