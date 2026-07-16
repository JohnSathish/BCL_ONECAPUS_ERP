#!/usr/bin/env bash
# Sem 7/8 curriculum readiness checklist (ops — run after deploy / before first intake)
#
# Prerequisites:
#   - ERP updated (vps-update-erp-safe.sh)
#   - Migrations applied (includes eligibility_override_reason, previous_college_name)
#
# 1) Seed / verify Sem 7 offerings per programme + shift
#    Expected pattern: 3 MAJOR + 2 MINOR (20 credits)
#    Admin → Programs → curriculum coverage for semesterSequence=7
#
# 2) Seed / verify Sem 8 pathway offerings
#    HONOURS: 5 MAJOR advanced papers
#    HONOURS_WITH_RESEARCH: 1 DISSERTATION (12 cr) + 2 MAJOR
#    Confirm pools resolve via FYUGP template pathway variants
#
# 3) Sem 7 intake channels
#    - One-by-one: Add Student → Current semester 7 → attested aggregate % + Major/Minor
#    - Bulk: Students import → Sem 7 Template (LATERAL columns + Aggregate % Through Sem 6)
#
# 4) Sem 8 registration gate
#    - Enter attested aggregate on standing (admit/import or profile Academic tab)
#    - Select Honours pathway on Sem 8 registration UI before auto-assign / submit
#    - Research blocked unless aggregate >= 75 or principal override with reason
#    - Sem 7+: marksheet document required; LATERAL/MIGRATION also need MIGRATION or TC
#
# 5) Smoke
#    - Admit one Sem 7 lateral with aggregate 70 + docs → register Sem 7
#    - Promote/register Sem 8 → Research rejected; Honours allowed
#    - Same with aggregate 80 → Research allowed
#    - Override path: Research with reason when aggregate < 75
#
set -euo pipefail
echo "Sem 7/8 readiness notes — see comments in scripts/deploy/vps-sem7-sem8-readiness.sh"
echo "No automated seed in this script; verify curriculum coverage in Admin UI."
