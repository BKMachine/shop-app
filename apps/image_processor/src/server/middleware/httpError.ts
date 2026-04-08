export default class HttpError extends Error {
  status: number;

  code?: string;

  expose: boolean;

  constructor(
    status: number,
    message: string,
    options?: ErrorOptions & { expose?: boolean; code?: string },
  ) {
    super(message, options);
    this.name = 'HttpError';
    this.status = status;
    this.code = options?.code;
    this.expose = options?.expose ?? status < 500;
  }
}
