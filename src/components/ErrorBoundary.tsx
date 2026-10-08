import { Component, type ReactNode } from 'react';
import { Lumo } from './Lumo';

/** If a screen crashes, show a calm way out instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Lumen screen error:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const B = import.meta.env.BASE_URL;
    return (
      <main className="screen not-found" id="main">
        <Lumo pose="thinking" size={140} motion="none" />
        <h1 className="title" tabIndex={-1}>Oops, this page got muddled</h1>
        <p>Your progress is safe. Let's go back to somewhere we know.</p>
        <div className="actions">
          <a className="btn primary" href={`${B}classroom`}>Go to the Classroom</a>
          <a className="btn" href={B}>Start page</a>
        </div>
      </main>
    );
  }
}
