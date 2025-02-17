import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from './test/test-utils';
import { App } from './App';

describe('App', () => {
  it('renders the Open Blox UI title', () => {
    renderWithProviders(<App />);
    expect(screen.getByText('Open Blox UI')).toBeInTheDocument();
  });

  it('renders the connect button', () => {
    renderWithProviders(<App />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
}); 