/** État renvoyé par les actions d'import CSV SumUp (créateur et admin) à la fenêtre d'import. */
export type ImportState = {
  mode?: "preview" | "applied";
  error?: string;
  creates?: { line: number; brand?: string; reference: string; name: string; price: string; quantity: number; status?: string }[];
  updates?: { line: number; name: string; details: string[] }[];
  unchanged?: number;
  errors?: { line: number; message: string }[];
  result?: { message: string };
} | null;
