export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Squarified treemap (Bruls, Huizing & van Wijk): lays `values` out inside
 * `bounds` with areas proportional to each value, keeping boxes as close to
 * square as possible. Returns one rect per value, in input order. Zero or
 * negative values get an empty rect. */
export function squarify(values: number[], bounds: Rect): Rect[] {
  const result: Rect[] = values.map(() => ({ x: bounds.x, y: bounds.y, w: 0, h: 0 }))
  const total = values.reduce((sum, v) => sum + Math.max(v, 0), 0)
  if (total <= 0 || bounds.w <= 0 || bounds.h <= 0) return result

  const scale = (bounds.w * bounds.h) / total
  const order = values
    .map((v, i) => ({ i, area: Math.max(v, 0) * scale }))
    .filter((item) => item.area > 0)
    .sort((a, b) => b.area - a.area)

  let free = { ...bounds }
  let row: typeof order = []

  const worst = (items: typeof order, side: number) => {
    const sum = items.reduce((s, item) => s + item.area, 0)
    const max = Math.max(...items.map((item) => item.area))
    const min = Math.min(...items.map((item) => item.area))
    return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min))
  }

  const placeRow = (items: typeof order) => {
    const sum = items.reduce((s, item) => s + item.area, 0)
    if (free.w >= free.h) {
      // Lay the row as a column on the left edge.
      const colWidth = sum / free.h
      let y = free.y
      for (const item of items) {
        const h = item.area / colWidth
        result[item.i] = { x: free.x, y, w: colWidth, h }
        y += h
      }
      free = { x: free.x + colWidth, y: free.y, w: free.w - colWidth, h: free.h }
    } else {
      const rowHeight = sum / free.w
      let x = free.x
      for (const item of items) {
        const w = item.area / rowHeight
        result[item.i] = { x, y: free.y, w, h: rowHeight }
        x += w
      }
      free = { x: free.x, y: free.y + rowHeight, w: free.w, h: free.h - rowHeight }
    }
  }

  for (const item of order) {
    const side = Math.min(free.w, free.h)
    if (row.length === 0 || worst([...row, item], side) <= worst(row, side)) {
      row.push(item)
    } else {
      placeRow(row)
      row = [item]
    }
  }
  if (row.length > 0) placeRow(row)
  return result
}
