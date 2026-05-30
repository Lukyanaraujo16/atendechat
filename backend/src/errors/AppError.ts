class AppError {
  public readonly message: string;

  public readonly statusCode: number;

  /** Mensagem opcional para o cliente (ex.: detalhe legível); o campo `error` usa `message` (código). */
  public readonly clientMessage?: string;

  /** Campos extra no JSON de resposta (ex.: bytes de disco). */
  public readonly data?: Record<string, number | string | boolean | null>;

  constructor(
    message: string,
    statusCode = 400,
    clientMessage?: string,
    data?: Record<string, number | string | boolean | null>
  ) {
    this.message = message;
    this.statusCode = statusCode;
    this.clientMessage = clientMessage;
    this.data = data;
  }
}

export default AppError;
