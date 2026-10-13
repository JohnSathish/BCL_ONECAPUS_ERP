import { Injectable } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import puppeteer, { type Browser } from 'puppeteer';
import QRCode from 'qrcode';
import { resolvePdfImageSrc } from '../../../common/uploads/pdf-asset.util';
import {
  renderIaAdmitCardHtml,
  renderIaAdmitCardsDocumentHtml,
  type IaAdmitCardTemplateInput,
} from './templates/ia-admit-card.template';

/** Pair layout is two cards per page. Keep each Puppeteer document small. */
const BATCH_CHUNK_CARDS = 40;

function embedAdmitCardImages(
  card: IaAdmitCardTemplateInput,
): IaAdmitCardTemplateInput {
  return {
    ...card,
    institution: {
      ...card.institution,
      logoUrl: resolvePdfImageSrc(card.institution.logoUrl),
    },
    student: {
      ...card.student,
      photoUrl: resolvePdfImageSrc(card.student.photoUrl),
    },
    qrDataUrl: resolvePdfImageSrc(card.qrDataUrl),
  };
}

async function withLocalQr(
  card: IaAdmitCardTemplateInput,
): Promise<IaAdmitCardTemplateInput> {
  const embedded = embedAdmitCardImages(card);
  if (embedded.qrDataUrl || !embedded.verifyUrl) return embedded;
  try {
    const qrDataUrl = await QRCode.toDataURL(embedded.verifyUrl, {
      margin: 1,
      width: 180,
      errorCorrectionLevel: 'M',
    });
    return { ...embedded, qrDataUrl };
  } catch {
    return embedded;
  }
}

async function mergePdfBuffers(parts: Buffer[]) {
  if (parts.length === 1) return parts[0];
  const merged = await PDFDocument.create();
  for (const part of parts) {
    const doc = await PDFDocument.load(part);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    for (const page of pages) merged.addPage(page);
  }
  return Buffer.from(await merged.save());
}

@Injectable()
export class IaAdmitPdfService {
  private launchBrowser() {
    return puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
  }

  private async renderHtml(browser: Browser, html: string) {
    const page = await browser.newPage();
    try {
      await page.setContent(html, {
        waitUntil: 'load',
        timeout: 120_000,
      });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
        timeout: 120_000,
      });
      return Buffer.from(pdf);
    } finally {
      await page.close();
    }
  }

  async htmlToPdf(html: string, _layout: 'single' | 'pair' = 'single') {
    const browser = await this.launchBrowser();
    try {
      return await this.renderHtml(browser, html);
    } finally {
      await browser.close();
    }
  }

  private async prepareCards(cards: IaAdmitCardTemplateInput[]) {
    const prepared: IaAdmitCardTemplateInput[] = [];
    for (let i = 0; i < cards.length; i += 50) {
      prepared.push(
        ...(await Promise.all(
          cards.slice(i, i + 50).map((card) => withLocalQr(card)),
        )),
      );
    }
    return prepared;
  }

  async renderDocumentHtml(
    cards: IaAdmitCardTemplateInput[],
    layout: 'single' | 'pair' = 'single',
  ) {
    const prepared = await this.prepareCards(cards);
    return renderIaAdmitCardsDocumentHtml(prepared, layout);
  }

  async renderCardPdf(card: IaAdmitCardTemplateInput) {
    const [prepared] = await this.prepareCards([card]);
    const html = renderIaAdmitCardHtml(prepared);
    return this.htmlToPdf(html, 'single');
  }

  async renderBatchPdf(cards: IaAdmitCardTemplateInput[]) {
    const prepared = await this.prepareCards(cards);
    const browser = await this.launchBrowser();
    try {
      const parts: Buffer[] = [];
      for (let i = 0; i < prepared.length; i += BATCH_CHUNK_CARDS) {
        const html = renderIaAdmitCardsDocumentHtml(
          prepared.slice(i, i + BATCH_CHUNK_CARDS),
          'pair',
        );
        parts.push(await this.renderHtml(browser, html));
      }
      return mergePdfBuffers(parts);
    } finally {
      await browser.close();
    }
  }

  /** One PDF per card, reusing a single browser. Writes each file before the next render. */
  async writeSinglePdfs(
    cards: IaAdmitCardTemplateInput[],
    write: (index: number, pdf: Buffer) => Promise<void> | void,
  ) {
    const prepared = await this.prepareCards(cards);
    const browser = await this.launchBrowser();
    try {
      for (let i = 0; i < prepared.length; i += 1) {
        const html = renderIaAdmitCardHtml(prepared[i]);
        await write(i, await this.renderHtml(browser, html));
      }
    } finally {
      await browser.close();
    }
  }
}
