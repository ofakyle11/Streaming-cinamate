import { afterEach, describe, expect, it } from 'vitest';
import { focusTargetsAfterRemoval } from './useKeepFocusOnRemoval';

function row(id: string, withCard: boolean): string {
  return `<section class="row" id="${id}"><h2 tabindex="-1">${id}</h2>${
    withCard ? `<a class="card-link" href="/t/${id}">${id} card</a>` : ''
  }</section>`;
}

describe('focusTargetsAfterRemoval', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('prefers the next rows, then previous rows, then plain focusables around the section', () => {
    const main = document.createElement('main');
    main.insertAdjacentHTML(
      'beforeend',
      `<button id="before">before</button>${row('a', true)}${row('gone', true)}${row('b', false)}${row('c', true)}<button id="after">after</button>`,
    );
    document.body.append(main);
    const gone = document.getElementById('gone')!;

    const ids = focusTargetsAfterRemoval(gone).map((el) => el.id || el.textContent);
    // b has no cards, so its heading; then c's card; then a (previous row). Plain neighbours are deduped.
    expect(ids).toEqual(['b', 'c card', 'a card']);
  });

  it('falls back to the nearest focusable outside any row', () => {
    document.body.insertAdjacentHTML('beforeend', `<button id="before">before</button>${row('solo', true)}<a id="after" href="/x">after</a>`);
    const ids = focusTargetsAfterRemoval(document.getElementById('solo')!).map((el) => el.id);
    expect(ids).toEqual(['after', 'before']);
  });

  it('returns nothing when the section is alone on the page', () => {
    document.body.insertAdjacentHTML('beforeend', row('solo', true));
    expect(focusTargetsAfterRemoval(document.getElementById('solo')!)).toEqual([]);
  });
});
