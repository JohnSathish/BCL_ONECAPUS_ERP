/**
 * IA examination feature flags.
 */
/** Admin admit card generation & bulk print */
export const IA_ADMIT_CARDS_ADMIN_ENABLED = true;

/** Student self-service admit card download (Phase 2) */
export const IA_ADMIT_CARDS_STUDENT_ENABLED = false;

/** @deprecated use IA_ADMIT_CARDS_ADMIN_ENABLED */
export const IA_ADMIT_CARDS_ENABLED = IA_ADMIT_CARDS_ADMIN_ENABLED;

export const IA_ADMIT_CARDS_STUDENT_PHASE2_MESSAGE =
  'Student self-service IA admit cards will be available in a future release. Contact the examination cell for your hall ticket.';
