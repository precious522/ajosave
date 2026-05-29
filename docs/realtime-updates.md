# Real-Time Updates

Ajosave supports real-time updates for circle activities using Stellar Horizon streaming and WebSocket connections.

## Architecture

### Stellar Horizon Streaming (Backend)

The backend subscribes to Stellar Horizon's Server-Sent Events (SSE) stream to monitor incoming USDC payments in real-time.

**Features:**
- Monitors payments to the platform's Stellar account
- Auto-confirms contributions when matching USDC payments are received
- Eliminates polling and reduces confirmation latency
- Automatically reconnects on connection loss

**Implementation:**
- Service: `src/server/services/horizon-stream.service.ts`
- Starts automatically on server boot (via `instrumentation.ts`)
- Can be controlled via `/api/admin/horizon-stream` endpoint

### WebSocket Server (Backend → Frontend)

The backend broadcasts events to connected frontend clients via WebSocket (Socket.io).

**Events:**
- `contribution:confirmed` - When a contribution is confirmed on-chain
- `payout:processed` - When a payout is executed
- `circle:completed` - When a circle completes all cycles
- `circle:started` - When a circle becomes active

**Implementation:**
- Server: `src/server/websocket.ts`
- Clients can subscribe to specific circles or user updates
- Authentication required for subscriptions

### Frontend Hook

React hook for consuming real-time updates in components.

**Usage:**

```typescript
import { useRealtimeUpdates } from "@/hooks/useRealtimeUpdates";

function CircleDetail({ circleId }: { circleId: string }) {
  const { isConnected } = useRealtimeUpdates({
    circleId,
    onContributionConfirmed: (data) => {
      console.log("Contribution confirmed:", data);
      // Refresh circle data or show notification
    },
    onPayoutProcessed: (data) => {
      console.log("Payout processed:", data);
      // Update UI
    },
  });

  return (
    <div>
      {isConnected ? "🟢 Live" : "🔴 Offline"}
      {/* Circle content */}
    </div>
  );
}
```

## Configuration

### Environment Variables

```bash
# Enable/disable Horizon streaming
ENABLE_HORIZON_STREAM=true

# Stellar configuration
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_SERVER_SECRET_KEY=your_secret_key
```

### Admin Controls

Start/stop the Horizon stream:

```bash
# Start stream
curl -X POST http://localhost:3000/api/admin/horizon-stream \
  -H "Content-Type: application/json" \
  -d '{"action": "start"}'

# Stop stream
curl -X POST http://localhost:3000/api/admin/horizon-stream \
  -H "Content-Type: application/json" \
  -d '{"action": "stop"}'

# Check status
curl http://localhost:3000/api/admin/horizon-stream
```

## Benefits

1. **Instant Confirmation**: Contributions are confirmed within seconds of on-chain settlement
2. **No Polling**: Eliminates the need for frontend polling, reducing server load
3. **Better UX**: Users see updates in real-time without refreshing
4. **Scalable**: Horizon SSE is designed for production use
5. **Reliable**: Automatic reconnection on connection loss

## Deployment Considerations

### Production

- Ensure `ENABLE_HORIZON_STREAM=true` in production environment
- Use mainnet Horizon URL: `https://horizon.stellar.org`
- Monitor stream health via `/api/admin/horizon-stream` endpoint
- Consider using a process manager (PM2) for automatic restarts

### Development

- Stream works on testnet by default
- Can be disabled with `ENABLE_HORIZON_STREAM=false` for local development
- WebSocket server runs on the same port as Next.js (default: 3000)

## Troubleshooting

### Stream Not Starting

1. Check `STELLAR_SERVER_SECRET_KEY` is set correctly
2. Verify Horizon URL is accessible
3. Check logs for connection errors

### WebSocket Connection Issues

1. Ensure `/api/socket` path is not blocked by proxy/firewall
2. Check CORS configuration in `src/server/websocket.ts`
3. Verify authentication token is valid

### Auto-Confirmation Not Working

1. Verify contribution amount matches payment amount exactly
2. Check that user's Stellar address is set correctly
3. Ensure contribution was created within the last 30 minutes
4. Check logs for matching errors

## Future Enhancements

- [ ] Add Redis pub/sub for multi-instance WebSocket synchronization
- [ ] Implement WebSocket authentication with JWT
- [ ] Add rate limiting for WebSocket connections
- [ ] Support for custom payment memos for better matching
- [ ] Dashboard for monitoring stream health and metrics
