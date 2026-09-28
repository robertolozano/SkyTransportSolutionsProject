/**
 * The site's front door is the public walkthrough, not the staff console —
 * whoever lands on the bare domain is most likely a prospect. `/start` stays
 * as an alias so existing links and the submission flow keep working.
 */
export { default, metadata } from './start/page'
