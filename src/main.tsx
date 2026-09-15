import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { applyTheme, getThemeSettings } from './utils/theme';
import { ErrorBoundary } from './components/ErrorBoundary';

// Infallible Mobile WebView Polyfill for window.matchMedia
// Prevents startup crashes from animation and layout libraries on Android WebViews
if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    window.matchMedia = (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList;
  } else {
    // Some Android WebViews define matchMedia with addListener but missing addEventListener
    try {
      const testMql = window.matchMedia('(min-width: 0px)');
      if (testMql && typeof testMql.addEventListener !== 'function') {
        const originalMatchMedia = window.matchMedia;
        window.matchMedia = (query: string): MediaQueryList => {
          const mql = originalMatchMedia.call(window, query);
          if (mql && typeof mql.addEventListener !== 'function') {
            mql.addEventListener = function (_type: string, listener: any) {
              if (typeof (mql as any).addListener === 'function') {
                (mql as any).addListener(listener);
              }
            };
            mql.removeEventListener = function (_type: string, listener: any) {
              if (typeof (mql as any).removeListener === 'function') {
                (mql as any).removeListener(listener);
              }
            };
          }
          return mql;
        };
      }
    } catch (e) {
      console.warn('[main.tsx] matchMedia polyfill warning:', e);
    }
  }
}

// Mobile WebView error logging & diagnostic monitoring
window.onerror = (message, source, lineno, colno, error) => {
  console.error('[TindahanNotes WebView Error]', {
    message,
    source,
    lineno,
    colno,
    error: error?.stack || error,
  });
  return false;
};

window.addEventListener('unhandledrejection', (event) => {
  console.warn('[TindahanNotes Handled Promise Rejection]', event.reason);
  event.preventDefault();
});

// Initialize and apply saved theme safely
try {
  applyTheme(getThemeSettings());
} catch (err) {
  console.warn('[main.tsx] Failed initial theme application:', err);
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}


