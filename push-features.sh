#!/bin/bash

# Script to push all feature branches for issues #116, #117, #118, #120
# Run this script after authenticating with GitHub

echo "Pushing feature branches to remote..."

# Push multi-currency support (Issue #116)
echo "Pushing feature/multi-currency-support..."
git push -u origin feature/multi-currency-support

# Push on-chain reputation (Issue #117)
echo "Pushing feature/onchain-reputation..."
git push -u origin feature/onchain-reputation

# Push email notifications (Issue #118)
echo "Pushing feature/email-notifications..."
git push -u origin feature/email-notifications

# Push real-time streaming (Issue #120)
echo "Pushing feature/realtime-horizon-streaming..."
git push -u origin feature/realtime-horizon-streaming

echo "All feature branches pushed successfully!"
echo ""
echo "Next steps:"
echo "1. Create pull requests for each branch on GitHub"
echo "2. Review and merge the PRs"
echo "3. Run database migrations"
echo "4. Install new dependencies: npm install resend socket.io socket.io-client"
echo "5. Update environment variables (see .env.example)"
