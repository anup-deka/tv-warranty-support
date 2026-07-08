"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { lookupDevice } from "@/lib/api";

const DEMO_SERIALS = [
  { code: "SN-VISTA-2024-001", label: "Active warranty" },
  { code: "SN-VISTA-2023-002", label: "Expiring soon" },
  { code: "SN-LUMA-2021-005",  label: "Expired warranty" },
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
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            TV Warranty Support
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Enter your TV&apos;s serial code to check your warranty status and
            get help from our AI support assistant.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
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
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200
                         disabled:text-gray-400 text-white text-sm font-medium py-2.5
                         rounded-lg transition flex items-center justify-center gap-2"
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
          <p className="text-xs text-gray-400 text-center mb-3">Demo serial codes</p>
          <div className="flex flex-col gap-2">
            {DEMO_SERIALS.map((d) => (
              <button
                key={d.code}
                onClick={() => setSerialCode(d.code)}
                className="flex items-center justify-between bg-white border border-gray-200
                           rounded-lg px-3.5 py-2.5 hover:border-blue-300 hover:bg-blue-50
                           transition text-left group"
              >
                <span className="font-mono text-sm text-gray-700 group-hover:text-blue-700">
                  {d.code}
                </span>
                <span className="text-xs text-gray-400 group-hover:text-blue-500">
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
