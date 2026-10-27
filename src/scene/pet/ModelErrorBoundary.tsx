import { Component, type ReactNode } from 'react';

interface Props {
  fallback: ReactNode;
  onError?: (error: Error) => void;
  /** Changing this key resets the boundary (e.g. when the species changes). */
  resetKey?: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
  resetKey?: string;
}

/** Catches 3D model loading errors and renders a fallback instead. */
export class ModelErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.resetKey) return { error: null, resetKey: props.resetKey };
    return null;
  }

  componentDidCatch(error: Error) {
    console.warn('[virtual-pets-3d] Model failed to load, using placeholder:', error);
    this.props.onError?.(error);
  }

  render() {
    return this.state.error ? this.props.fallback : this.props.children;
  }
}
