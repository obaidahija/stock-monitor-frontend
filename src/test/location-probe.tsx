import { useLocation } from 'react-router'
import { CURRENT_LOCATION_LABEL } from './location'

/** Renders the router's current path and query so a test can assert where navigation landed. */
export function LocationProbe() {
  const location = useLocation()
  return <output aria-label={CURRENT_LOCATION_LABEL}>{location.pathname + location.search}</output>
}
