const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface DeviceInfo {
  serial_code: string;
  customer_name: string;
  customer_email: string;
  tv_model: string;
  tv_screen_size: string | null;
  purchase_date: string;
  warranty_expiry_date: string;
  warranty_type: string;
  retailer: string | null;
  warranty_status: "active" | "expiring_soon" | "expired";
  days_remaining: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  conversation_id: string;
  answer: string;
  serial_code: string;
}

export interface Ticket {
  id: string;
  serial_code: string;
  conversation_id: string | null;
  title: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
}

export async function lookupDevice(serialCode: string): Promise<DeviceInfo> {
  const res = await fetch(`${BASE_URL}/device/${encodeURIComponent(serialCode)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail ?? "Failed to look up device.");
  }
  return res.json();
}

export async function sendMessage(
  serialCode: string,
  message: string,
  conversationId: string | null
): Promise<ChatResponse> {
  const res = await fetch(`${BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serial_code: serialCode,
      message,
      conversation_id: conversationId,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail ?? "Failed to send message.");
  }
  return res.json();
}

export async function createTicket(
  serialCode: string,
  conversationId: string,
  description: string,
  priority: string = "medium"
): Promise<Ticket> {
  const res = await fetch(`${BASE_URL}/tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serial_code: serialCode,
      conversation_id: conversationId,
      description,
      priority,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail ?? "Failed to create ticket.");
  }
  return res.json();
}

export async function listTickets(serialCode: string): Promise<Ticket[]> {
  const res = await fetch(`${BASE_URL}/tickets/${encodeURIComponent(serialCode)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.tickets ?? [];
}
