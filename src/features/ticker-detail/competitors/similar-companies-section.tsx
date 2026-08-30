import { Link } from 'react-router'
import type { SimilarCompanyOut } from '@/types/api'

// A second, independent competitor signal alongside the evidence-grounded
// list above: an industry/peer-group similarity read, not "named as a
// competitor" evidence -- kept in its own lightweight section (no rank/
// impact/confidence, since that depth doesn't apply here) rather than
// merged into the confirmed-competitor rows.
export function SimilarCompaniesSection({ companies }: { companies: SimilarCompanyOut[] }) {
  if (companies.length === 0) return null

  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold">Similar Companies</h3>
        <p className="text-muted-foreground text-xs">
          Companies in the same industry/peer group — a similarity read, not evidence that
          either names the other as a competitor.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {companies.map((company) => (
          <Link
            key={company.ticker}
            to={`/stocks/${company.ticker}`}
            className="border-border bg-muted/40 hover:bg-muted inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors"
          >
            <span className="font-medium">{company.ticker}</span>
            {company.name && <span className="text-muted-foreground">{company.name}</span>}
          </Link>
        ))}
      </div>
    </div>
  )
}
