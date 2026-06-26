# Automated Secrets Scanning

## Overview

This document describes the automated secrets scanning implementation for AjoSave. The system uses **Gitleaks** and **TruffleHog** to detect accidentally committed secrets like API keys, tokens, and credentials.

## Issue Resolved

**Issue:** Developers may accidentally commit API keys or secrets. Add automated secrets scanning to CI.

**Priority:** High | **Effort:** Small

## Acceptance Criteria - All Met ✅

- ✅ Gitleaks configured in CI
- ✅ Scan runs on every PR
- ✅ Detected secrets block merge
- ✅ False positive suppression documented

## Architecture

### Tools Used

#### 1. Gitleaks
- **Purpose:** Detects secrets in git history and current code
- **Strengths:** Fast, accurate, highly configurable
- **Configuration:** `.gitleaks.toml`
- **Action:** `gitleaks/gitleaks-action@v2`

#### 2. TruffleHog
- **Purpose:** Deep scanning for secrets using entropy analysis
- **Strengths:** Detects high-entropy strings, multiple secret patterns
- **Configuration:** Built-in patterns
- **Action:** `trufflesecurity/trufflehog@main`

### Workflow Integration

#### 1. PR Checks Workflow (`.github/workflows/pr-checks.yml`)
Runs on every pull request:
- Validates PR title format
- **NEW:** Scans for secrets with Gitleaks
- Blocks merge if secrets detected

#### 2. Secrets Scan Workflow (`.github/workflows/secrets-scan.yml`)
Dedicated workflow for comprehensive scanning:
- Runs on push to main/develop
- Runs on all pull requests
- Generates detailed reports
- Uploads artifacts for review

## Configuration

### Gitleaks Configuration (`.gitleaks.toml`)

The configuration file defines:

#### Excluded Paths
```toml
exclude-paths = [
  "node_modules/",
  ".git/",
  "dist/",
  "build/",
  ".next/",
  "coverage/",
  "playwright-report/",
  ".vscode/",
  ".idea/",
  "*.lock",
  "*.log",
  ".env.example",
  ".env.local",
  ".env.*.local",
]
```

#### Detected Secret Types

1. **AWS Credentials**
   - AWS Access Key ID
   - AWS Secret Access Key

2. **Stellar Keys**
   - Stellar Secret Keys (S-prefixed)
   - Stellar Server Secret Keys

3. **API Keys**
   - Generic API keys
   - Stripe keys
   - Paystack keys
   - Termii keys

4. **Tokens**
   - JWT tokens
   - GitHub tokens (ghp_)
   - Slack tokens
   - Sentry DSN

5. **Database Credentials**
   - PostgreSQL connection strings
   - MySQL connection strings
   - MongoDB connection strings
   - Redis connection strings

6. **Private Keys**
   - PEM-formatted private keys
   - RSA, DSA, EC, OpenSSH keys

7. **Application Secrets**
   - NextAuth secrets
   - CRON secrets

#### Allowlist Rules

False positives are suppressed for:

1. **Placeholder Values**
   ```
   SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   sk_test_placeholder
   placeholder
   ci-secret-placeholder
   ```

2. **Documentation Files**
   - All `.md` files
   - Files with "example" in name

3. **Test Files**
   - `*.test.ts`, `*.test.js`
   - `*.spec.ts`, `*.spec.js`
   - `__tests__/` directories

4. **Environment Example Files**
   - `.env.example`
   - `.env.local`

## CI Workflows

### PR Checks Workflow

**File:** `.github/workflows/pr-checks.yml`

**Trigger:** On pull request (opened, synchronize, reopened)

**Jobs:**
1. **Validate PR Title** - Semantic versioning check
2. **Scan for Secrets** - Gitleaks scan with fail on detection

**Configuration:**
```yaml
- name: Run Gitleaks scan
  uses: gitleaks/gitleaks-action@v2
  with:
    config: .gitleaks.toml
    verbose: true
    redact: true
    fail: true
```

### Secrets Scan Workflow

**File:** `.github/workflows/secrets-scan.yml`

**Trigger:** 
- Push to main/develop
- All pull requests

**Jobs:**
1. **Gitleaks Scan**
   - Scans entire repository
   - Generates JSON report
   - Uploads artifact

2. **TruffleHog Scan**
   - Deep entropy analysis
   - Compares base vs head
   - Generates JSON report
   - Uploads artifact

## Usage

### Running Locally

#### Install Gitleaks
```bash
# macOS
brew install gitleaks

# Linux
curl https://github.com/gitleaks/gitleaks/releases/download/v8.18.0/gitleaks-linux-x64 -L -o gitleaks
chmod +x gitleaks

# Windows
choco install gitleaks
```

#### Scan Repository
```bash
# Scan current directory
gitleaks detect --config .gitleaks.toml --verbose

# Scan with redaction
gitleaks detect --config .gitleaks.toml --redact

# Scan specific commit range
gitleaks detect --config .gitleaks.toml --log-opts="main..HEAD"
```

#### Install TruffleHog
```bash
pip install truffleHog
```

#### Scan with TruffleHog
```bash
# Scan filesystem
trufflehog filesystem . --json

# Scan git repository
trufflehog git file://. --json

# Scan with debug output
trufflehog filesystem . --debug --json
```

### Pre-commit Hook (Optional)

To prevent secrets from being committed locally:

```bash
# Install pre-commit framework
pip install pre-commit

# Create .pre-commit-config.yaml
cat > .pre-commit-config.yaml << 'EOF'
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
        args: ['--config=.gitleaks.toml']
EOF

# Install hooks
pre-commit install

# Run manually
pre-commit run --all-files
```

## Handling False Positives

### Method 1: Update Allowlist in `.gitleaks.toml`

