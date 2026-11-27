import { useSearchParams } from 'react-router'

/**
 * The open macro item lives in the URL (?item=<macro news id>), so a refresh,
 * a shared link or Back reopens the same panel. Same pattern as the ticker
 * News tab's ?article=.
 */
export function useOpenMacroItem() {
  const [searchParams, setSearchParams] = useSearchParams()
  const raw = Number(searchParams.get('item'))
  const itemId = Number.isInteger(raw) && raw > 0 ? raw : null

  function setItemId(next: number | null) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (next === null) params.delete('item')
        else params.set('item', String(next))
        return params
      },
      // Opening adds a history entry (Back closes the panel); closing replaces it.
      { replace: next === null },
    )
  }

  return { itemId, open: (id: number) => setItemId(id), close: () => setItemId(null) }
}
