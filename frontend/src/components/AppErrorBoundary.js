import React from "react";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("[AppErrorBoundary]", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    const message =
      error?.message ||
      (typeof error === "string" ? error : "Erro ao carregar a aplicação.");

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: 20, marginBottom: 12 }}>Não foi possível abrir o app</h1>
        <p style={{ fontSize: 14, opacity: 0.85, maxWidth: 420, marginBottom: 20 }}>
          {message}
        </p>
        <button
          type="button"
          onClick={this.handleReload}
          style={{
            padding: "10px 20px",
            fontSize: 14,
            fontWeight: 600,
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            backgroundColor: "#24c776",
            color: "#fff",
          }}
        >
          Recarregar
        </button>
      </div>
    );
  }
}