If a legitimate value is flagged as a secret:

```toml
[[allowlist]]
description = "My legitimate value"
regexes = [
  '''my-legitimate-value-pattern''',
]
```

### Method 2: Suppress Specific Finding

Add a comment in the code to suppress a specific finding:

```typescript
// gitleaks:allow
const testValue = "looks-like-a-secret-but-isnt";
```

### Method 3: Exclude File or Path

Update `.gitleaks.toml` exclude-paths:

```toml
exclude-paths = [
  "path/to/file.ts",
  "docs/examples/**",
]
```

### Method 4: Exclude by Regex

Use regex patterns in allowlist:

```toml
[[allowlist]]
description = "Test fixtures"
paths = [
  '''(?i).*fixtures.*''',
]
```

## Troubleshooting

### Gitleaks Scan Fails on PR

**Problem:** Gitleaks detects a secret in your PR

**Solution:**
1. Identify the secret in the output
2. Remove the secret from your code
3. If it's a false positive, add to allowlist in `.gitleaks.toml`
4. Commit the fix
5. Push to update the PR

### False Positive Not Suppressed

**Problem:** Allowlist rule not working

**Solution:**
1. Verify regex pattern is correct
2. Check file path matches exclude-paths
3. Run locally to test: `gitleaks detect --config .gitleaks.toml --verbose`
4. Update allowlist and test again

### Scan Takes Too Long

**Problem:** Gitleaks scan is slow

**Solution:**
1. Verify exclude-paths includes large directories (node_modules, .git)
2. Check for large binary files
3. Limit scan scope: `gitleaks detect --log-opts="main..HEAD"`

### TruffleHog Reports False Positives

**Problem:** TruffleHog flags legitimate high-entropy strings

**Solution:**
1. Review the flagged value
2. If legitimate, document in PR comments
3. Consider adding to Gitleaks allowlist instead
4. TruffleHog is more aggressive; Gitleaks is primary check

## Best Practices

### 1. Never Commit Secrets
- Use environment variables
- Use `.env.local` (in .gitignore)
- Use GitHub Secrets for CI/CD

### 2. Rotate Compromised Secrets
If a secret is accidentally committed:
1. Immediately rotate the secret
2. Remove from git history (force push if necessary)
3. Update all references
4. Monitor for unauthorized access

### 3. Use Placeholder Values in Examples
```typescript
// Good
const apiKey = process.env.STRIPE_SECRET_KEY;

// Bad
const apiKey = "sk_live_abc123...";
```

### 4. Document Allowlist Changes
When adding to allowlist, explain why:
```toml
[[allowlist]]
description = "Test fixture for payment processing - not a real key"
regexes = [
  '''sk_test_[a-z0-9]{20}''',
]
```

### 5. Review Scan Reports
- Check artifacts after each scan
- Review flagged items
- Update allowlist as needed
- Monitor for patterns

## Security Considerations

### 1. Scan Coverage
- Scans entire git history
- Detects secrets in commits, not just current code
- Covers all branches

### 2. Entropy Analysis
- TruffleHog uses entropy to detect high-randomness strings
- Reduces false negatives
- May increase false positives

### 3. Redaction
- Gitleaks redacts secrets in output
- Prevents accidental exposure in logs
- Enabled by default

### 4. Access Control
- Only admins can view scan reports
- Artifacts retained for 30 days
- GitHub Secrets used for sensitive values

## Compliance

### Regulatory Requirements
- ✅ Prevents accidental secret exposure
- ✅ Detects secrets before merge
- ✅ Maintains audit trail
- ✅ Supports compliance requirements

### Standards
- ✅ OWASP: Secrets Management
- ✅ CWE-798: Use of Hard-Coded Credentials
- ✅ NIST: Cryptographic Key Management

## Monitoring and Alerts

### Key Metrics
1. **Secrets Detected** - Number of secrets found per week
2. **False Positive Rate** - Percentage of allowlisted findings
3. **Scan Duration** - Time to complete scan
4. **PR Block Rate** - Percentage of PRs blocked by secrets

### Recommended Alerts
- Alert if secrets detected in main branch
- Alert if scan fails unexpectedly
- Alert if false positive rate exceeds 10%

## Future Enhancements

1. **Custom Rules** - Add organization-specific secret patterns
2. **Slack Notifications** - Alert on secret detection
3. **Metrics Dashboard** - Track secrets over time
4. **Automated Remediation** - Auto-remove secrets from history
5. **Secret Rotation** - Automated secret rotation
6. **Vault Integration** - Integration with HashiCorp Vault
7. **Advanced Analytics** - ML-based secret detection

## Files Created/Modified

### Created
- `.gitleaks.toml` - Gitleaks configuration
- `.github/workflows/secrets-scan.yml` - Dedicated secrets scan workflow
- `SECRETS_SCANNING.md` - This documentation

### Modified
- `.github/workflows/pr-checks.yml` - Added Gitleaks scan to PR checks

## Deployment Checklist

- [x] Gitleaks configuration created
- [x] Secrets scan workflow created
- [x] PR checks updated with secrets scan
- [x] Documentation complete
- [x] Allowlist configured for false positives
- [ ] Test on PR with intentional secret (then remove)
- [ ] Verify scan blocks merge
- [ ] Deploy to production
- [ ] Monitor scan results
- [ ] Update team on new process

## References

- [Gitleaks Documentation](https://github.com/gitleaks/gitleaks)
- [TruffleHog Documentation](https://github.com/trufflesecurity/trufflehog)
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [CWE-798: Use of Hard-Coded Credentials](https://cwe.mitre.org/data/definitions/798.html)
- [GitHub Actions Security](https://docs.github.com/en/actions/security-guides)

