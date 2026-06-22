import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import puppeteer from 'puppeteer';
import { loadPrismaClientCtor } from '../lib/prisma-client';
import {
  buildFeeReceiptHtml,
  buildFeeReceiptStorageKey,
  FEE_RECEIPT_TEMPLATE_VERSION,
  receiptPdfOptions,
  resolveFeeCycleLabel,
  resolveFeeReceiptBranding,
  resolveReceiptLines,
  resolveReceiptTemplateFormat,
} from '../lib/fee-receipt.template';

function storageRoot() {
  return process.env.STORAGE_ROOT ?? join(process.cwd(), 'storage');
}

async function storagePut(key: string, data: Buffer) {
  const filePath = join(storageRoot(), key.replace(/^\/+/, ''));
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, data);
  return filePath;
}

async function storageGet(key: string): Promise<Buffer | null> {
  try {
    return await readFile(join(storageRoot(), key.replace(/^\/+/, '')));
  } catch {
    return null;
  }
}

let prisma: Record<string, unknown> | null = null;

function db() {
  if (!prisma) prisma = new (loadPrismaClientCtor())();
  return prisma as {
    feeReceipt: {
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      update: (args: unknown) => Promise<unknown>;
    };
    student: { findFirst: (args: unknown) => Promise<Record<string, unknown> | null> };
    user: { findFirst: (args: unknown) => Promise<Record<string, unknown> | null> };
    tenant: { findUnique: (args: unknown) => Promise<Record<string, unknown> | null> };
    tenantBranding: { findUnique: (args: unknown) => Promise<Record<string, unknown> | null> };
    feeFinanceSettings: { findUnique: (args: unknown) => Promise<Record<string, unknown> | null> };
    $disconnect: () => Promise<void>;
  };
}

export async function generateFeeReceiptPdf(tenantId: string, receiptId: string) {
  const settings = await db().feeFinanceSettings.findUnique({ where: { tenantId } });
  const format = resolveReceiptTemplateFormat(settings?.metadata as Record<string, unknown> | null);

  const receipt = await db().feeReceipt.findFirst({
    where: { id: receiptId, tenantId },
    include: {
      payment: {
        include: {
          allocations: {
            include: {
              demand: { include: { lines: true } },
            },
          },
        },
      },
      demand: { include: { lines: true } },
    },
  });
  if (!receipt) throw new Error(`Receipt not found: ${receiptId}`);

  const receiptNo = String(receipt.receiptNo);
  const storageKey = buildFeeReceiptStorageKey(tenantId, receiptNo, format);

  if (
    receipt.pdfPath &&
    String(receipt.pdfPath).includes(FEE_RECEIPT_TEMPLATE_VERSION) &&
    String(receipt.pdfPath).includes(format)
  ) {
    try {
      await readFile(String(receipt.pdfPath));
      return { receiptId, cached: true };
    } catch {
      const cached = await storageGet(storageKey);
      if (cached) return { receiptId, cached: true };
    }
  } else {
    const cached = await storageGet(storageKey);
    if (cached) return { receiptId, cached: true };
  }

  const student = await db().student.findFirst({
    where: { id: receipt.studentId, tenantId },
    include: {
      user: { select: { displayName: true } },
      masterProfile: true,
      programVersion: { include: { program: true } },
      academicStanding: true,
    },
  });

  const collector = receipt.issuedById
    ? await db().user.findFirst({
        where: { id: receipt.issuedById },
        select: { displayName: true, email: true },
      })
    : null;

  const branding = await resolveFeeReceiptBranding(
    db() as Parameters<typeof resolveFeeReceiptBranding>[0],
    tenantId,
  );
  const verifyUrl = `${process.env.WEB_ORIGIN ?? 'http://demo.localhost:3000'}/verify/receipt/${receiptNo}`;
  const masterProfile = student?.masterProfile as
    | { fullName?: string; applicationNumber?: string }
    | undefined;
  const user = student?.user as { displayName?: string } | undefined;
  const programVersion = student?.programVersion as { program?: { name?: string } } | undefined;
  const standing = student?.academicStanding as { currentSemesterSequence?: number } | undefined;
  const payment = receipt.payment as
    | {
        paymentMode?: string;
        paymentSource?: string;
        status?: string;
        paidAt?: string;
        providerPaymentId?: string;
        externalReference?: string;
        transactionNo?: string;
        metadata?: Record<string, unknown>;
      }
    | undefined;

  const paymentMeta = payment?.metadata ?? {};
  const transactionRef =
    payment?.providerPaymentId ??
    (paymentMeta.transactionReference as string) ??
    payment?.externalReference ??
    payment?.transactionNo ??
    receiptNo;
  const utrNumber = (paymentMeta.utrNumber as string) ?? null;
  const paymentModeLabel =
    (paymentMeta.collectionMethodLabel as string) ??
    payment?.paymentSource ??
    payment?.paymentMode ??
    'ONLINE';
  const paymentStatus =
    payment?.status === 'SUCCESS' || payment?.status === 'PAID'
      ? 'SUCCESS'
      : String(payment?.status ?? 'SUCCESS');

  const html = buildFeeReceiptHtml(
    {
      branding,
      receiptNo,
      date: new Date(String(receipt.issuedAt)),
      paidAt: payment?.paidAt ? new Date(payment.paidAt) : new Date(String(receipt.issuedAt)),
      studentName: masterProfile?.fullName ?? user?.displayName ?? 'Student',
      enrollmentNumber: String(student?.enrollmentNumber ?? '—'),
      applicationNo: masterProfile?.applicationNumber ?? '—',
      programme: programVersion?.program?.name ?? '—',
      semester: standing?.currentSemesterSequence
        ? `Semester ${standing.currentSemesterSequence}`
        : '—',
      feeCycle: String(resolveFeeCycleLabel(receipt)),
      lines: resolveReceiptLines(receipt),
      amount: Number(receipt.amount),
      paymentMode: String(paymentModeLabel),
      paymentStatus,
      transactionRef: String(transactionRef),
      utrNumber,
      collectedBy: String(collector?.displayName ?? collector?.email ?? 'Finance Office'),
      verifyUrl,
    },
    format,
  );

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  });
  let buffer: Buffer;
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    buffer = Buffer.from(await page.pdf(receiptPdfOptions(format)));
  } finally {
    await browser.close();
  }

  const filePath = await storagePut(storageKey, buffer);
  await db().feeReceipt.update({
    where: { id: receiptId },
    data: { pdfPath: filePath, qrPayload: verifyUrl },
  });

  return { receiptId, ok: true };
}

export async function disconnectPrisma() {
  await db().$disconnect();
  prisma = null;
}
