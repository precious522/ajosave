import { revokeUserSessions, rotateRefreshToken, useRefreshToken } from "@/lib/refresh-tokens";
import { query } from "@/lib/db";
import { sendSms } from "@/lib/sms";

jest.mock("@/lib/db", () => ({ query: jest.fn() }));
jest.mock("@/lib/sms", () => ({ sendSms: jest.fn() }));

const mockedQuery = query as jest.MockedFunction<typeof query>;
const mockedSendSms = sendSms as jest.MockedFunction<typeof sendSms>;

describe("refresh token rotation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("revokes user sessions and notifies SMS when an old token is reused", async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [{ id: "user-1", phone: "+2348000000000" }] } as any)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ token: "old-token", family_id: "family-1", revoked_at: new Date(), user_id: "user-1" }] } as any)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [{ phone: "+2348000000000" }] } as any);

    const initial = await rotateRefreshToken("user-1", "family-1");
    const reused = await useRefreshToken(initial.token, "user-1");

    expect(reused).toBeNull();
    expect(mockedSendSms).toHaveBeenCalledWith("+2348000000000", expect.stringContaining("suspicious"));
  });

  it("issues a new refresh token and marks the previous one as revoked", async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [{ id: "user-2", phone: "+2348000000001" }] } as any);
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);
    mockedQuery.mockResolvedValueOnce({ rows: [] } as any);

    const rotated = await rotateRefreshToken("user-2", "family-2");

    expect(rotated.token).toBeTruthy();
    expect(rotated.familyId).toBe("family-2");
  });
});
