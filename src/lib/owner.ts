// The casino owner's username. Defaults to the original owner but can be
// overridden at runtime (SiteConfig key "owner_username") so ownership can be
// transferred — e.g. when the site is sold to a new operator. Comparison is
// case-insensitive.
const DEFAULT_OWNER = "ditol21";
let currentOwner = DEFAULT_OWNER;

export function isOwner(username: string | null | undefined): boolean {
  return !!username && username.toLowerCase() === currentOwner.toLowerCase();
}

export function getOwner(): string {
  return currentOwner;
}

/** Set the owner username (transfers ownership). Ignored if blank. */
export function setOwner(username: string | null | undefined): void {
  if (username && username.trim()) currentOwner = username.trim();
}
