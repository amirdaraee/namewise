declare module 'pdf-extraction' {
  function extract(buffer: Buffer, options?: any): Promise<{
    text?: string;
    pages?: any[];
  }>;
  export = extract;
}