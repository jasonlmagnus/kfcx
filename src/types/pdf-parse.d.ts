declare module "pdf-parse" {
  export class PDFParse {
    constructor(data: Uint8Array, options?: { verbosity?: number });
    getText(): Promise<{ pages: unknown[]; text: string; total: number }>;
    load(): Promise<unknown>;
  }
}
