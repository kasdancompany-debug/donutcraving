import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';

async function bootstrap() {
  const root = createRoot(document.getElementById('root')!);

  // Recorded-session lab is stripped from production: this branch is dead when
  // `import.meta.env.DEV` is false, and the dynamic import is not bundled for kiosk.
  if (import.meta.env.DEV) {
    const { isReplayLabEnabled } = await import('./dev/isReplayLabEnabled');
    if (isReplayLabEnabled()) {
      const { ReplayLab } = await import('./dev/ReplayLab');
      root.render(
        <StrictMode>
          <ErrorBoundary>
            <ReplayLab />
          </ErrorBoundary>
        </StrictMode>,
      );
      return;
    }
  }

  const { default: App } = await import('./App.tsx');
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}

void bootstrap();
