import { screen } from '@testing-library/react'

export const CURRENT_LOCATION_LABEL = 'Current location'

/** Reads the path and query shown by a rendered LocationProbe. */
export function currentLocation() {
  return screen.getByLabelText(CURRENT_LOCATION_LABEL).textContent
}
