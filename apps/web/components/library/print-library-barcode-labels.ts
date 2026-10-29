import {
  defaultBarcodeLabelSettings,
  writeBarcodeSheet,
  type LibraryBarcodeLabelPayload,
} from './library-barcode-print';

export type LibraryBarcodeLabel = {
  title: string;
  author: string;
  accessionNo: string;
  barcode: string;
  callNumber?: string;
  department?: string;
};

export function writeLibraryBarcodeLabels(target: Window, labels: LibraryBarcodeLabel[]) {
  const printable: LibraryBarcodeLabelPayload[] = labels
    .filter(
      (label) => label.accessionNo.trim() && label.accessionNo.trim() === label.barcode.trim(),
    )
    .map((label) => ({
      copyId: label.accessionNo,
      accessionNumber: label.accessionNo.trim(),
      encodedValue: label.accessionNo.trim(),
      title: label.title,
      author: label.author,
      callNumber: label.callNumber ?? '',
      department: label.department ?? '',
    }));
  writeBarcodeSheet(target, printable, defaultBarcodeLabelSettings(), { autoPrint: true });
}
