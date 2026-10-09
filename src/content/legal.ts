/**
 * Legal copy for /privacy, /terms and /security.
 *
 * Everything a reader sees on those pages lives in this one file, so the
 * wording can be edited without touching the page component. Each document is
 * a list of sections; each section's body is a list of blocks, where a string
 * is a paragraph and an array of strings is a bulleted list. Inline markup is
 * deliberately tiny: `**bold**` and `[text](href)` only (see LegalPage.tsx).
 */

export type LegalBlock = string | string[];

export interface LegalSection {
  /** Anchor id, used by the section index (`#id`). */
  id: string;
  heading: string;
  body: LegalBlock[];
}

export interface LegalDocument {
  /** Route segment and footer label key. */
  slug: 'privacy' | 'terms' | 'security';
  /** Short label for the footer and cross-links. */
  label: string;
  /** Page heading. */
  title: string;
  /** Meta description for crawlers and link previews. */
  description: string;
  /** Small eyebrow above the heading. */
  eyebrow: string;
  /** One sentence under the heading. */
  summary: string;
  sections: LegalSection[];
}

/** Shown as "Effective <date>" on every document. */
export const EFFECTIVE_DATE = '9 October 2026';

export const CONTACT = {
  privacy: 'privacy@lastframe.tv',
  security: 'security@lastframe.tv',
  legal: 'legal@lastframe.tv',
} as const;

/** Where the account database runs. Change here if the project moves. */
export const DATA_REGION = 'the United States (US East)';

