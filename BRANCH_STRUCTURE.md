# ICT Trading - Branch Structure & Separation

**Status**: ✅ COMPLETE
**Date**: 2026-02-23
**Purpose**: Enforce strict project isolation

---

## 🎯 Current Branch Structure

### Active Branches

#### `ICT-Trading` (PRIMARY BRANCH) 🟢
- **Status**: ✅ Active Development
- **Purpose**: All ICT Trading work
- **Contains**: Phase 3 implementation + Branch policy
- **Commits**: 10 total (from initial repo setup through Phase 3)
- **Latest**: a91857b - Add strict branch policy for ICT Trading isolation
- **Remote**: https://github.com/umerdaim-lang/ICT-Trading/tree/ICT-Trading

```
Latest commits on ICT-Trading:
a91857b Add strict branch policy for ICT Trading isolation
0456095 Add Phase 3 deployment checklist with testing procedures
b5c9c86 Add unit tests for Phase 3 ICT service functions
cb81dfc Add Phase 3 comprehensive verification and testing guide
441b602 Fix signal extraction from API response
48bf483 Add MSS and Liquidity Levels analysis sections, filter signals by symbol
6c62e11 Implement ICT chart overlays with Order Blocks, FVGs, and Swing markers
7737181 Refine Claude prompt with session context and structured JSON output
57f1f59 Update analysis route to save and return Supply/Demand Zones and Breaker Blocks
581c4ba Add Supply/Demand Zones and Breaker Blocks detection to ICT analysis
```

#### `main` (LEGACY) 🟡
- **Status**: ⚠️ Legacy - DO NOT USE for new work
- **Purpose**: Backward compatibility only
- **Contains**: Pre-Phase 3 code + some Phase 3 commits
- **Action**: Will be cleaned up in final step
- **Remote**: https://github.com/umerdaim-lang/ICT-Trading

---

## 🔐 What's on Each Branch

### ICT-Trading Branch
✅ **All Phase 3 Code** (production-ready)
- ✅ Backend: ict.service.js, analysis.js, claude.service.js
- ✅ Frontend: Chart.jsx, AnalysisLog.jsx, SignalPanel.jsx
- ✅ Tests: backend/tests/ict.service.test.js
- ✅ Documentation:
  - PHASE3_VERIFICATION.md
  - PHASE3_DEPLOYMENT_CHECKLIST.md
  - BRANCH_POLICY.md (strict enforcement)
  - BRANCH_STRUCTURE.md (this file)

### main Branch
⚠️ **LEGACY - Being phased out**
- Some Phase 3 commits (will be cleaned)
- Pre-Phase 3 code
- Old configurations

---

## 🚀 How to Work with ICT-Trading

### Rule 1: Always Use ICT-Trading Branch
```bash
# Switch to ICT-Trading
git checkout ICT-Trading

# Verify you're on correct branch
git branch
# Expected output:
#   * ICT-Trading
#     main
```

### Rule 2: All Commits Go to ICT-Trading Only
```bash
# Make changes
# ...
git add <specific_files>
git commit -m "your message"
git push origin ICT-Trading

# NEVER push to main
# NEVER merge from main → ICT-Trading
```

### Rule 3: Verify Before Committing
```bash
# Check current branch
git branch  # Must show * ICT-Trading

# Check files to commit
git status  # Must show only ICT Trading files

# Check remote
git branch -a  # Must show origin/ICT-Trading
```

---

## 📊 Branch Separation Verification

### View Commits on Each Branch
```bash
# ICT-Trading branch
git log ICT-Trading --oneline | head

# main branch
git log main --oneline | head
```

### Expected Difference
- ICT-Trading: Has Phase 3 commits
- main: May have some Phase 3 (will be cleaned)

---

## 🛠️ Deployment Strategy

### Current (Phase 3)
1. **Development**: Work on `ICT-Trading` branch
2. **Testing**: Test on local/staging
3. **Deployment**: Manual push to Render from ICT-Trading

### Future (After Cleanup)
1. Create PR from ICT-Trading → main
2. Review all changes
3. Merge to main
4. Render auto-deploys from main

---

## ⚠️ Critical Rules (MUST FOLLOW)

| Rule | Consequence of Violation |
|------|--------------------------|
| **All work on ICT-Trading** | Code lost if committed to main |
| **Never merge main → ICT-Trading** | Mixing old/new code |
| **Never commit AutoPartsERP files** | Project contamination |
| **Always verify branch before committing** | Accidental commits |

---

## 🧹 Cleanup Plan (Future)

### When to Clean up main
Once ICT-Trading is stable and tested:

1. **Review all ICT-Trading commits** ✓
2. **Test on Render** (from ICT-Trading branch)
3. **Create PR**: ICT-Trading → main
4. **Merge to main**
5. **Reset origin/main** to clean state
6. **Update Render** to deploy from main

### How to Clean up main
```bash
# Step 1: Create PR (on GitHub)
# ICT-Trading → main

# Step 2: Merge PR
# Verify all changes

# Step 3: main now has all Phase 3 work
# (no longer legacy)

# Step 4: Done! ✅
```

---

## 📋 Checklist for New Developers

Before working on ICT Trading:

- [ ] Read this file (BRANCH_STRUCTURE.md)
- [ ] Read BRANCH_POLICY.md
- [ ] Checkout ICT-Trading branch
- [ ] Verify with `git branch`
- [ ] Create feature branch if needed (optional)
- [ ] Make changes
- [ ] Test locally
- [ ] Commit to ICT-Trading branch
- [ ] Push to ICT-Trading branch
- [ ] Never touch main

---

## 📞 Questions?

### Which branch should I use?
→ **Always ICT-Trading**

### What if I committed to main by mistake?
→ See BRANCH_POLICY.md → Emergency Procedures

### When will main be cleaned up?
→ After Phase 3 testing is complete (TBD)

### Can I work on multiple features?
→ Yes, use feature branches off ICT-Trading:
```bash
git checkout ICT-Trading
git checkout -b feature/my-feature
# ... work ...
git checkout ICT-Trading
git merge feature/my-feature
git push origin ICT-Trading
```

---

## Summary

| Item | Status |
|------|--------|
| ICT-Trading branch created | ✅ Done |
| Phase 3 commits on ICT-Trading | ✅ Done |
| Branch policy documented | ✅ Done |
| Branch separation enforced | ✅ Done |
| Ready for Phase 4 | ✅ Ready |

---

**Last Updated**: 2026-02-23
**Enforced By**: Claude Code Assistant
**This is a CRITICAL separation rule - violations will not be tolerated**
