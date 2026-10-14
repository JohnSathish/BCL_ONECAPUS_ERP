/**
 * Lets Android 11+ resolve a PDF viewer when the student opens a question paper.
 * Without this query, ACTION_VIEW for application/pdf is hidden from the app.
 */
const { withAndroidManifest } = require('@expo/config-plugins');

function withAndroidPdfView(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const queries = Array.isArray(manifest.queries)
      ? manifest.queries
      : manifest.queries
        ? [manifest.queries]
        : [{}];
    const block = queries[0] ?? {};
    const intents = Array.isArray(block.intent) ? block.intent : block.intent ? [block.intent] : [];
    const hasPdf = intents.some((intent) =>
      (intent.data ?? []).some((data) => data.$?.['android:mimeType'] === 'application/pdf'),
    );
    if (!hasPdf) {
      intents.push({
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        data: [{ $: { 'android:mimeType': 'application/pdf' } }],
      });
    }
    block.intent = intents;
    queries[0] = block;
    manifest.queries = queries;
    return cfg;
  });
}

module.exports = withAndroidPdfView;
