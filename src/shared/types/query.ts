export interface QuerySearch<TRow> {
  column: keyof TRow;
  value: string;
}

export interface QueryRange {
  from: number;
  to: number;
}

export interface QueryOrderBy<TRow> {
  column: keyof TRow;
  ascending?: boolean;
}

export interface QueryOptions<TRow> {
  filters?: Partial<TRow>;
  search?: QuerySearch<TRow>;
  range?: QueryRange;
  orderBy?: QueryOrderBy<TRow>;
  custom?: (query: any) => any;
  skip?: boolean;
  columns?: string;
  count?: "exact" | "planned" | "estimated";
}

export interface QueryListResult<TRow> {
  data: TRow[];
  count: number | null;
}

