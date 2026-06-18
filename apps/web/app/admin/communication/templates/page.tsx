import { TemplatesManager } from '@/components/communication/templates/templates-manager';

export default function TemplatesPage() {
  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Message Templates</h1>
      <TemplatesManager />
    </div>
  );
}
