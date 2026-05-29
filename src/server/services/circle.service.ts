import { randomUUID } from "crypto";
import type { Circle, Member, CircleStatus } from "@/types";
import type { CreateCircleInput } from "@/types/schemas";

// Exchange rate — replace with live FX feed in production
const NGN_PER_USDC = 1600;
export const ngnToUsdc = (ngn: number) => (ngn / NGN_PER_USDC).toFixed(7);

// ─── In-memory store (replace with DB) ───────────────────────────────────────
const circles = new Map<string, Circle>();
const members = new Map<string, Member[]>(); // circleId → members

export async function createCircle(
  creatorId: string,
  input: CreateCircleInput
): Promise<Circle> {
  const id = randomUUID();
  const circle: Circle = {
    id,
    name: input.name,
    creatorId,
    contributionUsdc: ngnToUsdc(input.contributionNgn),
    contributionNgn: input.contributionNgn,
    maxMembers: input.maxMembers,
    cycleFrequency: input.cycleFrequency,
    category: input.category,
    status: "open",
    currentCycle: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  circles.set(id, circle);
  members.set(id, []);
  return circle;
}

export async function getCircleById(id: string): Promise<Circle | null> {
  return circles.get(id) ?? null;
}

export async function listOpenCircles(category?: string): Promise<Circle[]> {
  return [...circles.values()].filter(
    (c) => c.status === "open" && (!category || c.category === category)
  );
}

export async function getCirclesByUser(userId: string): Promise<Circle[]> {
  const userMemberships = [...members.values()]
    .flat()
    .filter((m) => m.userId === userId)
    .map((m) => m.circleId);
  return [...circles.values()].filter(
    (c) => c.creatorId === userId || userMemberships.includes(c.id)
  );
}

export async function joinCircle(
  circleId: string,
  userId: string
): Promise<Member> {
  const circle = circles.get(circleId);
  if (!circle) throw new Error("Circle not found");
  if (circle.status !== "open") throw new Error("Circle is not open for joining");

  const circleMembers = members.get(circleId) ?? [];
  if (circleMembers.length >= circle.maxMembers) throw new Error("Circle is full");
  if (circleMembers.some((m) => m.userId === userId)) throw new Error("Already a member");

  const member: Member = {
    id: randomUUID(),
    circleId,
    userId,
    position: circleMembers.length + 1,
    status: "active",
    hasReceivedPayout: false,
    joinedAt: new Date(),
  };

  circleMembers.push(member);
  members.set(circleId, circleMembers);

  // Auto-start when full
  if (circleMembers.length === circle.maxMembers) {
    circle.status = "active";
    circle.currentCycle = 1;
    circle.nextPayoutAt = computeNextPayoutDate(circle.cycleFrequency);
    circle.updatedAt = new Date();
    circles.set(circleId, circle);
  }

  return member;
}

export async function getMembersByCircle(circleId: string): Promise<Member[]> {
  return members.get(circleId) ?? [];
}

export async function updateCircleStatus(id: string, status: CircleStatus): Promise<void> {
  const circle = circles.get(id);
  if (!circle) return;
  circle.status = status;
  circle.updatedAt = new Date();
  circles.set(id, circle);
}

function computeNextPayoutDate(frequency: Circle["cycleFrequency"]): Date {
  const d = new Date();
  if (frequency === "weekly") d.setDate(d.getDate() + 7);
  else if (frequency === "biweekly") d.setDate(d.getDate() + 14);
  else d.setMonth(d.getMonth() + 1);
  return d;
}
