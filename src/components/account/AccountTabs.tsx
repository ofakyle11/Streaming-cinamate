import { KeyboardEvent, useRef } from 'react';
import { Link } from 'react-router-dom';

import { ACCOUNT_TABS, accountTabHref, type AccountTabId } from './tabs';

interface AccountTabsProps {
  active: AccountTabId;
  onChange: (tab: AccountTabId) => void;
}

/**
 * Pill tab strip. Tabs are links (the URL carries the tab, so /account?tab=data
 * is shareable and the back button works), with the ARIA tabs keyboard model
 * layered on: arrows move between tabs, Home/End jump.
 */
export default function AccountTabs({ active, onChange }: AccountTabsProps) {
  const refs = useRef<Array<HTMLAnchorElement | null>>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLAnchorElement>, index: number) => {
    const count = ACCOUNT_TABS.length;
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (index + 1) % count;
    else if (e.key === 'ArrowLeft') next = (index - 1 + count) % count;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = count - 1;
    if (next === null) return;
    e.preventDefault();
    refs.current[next]?.focus();
    onChange(ACCOUNT_TABS[next].id);
  };

  return (
    <nav className="acct-tabs" aria-label="Account sections">
      <div role="tablist" aria-label="Account sections" className="acct-tablist">
        {ACCOUNT_TABS.map((tab, i) => {
          const selected = tab.id === active;
          return (
            <Link
              key={tab.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              to={accountTabHref(tab.id)}
              replace
              role="tab"
              id={`acct-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`acct-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              className={`acct-tab${selected ? ' is-on' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                onChange(tab.id);
              }}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