export const privacy: LegalDocument = {
  slug: 'privacy',
  label: 'Privacy',
  title: 'Privacy policy',
  eyebrow: 'Legal',
  description:
    'What Lastframe.tv collects, how it is used, who sees it and how to delete it. We keep only what the product needs and never sell it.',
  summary:
    'Lastframe.tv helps you find films and series and where to watch them. We keep only what that needs, and you can delete all of it at any time.',
  sections: [
    {
      id: 'what-we-collect',
      heading: 'What we collect',
      body: [
        'If you only browse, nothing about you leaves your device. Your list, viewing history and ratings are stored in your browser until you sign in.',
        'When you sign in we store:',
        [
          '**Your email address**, used to send you a sign-in link and to recognise you next time. If you sign in with Google, we also receive the name and avatar on your Google account.',
          '**The profiles you create**, with their names and avatars.',
          '**Your list, viewing history and ratings**, so they follow you between devices.',
          '**Basic security records**: when you signed in, and for each signed-in browser its name, user agent and when it was last active, so we can spot abuse. You can see those devices on the [Account page](/account) and sign any of them out.',
        ],
        'We do not collect payment details, your contacts, your location, or anything you do inside another streaming service.',
      ],
    },
    {
      id: 'how-we-use-it',
      heading: 'How we use it',
      body: [
        [
          'To sign you in and keep you signed in.',
          'To sync your profiles, list, history and ratings between the devices you use.',
          'To calculate your fit score, which happens on your own device using your ratings and history.',
          'To send you sign-in links and notices about your account, such as a change to this policy.',
          'To keep the service safe: spotting abuse and investigating security reports.',
        ],
        'We do not sell your data, build advertising profiles or share your activity with the services you watch on.',
      ],
    },
    {
      id: 'who-we-share-it-with',
      heading: 'Who we share it with',
      body: [
        'A small number of providers run parts of the service for us. Each receives only what its job needs.',
        [
          '**Supabase** hosts the account database and runs sign-in. It holds your email address, your synced data and a security log of sign-ins.',
          '**Resend** delivers the sign-in and account emails. It sees your email address and keeps delivery records for a short time.',
          '**Google**, only if you choose to sign in with it. Google learns that you signed in to Lastframe.tv and gives us your email address, name and avatar.',
          '**Netlify** serves the website and its small server functions, and sees the usual web server logs (IP address, browser, pages requested).',
          '**Cloudflare** runs the bot check on the sign-in form when it is switched on. It sees your IP address and browser signals for that check only.',
          '**TMDB** supplies title details, artwork and streaming availability (the availability data comes from **JustWatch**). TMDB receives the titles you look up, never your identity. The posters and backdrops you see load from TMDB directly.',
          '**Plausible** counts page views without cookies, fingerprinting or personal identifiers. It receives the page address without any search text you typed. We see totals, not people.',
          '**YouTube** shows trailers, through its privacy-enhanced domain. The home page previews a trailer after a few seconds (never when your device asks for reduced motion), and title pages load one when you open it.',
        ],
        'We share data with anyone else only when the law requires it or to protect the service and its users from abuse.',
      ],
    },
    {
      id: 'where-it-lives',
      heading: 'Where it lives',
      body: [
        `Your account data is stored with Supabase in ${DATA_REGION}. The website is served from Netlify's global network. Your browser keeps a local copy of your list, history and ratings so the app works offline.`,
        'Data is encrypted on the way to and from our servers and at rest in the database. Each account can only read and write its own rows; that rule is enforced by the database, not just the app.',
      ],
    },
    {
      id: 'how-long-we-keep-it',
      heading: 'How long we keep it',
      body: [
        'We keep your account data for as long as your account exists. Viewing history and ratings stay until you remove them or delete the account; an item you remove is kept as a deletion marker so the removal reaches your other devices, and the marker goes when the account does. A signed-in browser you have forgotten is removed after 30 days, and one not seen for six months is removed too.',
        'When you delete your account, your account, profiles, list, history, ratings and devices are removed from the database within 24 hours. Copies in database backups and the short-lived security logs our providers keep (sign-in records, email delivery records, web server logs) expire on those providers’ own schedules; the providers are listed on our [security page](/security).',
      ],
    },
    {
      id: 'your-choices',
      heading: 'Your choices',
      body: [
        [
          '**Stay a guest.** Everything works without an account; your data just stays on this device.',
          '**Delete everything.** Open your [Account page](/account) and choose Delete my data. Deletion completes within 24 hours and cannot be undone.',
          '**Take a copy.** Download your account details, profiles, list, history, ratings and signed-in devices as a file from the [Account page](/account?tab=data), or ask us at the address below.',
          '**Sign out.** Sign out of one device, or every device at once, from your [Account page](/account). A device you sign out on its own leaves the next time it opens Lastframe.tv; use Sign out everywhere for a lost or stolen device.',
          '**Clear this device.** Signing out of an account removes its local copy from this browser. Deleting your data also clears cached artwork.',
        ],
        'If you live somewhere that gives you extra rights over your data, such as Canada, the United Kingdom or the European Economic Area, you can exercise them through the same channels, and we will answer within 30 days.',
      ],
    },
    {
      id: 'cookies',
      heading: 'Cookies and local storage',
      body: [
        'We do not use advertising or tracking cookies. Your browser stores a few things so the app works: your theme choice, your sign-in session, the local copy of your profiles, list, history and ratings, and cached artwork so pages load offline. Plausible analytics runs without cookies.',
      ],
    },
    {
      id: 'children',
      heading: 'Children',
      body: [
        'Lastframe.tv is not directed at children under 13, and we do not knowingly keep accounts for them. If you believe a child has created an account, write to us and we will remove it.',
        'A Kids profile belongs to the adult account that created it. It holds only the profile name and avatar you choose, never a child’s own details.',
      ],
    },
    {
      id: 'changes',
      heading: 'Changes to this policy',
      body: [
        'When this policy changes in a way that matters, we will update the effective date above and, if you have an account, tell you by email before the change takes effect.',
      ],
    },
    {
      id: 'contact',
      heading: 'Contact',
      body: [`Questions about privacy go to [${CONTACT.privacy}](mailto:${CONTACT.privacy}).`],
    },
  ],
};

