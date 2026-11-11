// The only file to edit after buying a domain. Every value is filled into the
// page by main.ts. Rebuild (or push, if the host builds for you) after a change.

export interface SiteConfig {
  /** The business name. Change it here and it changes everywhere. */
  brand: string;
  /** The domain the site is served from, without https:// */
  domain: string;
  /** The address people write to. Used for every contact link. */
  email: string;
  /** Optional. A founder's name. Empty hides it. */
  founder: string;
  /** Optional. A scheduling link. Empty hides the booking button. */
  calendarUrl: string;
  /** Optional. A postal address for the footer. Empty hides it. */
  postalAddress: string;
}

export const config: SiteConfig = {
  brand: 'Dutch Door',
  domain: 'example.com',
  email: 'hello@example.com',
  founder: '',
  calendarUrl: '',
  postalAddress: '',
};
