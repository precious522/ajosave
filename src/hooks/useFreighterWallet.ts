"use client";

import { useEffect, useState } from "react";
import {
  isConnected,
  requestAccess,
  getNetwork,
} from "@stellar/freighter-api";

export type ConnectionState =
  | "not_installed"
  | "disconnected"
  | "connecting"
  | "connected";

export interface UseFreighterWalletReturn {
  connectionState: ConnectionState;
  publicKey: string | null;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

interface WalletState {
  connectionState: ConnectionState;
  publicKey: string | null;
  error: string | null;
}

export function useFreighterWallet(): UseFreighterWalletReturn {
  const [state, setState] = useState<WalletState>({
    connectionState: "not_installed",
    publicKey: null,
    error: null,
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const detect = async () => {
      try {
        const result = await isConnected();
        if (result.isConnected === true) {
          setState((prev) => ({ ...prev, connectionState: "disconnected" }));
        } else {
          setState((prev) => ({ ...prev, connectionState: "not_installed" }));
        }
      } catch (err) {
        console.error("Freighter isConnected() failed:", err);
        setState((prev) => ({ ...prev, connectionState: "not_installed" }));
      }
    };

    detect();
  }, []);

  const connect = async (): Promise<void> => {
    if (typeof window === "undefined") {
      return;
    }

    setState((prev) => ({ ...prev, connectionState: "connecting", error: null }));

    try {
      // Request access from Freighter
      const accessResult = await requestAccess();

      if (accessResult.error) {
        const errorStr = String(accessResult.error);
        let message: string;

        if (/rejected|denied/i.test(errorStr)) {
          message =
            "Connection request was rejected. You can enter your Stellar key manually.";
        } else if (/locked/i.test(errorStr)) {
          message =
            "Your Freighter wallet is locked. Please unlock it and try again.";
        } else {
          console.error("Unexpected Freighter requestAccess error:", errorStr);
          message = "An unexpected error occurred. Please try again.";
        }

        setState((prev) => ({
          ...prev,
          connectionState: "disconnected",
          error: message,
        }));
        return;
      }

      // Validate the returned address
      const address = accessResult.address;
      if (
        typeof address !== "string" ||
        address.length !== 56 ||
        !address.startsWith("G")
      ) {
        setState((prev) => ({
          ...prev,
          connectionState: "disconnected",
          error:
            "The key returned by Freighter is not a valid Stellar public key.",
        }));
        return;
      }

      // Verify the network
      const networkResult = await getNetwork();

      if (
        networkResult.error ||
        networkResult.network.toUpperCase() !== "PUBLIC"
      ) {
        const detectedNetwork = networkResult.network || "unknown";
        setState((prev) => ({
          ...prev,
          connectionState: "disconnected",
          error: `Freighter is connected to ${detectedNetwork}, but this app requires Pubnet. Please switch networks in Freighter and try again.`,
        }));
        return;
      }

      // Success
      setState({
        connectionState: "connected",
        publicKey: address,
        error: null,
      });
    } catch (err) {
      console.error("Unexpected error in useFreighterWallet.connect():", err);
      setState((prev) => ({
        ...prev,
        connectionState: "disconnected",
        error: "An unexpected error occurred. Please try again.",
      }));
    }
  };

  const disconnect = (): void => {
    setState({
      connectionState: "disconnected",
      publicKey: null,
      error: null,
    });
  };

  return {
    connectionState: state.connectionState,
    publicKey: state.publicKey,
    error: state.error,
    connect,
    disconnect,
  };
}
