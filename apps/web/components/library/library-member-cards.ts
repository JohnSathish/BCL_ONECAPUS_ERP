import { renderBarcodePrintHtml } from '@/components/id-cards/build-barcode-svg';

export type MemberCardInput = {
  fullName: string;
  code: string;
  department?: string | null;
  memberType: string;
  photoUrl?: string | null;
  expiresAt?: string | null;
};

function esc(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function printLibraryMemberCards(input: {
  collegeName: string;
  logoUrl?: string | null;
  cards: MemberCardInput[];
}) {
  const cards = input.cards.filter((card) => card.code.trim());
  if (!cards.length || typeof window === 'undefined') return;
  const logo = input.logoUrl
    ? `<img src="${esc(input.logoUrl)}" alt="" style="height:28px;width:28px;object-fit:contain;" />`
    : '';
  const body = cards
    .map((card) => {
      const photo = card.photoUrl
        ? `<img src="${esc(card.photoUrl)}" alt="" style="width:54px;height:64px;object-fit:cover;border-radius:6px;" />`
        : `<div style="width:54px;height:64px;border-radius:6px;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-weight:700;color:#334155;">${esc(card.fullName.slice(0, 1))}</div>`;
      const valid = card.expiresAt
        ? new Date(card.expiresAt).toLocaleDateString()
        : 'No expiry on record';
      return `<article class="card">
        <div class="top">${logo}<div><strong>${esc(input.collegeName)}</strong><span>Library card</span></div></div>
        <div class="mid">${photo}<div><b>${esc(card.fullName)}</b><p>${esc(card.code)}</p><p>${esc(card.department || 'Department not recorded')}</p><p>${esc(card.memberType.replaceAll('_', ' '))}</p></div></div>
        <div class="code">${renderBarcodePrintHtml(card.code)}</div>
        <p class="valid">Valid ${esc(valid)}</p>
      </article>`;
    })
    .join('');
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
  if (!popup) return;
  popup.document.write(`<!DOCTYPE html><html><head><title>Library cards</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 16px; color: #0f172a; }
      .sheet { display: flex; flex-wrap: wrap; gap: 12px; }
      .card { width: 86mm; height: 54mm; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; box-sizing: border-box; display: flex; flex-direction: column; }
      .top, .mid { display: flex; gap: 8px; align-items: center; }
      .top span, .mid p, .valid { margin: 0; font-size: 10px; color: #475569; }
      .top strong, .mid b { font-size: 12px; }
      .mid { margin-top: 6px; }
      .code { height: 34px; margin-top: auto; }
      .valid { margin-top: 2px; }
      @media print { body { margin: 8mm; } }
    </style></head><body>
    <p>${esc(input.collegeName)} · Library membership cards · ${cards.length}</p>
    <div class="sheet">${body}</div>
    <script>window.onload = () => { window.print(); }<\/script>
    </body></html>`);
  popup.document.close();
}
