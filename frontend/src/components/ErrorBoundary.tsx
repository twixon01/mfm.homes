import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
  };

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("UI crash captured by ErrorBoundary", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <main className="loading">
          <div>
            <p>Произошла ошибка интерфейса.</p>
            <button type="button" onClick={() => window.location.reload()}>
              Перезагрузить страницу
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
