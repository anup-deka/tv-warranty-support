"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  lookupDevice,
  sendMessage,
  createTicket,
  listTickets,
  type DeviceInfo,
  type ChatMessage,
  type Ticket,
} from "@/lib/api";

// ── Warranty status badge ──────────────────────────────────────────────────
function WarrantyBadge({ status, days }: { status: DeviceInfo["warranty_status"]; days: number }) {
  const cfg = {
    active: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", label: `Active · ${days}d left` },
    expiring_soon: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", label: `Expiring in ${days}d` },
    expired: { bg: "bg-red-50", text: "text-red-600", border: "border-red-200", label: `Expired ${Math.abs(days)}d ago` },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === "active" ? "bg-green-500" : status === "expiring_soon" ? "bg-amber-500" : "bg-red-500"}`} />
      {cfg.label}
    </span>
  );
}

// ── Ticket modal ───────────────────────────────────────────────────────────
function TicketModal({
  onClose,
  onSubmit,
  loading,
}: {
  onClose: () => void;
  onSubmit: (description: string, priority: string) => Promise<void>;
  loading: boolean;
}) {
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Raise a Support Ticket</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Describe your issue
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe what's happening with your TV..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                         placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500
                         focus:border-transparent resize-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="low">Low — not urgent</option>
              <option value="medium">Medium — affecting use</option>
              <option value="high">High — TV barely usable</option>
              <option value="urgent">Urgent — TV not working</option>
            </select>
          </div>
          <p className="text-xs text-gray-400">
            Our AI will generate a ticket title from your chat history. You&apos;ll receive email
            confirmation at your registered address.
          </p>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(description, priority)}
            disabled={loading || !description.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200
                       disabled:text-gray-400 text-white text-sm font-medium rounded-lg
                       transition flex items-center gap-2"
          >
            {loading && (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            Submit Ticket
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Ticket item ────────────────────────────────────────────────────────────
function TicketItem({ ticket }: { ticket: Ticket }) {
  const priorityColor = {
    low: "text-gray-500",
    medium: "text-blue-600",
    high: "text-orange-600",
    urgent: "text-red-600",
  }[ticket.priority] ?? "text-gray-600";

  const statusColor = {
    open: "text-green-600",
    in_progress: "text-blue-600",
    resolved: "text-gray-500",
    closed: "text-gray-400",
  }[ticket.status] ?? "text-gray-600";

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-800 leading-snug">{ticket.title}</p>
        <span className={`text-xs font-medium shrink-0 ${statusColor}`}>{ticket.status}</span>
      </div>
      <div className="flex items-center gap-3 mt-1.5">
        <span className={`text-xs ${priorityColor}`}>{ticket.priority} priority</span>
        <span className="text-xs text-gray-400">
          {new Date(ticket.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>
    </div>
  );
}

// ── Chat bubble ────────────────────────────────────────────────────────────
function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mr-2 mt-0.5">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
      )}
      <div
        className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? "bg-blue-600 text-white rounded-br-sm"
            : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function SupportPage() {
  const params = useParams();
  const router = useRouter();
  const serialCode = decodeURIComponent(params.serial as string).toUpperCase();

  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [loadingDevice, setLoadingDevice] = useState(true);
  const [deviceError, setDeviceError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketSuccess, setTicketSuccess] = useState<Ticket | null>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "tickets">("chat");

  const bottomRef = useRef<HTMLDivElement>(null);

  // Load device info
  useEffect(() => {
    lookupDevice(serialCode)
      .then((d) => {
        setDevice(d);
        setMessages([
          {
            role: "assistant",
            content: `Hi ${d.customer_name.split(" ")[0]}! I'm the VistaTech warranty assistant. I can see your **${d.tv_model}** has a **${d.warranty_type} warranty** that ${
              d.warranty_status === "expired"
                ? `expired ${Math.abs(d.days_remaining)} days ago`
                : d.warranty_status === "expiring_soon"
                ? `expires in ${d.days_remaining} days`
                : `is active (${d.days_remaining} days remaining)`
            }. How can I help you today?`,
          },
        ]);
      })
      .catch((e) => setDeviceError(e.message))
      .finally(() => setLoadingDevice(false));
  }, [serialCode]);

  // Load tickets when tab is switched
  useEffect(() => {
    if (activeTab === "tickets") {
      listTickets(serialCode).then(setTickets);
    }
  }, [activeTab, serialCode]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || chatLoading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setChatLoading(true);

    try {
      const res = await sendMessage(serialCode, text, conversationId);
      setConversationId(res.conversation_id);
      setMessages((prev) => [...prev, { role: "assistant", content: res.answer }]);
    } catch (err: unknown) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Sorry, something went wrong. ${err instanceof Error ? err.message : ""}` },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  async function handleTicketSubmit(description: string, priority: string) {
    if (!conversationId) return;
    setTicketLoading(true);
    try {
      const ticket = await createTicket(serialCode, conversationId, description, priority);
      setTicketSuccess(ticket);
      setShowTicketModal(false);
      setActiveTab("tickets");
      const updated = await listTickets(serialCode);
      setTickets(updated);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create ticket.");
    } finally {
      setTicketLoading(false);
    }
  }

  if (loadingDevice) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <span className="w-8 h-8 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-sm">Looking up your device...</span>
        </div>
      </div>
    );
  }

  if (deviceError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 max-w-md text-center">
          <p className="text-sm text-red-700 font-medium mb-1">Device not found</p>
          <p className="text-sm text-red-600">{deviceError}</p>
        </div>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          Try another serial code
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-10rem)]">
      {/* Left column: device info + tickets tab */}
      <aside className="lg:col-span-1 flex flex-col gap-4 overflow-y-auto">
        {/* Device card */}
        {device && (
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <p className="font-semibold text-gray-900 text-sm leading-tight">{device.tv_model}</p>
                {device.tv_screen_size && (
                  <p className="text-xs text-gray-400 mt-0.5">{device.tv_screen_size} screen</p>
                )}
              </div>
              <WarrantyBadge status={device.warranty_status} days={device.days_remaining} />
            </div>
            <div className="space-y-1.5 text-xs text-gray-500">
              <div className="flex justify-between">
                <span>Customer</span>
                <span className="text-gray-700 font-medium">{device.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span>Serial code</span>
                <span className="font-mono text-gray-700">{device.serial_code}</span>
              </div>
              <div className="flex justify-between">
                <span>Purchased</span>
                <span className="text-gray-700">{new Date(device.purchase_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
              </div>
              <div className="flex justify-between">
                <span>Warranty expires</span>
                <span className="text-gray-700">{new Date(device.warranty_expiry_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
              </div>
              <div className="flex justify-between">
                <span>Plan</span>
                <span className="text-gray-700 font-medium">{device.warranty_type}</span>
              </div>
              {device.retailer && (
                <div className="flex justify-between">
                  <span>Retailer</span>
                  <span className="text-gray-700">{device.retailer}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Ticket success banner */}
        {ticketSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <p className="text-sm font-medium text-green-700 mb-0.5">Ticket created</p>
            <p className="text-xs text-green-600">{ticketSuccess.title}</p>
          </div>
        )}

        {/* Tickets section */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex-1">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">Support Tickets</p>
            <button
              onClick={() => setActiveTab(activeTab === "tickets" ? "chat" : "tickets")}
              className="text-xs text-blue-600 hover:underline"
            >
              {activeTab === "tickets" ? "Back to chat" : "View all"}
            </button>
          </div>
          {activeTab === "tickets" ? (
            <div className="p-3 space-y-2 overflow-y-auto max-h-64">
              {tickets.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No tickets yet</p>
              ) : (
                tickets.map((t) => <TicketItem key={t.id} ticket={t} />)
              )}
            </div>
          ) : (
            <div className="px-4 py-3">
              <p className="text-xs text-gray-400 leading-relaxed">
                Chat with our AI assistant first, then raise a ticket if your issue
                needs hands-on support.
              </p>
            </div>
          )}
        </div>

        <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 text-center transition">
          &larr; Check a different serial code
        </Link>
      </aside>

      {/* Right column: chat */}
      <section className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <p className="text-sm font-semibold text-gray-800">Warranty Assistant</p>
          </div>
          <button
            onClick={() => setShowTicketModal(true)}
            disabled={!conversationId}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg
                       border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600
                       disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 4v16m8-8H4" />
            </svg>
            Raise Ticket
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.map((msg, i) => (
            <ChatBubble key={i} message={msg} />
          ))}
          {chatLoading && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-2.5">
                <span className="flex gap-1 items-center h-5">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggested questions */}
        {messages.length <= 1 && (
          <div className="px-5 pb-2 flex flex-wrap gap-1.5">
            {[
              "Is my TV still under warranty?",
              "What does my warranty cover?",
              "How do I file a warranty claim?",
              "My screen has dead pixels — is this covered?",
            ].map((q) => (
              <button
                key={q}
                onClick={() => setInput(q)}
                className="text-xs px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full
                           hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition text-gray-600"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <form
          onSubmit={handleSend}
          className="px-4 py-3 border-t border-gray-100 flex gap-2 items-end"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
            rows={1}
            placeholder="Ask about your warranty coverage..."
            className="flex-1 resize-none px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm
                       placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500
                       focus:border-transparent transition max-h-32 overflow-y-auto"
          />
          <button
            type="submit"
            disabled={chatLoading || !input.trim()}
            className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200
                       flex items-center justify-center transition shrink-0"
          >
            <svg className="w-4 h-4 text-white disabled:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </form>
      </section>

      {/* Ticket modal */}
      {showTicketModal && (
        <TicketModal
          onClose={() => setShowTicketModal(false)}
          onSubmit={handleTicketSubmit}
          loading={ticketLoading}
        />
      )}
    </div>
  );
}
