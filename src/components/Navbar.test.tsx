import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Navbar from './Navbar';

function renderNavbar(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Navbar />
      <Routes>
        <Route path="*" element={<div data-testid="page" />} />
      </Routes>
    </MemoryRouter>,
  );
}

const toggle = () => screen.getByRole('button', { name: 'Menu' });
const menuList = () => document.getElementById(toggle().getAttribute('aria-controls') ?? '');

describe('Navbar mobile menu', () => {
  it('toggles aria-expanded and controls the links list', () => {
    renderNavbar();
    const button = toggle();
    expect(button).toHaveAttribute('aria-expanded', 'false');
    const list = menuList();
    expect(list).not.toBeNull();
    expect(list).not.toHaveClass('is-open');

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(list).toHaveClass('is-open');

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(list).not.toHaveClass('is-open');
  });

  it('renders the primary links when open', () => {
    renderNavbar();
    fireEvent.click(toggle());
    const list = menuList() as HTMLElement;
    expect(list).toHaveClass('is-open');
    expect(list.querySelectorAll('a')).toHaveLength(5);
    for (const name of ['Home', 'Series', 'Films', 'New & Popular', 'My List']) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    }
  });

  it('closes on Escape and restores focus to the toggle', () => {
    renderNavbar();
    const button = toggle();
    fireEvent.click(button);
    screen.getByRole('link', { name: 'Films' }).focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });

  it('closes on an outside click and restores focus to the toggle', () => {
    renderNavbar();
    const button = toggle();
    fireEvent.click(button);
    fireEvent.mouseDown(screen.getByTestId('page'));
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });

  it('closes when a link is clicked', () => {
    renderNavbar('/');
    const button = toggle();
    fireEvent.click(button);
    fireEvent.click(screen.getByRole('link', { name: 'Series' }));
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('link', { name: 'Series' })).toHaveClass('active');
  });
});
