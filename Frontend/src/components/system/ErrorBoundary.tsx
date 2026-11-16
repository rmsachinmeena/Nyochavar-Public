import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** When this value changes (for example the page path) a shown error is cleared and the children render again. */
  resetKey?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/** Catches a crash inside any component below it and shows a friendly screen instead of a blank white page. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // @types/react is not installed in this project, so these two members are declared by hand
  declare props: ErrorBoundaryProps;
  declare setState: (state: ErrorBoundaryState) => void;

  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen crashed:', error, info.componentStack);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6 py-16">
        <div className="max-w-md text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">Something went wrong</p>
          <h1 className="mt-2 font-serif text-3xl text-ink">We hit a small problem</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
            This page could not be shown. Your cart and account are safe. Please try again, or go back to the home page.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
              className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Try again
            </button>
            <a href="/" className="rounded-full border border-slate-300 px-6 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              Go to home
            </a>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