export const terms: LegalDocument = {
  slug: 'terms',
  label: 'Terms',
  title: 'Terms of service',
  eyebrow: 'Legal',
  description:
    'The terms for using Lastframe.tv: what the service is, what we ask of you, and the limits of what we promise.',
  summary:
    'The short version: use Lastframe.tv to find things to watch, treat it and other people fairly, and understand that availability comes from third parties and can be wrong.',
  sections: [
    {
      id: 'the-service',
      heading: 'The service',
      body: [
        'Lastframe.tv is a discovery service. It shows you films and series, where they are available to stream, rent or buy in your region, and how well each one fits your taste. It does not stream, host or sell video. Watching happens on the service that holds the title.',
        'Availability, prices and artwork come from third parties and can be out of date. Check the streaming service before you rely on them.',
      ],
    },
    {
      id: 'your-account',
      heading: 'Your account',
      body: [
        'You sign in with a link sent to your email address, or with a Google account where that is offered. There is no Lastframe.tv password. Keep your inbox secure, because anyone who can read your email can sign in as you.',
        'You must be at least 13 years old to create an account. You are responsible for what happens under your account, and you should sign out of devices you do not control.',
        'You can delete your account at any time from your [Account page](/account).',
      ],
    },
    {
      id: 'your-data',
      heading: 'Your data',
      body: [
        'Your profiles, list, history and ratings are yours. You give us permission to store and sync them so the service works, and nothing more. Our [privacy policy](/privacy) explains what we keep and why.',
      ],
    },
    {
      id: 'acceptable-use',
      heading: 'Acceptable use',
      body: [
        'Please do not:',
        [
          'scrape, crawl or bulk-download the catalogue or the availability data;',
          'probe, overload or interfere with the service or its providers;',
          'use the service to break the law, infringe copyright or harass anyone;',
          'resell access to the service or present it as your own.',
        ],
        'We may limit or close accounts that do these things.',
      ],
    },
    {
      id: 'content-and-attribution',
      heading: 'Content and attribution',
      body: [
        'Title details, artwork and ratings are supplied by TMDB. Streaming availability is supplied by JustWatch. Lastframe.tv uses the TMDB API but is not endorsed or certified by TMDB. Posters, backdrops and trailers belong to their owners.',
        'The Lastframe.tv name, mark and design are ours. Please do not reuse them without asking.',
      ],
    },
    {
      id: 'changes-and-availability',
      heading: 'Changes and availability',
      body: [
        'Lastframe.tv is new and will change. Features may be added, altered or removed, and the service may be unavailable now and then. If we ever close the service, we will give account holders at least 30 days notice and a way to take their data with them.',
      ],
    },
    {
      id: 'disclaimers',
      heading: 'Disclaimers and liability',
      body: [
        'The service is provided as is. We do not promise that it will be uninterrupted, error-free, or that availability and fit scores are accurate.',
        'To the extent the law allows, we are not liable for indirect or consequential losses, and our total liability to you for anything connected with the service is limited to the amount you paid us in the twelve months before the claim, which for a free account is nothing. Nothing in these terms limits rights that the law does not allow us to limit.',
      ],
    },
    {
      id: 'ending',
      heading: 'Ending these terms',
      body: [
        'You can stop using the service or delete your account at any time. We can suspend or close an account that breaks these terms, and will tell you why unless the law prevents it.',
      ],
    },
    {
      id: 'governing-law',
      heading: 'Governing law',
      body: [
        'These terms are governed by the laws of Canada. If a dispute cannot be settled by talking to us first, it will be heard by the courts of Canada.',
      ],
    },
    {
      id: 'changes-to-these-terms',
      heading: 'Changes to these terms',
      body: [
        'If we change these terms in a way that matters, we will update the effective date above and tell account holders by email before the change takes effect. Continuing to use the service after that means you accept the new terms.',
      ],
    },
    {
      id: 'contact',
      heading: 'Contact',
      body: [`Questions about these terms go to [${CONTACT.legal}](mailto:${CONTACT.legal}).`],
    },
  ],
};

