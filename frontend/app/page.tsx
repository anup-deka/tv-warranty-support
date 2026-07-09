"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { lookupDevice } from "@/lib/api";

const DEMO_SERIALS = [
  { code: "SN-VISTA-2024-001", label: "Active warranty", dot: "bg-green-500", text: "text-green-600" },
  { code: "SN-VISTA-2023-002", label: "Expiring soon", dot: "bg-amber-500", text: "text-amber-600" },
  { code: "SN-LUMA-2021-005",  label: "Expired warranty", dot: "bg-red-500", text: "text-red-500" },
];

export default function HomePage() {
  const router = useRouter();
  const [serialCode, setSerialCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = serialCode.trim().toUpperCase();
    if (!code) return;

    setLoading(true);
    setError(null);

    try {
      await lookupDevice(code);
      router.push(`/support/${encodeURIComponent(code)}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh]">
      <div className="w-full max-w-md animate-fade-in-up">
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-xs font-medium text-blue-600 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            AI-powered support
          </span>
          <h1 className="text-3xl font-bold tracking-tight mb-2 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-500 bg-clip-text text-transparent">
            TV Warranty Support
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Enter your TV&apos;s serial code to check your warranty status and
            get help from our AI support assistant.
          </p>
        </div>

        <div className="bg-white/90 backdrop-blur rounded-2xl shadow-lg shadow-gray-900/5 ring-1 ring-gray-200/70 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="serial"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Serial Code
              </label>
              <input
                id="serial"
                type="text"
                value={serialCode}
                onChange={(e) => setSerialCode(e.target.value)}
                placeholder="e.g. SN-VISTA-2024-001"
                autoComplete="off"
                spellCheck={false}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm
                           font-mono placeholder-gray-400 focus:outline-none focus:ring-2
                           focus:ring-blue-500 focus:border-transparent transition"
              />
              <p className="mt-1.5 text-xs text-gray-400">
                Found on the label on the back of your TV or in Settings &rsaquo; About
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !serialCode.trim()}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700
                         hover:to-indigo-700 disabled:from-gray-200 disabled:to-gray-200
                         disabled:text-gray-400 text-white text-sm font-semibold py-2.5
                         rounded-lg shadow-md shadow-blue-500/25 disabled:shadow-none
                         transition-all active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Looking up device...
                </>
              ) : (
                "Check Warranty & Get Support"
              )}
            </button>
          </form>
        </div>

        <div className="mt-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-gray-200/80" />
            <p className="text-xs font-medium text-gray-400">Demo serial codes</p>
            <div className="h-px flex-1 bg-gray-200/80" />
          </div>
          <div className="flex flex-col gap-2">
            {DEMO_SERIALS.map((d) => (
              <button
                key={d.code}
                onClick={() => setSerialCode(d.code)}
                className="flex items-center justify-between bg-white/80 backdrop-blur ring-1 ring-gray-200/70
                           rounded-xl px-3.5 py-2.5 hover:ring-blue-300 hover:bg-blue-50/60 hover:shadow-sm
                           transition-all text-left group"
              >
                <span className="flex items-center gap-2.5">
                  <span className={`w-2 h-2 rounded-full ${d.dot}`} />
                  <span className="font-mono text-sm text-gray-700 group-hover:text-blue-700">
                    {d.code}
                  </span>
                </span>
                <span className={`text-xs font-medium ${d.text}`}>
                  {d.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
