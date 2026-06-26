import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CreateCircleForm } from "../CreateCircleForm";
import { useRouter } from "next/navigation";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

// Mock global fetch
global.fetch = jest.fn();

describe("CreateCircleForm", () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (global.fetch as jest.Mock).mockClear();
    mockPush.mockClear();
  });

  it("shows validation errors for invalid inputs", async () => {
    render(<CreateCircleForm />);
    
    const submitButton = screen.getByRole("button", { name: /create circle/i });
    fireEvent.click(submitButton);

    // Errors should appear for empty/invalid fields
    expect(await screen.findByText(/circle name must be at least 3 characters/i)).toBeInTheDocument();
  });

  it("calls API with correct payload on valid submission", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { id: "new-circle-id" } }),
    });

    render(<CreateCircleForm />);

    // Fill the form
    fireEvent.change(screen.getByLabelText(/circle name/i), { target: { value: "Lagos Monthly" } });
    fireEvent.change(screen.getByLabelText(/contribution amount/i), { target: { value: "10000" } });
    fireEvent.change(screen.getByLabelText(/number of members/i), { target: { value: "10" } });
    
    const submitButton = screen.getByRole("button", { name: /create circle/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/circles", expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }));
    });

    // Check payload (assuming field name mapping or that it matches the form)
    const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(callBody.name).toBe("Lagos Monthly");
    
    // Check redirection
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/circles/new-circle-id");
    });
  });

  it("shows loading state during submission", async () => {
    let resolveFetch: (_value: any) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    (global.fetch as jest.Mock).mockReturnValueOnce(fetchPromise);

    render(<CreateCircleForm />);

    fireEvent.change(screen.getByLabelText(/circle name/i), { target: { value: "Lagos Monthly" } });
    fireEvent.change(screen.getByLabelText(/contribution amount/i), { target: { value: "10000" } });
    fireEvent.change(screen.getByLabelText(/number of members/i), { target: { value: "10" } });

    fireEvent.click(screen.getByRole("button", { name: /create circle/i }));

    // Button should be in loading state (disabled and showing loading text)
    const submitButton = screen.getByRole("button");
    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    // Resolve the promise
    await waitFor(() => {
      resolveFetch!({
        ok: true,
        json: async () => ({ success: true, data: { id: "id" } }),
      });
    });
  });

  it("shows error message on API failure", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ success: false, error: "Failed to create circle" }),
    });

    render(<CreateCircleForm />);

    fireEvent.change(screen.getByLabelText(/circle name/i), { target: { value: "Lagos Monthly" } });
    fireEvent.change(screen.getByLabelText(/contribution amount/i), { target: { value: "10000" } });
    fireEvent.change(screen.getByLabelText(/number of members/i), { target: { value: "10" } });

    fireEvent.click(screen.getByRole("button", { name: /create circle/i }));

    expect(await screen.findByText(/failed to create circle/i)).toBeInTheDocument();
  });
});
