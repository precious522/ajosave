import { deleteUserData, sendDeletionConfirmationEmail } from "@/server/services/user-deletion.service";
import * as db from "@/lib/db";
import * as email from "@/lib/email";
import * as audit from "@/server/services/audit.service";

jest.mock("@/lib/db", () => ({ query: jest.fn(), transaction: jest.fn() }));
jest.mock("@/lib/email", () => ({ sendEmail: jest.fn() }));
jest.mock("@/server/services/audit.service", () => ({ logAuditAction: jest.fn() }));

const mockTransaction = db.transaction as jest.MockedFunction<typeof db.transaction>;
const mockQuery = db.query as jest.MockedFunction<typeof db.query>;
const mockSendEmail = email.sendEmail as jest.MockedFunction<typeof email.sendEmail>;
const mockLogAudit = audit.logAuditAction as jest.MockedFunction<typeof audit.logAuditAction>;

const USER_ID = "abc12345-0000-0000-0000-000000000000";

beforeEach(() => {
  jest.clearAllMocks();
  mockLogAudit.mockResolvedValue({} as any);
  mockTransaction.mockImplementation(async (cb) => cb(mockQuery));
});

describe("deleteUserData", () => {
  it("anonymizes PII and returns email", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ email: "user@example.com" }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // UPDATE users
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // DELETE refresh_tokens

    const result = await deleteUserData(USER_ID);

    expect(result).toEqual({ email: "user@example.com" });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE users"),
      expect.arrayContaining([`deleted-${USER_ID}`, `deleted-user-${USER_ID.slice(0, 8)}`, USER_ID])
    );
    expect(mockQuery).toHaveBeenCalledWith(
      "DELETE FROM refresh_tokens WHERE user_id = $1",
      [USER_ID]
    );
  });

  it("returns null email when user has no email", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ email: null }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    const result = await deleteUserData(USER_ID);
    expect(result.email).toBeNull();
  });

  it("throws if user not found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
    await expect(deleteUserData(USER_ID)).rejects.toThrow("User not found");
  });

  it("logs audit action after deletion", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ email: null }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    await deleteUserData(USER_ID);

    expect(mockLogAudit).toHaveBeenCalledWith(
      USER_ID, "DELETE_USER", "USER", USER_ID,
      expect.objectContaining({ details: expect.objectContaining({ reason: expect.stringContaining("GDPR") }) })
    );
  });

  it("does not throw if audit log fails", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ email: null }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
    mockLogAudit.mockRejectedValue(new Error("audit DB down"));

    await expect(deleteUserData(USER_ID)).resolves.toBeDefined();
  });
});

describe("sendDeletionConfirmationEmail", () => {
  it("sends email with correct subject and recipient", async () => {
    mockSendEmail.mockResolvedValue(undefined);
    await sendDeletionConfirmationEmail("user@example.com");
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@example.com",
        subject: "Your Ajosave account has been deleted",
      })
    );
  });
});
