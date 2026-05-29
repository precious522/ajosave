import { render, screen } from "@testing-library/react";
import { CircleCard } from "../CircleCard";
import type { Circle, Member, CircleStatus } from "@/types";

// Mock next/link so href renders as a plain <a>
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const baseCircle: Circle = {
  id: "circle-1",
  name: "Lagos Monthly Ajo",
  creatorId: "user-1",
  contributionUsdc: "10.0000000",
  contributionFiat: 16_000,
  contributionCurrency: "NGN",
  circleType: "public",
  maxMembers: 5,
  cycleFrequency: "monthly",
  payoutMethod: "fixed",
  gracePeriodHours: 24,
  status: "open",
  currentCycle: 0,
  nextPayoutAt: undefined,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

const makeMember = (id: string): Member => ({
  id,
  circleId: "circle-1",
  userId: `user-${id}`,
  position: 1,
  status: "active",
  hasReceivedPayout: false,
  joinedAt: new Date("2025-01-01"),
});

describe("CircleCard", () => {
  describe("renders core information", () => {
    it("displays the circle name", () => {
      render(<CircleCard circle={baseCircle} members={[]} />);
      expect(screen.getByText("Lagos Monthly Ajo")).toBeInTheDocument();
    });

    it("displays cycle frequency", () => {
      render(<CircleCard circle={baseCircle} members={[]} />);
      expect(screen.getByText("/ monthly")).toBeInTheDocument();
    });

    it("displays member count", () => {
      const members = [makeMember("a"), makeMember("b")];
      render(<CircleCard circle={baseCircle} members={members} />);
      expect(screen.getByText(/2 \/ 5 members/i)).toBeInTheDocument();
    });

    it("displays the next payout date when provided", () => {
      const circle: Circle = {
        ...baseCircle,
        nextPayoutAt: new Date("2025-06-15"),
      };
      render(<CircleCard circle={circle} members={[]} />);
      expect(screen.getByText(/jun 15, 2025/i)).toBeInTheDocument();
    });

    it("does not display next payout when not set", () => {
      render(<CircleCard circle={baseCircle} members={[]} />);
      expect(screen.queryByText(/next payout/i)).not.toBeInTheDocument();
    });

    it("renders a progress bar with correct aria attributes", () => {
      const members = [makeMember("a"), makeMember("b")];
      render(<CircleCard circle={baseCircle} members={members} />);
      const bar = screen.getByRole("progressbar");
      expect(bar).toHaveAttribute("aria-valuenow", "2");
      expect(bar).toHaveAttribute("aria-valuemax", "5");
    });

    it("displays the correct currency symbol for NGN", () => {
      render(<CircleCard circle={baseCircle} members={[]} />);
      expect(screen.getByText(/₦/)).toBeInTheDocument();
      expect(screen.getByText(/16,000/)).toBeInTheDocument();
    });

    it("displays the correct currency symbol for USD", () => {
      const usdCircle: Circle = { ...baseCircle, contributionCurrency: "USD", contributionFiat: 50 };
      render(<CircleCard circle={usdCircle} members={[]} />);
      expect(screen.getByText(/\$/)).toBeInTheDocument();
      expect(screen.getByText(/50/)).toBeInTheDocument();
    });

    it("displays the correct currency symbol for EUR", () => {
      const eurCircle: Circle = { ...baseCircle, contributionCurrency: "EUR", contributionFiat: 45 };
      render(<CircleCard circle={eurCircle} members={[]} />);
      expect(screen.getByText(/€/)).toBeInTheDocument();
      expect(screen.getByText(/45/)).toBeInTheDocument();
    });

    it("displays the correct currency symbol for GBP", () => {
      const gbpCircle: Circle = { ...baseCircle, contributionCurrency: "GBP", contributionFiat: 40 };
      render(<CircleCard circle={gbpCircle} members={[]} />);
      expect(screen.getByText(/£/)).toBeInTheDocument();
      expect(screen.getByText(/40/)).toBeInTheDocument();
    });
  });

  describe("status badge", () => {
    const statuses: CircleStatus[] = ["open", "active", "completed", "cancelled"];

    statuses.forEach((status) => {
      it(`renders the "${status}" status badge`, () => {
        const circle: Circle = { ...baseCircle, status };
        render(<CircleCard circle={circle} members={[]} />);
        expect(screen.getByText(status.charAt(0).toUpperCase() + status.slice(1))).toBeInTheDocument();
      });
    });
  });

  describe("join button visibility", () => {
    it("shows Join button when showJoin=true, status=open, and spots are available", () => {
      render(<CircleCard circle={baseCircle} members={[makeMember("a")]} showJoin />);
      expect(screen.getByRole("link", { name: /join circle/i })).toBeInTheDocument();
    });

    it("join link points to the correct circle join URL", () => {
      render(<CircleCard circle={baseCircle} members={[]} showJoin />);
      expect(screen.getByRole("link", { name: /join circle/i })).toHaveAttribute(
        "href",
        "/circles/circle-1/join"
      );
    });

    it("shows singular 'spot' when only 1 spot remains", () => {
      const members = [makeMember("a"), makeMember("b"), makeMember("c"), makeMember("d")];
      render(<CircleCard circle={baseCircle} members={members} showJoin />);
      expect(screen.getByRole("link", { name: /1 spot left/i })).toBeInTheDocument();
    });

    it("shows plural 'spots' when multiple spots remain", () => {
      render(<CircleCard circle={baseCircle} members={[makeMember("a")]} showJoin />);
      expect(screen.getByRole("link", { name: /4 spots left/i })).toBeInTheDocument();
    });

    it("hides Join button when circle is full (spotsLeft = 0)", () => {
      const members = [
        makeMember("a"), makeMember("b"), makeMember("c"), makeMember("d"), makeMember("e"),
      ];
      render(<CircleCard circle={baseCircle} members={members} showJoin />);
      expect(screen.queryByRole("link", { name: /join circle/i })).not.toBeInTheDocument();
    });

    it("shows 'Circle Full — View Details / Join Waitlist' link when circle is full (spotsLeft = 0)", () => {
      const members = [
        makeMember("a"), makeMember("b"), makeMember("c"), makeMember("d"), makeMember("e"),
      ];
      render(<CircleCard circle={baseCircle} members={members} showJoin />);
      const link = screen.getByRole("link", { name: /circle full/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/circles/circle-1");
    });

    it("hides Join button when status is 'active'", () => {
      const circle: Circle = { ...baseCircle, status: "active" };
      render(<CircleCard circle={circle} members={[]} showJoin />);
      expect(screen.queryByRole("link", { name: /join circle/i })).not.toBeInTheDocument();
    });

    it("hides Join button when status is 'completed'", () => {
      const circle: Circle = { ...baseCircle, status: "completed" };
      render(<CircleCard circle={circle} members={[]} showJoin />);
      expect(screen.queryByRole("link", { name: /join circle/i })).not.toBeInTheDocument();
    });

    it("hides Join button when status is 'cancelled'", () => {
      const circle: Circle = { ...baseCircle, status: "cancelled" };
      render(<CircleCard circle={circle} members={[]} showJoin />);
      expect(screen.queryByRole("link", { name: /join circle/i })).not.toBeInTheDocument();
    });

    it("hides Join button when showJoin=false regardless of status and spots", () => {
      render(<CircleCard circle={baseCircle} members={[]} showJoin={false} />);
      expect(screen.queryByRole("link", { name: /join circle/i })).not.toBeInTheDocument();
    });
  });

  describe("View Details button", () => {
    it("shows View Details link when showJoin=false", () => {
      render(<CircleCard circle={baseCircle} members={[]} />);
      expect(screen.getByRole("link", { name: /view details/i })).toBeInTheDocument();
    });

    it("View Details link points to the correct circle URL", () => {
      render(<CircleCard circle={baseCircle} members={[]} />);
      expect(screen.getByRole("link", { name: /view details/i })).toHaveAttribute(
        "href",
        "/circles/circle-1"
      );
    });

    it("does not show View Details link when showJoin=true", () => {
      render(<CircleCard circle={baseCircle} members={[]} showJoin />);
      expect(screen.queryByRole("link", { name: /view details/i })).not.toBeInTheDocument();
    });
  });
});
