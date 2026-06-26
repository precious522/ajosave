# Push and Deploy Guide

## Authentication Required

The feature branches are ready to push but require GitHub authentication. Here's how to proceed:

## Option 1: Using GitHub CLI (Recommended)

```bash
# Install GitHub CLI if not already installed
# Ubuntu/Debian: sudo apt install gh
# macOS: brew install gh

# Authenticate
gh auth login

# Push all branches
./push-features.sh
```

## Option 2: Using Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate a new token with `repo` scope
3. Use the token as your password when pushing:

```bash
git push -u origin feature/multi-currency-support
# Username: your-github-username
# Password: your-personal-access-token
```

## Option 3: Using SSH Key

```bash
# Generate SSH key if you don't have one
ssh-keygen -t ed25519 -C "your-email@example.com"

# Add SSH key to GitHub
cat ~/.ssh/id_ed25519.pub
# Copy the output and add it to GitHub Settings → SSH Keys

# Update remote to use SSH
git remote set-url origin git@github.com:dev-fatima-24/ajosave.git

# Push branches
./push-features.sh
```

## Branches to Push

The following feature branches are ready:

1. ✅ `feature/multi-currency-support` - Issue #116
2. ✅ `feature/onchain-reputation` - Issue #117
3. ✅ `feature/email-notifications` - Issue #118
4. ✅ `feature/realtime-horizon-streaming` - Issue #120

## Manual Push Commands

If the script doesn't work, push each branch individually:

```bash
git push -u origin feature/multi-currency-support
git push -u origin feature/onchain-reputation
git push -u origin feature/email-notifications
git push -u origin feature/realtime-horizon-streaming
```

## After Pushing: Create Pull Requests

### PR #1: Multi-Currency Support (Closes #116)

```
Title: feat: add multi-currency support (NGN, GBP, USD, EUR)

Description:
Implements multi-currency support for circle contributions.

**Changes:**
- Add currency conversion library supporting NGN, GBP, USD, EUR
- Update database schema to store contribution currency
- Modify Paystack integration for multi-currency payments
- Update circle creation flow to accept currency selection

**Acceptance Criteria:**
✅ Circle creation allows selecting contribution currency
✅ Paystack supports GBP/USD/EUR
✅ Conversion to USDC handled per currency

Closes #116
```

### PR #2: On-Chain Reputation Storage (Closes #117)

```
Title: feat: implement on-chain reputation storage

Description:
Implements trustless reputation tracking on Soroban smart contract.

**Changes:**
- Enhance Soroban contract with reputation tracking
- Track on-time contributions and completed circles
- Calculate reputation score (0-100) based on contribution history
- Add API endpoint for reputation verification

**Reputation Formula:**
- On-time contribution rate: 70% weight
- Completed circles: 30% weight

**Acceptance Criteria:**
✅ Reputation stored in Soroban contract
✅ Score updated after each completed circle
✅ Publicly queryable by any participant

Closes #117
```

### PR #3: Email Notifications (Closes #118)

```
Title: feat: implement email notifications with Resend

Description:
Adds email notification support using Resend service.

**Changes:**
- Integrate Resend email service
- Create HTML email templates for all events
- Implement unified notification service (SMS + Email)
- Add user notification preferences

**Email Types:**
- Welcome email
- Payout received
- Contribution reminder
- Circle completed

**Acceptance Criteria:**
✅ Email provider integrated (Resend)
✅ Transactional emails: welcome, payout received, contribution reminder
✅ User can choose SMS, email, or both

Closes #118
```

### PR #4: Real-Time Stellar Horizon Streaming (Closes #120)

```
Title: feat: implement real-time Stellar Horizon streaming

Description:
Implements real-time payment monitoring and WebSocket updates.

**Changes:**
- Add Horizon SSE payment stream monitoring
- Auto-confirm contributions on USDC receipt
- Implement WebSocket server for real-time frontend updates
- Create React hook for consuming real-time events

**Real-Time Events:**
- contribution:confirmed
- payout:processed
- circle:completed
- circle:started

**Acceptance Criteria:**
✅ Backend subscribes to Horizon payment stream
✅ Incoming USDC payments trigger contribution confirmation
✅ Frontend receives real-time updates via WebSocket

Closes #120
```

## Deployment Steps

After merging all PRs:

### 1. Install Dependencies

```bash
npm install resend socket.io socket.io-client
```

### 2. Run Database Migrations

```bash
npm run migrate
```

### 3. Update Environment Variables

Add to your `.env` file:

```bash
# Email Notifications
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL="Ajosave <noreply@ajosave.app>"

# Real-Time Streaming
ENABLE_HORIZON_STREAM=true
STELLAR_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
```

### 4. Deploy Updated Soroban Contract

```bash
npm run contract:build
npm run contract:deploy
```

Update `STELLAR_AJO_CONTRACT_ID` in your environment with the new contract ID.

### 5. Configure Resend

1. Sign up at https://resend.com
2. Verify your sending domain
3. Get your API key
4. Update `RESEND_API_KEY` in environment

### 6. Test Each Feature

**Multi-Currency:**
```bash
# Create a circle with GBP
curl -X POST http://localhost:3000/api/circles \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Circle",
    "contributionAmount": 100,
    "contributionCurrency": "GBP",
    "maxMembers": 5,
    "cycleFrequency": "monthly"
  }'
```

**On-Chain Reputation:**
```bash
# Query reputation
curl http://localhost:3000/api/users/[user-id]/reputation?verify=true
```

**Email Notifications:**
- Create a test user with email
- Trigger a payout to receive email

**Real-Time Streaming:**
```bash
# Check stream status
curl http://localhost:3000/api/admin/horizon-stream

# Start stream
curl -X POST http://localhost:3000/api/admin/horizon-stream \
  -H "Content-Type: application/json" \
  -d '{"action": "start"}'
```

### 7. Monitor Logs

```bash
# Watch for Horizon stream events
tail -f logs/app.log | grep horizon-stream

# Watch for WebSocket connections
tail -f logs/app.log | grep websocket

# Watch for email notifications
tail -f logs/app.log | grep email
```

## Rollback Plan

If issues arise, you can revert each feature independently:

```bash
# Revert a specific feature
git revert <commit-hash>

# Or checkout previous version
git checkout <previous-commit>
```

## Support

For issues or questions:
- Check `IMPLEMENTATION_SUMMARY.md` for detailed implementation notes
- Review `docs/realtime-updates.md` for real-time feature documentation
- Check individual service files for inline documentation

## Verification Checklist

- [ ] All branches pushed successfully
- [ ] Pull requests created and reviewed
- [ ] Database migrations run without errors
- [ ] Dependencies installed
- [ ] Environment variables configured
- [ ] Soroban contract deployed
- [ ] Resend domain verified
- [ ] Multi-currency payments tested
- [ ] Reputation queries working
- [ ] Email notifications received
- [ ] Horizon stream running
- [ ] WebSocket connections established
- [ ] All tests passing

---

**Status**: Ready to push  
**Date**: April 27, 2026  
**Issues**: #116, #117, #118, #120
