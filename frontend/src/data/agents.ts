import type { LucideIcon } from "lucide-react";
import {
  BedDouble,
  Wallet,
  CalendarHeart,
  ShoppingBasket,
  MailQuestion,
  PlaneTakeoff,
} from "lucide-react";
import type { ApiAgent } from "../lib/api";

export type AgentStatus = "idle" | "running" | "attention";

export interface Agent {
  id: string;
  dbId?: string;    // UUID from database (for API calls)
  slug: string;
  name: string;
  purpose: string;
  icon: LucideIcon;
  status: AgentStatus;
  accent: string;
  lastActive: string;
}

// ── Icon + accent mapping by slug ─────────────────────────────────────────
const SLUG_META: Record<string, { icon: LucideIcon; accent: string }> = {
  "hotel-booker":      { icon: BedDouble,       accent: "#e8b96a" },
  "finance-ledger":    { icon: Wallet,          accent: "#7dffb0" },
  "mom-scheduler":     { icon: CalendarHeart,   accent: "#7dffb0" },
  "grocery-runner":    { icon: ShoppingBasket,   accent: "#ff5c4d" },
  "inbox-triage":      { icon: MailQuestion,    accent: "#7dffb0" },
  "travel-concierge":  { icon: PlaneTakeoff,    accent: "#7dffb0" },
};

const DEFAULT_META = { icon: BedDouble, accent: "#7dffb0" };

// ── Convert a DB agent to the frontend Agent type ─────────────────────────
export function mapApiAgent(api: ApiAgent): Agent {
  const meta = SLUG_META[api.slug] ?? DEFAULT_META;
  return {
    id: api.slug,     // use slug as the frontend id (matches onOpen flow)
    dbId: api.id,     // keep the UUID for API calls
    slug: api.slug,
    name: api.name,
    purpose: api.purpose,
    icon: meta.icon,
    status: "idle" as AgentStatus,
    accent: meta.accent,
    lastActive: "Idle",
  };
}

// ── Fallback mock data (used when backend is unavailable) ─────────────────
export const agents: Agent[] = [
  {
    id: "hotel-booker",
    slug: "hotel-booker",
    name: "Hotel Booker",
    purpose: "Finds and reserves stays that match your saved loyalty profiles.",
    icon: BedDouble,
    status: "running",
    accent: "#e8b96a",
    lastActive: "Running now",
  },
  {
    id: "finance-ledger",
    slug: "finance-ledger",
    name: "Finance Ledger",
    purpose: "Reconciles spend across accounts and flags budget drift weekly.",
    icon: Wallet,
    status: "idle",
    accent: "#7dffb0",
    lastActive: "Idle · 4h ago",
  },
  {
    id: "mom-scheduler",
    slug: "mom-scheduler",
    name: "Mom Scheduler",
    purpose: "Coordinates school pickups, appointments, and family logistics.",
    icon: CalendarHeart,
    status: "idle",
    accent: "#7dffb0",
    lastActive: "Idle · 1d ago",
  },
  {
    id: "grocery-runner",
    slug: "grocery-runner",
    name: "Grocery Runner",
    purpose: "Reorders staples and swaps items when a store is out of stock.",
    icon: ShoppingBasket,
    status: "attention",
    accent: "#ff5c4d",
    lastActive: "Needs input",
  },
  {
    id: "inbox-triage",
    slug: "inbox-triage",
    name: "Inbox Triage",
    purpose: "Drafts replies and escalates anything that smells like urgent.",
    icon: MailQuestion,
    status: "idle",
    accent: "#7dffb0",
    lastActive: "Idle · 12m ago",
  },
  {
    id: "travel-concierge",
    slug: "travel-concierge",
    name: "Travel Concierge",
    purpose: "Builds itineraries and watches fares against your travel window.",
    icon: PlaneTakeoff,
    status: "idle",
    accent: "#7dffb0",
    lastActive: "Idle · 2d ago",
  },
];
