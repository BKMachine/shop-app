export default class HttpError extends Error {
  status: number;

  expose: boolean;

  constructor(status: number, message: string, options?: ErrorOptions & { expose?: boolean }) {
    super(message, options);
    this.name = 'HttpError';
    this.status = status;
    this.expose = options?.expose ?? status < 500;
  }
}
