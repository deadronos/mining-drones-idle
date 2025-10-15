import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import './error-boundary.css';

type FallbackRender = (error: Error | null) => ReactNode;

interface Props {
  children: ReactNode;
  /**
   * Either a React node to render as fallback or a function that
   * receives the caught Error and returns a React node.
   */
  fallback?: ReactNode | FallbackRender;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Small, production-friendly Error Boundary.
 * Use the `fallback` prop to render a custom UI or pass a function
 * to receive the captured error and render dynamic content.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Centralized place to log caught errors. Integrate with an
    // external monitoring service here when needed.
    console.error('Uncaught error in ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      const { fallback } = this.props;
      if (typeof fallback === 'function') {
        return fallback(this.state.error);
      }
      if (fallback) return fallback;

      // Default fallback UI
      return (
        <div role="alert" className="error-boundary">
          <h2>Something went wrong</h2>
          <pre className="error-boundary__pre">{this.state.error?.message}</pre>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      );
    }

    return this.props.children;
  }
}
