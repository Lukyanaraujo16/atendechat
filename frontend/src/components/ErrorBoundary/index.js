import React from "react";

/**
 * Error Boundary para capturar erros e exibir mensagem útil.
 * Útil para debug - mostra qual componente filho falhou.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary capturou erro:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: "#d32f2f", backgroundColor: "#ffebee" }}>
          <strong>Erro ao carregar:</strong> {this.state.error?.message}
          <br />
          <small>{this.state.error?.stack}</small>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ marginTop: 10, padding: "4px 12px", cursor: "pointer" }}
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
