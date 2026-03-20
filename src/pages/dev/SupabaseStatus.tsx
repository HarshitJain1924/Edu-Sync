import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type QueryResult = {
  data?: any[] | null;
  error?: { message: string } | null;
};

export default function SupabaseStatus() {
  const [sessionJson, setSessionJson] = useState<string>("loading...");
  // Supabase client is strongly typed; narrow to known public table names.
  type PublicTable = keyof Database["public"]["Tables"];
  const [table, setTable] = useState<string>("profiles");
  const [result, setResult] = useState<QueryResult | null>(null);

  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

  const maskedAnon = useMemo(() => {
    if (!anon) return "<missing>";
    if (anon.length <= 12) return anon;
    return `${anon.slice(0, 6)}...${anon.slice(-6)}`;
  }, [anon]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSessionJson(JSON.stringify(data, null, 2));
    })();
  }, []);

  const runTest = async () => {
    setResult(null);
    try {
      // Cast the free-form input to the union of known table names for the typed client.
      const { data, error } = await supabase
        .from(table as unknown as PublicTable)
        .select("*")
        .limit(1);
      setResult({ data: data ?? null, error: error ? { message: error.message } : null });
    } catch (e: any) {
      setResult({ data: null, error: { message: e?.message ?? "Unknown error" } });
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Supabase Dev Status</h1>

      <div className="space-y-2 mb-6">
        <div>
          <span className="font-medium">Project URL:</span> <code>{url ?? "<missing>"}</code>
        </div>
        <div>
          <span className="font-medium">Anon key:</span> <code>{maskedAnon}</code>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-medium mb-2">Session</h2>
        <pre className="bg-neutral-900 text-neutral-100 p-3 rounded overflow-x-auto text-sm">
{sessionJson}
        </pre>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-medium mb-2">Quick Table Check</h2>
        <div className="flex gap-2 mb-3">
          <input
            className="border px-3 py-2 rounded w-full"
            placeholder="table name (e.g., profiles)"
            value={table}
            onChange={(e) => setTable(e.target.value)}
          />
          <button className="px-4 py-2 rounded bg-blue-600 text-white" onClick={runTest}>
            Run
          </button>
        </div>
        {result && (
          <pre className="bg-neutral-900 text-neutral-100 p-3 rounded overflow-x-auto text-sm">
{JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>

      <p className="text-sm text-neutral-500">
        Note: If the table does not exist or RLS denies access, you will see an error here. Use a public table or adjust policies for testing.
      </p>
    </div>
  );
}
