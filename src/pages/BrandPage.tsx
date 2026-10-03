import { useCallback, useState, type CSSProperties, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import BrandMark from '../components/brand/BrandMark';
import Lockup, { Wordmark } from '../components/brand/Lockup';
import {
  COLOURWAYS,
  DEFAULT_COLOURWAY,
  DEFAULT_MARK,
  MARKS,
  assetFiles,
  getColourway,
  getMark,
  isColourwayId,
  isMarkId,
  lockupSvg,
  markSvg,
  type ColourwayId,
  type MarkId,
} from '../components/brand/marks';
import { useActiveBrand } from '../components/brand/activeBrand';
import { useOptionalToast } from '../components/ui';
import { useMeta } from '../hooks/useMeta';
import '../styles/brand-kit.css';

const KIT_EDITION = 'October 2026';

/** Colour tokens shown on the colour slide (values from src/styles/tokens.css). */
const COLOUR_TOKENS = [
  {
    name: 'Night',
    hex: '#0b0b12',
    token: '--color-bg',
    role: 'Background. Every surface starts here.',
  },
  { name: 'Snow', hex: '#f4f4f8', token: '--color-text', role: 'Primary text and the wordmark.' },
  {
    name: 'Soft',
    hex: '#d6d6e0',
    token: '--color-text-soft',
    role: 'Secondary text over imagery.',
  },
  { name: 'Mist', hex: '#a9a9bb', token: '--color-muted', role: 'Metadata, labels, quiet UI.' },
  {
    name: 'Signal',
    hex: '#e50914',
    token: '--color-accent',
    role: 'The accent. Gradient end, destructive actions.',
  },
  {
    name: 'Violet',
    hex: '#7c3aed',
    token: '--color-violet',
    role: 'Gradient start, focus glow, aurora.',
  },
  { name: 'Cyan', hex: '#06b6d4', token: '--color-cyan', role: 'Aurora highlight, info states.' },
  { name: 'Go', hex: '#46d369', token: '--color-success', role: 'Match score and success states.' },
] as const;

const SLIDES = [
  { id: 'cover', section: 'Brand kit', status: 'Options for review' },
  { id: 'identity', section: '01 / Identity', status: 'Four directions' },
  { id: 'forms', section: '02 / Forms', status: 'One identity, four forms' },
  { id: 'colourways', section: '03 / Colourways', status: 'From the token set' },
  { id: 'use', section: '04 / Logo use', status: 'Rule proposed' },
  { id: 'type', section: '05 / Typography', status: 'Working selection' },
  { id: 'colour', section: '06 / Colour', status: 'From tokens.css' },
  { id: 'treatment', section: '07 / Visual treatment', status: 'Uses proposed' },
  { id: 'application', section: '08 / Application', status: 'In context' },
  { id: 'downloads', section: '09 / Files', status: 'SVG, ready to use' },
] as const;

type SlideId = (typeof SLIDES)[number]['id'];

interface SlideProps {
  id: SlideId;
  children: ReactNode;
  className?: string;
}

/** One deck page: a header strip, the body, and a footer strip with the page count. */
function Slide({ id, children, className }: SlideProps) {
  const index = SLIDES.findIndex((s) => s.id === id);
  const slide = SLIDES[index];
  const n = String(index + 1).padStart(2, '0');
  const total = String(SLIDES.length).padStart(2, '0');
  return (
    <section
      id={id}
      className={['bk-slide', 'glass', className].filter(Boolean).join(' ')}
      aria-labelledby={`${id}-heading`}
    >
      <div className="bk-strip" aria-hidden="true">
        <span>Last Frame</span>
        <span>{slide.section}</span>
        <span>{slide.status}</span>
      </div>
      <div className="bk-body">{children}</div>
      <div className="bk-strip bk-strip--foot" aria-hidden="true">
        <span>Brand kit / {KIT_EDITION}</span>
        <span>
          {n} / {total}
        </span>
      </div>
    </section>
  );
}

const SIZES = [16, 24, 32, 48, 64] as const;

export default function BrandPage() {
  useMeta({
    title: 'Brand kit',
    description:
      'Last Frame brand kit: four logo directions, colourways, logo use, typography, colour and downloadable SVG files.',
  });
  const [params, setParams] = useSearchParams();
  const optionParam = params.get('option');
  const colourParam = params.get('colour');
  const markId: MarkId = isMarkId(optionParam) ? optionParam : DEFAULT_MARK;
  const colourwayId: ColourwayId = isColourwayId(colourParam) ? colourParam : DEFAULT_COLOURWAY;
  const mark = getMark(markId);
  const colourway = getColourway(colourwayId);
  const files = assetFiles(markId);
  const { toast } = useOptionalToast();
  const active = useActiveBrand();
  const isActive = active.mark === markId && active.colourway === colourwayId;
  const activeMark = getMark(active.mark);
  const activeColourway = getColourway(active.colourway);
  const [copied, setCopied] = useState<string | null>(null);

  const setParam = useCallback(
    (key: 'option' | 'colour', value: string) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set(key, value);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const copy = useCallback(
    async (label: string, text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(label);
        toast(`Copied ${label}`, { kind: 'success' });
      } catch {
        setCopied(null);
        toast(`Couldn't copy ${label}`, { kind: 'error' });
      }
    },
    [toast],
  );

  const glowStyle = {
    '--lf-glow-a': colourway.stops[0],
    '--lf-glow-b': colourway.stops[colourway.stops.length - 1],
  } as CSSProperties;

  return (
    <main className="page brand-kit">
      <div className="bk-deck">
        {/* 00 Cover */}
        <Slide id="cover" className="bk-cover">
          <div className="bk-cover-grid">
            <div>
              <h1 id="cover-heading" className="bk-display bk-display--xl">
                <span>Brand</span>
                <span className="bk-grad" style={glowStyle}>
                  kit
                </span>
              </h1>
              <p className="bk-mono">
                Four directions
                <br />
                for one name.
              </p>
              <p className="bk-lead">
                Identity, colour and expression for Last Frame. A first edition for review: pick an
                option and a colourway below and every page follows.
              </p>
              <div className="bk-preview" role="group" aria-label="App preview">
                <p className="bk-note" aria-live="polite">
                  The app is showing{' '}
                  <strong>
                    {activeMark.index} / {activeMark.name} · {activeColourway.name}
                  </strong>
                  {active.isPreview ? ' (preview in this browser)' : ' (shipped default)'}.
                </p>
                <div className="bk-preview-actions">
                  <button
                    type="button"
                    className="btn primary sm"
                    disabled={isActive}
                    onClick={() => active.setPreview({ mark: markId, colourway: colourwayId })}
                  >
                    {isActive ? 'Showing in the app' : 'Try it in the app'}
                  </button>
                  {active.isPreview && (
                    <button type="button" className="btn ghost sm" onClick={active.clearPreview}>
                      Back to default
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="bk-cover-art" style={glowStyle}>
              <Lockup mark={markId} colourway={colourwayId} size={88} orientation="stacked" />
            </div>
          </div>
        </Slide>

        {/* 01 Identity: four options */}
        <Slide id="identity">
          <div className="bk-two">
            <div>
              <h2 id="identity-heading" className="bk-display">
                One name.
                <br />
                Four directions.
              </h2>
              <p className="bk-mono">
                The initials, a frame,
                <br />a strip, or a countdown.
              </p>
              <p className="bk-note">
                Each direction keeps the same wordmark, colour system and app-icon tile, so the
                choice is about the mark alone. The current option is{' '}
                <strong>
                  {mark.index} / {mark.name}
                </strong>
                .
              </p>
            </div>
            <div className="bk-options" role="group" aria-label="Logo options">
              {MARKS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`bk-option glass${m.id === markId ? ' is-selected' : ''}`}
                  aria-pressed={m.id === markId}
                  onClick={() => setParam('option', m.id)}
                >
                  <span className="bk-label">
                    {m.index} / {m.name}
                  </span>
                  <span className="bk-option-art">
                    <Lockup mark={m.id} colourway={colourwayId} size={56} orientation="stacked" />
                  </span>
                  <span className="bk-option-idea">{m.idea}</span>
                </button>
              ))}
            </div>
          </div>
        </Slide>

        {/* 02 Forms */}
        <Slide id="forms">
          <div className="bk-two">
            <div>
              <h2 id="forms-heading" className="bk-display">
                One identity.
                <br />
                Four forms.
              </h2>
              <p className="bk-mono">
                The full name when there is room.
                <br />A related form when space changes.
              </p>
              <p className="bk-note">{mark.rationale}</p>
            </div>
            <ul className="bk-forms">
              <li className="bk-form">
                <span className="bk-label">01 / Full lockup</span>
                <Lockup mark={markId} colourway={colourwayId} size={48} />
              </li>
              <li className="bk-form">
                <span className="bk-label">02 / Stacked</span>
                <Lockup mark={markId} colourway={colourwayId} size={56} orientation="stacked" />
              </li>
              <li className="bk-form">
                <span className="bk-label">03 / Mark</span>
                <BrandMark mark={markId} colourway={colourwayId} size={72} />
              </li>
              <li className="bk-form">
                <span className="bk-label">04 / App icon</span>
                <span className="bk-icons">
                  <BrandMark
                    mark={markId}
                    colourway={colourwayId}
                    variant="tile"
                    size={64}
                    title={`${mark.name} app icon, night tile`}
                  />
                  <BrandMark
                    mark={markId}
                    colourway={colourwayId}
                    variant="tile-gradient"
                    size={64}
                    title={`${mark.name} app icon, gradient tile`}
                  />
                </span>
              </li>
            </ul>
          </div>
        </Slide>

        {/* 03 Colourways */}
        <Slide id="colourways">
          <h2 id="colourways-heading" className="bk-display">
            One mark.
            <br />
            Four moods.
          </h2>
          <p className="bk-mono">
            Every gradient already exists in tokens.css. Nothing new is mixed.
          </p>
          <div className="bk-colourways" role="group" aria-label="Colourways">
            {COLOURWAYS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`bk-colourway glass${c.id === colourwayId ? ' is-selected' : ''}`}
                aria-pressed={c.id === colourwayId}
                onClick={() => setParam('colour', c.id)}
              >
                <span
                  className="bk-swatch-bar"
                  style={{ background: `linear-gradient(135deg, ${c.stops.join(', ')})` }}
                  aria-hidden="true"
                />
                <BrandMark mark={markId} colourway={c.id} size={64} decorative />
                <span className="bk-label">{c.name}</span>
                <span className="bk-option-idea">{c.note}</span>
              </button>
            ))}
          </div>
        </Slide>

        {/* 04 Logo use */}
        <Slide id="use">
          <div className="bk-two">
            <div>
              <h2 id="use-heading" className="bk-display">
                Room to
                <br />
                be seen.
              </h2>
              <p className="bk-label">Clear space</p>
              <p className="bk-mono">
                A repeatable unit gives the
                <br />
                identity breathing room.
              </p>
              <p className="bk-note">
                H = the mark's height.
                <br />X = half of H.
                <br />
                <br />
                Proposed: keep at least X of clear space around the lockup, and never place it over
                a poster without the legible glass panel behind it.
              </p>
              <p className="bk-label">Minimum size</p>
              <p className="bk-note">
                The mark holds at 24px. At 16px (favicon) the Monogram and Countdown still read; the
                Frame and Strip need their app-icon tile instead.
              </p>
            </div>
            <div>
              <figure className="bk-clear" aria-label="Clear space diagram">
                <span className="bk-clear-x bk-clear-x--tl" aria-hidden="true">
                  X
                </span>
                <span className="bk-clear-x bk-clear-x--br" aria-hidden="true">
                  X
                </span>
                <span className="bk-clear-art">
                  <Lockup mark={markId} colourway={colourwayId} size={64} />
                </span>
                <figcaption className="bk-label">Visible artwork</figcaption>
              </figure>
              <ul className="bk-sizes" aria-label="Minimum size test">
                {SIZES.map((s) => (
                  <li key={s}>
                    <BrandMark mark={markId} colourway={colourwayId} size={s} decorative />
                    <span className="bk-mono">{s}px</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Slide>

        {/* 05 Typography */}
        <Slide id="type">
          <h2 id="type-heading" className="bk-display">
            One voice.
            <br />
            Three roles.
          </h2>
          <dl className="bk-type">
            <div className="bk-type-row">
              <dt>
                <span className="bk-label">01 / Display</span>
                <span className="bk-type-name">Inter Black, caps</span>
              </dt>
              <dd>
                <p className="bk-display bk-display--sample">It ends on the last frame.</p>
                <p className="bk-note">
                  Headlines, hero titles and the wordmark. Capitals, tight leading, letter-spaced
                  only in the wordmark.
                </p>
              </dd>
            </div>
            <div className="bk-type-row">
              <dt>
                <span className="bk-label">02 / Text</span>
                <span className="bk-type-name">Inter Regular / Medium</span>
              </dt>
              <dd>
                <p className="bk-type-body">
                  A coat catches the morning wind. Boots cross the wet stone. One list holds
                  everything you mean to watch, so the evening can get back to the film.
                </p>
                <p className="bk-note">
                  Synopses, settings and regular app content. 16px on a 24px line.
                </p>
              </dd>
            </div>
            <div className="bk-type-row">
              <dt>
                <span className="bk-label">03 / Metadata</span>
                <span className="bk-type-name">System mono</span>
              </dt>
              <dd>
                <p className="bk-mono bk-type-meta">2h 14m · 2026 · PG-13 · 97% match</p>
                <p className="bk-note">
                  Runtimes, years, ratings and badges. Tabular figures keep rows aligned; the
                  typewriter voice nods to the shooting script.
                </p>
              </dd>
            </div>
          </dl>
          <table className="bk-scale">
            <caption className="bk-label">A practical type scale</caption>
            <thead>
              <tr>
                <th scope="col">Role</th>
                <th scope="col">Size / line</th>
                <th scope="col">Weight</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Title</th>
                <td>32 to 58px / 1.05</td>
                <td>900, caps</td>
              </tr>
              <tr>
                <th scope="row">Subheading</th>
                <td>20px / 26px</td>
                <td>700</td>
              </tr>
              <tr>
                <th scope="row">Body</th>
                <td>16px / 24px</td>
                <td>400</td>
              </tr>
              <tr>
                <th scope="row">Label</th>
                <td>14px / 20px</td>
                <td>700, tracked caps</td>
              </tr>
              <tr>
                <th scope="row">Metadata</th>
                <td>13px / 18px</td>
                <td>Mono 400</td>
              </tr>
            </tbody>
          </table>
          <p className="bk-footnote">
            Inter ships with the app as a self-hosted variable font (latin subset, one 48 KB file,
            SIL Open Font License), so all three roles render as shown. The system UI font stands in
            only until it loads.
          </p>
        </Slide>

        {/* 06 Colour */}
        <Slide id="colour">
          <div className="bk-colour-head">
            <h2 id="colour-heading" className="bk-display">
              Colour
            </h2>
            <Wordmark className="bk-grad" size="clamp(1.4rem, 4vw, 2.4rem)" />
          </div>
          <ul className="bk-swatches">
            {COLOUR_TOKENS.map((c, i) => (
              <li
                key={c.hex}
                className="bk-swatch"
                style={{ background: c.hex, color: i < 1 || i > 3 ? '#f4f4f8' : '#0b0b12' }}
              >
                <span className="bk-swatch-index">{String(i + 1).padStart(2, '0')}</span>
                <span className="bk-swatch-name">{c.name}</span>
                <span className="bk-mono">{c.hex}</span>
                <button
                  type="button"
                  className="bk-copy"
                  aria-label={`Copy ${c.name} ${c.hex}`}
                  onClick={() => copy(c.hex, c.hex)}
                >
                  {copied === c.hex ? 'Copied' : 'Copy'}
                </button>
              </li>
            ))}
          </ul>
          <dl className="bk-roles">
            {COLOUR_TOKENS.map((c) => (
              <div key={c.token}>
                <dt>
                  <code>{c.token}</code>
                </dt>
                <dd>{c.role}</dd>
              </div>
            ))}
          </dl>
          <p className="bk-footnote">
            Values are the live design tokens, so the kit and the app cannot disagree. Contrast
            ratios for every pairing are recorded in docs/A11Y.md.
          </p>
        </Slide>

        {/* 07 Visual treatment */}
        <Slide id="treatment">
          <h2 id="treatment-heading" className="bk-display">
            One family.
            <br />
            Different presence.
          </h2>
          <ul className="bk-treatments" style={glowStyle}>
            <li className="bk-treatment">
              <span className="bk-label">Flat</span>
              <span className="bk-treatment-art">
                <Lockup mark={markId} colourway={colourwayId} size={56} orientation="stacked" />
              </span>
              <span className="bk-note">
                Clean identity in compact spaces. Proposed: navigation, documents, favicons.
              </span>
            </li>
            <li className="bk-treatment">
              <span className="bk-label">Soft glow</span>
              <span className="bk-treatment-art bk-treatment-art--glow">
                <Lockup mark={markId} colourway={colourwayId} size={56} orientation="stacked" />
              </span>
              <span className="bk-note">
                Light with a film-like edge. Proposed: hero moments, loading and motion states.
              </span>
            </li>
            <li className="bk-treatment">
              <span className="bk-label">Glass</span>
              <span className="bk-treatment-art bk-treatment-art--glass">
                <Lockup mark={markId} colourway={colourwayId} size={56} orientation="stacked" />
                <span className="bk-reflection" aria-hidden="true">
                  <Lockup
                    mark={markId}
                    colourway={colourwayId}
                    size={56}
                    orientation="stacked"
                    decorative
                  />
                </span>
              </span>
              <span className="bk-note">
                Dimension and reflected light, the app's own language. Proposed: splash, social
                cards and larger campaign artwork.
              </span>
            </li>
          </ul>
        </Slide>

        {/* 08 Application */}
        <Slide id="application">
          <h2 id="application-heading" className="bk-display">
            Made for
            <br />
            the watchers.
          </h2>
          <p className="bk-mono">The identity in the places it will actually live.</p>
          <div className="bk-apps" style={glowStyle}>
            <figure className="bk-app bk-app--nav">
              <div className="bk-navbar glass" aria-hidden="true">
                <Lockup mark={markId} colourway={colourwayId} size={30} decorative />
                <span className="bk-navlinks">
                  <span>Home</span>
                  <span>Series</span>
                  <span>Films</span>
                  <span>My List</span>
                </span>
                <span className="bk-avatar" />
              </div>
              <figcaption className="bk-label">Navigation bar</figcaption>
            </figure>
            <figure className="bk-app bk-app--phone">
              <div className="bk-phone" aria-hidden="true">
                <BrandMark
                  mark={markId}
                  colourway={colourwayId}
                  variant="tile"
                  size={60}
                  decorative
                />
                <span>Last Frame</span>
              </div>
              <figcaption className="bk-label">Home screen icon</figcaption>
            </figure>
            <figure className="bk-app bk-app--social">
              <div className="bk-social" aria-hidden="true">
                <Lockup mark={markId} colourway={colourwayId} size={48} decorative />
                <span className="bk-social-tag">Find the film. Keep the list.</span>
                <span className="bk-mono">lastframe.tv</span>
              </div>
              <figcaption className="bk-label">Social card</figcaption>
            </figure>
            <figure className="bk-app bk-app--poster">
              <div className="bk-poster" aria-hidden="true">
                <span className="bk-poster-chip">Now streaming</span>
                <span className="bk-poster-title">Neon Drift</span>
                <BrandMark mark={markId} colourway={colourwayId} size={28} decorative />
              </div>
              <figcaption className="bk-label">Poster watermark</figcaption>
            </figure>
          </div>
        </Slide>

        {/* 09 Downloads */}
        <Slide id="downloads">
          <div className="bk-two">
            <div>
              <h2 id="downloads-heading" className="bk-display">
                Take it
                <br />
                with you.
              </h2>
              <p className="bk-mono">
                Vector files for
                <br />
                {mark.index} / {mark.name}.
              </p>
              <p className="bk-note">
                The download links carry the Aurora colourway, the one the shipped brand uses. The
                copy buttons use the colourway selected above ({colourway.name}) so any combination
                can be pasted into a design tool.
              </p>
            </div>
            <ul className="bk-files">
              <li>
                <span className="bk-file-art">
                  <BrandMark mark={markId} colourway={colourwayId} size={40} decorative />
                </span>
                <span className="bk-file-name">
                  <strong>Mark</strong>
                  <code>/brand/{files.mark}</code>
                </span>
                <span className="bk-file-actions">
                  <a className="btn glass sm" href={`/brand/${files.mark}`} download>
                    Download
                  </a>
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() =>
                      copy(
                        `${mark.name} mark SVG`,
                        markSvg({
                          mark: markId,
                          colourway: colourwayId,
                          title: `Last Frame ${mark.name} mark`,
                        }),
                      )
                    }
                  >
                    Copy SVG
                  </button>
                </span>
              </li>
              <li>
                <span className="bk-file-art">
                  <BrandMark
                    mark={markId}
                    colourway={colourwayId}
                    variant="tile"
                    size={40}
                    decorative
                  />
                </span>
                <span className="bk-file-name">
                  <strong>App icon</strong>
                  <code>/brand/{files.icon}</code>
                </span>
                <span className="bk-file-actions">
                  <a className="btn glass sm" href={`/brand/${files.icon}`} download>
                    Download
                  </a>
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() =>
                      copy(
                        `${mark.name} icon SVG`,
                        markSvg({
                          mark: markId,
                          colourway: colourwayId,
                          variant: 'tile',
                          size: 512,
                          title: `Last Frame ${mark.name} app icon`,
                        }),
                      )
                    }
                  >
                    Copy SVG
                  </button>
                </span>
              </li>
              <li>
                <span className="bk-file-art">
                  <Lockup mark={markId} colourway={colourwayId} size={24} decorative />
                </span>
                <span className="bk-file-name">
                  <strong>Lockup</strong>
                  <code>/brand/{files.lockup}</code>
                </span>
                <span className="bk-file-actions">
                  <a className="btn glass sm" href={`/brand/${files.lockup}`} download>
                    Download
                  </a>
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() =>
                      copy(
                        `${mark.name} lockup SVG`,
                        lockupSvg({ mark: markId, colourway: colourwayId }),
                      )
                    }
                  >
                    Copy SVG
                  </button>
                </span>
              </li>
            </ul>
          </div>
          <p className="bk-footnote">
            Files are generated from one source (src/components/brand/marks.ts) by
            scripts/generate-brand-assets.mjs. The lockup's wordmark is live text in Inter, so it
            takes the system font where Inter is not installed.
          </p>
        </Slide>
      </div>
    </main>
  );
}
