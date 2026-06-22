import { redirect } from 'next/navigation';

/** Public alias route — /finance/fee-collection */
export default function FinanceFeeCollectionAliasPage() {
  redirect('/admin/fees/fee-collection');
}
