import { formatRelativeTime } from '@/lib/format'
import type { TwitterSignalScoreOut } from '@/types/api'

const COMPONENT_MAX: Record<string, number> = {
  relevance_score: 25,
  virality_score: 25,
  source_trust_score: 20,
  freshness_score: 15,
  corroboration_score: 15,
  risk_penalty_score: 25,
}

const COMPONENT_LABEL: Record<string, string> = {
  relevance_score: 'Relevance',
  virality_score: 'Virality',
  source_trust_score: 'Source trust',
  freshness_score: 'Freshness',
  corroboration_score: 'Corroboration',
  risk_penalty_score: 'Risk penalty',
}

function ScoreBar({ componentKey, value }: { componentKey: string; value: number }) {
  const max = COMPONENT_MAX[componentKey]
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const isRisk = componentKey === 'risk_penalty_score'
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{COMPONENT_LABEL[componentKey]}</span>
        <span className="tabular-nums">
          {isRisk && value > 0 ? '−' : ''}
          {value.toFixed(1)} / {max}
        </span>
      </div>
      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
        <div
          className={isRisk ? 'h-full bg-red-500' : 'h-full bg-primary'}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function SignalScoreDetail({ score }: { score: TwitterSignalScoreOut }) {
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">Signal score</p>
        <p className="text-lg font-semibold tabular-nums">{score.final_score.toFixed(1)}</p>
      </div>

      <div className="space-y-2.5">
        <ScoreBar componentKey="relevance_score" value={score.relevance_score} />
        <ScoreBar componentKey="virality_score" value={score.virality_score} />
        <ScoreBar componentKey="source_trust_score" value={score.source_trust_score} />
        <ScoreBar componentKey="freshness_score" value={score.freshness_score} />
        <ScoreBar componentKey="corroboration_score" value={score.corroboration_score} />
        <ScoreBar componentKey="risk_penalty_score" value={score.risk_penalty_score} />
      </div>

      {score.explanations.length > 0 && (
        <ul className="text-muted-foreground space-y-1 text-xs">
          {score.explanations.map((item) => (
            <li key={item.component}>{item.explanation}</li>
          ))}
        </ul>
      )}

      {score.matched_risk_rules.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-red-600 dark:text-red-400">Risk rules matched</p>
          <ul className="text-muted-foreground space-y-0.5 text-xs">
            {score.matched_risk_rules.map((rule) => (
              <li key={rule.rule_id}>
                {rule.explanation} (−{rule.penalty_points.toFixed(1)})
              </li>
            ))}
          </ul>
        </div>
      )}

      {score.corroborating_sources.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium">Corroborating sources</p>
          <p className="text-muted-foreground text-xs">{score.corroborating_sources.join(', ')}</p>
        </div>
      )}

      <p className="text-muted-foreground text-xs">
        Calculated {formatRelativeTime(score.calculated_at)} · {score.version}
      </p>
    </div>
  )
}
