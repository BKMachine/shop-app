import type { AxiosError } from 'axios';

type ApiErrorPayload = {
  error?: string;
  message?: string;
};

export function getErrorMessage(error: unknown, fallback: string): string {
  const axiosError = error as AxiosError<ApiErrorPayload>;
  return (
    axiosError.response?.data?.error ||
    axiosError.response?.data?.message ||
    axiosError.message ||
    fallback
  );
}
