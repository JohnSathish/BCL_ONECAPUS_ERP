import { Injectable } from '@nestjs/common';
import puppeteer from 'puppeteer';
import { resolvePdfImageSrc } from '../../../common/uploads/pdf-asset.util';
import {
  renderIaAdmitCardHtml,
  renderIaAdmitCardsDocumentHtml,
  type IaAdmitCardTemplateInput,
} from './templates/ia-admit-card.template';

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

@Injectable()
export class IaAdmitPdfService {
  async htmlToPdf(html: string, layout: 'single' | 'pair' = 'single') {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin:
          layout === 'pair'
            ? { top: '0', right: '0', bottom: '0', left: '0' }
            : { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  renderDocumentHtml(
    cards: IaAdmitCardTemplateInput[],
    layout: 'single' | 'pair' = 'single',
  ) {
    const prepared = cards.map((c) => embedAdmitCardImages(c));
    return renderIaAdmitCardsDocumentHtml(prepared, layout);
  }

  async renderCardPdf(card: IaAdmitCardTemplateInput) {
    const html = renderIaAdmitCardHtml(embedAdmitCardImages(card));
    return this.htmlToPdf(html, 'single');
  }

  async renderBatchPdf(cards: IaAdmitCardTemplateInput[]) {
    return this.htmlToPdf(this.renderDocumentHtml(cards, 'pair'), 'pair');
  }
}
