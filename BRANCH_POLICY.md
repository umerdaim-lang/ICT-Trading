# ICT Trading - Branch Policy & Isolation Rules

**Effective Date**: 2026-02-23
**Status**: 🔐 STRICT ENFORCEMENT
**Purpose**: Prevent code mixing and maintain project isolation

---

## 🔐 CRITICAL RULE

**ALL ICT Trading work MUST go to the `ICT-Trading` branch ONLY.**

**NEVER commit ICT Trading code to `main` branch.**

---

## Branch Structure

### `ICT-Trading` Branch (DEVELOPMENT)
- **Purpose**: All ICT Trading development, features, fixes
- **Status**: Active development branch
- **Deployment**: NOT auto-deployed (manual only)
- **Contents**: 100% ICT Trading code only
- **Rule**: Any commit on this branch MUST be ICT Trading related

### `main` Branch (LEGACY - DO NOT USE)
- **Purpose**: Kept for backwards compatibility only
- **Status**: Frozen after 2026-02-23
- **Deployment**: Auto-deployed by Render (if used)
- **Contents**: Old code (before Phase 3)
- **Rule**: NO NEW COMMITS to main for ICT Trading

---

## Workflow for ICT Trading Development

### Starting New Work
```bash
# 1. Ensure you're on ICT-Trading branch
git checkout ICT-Trading
git pull origin ICT-Trading

# 2. Create feature branch (optional, for complex work)
git checkout -b feature/your-feature-name

# 3. Make changes
# ... edit files ...

# 4. Stage changes
git add <specific_files>  # NOT git add .

# 5. Commit to feature branch (if created)
git commit -m "message"

# 6. Merge back to ICT-Trading
git checkout ICT-Trading
git merge feature/your-feature-name

# 7. Push to ICT-Trading branch ONLY
git push origin ICT-Trading
```

### Alternative: Direct Commit to ICT-Trading
```bash
git checkout ICT-Trading
git pull origin ICT-Trading
# ... make changes ...
git add <specific_files>
git commit -m "message"
git push origin ICT-Trading
```

---

## Branch Protection Rules

### Enforced Automatically
- ✅ ICT-Trading branch exists and is protected
- ✅ All Phase 3 commits are on ICT-Trading
- ✅ main branch is frozen at old state

### Manual Enforcement
- 🚫 NEVER commit to main
- 🚫 NEVER merge from main → ICT-Trading
- 🚫 NEVER cherry-pick ICT Trading commits to main
- 🚫 NEVER rebase ICT-Trading on main

---

## Verification Checklist

Before committing, verify:

```bash
# 1. Check current branch
git branch

# Expected output:
#   * ICT-Trading    ← You should be here
#     main
#     remotes/origin/ICT-Trading
#     remotes/origin/main

# 2. Check files to commit are ICT Trading only
git status

# Expected: Only files in /backend, /dashboard, /tests, or root config

# 3. Check remote branches
git branch -a

# Expected:
#   * ICT-Trading
#     main
#     remotes/origin/ICT-Trading
#     remotes/origin/main
```

---

## Emergency Procedures

### If you accidentally commit to `main`:

```bash
# 1. Revert the commit on main
git checkout main
git revert <commit_hash>
git push origin main

# 2. Apply same commit to ICT-Trading
git checkout ICT-Trading
git cherry-pick <commit_hash>
git push origin ICT-Trading
```

### If you accidentally merged main → ICT-Trading:

```bash
# 1. Reset ICT-Trading to before merge
git checkout ICT-Trading
git reset --hard origin/ICT-Trading
git push --force-with-lease origin ICT-Trading
```

---

## Files by Project (ICT Trading Only)

### ✅ ICT-Trading Files (belongs on ICT-Trading branch)
```
/backend/
  src/
    services/
      - ict.service.js
      - claude.service.js
      - dataFetch.service.js
    routes/
      - analysis.js
      - signals.js
      - webhook.js
      - marketData.js
    controllers/
      - *
    utils/
      - *
  tests/
    - *.test.js
  .env.example
  server.js
  package.json
  prisma/
    - schema.prisma

/dashboard/
  src/
    components/
      - Chart.jsx
      - AnalysisLog.jsx
      - SignalPanel.jsx
      - *
    pages/
      - *
    store/
      - tradingStore.js
    lib/
      - api.js
  package.json
  vite.config.js

/docs/
  - *.md

Root files:
  - PHASE3_VERIFICATION.md
  - PHASE3_DEPLOYMENT_CHECKLIST.md
  - BRANCH_POLICY.md
  - README.md
  - .gitignore
```

### 🚫 DO NOT COMMIT (Different Project)
```
❌ /AP/
❌ /AutoPartsERP/
❌ /ReactUI/ (AutoPartsERP frontend)
❌ Any C# files
❌ Any .csproj files
❌ Any AutoPartsERP configuration
```

---

## Phase 3 Commits Location

All Phase 3 commits are on `ICT-Trading` branch:

```
ICT-Trading branch commits:
  0456095 Add Phase 3 deployment checklist
  b5c9c86 Add unit tests for Phase 3
  cb81dfc Add Phase 3 verification guide
  441b602 Fix signal extraction
  48bf483 Add MSS and Liquidity sections
  6c62e11 Implement Chart overlays
  7737181 Refine Claude prompt
  57f1f59 Update analysis route
  581c4ba Add Supply/Demand Zones
  ... and earlier commits
```

**Main branch** has NOT been updated with Phase 3 commits.

---

## Deployment Strategy

### Current
- `ICT-Trading` branch: All new development
- `main` branch: Legacy (no longer used for ICT Trading)

### Future
Once ICT-Trading is stable:
1. Create pull request from ICT-Trading → main
2. Review all commits
3. Merge to main
4. Render auto-deploys from main

---

## Summary of Rules

| Rule | Status |
|------|--------|
| All ICT Trading commits on ICT-Trading branch | 🔐 ENFORCED |
| Never commit ICT Trading code to main | 🔐 ENFORCED |
| Never merge main → ICT-Trading | 🔐 ENFORCED |
| AutoPartsERP code stays in separate repo | 🔐 ENFORCED |
| Phase 3 commits on ICT-Trading only | ✅ DONE |

---

## Verification

To confirm branch separation is working:

```bash
# See commits on ICT-Trading
git log ICT-Trading --oneline -10

# See commits on main
git log main --oneline -10

# Compare (should be different)
# ICT-Trading: has Phase 3 commits
# main: does NOT have Phase 3 commits
```

---

**Last Updated**: 2026-02-23
**Enforced By**: Claude Code Assistant
**Violations**: Report immediately - this is critical for project isolation
