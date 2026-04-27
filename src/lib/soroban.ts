import { contract, Keypair, Networks } from "@stellar/stellar-sdk";
import { serverConfig } from "@/server/config";

const networkPassphrase =
  serverConfig.stellar.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

/**
 * Invoke AjoContract.payout() via Soroban RPC.
 * The contract handles the token transfer; the backend only triggers it.
 *
 * @param contractId - The deployed Ajo contract address for this circle
 * @returns The Soroban transaction hash
 */
export async function invokeContractPayout(contractId: string): Promise<string> {
  const keypair = Keypair.fromSecret(serverConfig.stellar.serverSecretKey);
  const signer = contract.basicNodeSigner(keypair, networkPassphrase);

  const client = await contract.Client.from({
    contractId,
    networkPassphrase,
    rpcUrl: serverConfig.stellar.sorobanRpcUrl,
    publicKey: keypair.publicKey(),
    ...signer,
  });

  // payout() takes no args — admin auth is checked inside the contract
  // @ts-expect-error — method generated from contract ABI at runtime
  const assembled = await client.payout();
  const sent = await assembled.send();
  // SentTransaction exposes the hash via the underlying getTransaction response
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (sent as any).hash ?? (sent as any).sendTransactionResponse?.hash ?? "";
}

/**
 * Invoke AjoContract.set_payout_order() via Soroban RPC.
 * Sets the randomized payout order on the smart contract.
 *
 * @param contractId - The deployed Ajo contract address for this circle
 * @param payoutOrder - Array of member indices in desired payout order
 * @returns The Soroban transaction hash
 */
export async function invokeContractSetPayoutOrder(
  contractId: string,
  payoutOrder: number[]
): Promise<string> {
  const keypair = Keypair.fromSecret(serverConfig.stellar.serverSecretKey);
  const signer = contract.basicNodeSigner(keypair, networkPassphrase);

  const client = await contract.Client.from({
    contractId,
    networkPassphrase,
    rpcUrl: serverConfig.stellar.sorobanRpcUrl,
    publicKey: keypair.publicKey(),
    ...signer,
  });

  // set_payout_order(order: Vec<u32>)
  // @ts-expect-error — method generated from contract ABI at runtime
  const assembled = await client.set_payout_order({ order: payoutOrder });
  const sent = await assembled.send();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (sent as any).hash ?? (sent as any).sendTransactionResponse?.hash ?? "";
}
