interface Rules {
  [key: string]: (value: string) => boolean | string;
}