export const security: LegalDocument = {
  slug: 'security',
  label: 'Security',
  title: 'Security',
  eyebrow: 'Trust',
  description:
    'How Lastframe.tv protects your account and data, what runs in your browser, and how to report a vulnerability.',
  summary:
    'We keep as little as possible, protect it in transit and at rest, and keep the door open for anyone who finds a problem.',
  sections: [
    {
      id: 'signing-in',
      heading: 'Signing in',
      body: [
        'There are no Lastframe.tv passwords to leak. You sign in with a one-time link sent to your email address, or with a Google account where that is offered. Each link works once and expires after a short time, and sign-in requests are rate limited.',
        'You can sign out from your [Account page](/account). It lists your signed-in devices; you can sign out any one of them, or choose Sign out everywhere to sign all of them out within minutes.',
      ],
    },
    {
      id: 'protecting-your-data',
      heading: 'Protecting your data',
      body: [
        [
          '**In transit:** every connection uses HTTPS, and browsers are told to never fall back to plain HTTP.',
          '**At rest:** the account database is encrypted by our hosting provider, Supabase.',
          '**Access:** each account can only read and write its own rows. The rule lives in the database (row level security), so a bug in the app cannot expose someone else’s data.',
          '**Least data:** we store your email address and what you create in the app, and nothing else we can avoid.',
        ],
      ],
    },
    {
      id: 'in-your-browser',
      heading: 'What runs in your browser',
      body: [
        'Your fit score is calculated on your device from your own ratings and history; it is never sent anywhere. The app ships with a strict content security policy, so only our own code and a short list of named providers can load, such as artwork from TMDB, trailers from YouTube’s privacy-enhanced player, and cookieless analytics from Plausible. No advertising or tracking scripts run on Lastframe.tv.',
      ],
    },
    {
      id: 'providers',
      heading: 'The providers we rely on',
      body: [
        [
          '**Supabase** for the database and sign-in, including a log of sign-in events.',
          '**Resend** for delivering sign-in emails, which keeps short-lived delivery records.',
          '**Netlify** for hosting and serverless functions, which keeps short-lived web server logs.',
          '**Cloudflare** for the bot check on the sign-in form, when it is on.',
          '**TMDB** for catalogue data and, through it, **JustWatch** for streaming availability.',
          '**Google**, only when you choose to sign in with it.',
          '**Plausible** for privacy-friendly analytics.',
        ],
        'Secret keys never ship to the browser. The only key in the app is Supabase\u2019s public key, which is designed to be public and does nothing without the row rules above. Requests that need a secret go through our own server functions.',
      ],
    },
    {
      id: 'your-part',
      heading: 'Your part',
      body: [
        [
          'Protect the inbox you sign in with: it is the key to your account.',
          'Only follow sign-in links you asked for. We never ask for a password or a code by email.',
          'Sign out when you leave a device you do not control.',
        ],
      ],
    },
    {
      id: 'reporting',
      heading: 'Reporting a vulnerability',
      body: [
        `If you find a security problem, please tell us before telling anyone else: [${CONTACT.security}](mailto:${CONTACT.security}). We acknowledge reports within 72 hours and keep you informed while we fix the issue.`,
        'We will not take action against researchers who test in good faith, keep to accounts they own, avoid disrupting the service or other people’s data, and give us reasonable time to fix what they find. We do not run a paid bounty programme at the moment.',
      ],
    },
    {
      id: 'incidents',
      heading: 'If something goes wrong',
      body: [
        'If we learn that your data has been exposed, we will tell you by email within 72 hours of confirming it, say what happened and what we are doing, and notify the authorities where the law requires it.',
      ],
    },
  ],
};

export const legalDocuments: Record<LegalDocument['slug'], LegalDocument> = {
  privacy,
  terms,
  security,
};

export const legalOrder: LegalDocument['slug'][] = ['privacy', 'terms', 'security'];
