"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
  title?: string;
  description?: string;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

class BaseErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[error-boundary]", error, errorInfo);
  }

  private reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={styles.shell}>
        <div style={styles.card}>
          <h2 style={styles.title}>{this.props.title ?? "Something went wrong"}</h2>
          <p style={styles.description}>
            {this.props.description ?? "A runtime error interrupted this panel."}
          </p>
          <pre style={styles.code}>{this.state.error?.message ?? "Unknown error"}</pre>
          <div style={styles.actions}>
            <button type="button" onClick={this.reset} style={styles.button}>
              Try Again
            </button>
            <a
              href="https://github.com/nousresearch/claw3d/issues"
              target="_blank"
              rel="noreferrer"
              style={styles.link}
            >
              Report Issue
            </a>
          </div>
        </div>
      </div>
    );
  }
}

export function ErrorBoundary({ children }: { children: ReactNode }) {
  return <BaseErrorBoundary>{children}</BaseErrorBoundary>;
}

export function OfficeErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <BaseErrorBoundary
      title="Office rendering error"
      description="The 3D office crashed. Retry to re-mount the scene."
    >
      {children}
    </BaseErrorBoundary>
  );
}

export function ChatErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <BaseErrorBoundary
      title="Chat connection error"
      description="The chat panel crashed. Retry to reconnect chat state."
    >
      {children}
    </BaseErrorBoundary>
  );
}

export default ErrorBoundary;

const styles = {
  shell: {
    minHeight: "100dvh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0a0a0a",
    padding: "20px",
  },
  card: {
    width: "min(680px, 100%)",
    border: "1px solid #2f2a55",
    background: "#12101f",
    borderRadius: "12px",
    padding: "16px",
    boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
  },
  title: {
    margin: "0 0 8px",
    color: "#e9e7ff",
  },
  description: {
    margin: "0 0 12px",
    color: "#b8b4db",
  },
  code: {
    margin: "0 0 12px",
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #2f2a55",
    background: "#0a0a0a",
    color: "#f5d0fe",
    fontSize: "12px",
    whiteSpace: "pre-wrap" as const,
  },
  actions: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
  },
  button: {
    borderRadius: "8px",
    border: "1px solid #51449c",
    background: "#7c3aed",
    color: "white",
    padding: "8px 12px",
    cursor: "pointer",
  },
  link: {
    color: "#93c5fd",
    textDecoration: "none",
    fontSize: "13px",
  },
};