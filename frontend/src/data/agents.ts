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
// Realistic, muted tones that feel warm and premium (not neon)
const SLUG_META: Record<string, { icon: LucideIcon; accent: string }> = {
  "hotel-booker":      { icon: BedDouble,       accent: "#c9956b" },  // warm amber/bronze
  "flight-booker":     { icon: PlaneTakeoff,    accent: "#7ba4c9" },  // muted steel blue
  "finance-ledger":    { icon: Wallet,          accent: "#8bbd8e" },  // sage green
  "mom-scheduler":     { icon: CalendarHeart,   accent: "#c48f7a" },  // terracotta
  "grocery-runner":    { icon: ShoppingBasket,   accent: "#b5838d" },  // dusty rose
  "inbox-triage":      { icon: MailQuestion,    accent: "#9a8ec4" },  // lavender
  "travel-concierge":  { icon: PlaneTakeoff,    accent: "#6da8a8" },  // teal
};

const DEFAULT_META = { icon: BedDouble, accent: "#c9956b" };

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
// Top 3: Hotel Booker, Grocery Runner, Flight Booker (featured agents)
export const agents: Agent[] = [
  {
    id: "hotel-booker",
    slug: "hotel-booker",
    name: "Hotel Booker",
    purpose: "Finds and reserves stays that match your saved loyalty profiles.",
    icon: BedDouble,
    status: "running",
    accent: "#c9956b",
    lastActive: "Running now",
  },
  {
    id: "grocery-runner",
    slug: "grocery-runner",
    name: "Grocery Runner",
    purpose: "Reorders staples and swaps items when a store is out of stock.",
    icon: ShoppingBasket,
    status: "attention",
    accent: "#b5838d",
    lastActive: "Needs input",
  },
  {
    id: "flight-booker",
    slug: "flight-booker",
    name: "Flight Booker",
    purpose: "Searches and books flights at the best price for your route and dates.",
    icon: PlaneTakeoff,
    status: "idle",
    accent: "#7ba4c9",
    lastActive: "Idle",
  },
  {
    id: "finance-ledger",
    slug: "finance-ledger",
    name: "Finance Ledger",
    purpose: "Reconciles spend across accounts and flags budget drift weekly.",
    icon: Wallet,
    status: "idle",
    accent: "#8bbd8e",
    lastActive: "Idle · 4h ago",
  },
  {
    id: "mom-scheduler",
    slug: "mom-scheduler",
    name: "Mom Scheduler",
    purpose: "Coordinates school pickups, appointments, and family logistics.",
    icon: CalendarHeart,
    status: "idle",
    accent: "#c48f7a",
    lastActive: "Idle · 1d ago",
  },
  {
    id: "inbox-triage",
    slug: "inbox-triage",
    name: "Inbox Triage",
    purpose: "Drafts replies and escalates anything that smells like urgent.",
    icon: MailQuestion,
    status: "idle",
    accent: "#9a8ec4",
    lastActive: "Idle · 12m ago",
  },
  {
    id: "travel-concierge",
    slug: "travel-concierge",
    name: "Travel Concierge",
    purpose: "Builds itineraries and watches fares against your travel window.",
    icon: PlaneTakeoff,
    status: "idle",
    accent: "#6da8a8",
    lastActive: "Idle · 2d ago",
  },
];
