#!/usr/bin/env bash
# Digitized semester subject renewal — ops checklist (run after deploy)
#
# Goal: After promotion, students finish AEC/MDC/SEC/VTC–VAC on portal/mobile
# instead of paper renewal forms. Major/Minor stay locked.
#
# Prerequisites:
#   - ERP updated; migration leave_electives_for_student_renewal applied
#   - Curriculum offerings exist for the target semester
#
set -euo pipefail

echo "=== Semester subject renewal readiness ==="
echo ""
echo "1) Workflow mode (required for student self-service)"
echo "   Admin → Subject Registration → workflow settings"
echo "   Set institution/batch mode to STUDENT_SELF or HYBRID (not ADMIN_ONLY)."
echo "   Student elective categories should include: MDC, SEC, AEC, VAC, VTC."
echo ""
echo "2) Open registration window for the target semester"
echo "   Admin → Registration windows → OPEN for the promote-to semester"
echo "   Set closesAt to the paper-form deadline (communicate this date)."
echo ""
echo "3) Run promotion with renewal drafts"
echo "   Academic lifecycle → Semester promotion wizard"
echo "   Keep \"Leave electives for student renewal\" ON (default for Sem 2–7)."
echo "   Apply → standing advances; draft regs created with Major/Minor filled."
echo "   Turn OFF only for edge batches that must complete immediately."
echo ""
echo "4) Announce to students"
echo "   Portal/mobile: Subject renewal (or /student/registration?renewal=1)"
echo "   Remind: locked Major/Minor; choose electives before window closes."
echo "   Fee clearance + profile soft-gate may block submit — tell students to clear dues/profile first."
echo ""
echo "5) Monitor incomplete renewals"
echo "   Admin → Students → Subject Registration"
echo "   Status filter: \"Renewal incomplete\" (= draft with unfilled elective slots)."
echo "   Button: \"Remind incomplete renewals\" (email/in-app/push; once per day per student)."
echo "   Button: \"Prepare semester renewals\" for cohorts already on the target semester."
echo "   Office completes leftovers via admin assign before window lock."
echo ""
echo "Smoke:"
echo "  - Promote one student Sem N→N+1 with toggle ON → draft exists, electives empty"
echo "  - Student portal: confirm locked subjects → pick electives → submit → completed"
echo "  - Student cannot change Major/Minor via renewal APIs"
echo "  - Admin filter lists incomplete drafts; completing via admin clears them"
echo ""
echo "Done — see comments in scripts/deploy/vps-semester-subject-renewal.sh"
