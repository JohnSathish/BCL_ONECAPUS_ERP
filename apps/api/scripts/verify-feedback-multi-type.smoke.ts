/**
 * Smoke checklist for multi-type feedback (run manually against local/API).
 *
 * 1. Apply migration: npm run db:migrate -w api
 * 2. Restart API
 * 3. Admin → IQAC → Student Feedback:
 *    - Create campaign (seeds LIKERT_5 defaults)
 *    - Add questions: short_text, multi_choice, yes_no, rating, long_text
 *    - Set show-if on long_text when yes_no = no
 *    - Save questions, Enable form
 * 4. Student portal → Feedback: submit mixed answers
 * 5. Admin analytics: objective distributions + text samples
 * 6. Export Excel + PDF
 * 7. Mobile student Feedback screen renders same types
 *
 * API endpoints:
 *   GET  /v1/feedback/me/campaigns
 *   POST /v1/feedback/me/campaigns/:id/submit
 *   POST /v1/feedback/campaigns/:id/questions
 *   GET  /v1/feedback/campaigns/:id/analytics
 *   GET  /v1/feedback/campaigns/:id/export.xlsx
 *   GET  /v1/feedback/campaigns/:id/export.pdf
 */
export {};
