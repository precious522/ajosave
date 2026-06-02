export const serverConfig = {
  app: {
    url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    name: process.env.NEXT_PUBLIC_APP_NAME ?? "Ajosave",
  },
  stellar: {
    network: (process.env.STELLAR_NETWORK ?? "testnet") as "testnet" | "mainnet",
    horizonUrl: process.env.STELLAR_HORIZON_URL ?? "https://horizon-testnet.stellar.org",
    horizonFallbackUrl: process.env.STELLAR_HORIZON_FALLBACK_URL ?? "",
    networkPassphrase:
      process.env.STELLAR_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015",
    ajoContractId: process.env.STELLAR_AJO_CONTRACT_ID ?? "",
    certificateContractId: process.env.STELLAR_CERTIFICATE_CONTRACT_ID ?? "",
    serverSecretKey: process.env.STELLAR_SERVER_SECRET_KEY ?? "",
    sorobanRpcUrl:
      process.env.STELLAR_SOROBAN_RPC_URL ??
      "https://soroban-testnet.stellar.org",
    maxFeeCap: Number.parseInt(process.env.STELLAR_MAX_FEE_CAP ?? "200", 10) || 200,
  },
  usdc: {
    issuer: process.env.USDC_ISSUER ?? "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    assetCode: process.env.USDC_ASSET_CODE ?? "USDC",
  },
  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY ?? "",
    platformSubaccount: process.env.PAYSTACK_PLATFORM_SUBACCOUNT ?? "",
  },
  termii: {
    apiKey: process.env.TERMII_API_KEY ?? "",
    senderId: process.env.TERMII_SENDER_ID ?? "Ajosave",
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY ?? "",
    fromEmail: process.env.RESEND_FROM_EMAIL ?? "Ajosave <noreply@ajosave.app>",
  },
  redis: { url: process.env.REDIS_URL ?? "redis://localhost:6379" },
  database: { url: process.env.DATABASE_URL ?? "" },
  cronSecret: process.env.CRON_SECRET ?? "",
  authSecret: process.env.NEXTAUTH_SECRET ?? "development-secret-keep-it-safe",
  kyc: {
    smilePartnerId: process.env.SMILE_PARTNER_ID ?? "",
    smileApiKey: process.env.SMILE_API_KEY ?? "",
    smileCallbackUrl: process.env.SMILE_CALLBACK_URL ?? "",
    /** NGN threshold above which circles require KYC (default 100,000) */
    thresholdNgn: parseInt(process.env.KYC_THRESHOLD_NGN ?? "100000", 10),
  },
} as const;
