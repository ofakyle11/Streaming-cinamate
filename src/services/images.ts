/**
 * Neutral placeholder artwork for titles whose TMDB poster/backdrop path is
 * missing. An inline SVG data: URI (CSP img-src already allows data:), so no
 * network request is made and no broken-image icon or empty `url()` appears.
 * Colours mirror tokens.css (--color-surface-solid, --glass-border, --color-muted).
 */
const PLACEHOLDER_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300" preserveAspectRatio="xMidYMid slice">' +
  '<rect width="200" height="300" fill="#141420"/>' +
  '<rect x="0.5" y="0.5" width="199" height="299" fill="none" stroke="#ffffff" stroke-opacity="0.12"/>' +
  '<g fill="none" stroke="#a9a9bb" stroke-opacity="0.55" stroke-width="4" stroke-linejoin="round">' +
  '<rect x="70" y="125" width="60" height="44" rx="6"/>' +
  '<path d="M92 137l18 10-18 10z" fill="#a9a9bb" fill-opacity="0.55" stroke="none"/>' +
  '</g></svg>';

export const TITLE_PLACEHOLDER_IMAGE = `data:image/svg+xml,${encodeURIComponent(PLACEHOLDER_SVG)}`;

/** Returns `url`, or the neutral placeholder when it is empty. */
export function imageOrPlaceholder(url: string): string {
  return url ? url : TITLE_PLACEHOLDER_IMAGE;
}
