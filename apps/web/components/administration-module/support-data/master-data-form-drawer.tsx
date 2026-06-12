'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CategoryFieldRenderer } from './category-field-renderer';
import type { SupportDataFieldDef, SupportDataRow } from '@/types/support-data';

type Props = {
  open: boolean;
  mode: 'create' | 'edit';
  categoryLabel: string;
  fields: SupportDataFieldDef[];
  form: Record<string, unknown>;
  setForm: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  saving?: boolean;
  onClose: () => void;
  onSave: () => void;
  editingRow?: SupportDataRow | null;
};

export function MasterDataFormDrawer({
  open,
  mode,
  categoryLabel,
  fields,
  form,
  setForm,
  saving,
  onClose,
  onSave,
  editingRow,
}: Props) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l bg-background shadow-xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <p className="text-xs uppercase text-muted-foreground">{categoryLabel}</p>
                <h2 className="text-lg font-semibold">
                  {mode === 'create' ? 'Add entry' : 'Edit entry'}
                </h2>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <CategoryFieldRenderer
                fields={fields}
                form={form}
                setForm={setForm}
                isEdit={mode === 'edit'}
              />
              {editingRow ? (
                <p className="mt-4 text-xs text-muted-foreground">
                  Code <span className="font-mono">{editingRow.code}</span> cannot be changed.
                </p>
              ) : null}
            </div>
            <div className="flex gap-2 border-t p-4">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
              <Button type="button" className="flex-1" disabled={saving} onClick={onSave}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
