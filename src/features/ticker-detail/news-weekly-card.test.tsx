import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NewsWeeklySummaryOut } from "@/types/api";
import { useGenerateNewsWeekly, useNewsWeekly } from "./hooks";
import { NewsWeeklyCard } from "./news-weekly-card";

vi.mock("./hooks", () => ({
  useNewsWeekly: vi.fn(),
  useGenerateNewsWeekly: vi.fn(),
}));

const day = (date: string, positive = 0, negative = 0) => ({
  date,
  strong_positive: 0,
  positive,
  neutral: 1,
  negative,
  strong_negative: 0,
  not_read: 0,
  skipped: 0,
  net: null,
});

const WEEKLY: NewsWeeklySummaryOut = {
  ticker: "TSM",
  start_date: "2026-11-21",
  end_date: "2026-11-27",
  lean: "leaning_positive",
  summary:
    "Leaning positive 7 days for TSM: 3 of 5 stories positive, 1 negative, 1 neutral.",
  count_sentence: "Leaning positive 7 days for TSM.",
  overview: {
    text: "Revenue rose.",
    method: "bart-large-cnn",
    unsupported_numbers: [],
  },
  totals: {
    strong_positive: 1,
    positive: 2,
    neutral: 1,
    negative: 1,
    readable: 5,
    not_read: 2,
    skipped: 1,
  },
  themes: [{ event_type: "earnings_revenue", factors: 3 }],
  days: [day("2026-11-26", 2), day("2026-11-27", 1, 1)],
  stories: [
    {
      item_id: 42,
      title: "TSMC October revenue up 60%",
      published_at: "2026-11-24T15:00:00Z",
      source: "yahoo",
      url: "https://example.com",
      label: "strong_positive",
      net_score: 0.8,
      quote: "October revenue rose 59.7%.",
      quote_direction: "positive",
    },
  ],
  generated_at: "2026-11-27T20:00:00Z",
  seconds: 12,
  backfill: null,
};

function mockHooks(data: NewsWeeklySummaryOut | null, mutate = vi.fn()) {
  vi.mocked(useNewsWeekly).mockReturnValue({
    data,
    isPending: false,
    isError: false,
    isSuccess: true,
  } as unknown as ReturnType<typeof useNewsWeekly>);
  vi.mocked(useGenerateNewsWeekly).mockReturnValue({
    mutate,
    isPending: false,
  } as unknown as ReturnType<typeof useGenerateNewsWeekly>);
  return mutate;
}

describe("NewsWeeklyCard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("offers Generate when nothing was generated yet", () => {
    const mutate = mockHooks(null);
    render(<NewsWeeklyCard ticker="TSM" onOpenArticle={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));
    expect(mutate).toHaveBeenCalled();
  });

  it("shows the summary and counts; a story expands, then opens in the side panel", () => {
    mockHooks(WEEKLY);
    const open = vi.fn();
    render(<NewsWeeklyCard ticker="TSM" onOpenArticle={open} />);
    expect(screen.getByText(WEEKLY.summary)).toBeInTheDocument();
    expect(screen.getByText("3 positive")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /refresh/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 could not be downloaded/)).toBeInTheDocument();
    expect(screen.queryByText(/October revenue rose/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("TSMC October revenue up 60%"));
    expect(screen.getByText(/October revenue rose/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /open the full analysis/i }),
    );
    expect(open).toHaveBeenCalledWith(42);
  });
});
