export interface ResearchArchiveCount {
  key: string
  label: string
  count: number
}

export interface ResearchArchiveCollection {
  kind: string
  label: string
  description: string
  retention: 'manual_only' | 'latest_only'
  counts: ResearchArchiveCount[]
  total_records: number
  first_date: string | null
  last_date: string | null
}

export interface ResearchArchiveInventory {
  generated_at: string
  collections: ResearchArchiveCollection[]
}

export interface ResearchArchiveSelection {
  kind: string
  date_from: string
  date_to: string
}

export interface ResearchArchivePreview extends ResearchArchiveSelection {
  label: string
  counts: ResearchArchiveCount[]
  total_records: number
  protected_records: number
  expires_at: string
  token: string
}

export interface ResearchArchiveDeleteRequest {
  token: string
  confirmation: 'DELETE'
}

export interface ResearchArchiveDeleteResult {
  kind: string
  counts: ResearchArchiveCount[]
  total_records: number
  deleted_at: string
}
