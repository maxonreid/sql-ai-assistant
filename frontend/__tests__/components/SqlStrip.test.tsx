import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LangProvider } from '../../lib/language-context';
import SqlStrip from '../../components/SqlStrip';
import * as shikiMock from 'shiki';

// Prevent shiki from running in jsdom — it loads WASM/workers not available here
vi.mock('shiki', () => ({
  codeToHtml: vi.fn().mockResolvedValue('<pre><code>SELECT 1</code></pre>'),
}));

// Clipboard API is not available in jsdom
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
  writable: true,
});

function renderStrip(props: { sql?: string; queryType?: 'dmv' | 'business'; lang?: 'es' | 'en' }) {
  const { sql = 'SELECT 1', queryType = 'business', lang } = props;

  if (lang) {
    localStorage.setItem('sql-assistant:lang', lang);
  }

  return render(
    <LangProvider>
      <SqlStrip sql={sql} queryType={queryType} />
    </LangProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('SqlStrip — labels', () => {
  it('shows "SQL generado" label in Spanish for business queries', () => {
    renderStrip({ queryType: 'business', lang: 'es' });
    expect(screen.getByText('SQL generado')).toBeTruthy();
  });

  it('shows "Generated SQL" label in English for business queries', () => {
    renderStrip({ queryType: 'business', lang: 'en' });
    expect(screen.getByText('Generated SQL')).toBeTruthy();
  });

  it('shows "Consulta DMV" label in Spanish for dmv queries', () => {
    renderStrip({ queryType: 'dmv', lang: 'es' });
    expect(screen.getByText('Consulta DMV')).toBeTruthy();
  });

  it('shows "DMV Query" label in English for dmv queries', () => {
    renderStrip({ queryType: 'dmv', lang: 'en' });
    expect(screen.getByText('DMV Query')).toBeTruthy();
  });
});

describe('SqlStrip — expand/collapse', () => {
  it('is expanded by default for business queries', () => {
    const { container } = renderStrip({ queryType: 'business' });
    // bodyOpen class is applied when open=true
    const body = container.querySelector('[class*="body"]');
    expect(body?.className).toMatch(/bodyOpen/);
  });

  it('is collapsed by default for dmv queries', () => {
    const { container } = renderStrip({ queryType: 'dmv' });
    const body = container.querySelector('[class*="body"]');
    expect(body?.className).not.toMatch(/bodyOpen/);
  });

  it('toggles open state when the header is clicked', () => {
    const { container } = renderStrip({ queryType: 'business' });
    const header = container.querySelector('[class*="header"]') as HTMLElement;
    fireEvent.click(header);
    const body = container.querySelector('[class*="body"]');
    expect(body?.className).not.toMatch(/bodyOpen/);
    fireEvent.click(header);
    expect(body?.className).toMatch(/bodyOpen/);
  });
});

describe('SqlStrip — copy button', () => {
  it('shows copy button text in Spanish', () => {
    renderStrip({ lang: 'es' });
    expect(screen.getByRole('button').textContent).toBe('Copiar para SSMS');
  });

  it('shows copy button text in English', () => {
    renderStrip({ lang: 'en' });
    expect(screen.getByRole('button').textContent).toBe('Copy for SSMS');
  });

  it('calls clipboard.writeText with the SQL on click', async () => {
    renderStrip({ sql: 'SELECT 42', lang: 'en' });
    fireEvent.click(screen.getByRole('button'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('SELECT 42');
  });

  it('shows copied feedback text after clicking', async () => {
    renderStrip({ lang: 'en' });
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => {
      expect(screen.getByRole('button').textContent).toBe('✓ Copied');
    });
  });

  it('does not render a copy button when sql is empty', () => {
    renderStrip({ sql: '' });
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('SqlStrip — SQL content', () => {
  it('renders a plain <pre> before shiki resolves', () => {
    // Make shiki never resolve for this test
    vi.mocked(shikiMock.codeToHtml).mockReturnValueOnce(new Promise(() => {}) as any);

    const { container } = renderStrip({ sql: 'SELECT 1' });
    expect(container.querySelector('pre')).toBeTruthy();
    expect(container.querySelector('pre')?.textContent).toBe('SELECT 1');
  });

  it('renders highlighted HTML after shiki resolves', async () => {
    const { container } = renderStrip({ sql: 'SELECT 1' });
    await waitFor(() => {
      expect(container.querySelector('[class*="highlighted"]')).toBeTruthy();
    });
  });
});
