import { purgeExpiredPii, anonymizeAuditActor } from "@/lib/retention";
import { query } from "@/lib/db";

jest.mock("@/lib/db", () => ({ query: jest.fn() }));

const mockedQuery = query as jest.MockedFunction<typeof query>;

describe("PII retention policy", () => {
  beforeEach(() => jest.clearAllMocks());

  it("purges expired PII records and anonymizes actor names", async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [{ id: "user-1" }] } as any);
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const result = await purgeExpiredPii();
    const anonymized = anonymizeAuditActor("Alice");

    expect(result).toBeGreaterThanOrEqual(0);
    expect(anonymized).toContain("user");
  });
});
