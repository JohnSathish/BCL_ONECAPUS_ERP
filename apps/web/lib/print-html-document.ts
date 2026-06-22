/** Print a standalone HTML document in an isolated iframe (avoids admin shell / modal clipping). */
export function printHtmlDocument(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'Print');
    iframe.style.cssText =
      'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(iframe);

    const win = iframe.contentWindow;
    const doc = iframe.contentDocument ?? win?.document;
    if (!win || !doc) {
      document.body.removeChild(iframe);
      reject(new Error('Unable to open print frame'));
      return;
    }

    const cleanup = () => {
      window.setTimeout(() => {
        if (iframe.parentNode) document.body.removeChild(iframe);
      }, 500);
      resolve();
    };

    const onAfterPrint = () => {
      win.removeEventListener('afterprint', onAfterPrint);
      cleanup();
    };
    win.addEventListener('afterprint', onAfterPrint);

    doc.open();
    doc.write(html);
    doc.close();

    const trigger = () => {
      win.focus();
      win.print();
      window.setTimeout(cleanup, 60_000);
    };

    iframe.onload = () => {
      window.setTimeout(trigger, 300);
    };
    window.setTimeout(trigger, 800);
  });
}
