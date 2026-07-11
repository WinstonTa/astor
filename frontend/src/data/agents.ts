import type { LucideIcon } from "lucide-react";
import {
  BedDouble,
  Wallet,
  CalendarHeart,
  ShoppingBasket,
  MailQuestion,
  PlaneTakeoff,
} from "lucide-react";

export type AgentStatus = "idle" | "running" | "attention";

export interface Agent {
  id: string;
  name: string;
  purpose: string;
  icon: LucideIcon;
  status: AgentStatus;
  accent: string;
  lastActive: string;
}

export const agents: Agent[] = [
  {
    id: "hotel-booker",
    name: "Hotel Booker",
    purpose: "Finds and reserves stays that match your saved loyalty profiles.",
    icon: BedDouble,
    status: "running",
    accent: "#e8b96a",
    lastActive: "Running now",
  },
  {
    id: "finance-ledger",
    name: "Finance Ledger",
    purpose: "Reconciles spend across accounts and flags budget drift weekly.",
    icon: Wallet,
    status: "idle",
    accent: "#7dffb0",
    lastActive: "Idle · 4h ago",
  },
  {
    id: "mom-scheduler",
    name: "Mom Scheduler",
    purpose: "Coordinates school pickups, appointments, and family logistics.",
    icon: CalendarHeart,
    status: "idle",
    accent: "#7dffb0",
    lastActive: "Idle · 1d ago",
  },
  {
    id: "grocery-runner",
    name: "Grocery Runner",
    purpose: "Reorders staples and swaps items when a store is out of stock.",
    icon: ShoppingBasket,
    status: "attention",
    accent: "#ff5c4d",
    lastActive: "Needs input",
  },
  {
    id: "inbox-triage",
    name: "Inbox Triage",
    purpose: "Drafts replies and escalates anything that smells like urgent.",
    icon: MailQuestion,
    status: "idle",
    accent: "#7dffb0",
    lastActive: "Idle · 12m ago",
  },
  {
    id: "travel-concierge",
    name: "Travel Concierge",
    purpose: "Builds itineraries and watches fares against your travel window.",
    icon: PlaneTakeoff,
    status: "idle",
    accent: "#7dffb0",
    lastActive: "Idle · 2d ago",
  },
];
