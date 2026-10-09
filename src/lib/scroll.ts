/**
 * Scrolls `container` sideways so `child` sits in its middle. Unlike
 * scrollIntoView, it never moves the page itself.
 */
export function centerHorizontally(container: HTMLElement, child: HTMLElement): void {
  const box = container.getBoundingClientRect()
  const item = child.getBoundingClientRect()
  const delta = item.left + item.width / 2 - (box.left + box.width / 2)
  container.scrollLeft = Math.max(0, container.scrollLeft + delta)
}
