function waitForImages(doc: Document) {
  const images = Array.from(doc.images);
  if (!images.length) return Promise.resolve();
  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
        }),
    ),
  );
}

/** Print a standalone HTML document in an isolated iframe (avoids admin shell / modal clipping). */
export function printHtmlDocument(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'IA Admit Card Print');
    iframe.setAttribute(
      'style',
      [
        'position:fixed',
        'left:-10000px',
        'top:0',
        'width:210mm',
        'height:297mm',
        'border:0',
        'opacity:0',
        'pointer-events:none',
      ].join(';'),
    );

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(blobUrl);
      window.setTimeout(() => {
        iframe.remove();
      }, 1000);
      resolve();
    };

    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(blobUrl);
      iframe.remove();
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    iframe.onerror = () => fail(new Error('Failed to load print document'));

    iframe.onload = () => {
      const win = iframe.contentWindow;
      const doc = iframe.contentDocument ?? win?.document;
      if (!win || !doc) {
        fail(new Error('Unable to open print frame'));
        return;
      }

      const onAfterPrint = () => {
        win.removeEventListener('afterprint', onAfterPrint);
        finish();
      };
      win.addEventListener('afterprint', onAfterPrint);

      void waitForImages(doc).then(() => {
        window.setTimeout(() => {
          try {
            win.focus();
            win.print();
          } catch (error) {
            fail(error);
            return;
          }
          window.setTimeout(finish, 120_000);
        }, 150);
      });
    };

    document.body.appendChild(iframe);
    iframe.src = blobUrl;
  });
}
