'use client';

import { useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Barcode,
  BookOpen,
  Building2,
  IndianRupee,
  Info,
  Library,
  Plus,
  Printer,
  Save,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  createAccessionBook,
  fetchLibraryCategories,
  fetchNextAccessionNo,
} from '@/services/library';
import { fetchAcademicDepartments } from '@/services/organization';
import type { LibraryBook } from '@/types/library';
import { apiErrorMessage } from '@/utils/api-error';
import { writeLibraryBarcodeLabels } from './print-library-barcode-labels';

const BOOK_TYPES = [
  { value: 'TEXTBOOK', label: 'Textbook' },
  { value: 'REFERENCE', label: 'Reference Book' },
  { value: 'JOURNAL', label: 'Journal' },
  { value: 'MAGAZINE', label: 'Magazine' },
  { value: 'THESIS', label: 'Thesis' },
  { value: 'NEWSPAPER', label: 'Newspaper' },
  { value: 'OTHER', label: 'Other' },
];

const LANGUAGES = ['English', 'Hindi', 'Garo', 'Khasi', 'Bengali', 'Assamese', 'Nepali', 'Other'];

const CONDITIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'GOOD', label: 'Good' },
  { value: 'FAIR', label: 'Fair' },
  { value: 'DAMAGED', label: 'Damaged' },
];

const AVAILABILITY = [
  { value: 'RECEIVED', label: 'Received' },
  { value: 'CATALOGUED', label: 'Catalogued' },
  { value: 'ON_SHELF', label: 'On Shelf' },
  { value: 'ISSUED', label: 'Issued' },
  { value: 'LOST', label: 'Lost' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
];

const ACQUISITION = [
  { value: 'PURCHASE', label: 'Purchase' },
  { value: 'DONATION', label: 'Donation' },
  { value: 'GIFT', label: 'Gift' },
  { value: 'OTHER', label: 'Other' },
];

const FUNDING = ['College Fund', 'UGC', 'RUSA', 'Department Fund', 'Donation', 'Other'];

const WORKFLOW = [
  { value: 'RECEIVED', label: 'Received' },
  { value: 'CATALOGUED', label: 'Catalogued' },
  { value: 'ON_SHELF', label: 'On shelf' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
];

type FormState = {
  title: string;
  author: string;
  isbn: string;
  edition: string;
  publisher: string;
  publicationYear: string;
  language: string;
  categoryId: string;
  bookType: string;
  keywords: string;
  departmentId: string;
  departmentIds: string[];
  classificationNumber: string;
  location: string;
  subjectClassification: string;
  totalCopies: string;
  dateReceived: string;
  condition: string;
  availability: string;
  acquisitionType: string;
  supplierName: string;
  invoiceNumber: string;
  purchaseDate: string;
  price: string;
  fundingSource: string;
  remarks: string;
};

function todayIso() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function blankForm(): FormState {
  const today = todayIso();
  return {
    title: '',
    author: '',
    isbn: '',
    edition: '',
    publisher: '',
    publicationYear: '',
    language: '',
    categoryId: '',
    bookType: '',
    keywords: '',
    departmentId: '',
    departmentIds: [],
    classificationNumber: '',
    location: '',
    subjectClassification: '',
    totalCopies: '1',
    dateReceived: today,
    condition: 'NEW',
    availability: 'RECEIVED',
    acquisitionType: 'PURCHASE',
    supplierName: '',
    invoiceNumber: '',
    purchaseDate: today,
    price: '0.00',
    fundingSource: '',
    remarks: '',
  };
}

function labelsFor(book: LibraryBook, extra?: { callNumber?: string; department?: string }) {
  const author = [book.author, book.additionalAuthors].filter(Boolean).join(', ');
  const copies = book.copies ?? [];
  return copies.map((copy) => ({
    title: book.title,
    author,
    accessionNo: copy.accessionNumber || copy.barcode,
    barcode: copy.barcode,
    callNumber: extra?.callNumber || '',
    department: extra?.department || '',
  }));
}

export function LibraryAccessionEntryForm({ onOpenQueue }: { onOpenQueue: () => void }) {
  const qc = useQueryClient();
  const enabled = useAuthQueryEnabled();
  const [form, setForm] = useState<FormState>(blankForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [savedLabels, setSavedLabels] = useState<ReturnType<typeof labelsFor>>([]);
  const saving = useRef(false);

  const nextAcc = useQuery({
    queryKey: ['library', 'accession', 'next'],
    queryFn: fetchNextAccessionNo,
    enabled,
  });
  const categories = useQuery({
    queryKey: ['library', 'categories'],
    queryFn: fetchLibraryCategories,
    enabled,
  });
  const departments = useQuery({
    queryKey: ['organization', 'academic-departments'],
    queryFn: () => fetchAcademicDepartments(),
    enabled,
  });

  const copies = Math.max(0, Number(form.totalCopies) || 0);
  const price = Number(form.price);
  const totalCost = Number.isFinite(price) ? copies * price : 0;
  const gift = form.acquisitionType === 'DONATION' || form.acquisitionType === 'GIFT';
  const stage = WORKFLOW.some((step) => step.value === form.availability)
    ? form.availability
    : 'RECEIVED';

  const preview = useMemo(() => {
    const start = nextAcc.data?.accessionNo;
    if (!start || copies < 1) return start ?? '';
    const match = start.match(/^(.*-)(\d+)$/);
    if (!match || copies === 1) return start;
    const width = match[2].length;
    const end = String(Number(match[2]) + copies - 1).padStart(width, '0');
    return `${start} – ${match[1]}${end}`;
  }, [copies, nextAcc.data?.accessionNo]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!form.title.trim()) next.title = 'Book title is required.';
    if (!form.author.trim()) next.author = 'Enter at least one author.';
    if (!form.categoryId) next.categoryId = 'Choose a subject or category.';
    if (!form.bookType) next.bookType = 'Choose a book type.';
    if (!form.departmentId) next.departmentId = 'Choose a department.';
    if (!form.dateReceived) next.dateReceived = 'Date received is required.';
    if (!Number.isInteger(copies) || copies < 1 || copies > 100) {
      next.totalCopies = 'Enter between 1 and 100 copies.';
    }
    if (form.price.trim() && !Number.isFinite(price)) next.price = 'Enter a valid price.';
    if (form.publicationYear.trim() && !/^\d{4}$/.test(form.publicationYear.trim())) {
      next.publicationYear = 'Use a four-digit year.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  const save = useMutation({
    mutationFn: () =>
      createAccessionBook({
        title: form.title.trim(),
        author: form.author.trim(),
        isbn: form.isbn.trim() || undefined,
        edition: form.edition.trim() || undefined,
        publisher: form.publisher.trim() || undefined,
        publicationYear: form.publicationYear.trim() || undefined,
        language: form.language || undefined,
        categoryId: form.categoryId,
        bookType: form.bookType,
        keywords: form.keywords.trim() || undefined,
        departmentId: form.departmentId,
        departmentIds: form.departmentIds.filter((id) => id !== form.departmentId),
        classificationNumber: form.classificationNumber.trim() || undefined,
        location: form.location.trim() || undefined,
        subjectClassification: form.subjectClassification.trim() || undefined,
        totalCopies: copies,
        dateReceived: form.dateReceived,
        condition: form.condition,
        availability: form.availability,
        acquisitionType: form.acquisitionType,
        supplierName: form.supplierName.trim() || undefined,
        invoiceNumber: gift ? undefined : form.invoiceNumber.trim() || undefined,
        purchaseDate: gift ? undefined : form.purchaseDate || undefined,
        price: form.price.trim() ? price : undefined,
        fundingSource: form.fundingSource || undefined,
        remarks: form.remarks.trim() || undefined,
      }),
  });

  async function submit(mode: 'save' | 'another' | 'print') {
    setNotice('');
    if (!validate() || save.isPending || saving.current) return;
    saving.current = true;
    const popup = mode === 'print' ? window.open('', '_blank') : null;
    try {
      const book = await save.mutateAsync();
      const labels = labelsFor(book, {
        callNumber: form.classificationNumber,
        department: (departments.data ?? []).find(
          (department) => department.id === form.departmentId,
        )?.name,
      });
      const numbers = labels.map((label) => label.accessionNo).join(', ');
      setSavedLabels(labels);
      setNotice(`Saved. Accession ${labels.length === 1 ? 'number' : 'numbers'}: ${numbers}`);
      void qc.invalidateQueries({ queryKey: ['library'] });
      if (mode === 'print' && popup) writeLibraryBarcodeLabels(popup, labels);
      else popup?.close();
      if (mode === 'another') {
        setForm((current) => ({
          ...blankForm(),
          departmentId: current.departmentId,
          departmentIds: current.departmentIds,
          categoryId: current.categoryId,
          bookType: current.bookType,
          language: current.language,
          acquisitionType: current.acquisitionType,
          fundingSource: current.fundingSource,
        }));
      }
    } catch (error) {
      popup?.close();
      setNotice(apiErrorMessage(error));
    } finally {
      saving.current = false;
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Accession Workflow
          </h1>
          <p className="text-sm text-slate-500">
            Receive → Catalogue → Shelf with auto accession numbers
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2">
            <Barcode className="h-8 w-8 text-sky-700" />
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-sky-700">
                Next accession number
              </p>
              <p className="font-mono text-sm font-semibold text-slate-900">{preview || '…'}</p>
            </div>
          </div>
          <Button type="button" variant="outline" onClick={onOpenQueue}>
            Workflow queue
          </Button>
          <Button type="button" asChild>
            <Link href="/admin/library/catalogue">View catalogue</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {WORKFLOW.map((step) => (
          <span
            key={step.value}
            className={
              stage === step.value
                ? 'rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white'
                : 'rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600'
            }
          >
            {step.label}
          </span>
        ))}
      </div>

      {notice ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <span>{notice}</span>
          {savedLabels.length ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                const popup = window.open('', '_blank');
                if (popup) writeLibraryBarcodeLabels(popup, savedLabels);
              }}
            >
              <Printer className="mr-1 h-3.5 w-3.5" />
              Print barcodes
            </Button>
          ) : null}
        </div>
      ) : null}

      <Section
        icon={<BookOpen className="h-5 w-5" />}
        tint="bg-blue-600"
        title="1. Book Details"
        hint="Basic information about the book"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Book Title" required error={errors.title}>
            <Input
              value={form.title}
              placeholder="Enter book title"
              onChange={(e) => set('title', e.target.value)}
            />
          </Field>
          <Field label="Author(s)" required error={errors.author}>
            <Input
              value={form.author}
              placeholder="Enter author name(s) (use comma for multiple authors)"
              onChange={(e) => set('author', e.target.value)}
            />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Field label="ISBN (10 / 13)">
            <Input
              value={form.isbn}
              placeholder="e.g. 978-93-5896-505-5"
              onChange={(e) => set('isbn', e.target.value)}
            />
          </Field>
          <Field label="Edition">
            <Input
              value={form.edition}
              placeholder="e.g. 2nd Edition"
              onChange={(e) => set('edition', e.target.value)}
            />
          </Field>
          <Field label="Publisher">
            <Input
              value={form.publisher}
              placeholder="Enter publisher name"
              onChange={(e) => set('publisher', e.target.value)}
            />
          </Field>
          <Field label="Publication Year" error={errors.publicationYear}>
            <Input
              value={form.publicationYear}
              placeholder="e.g. 2024"
              onChange={(e) => set('publicationYear', e.target.value)}
            />
          </Field>
          <Field label="Language">
            <Select
              value={form.language}
              placeholder="Select language"
              onChange={(value) => set('language', value)}
            >
              {LANGUAGES.map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Subject / Category" required error={errors.categoryId}>
            <Select
              value={form.categoryId}
              placeholder="Select category"
              onChange={(value) => set('categoryId', value)}
            >
              {(categories.data ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Book Type" required error={errors.bookType}>
            <Select
              value={form.bookType}
              placeholder="Select book type"
              onChange={(value) => set('bookType', value)}
            >
              {BOOK_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Keywords / Tags">
            <Input
              value={form.keywords}
              placeholder="e.g. Science, Physics, NEP, FYUGP"
              onChange={(e) => set('keywords', e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section
        icon={<Building2 className="h-5 w-5" />}
        tint="bg-emerald-600"
        title="2. Department & Classification"
        hint="Department and shelving details"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Department" required error={errors.departmentId}>
            <Select
              value={form.departmentId}
              placeholder="Select department"
              onChange={(value) => set('departmentId', value)}
            >
              {(departments.data ?? []).map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Classification Number / Call Number">
            <Input
              value={form.classificationNumber}
              placeholder="e.g. 530 / PHY"
              onChange={(e) => set('classificationNumber', e.target.value)}
            />
          </Field>
          <Field label="Shelf / Rack Location">
            <Input
              value={form.location}
              placeholder="e.g. Rack A - Shelf 3"
              onChange={(e) => set('location', e.target.value)}
            />
          </Field>
          <Field label="Subject Classification">
            <Input
              value={form.subjectClassification}
              placeholder="e.g. DDC, UDC (optional)"
              onChange={(e) => set('subjectClassification', e.target.value)}
            />
          </Field>
        </div>
        {(departments.data ?? []).length > 1 ? (
          <details className="text-sm text-slate-600">
            <summary className="cursor-pointer font-medium">Also used by other departments</summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(departments.data ?? [])
                .filter((department) => department.id !== form.departmentId)
                .map((department) => (
                  <label key={department.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.departmentIds.includes(department.id)}
                      onChange={(event) =>
                        set(
                          'departmentIds',
                          event.target.checked
                            ? [...form.departmentIds, department.id]
                            : form.departmentIds.filter((id) => id !== department.id),
                        )
                      }
                    />
                    {department.name}
                  </label>
                ))}
            </div>
          </details>
        ) : null}
      </Section>

      <Section
        icon={<Library className="h-5 w-5" />}
        tint="bg-violet-600"
        title="3. Accession & Copies"
        hint="Physical copies and barcode details"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Number of Copies" required error={errors.totalCopies}>
            <Input
              type="number"
              min={1}
              max={100}
              value={form.totalCopies}
              onChange={(e) => set('totalCopies', e.target.value)}
            />
          </Field>
          <Field label="Date Received" required error={errors.dateReceived}>
            <Input
              type="date"
              value={form.dateReceived}
              onChange={(e) => set('dateReceived', e.target.value)}
            />
          </Field>
          <Field label="Book Condition">
            <Select value={form.condition} onChange={(value) => set('condition', value)}>
              {CONDITIONS.map((condition) => (
                <option key={condition.value} value={condition.value}>
                  {condition.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Availability Status">
            <Select value={form.availability} onChange={(value) => set('availability', value)}>
              {AVAILABILITY.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="flex gap-3 rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Each copy will be created with a unique accession number and barcode. If you enter
            multiple copies, the system will generate individual accession numbers for each copy.
          </p>
        </div>
      </Section>

      <Section
        icon={<IndianRupee className="h-5 w-5" />}
        tint="bg-orange-500"
        title="4. Purchase / Acquisition Details"
        hint="Financial and acquisition information"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Acquisition Type" required>
            <Select
              value={form.acquisitionType}
              onChange={(value) => set('acquisitionType', value)}
            >
              {ACQUISITION.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={gift ? 'Donor name' : 'Supplier / Vendor / Donor'}>
            <Input
              value={form.supplierName}
              placeholder={gift ? 'Enter donor name' : 'Enter supplier or donor name'}
              onChange={(e) => set('supplierName', e.target.value)}
            />
          </Field>
          <Field label="Invoice / Bill Number">
            <Input
              value={form.invoiceNumber}
              placeholder="Enter invoice number"
              disabled={gift}
              onChange={(e) => set('invoiceNumber', e.target.value)}
            />
          </Field>
          <Field label="Purchase Date">
            <Input
              type="date"
              value={form.purchaseDate}
              disabled={gift}
              onChange={(e) => set('purchaseDate', e.target.value)}
            />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Price per Copy (₹)" error={errors.price}>
            <Input
              value={form.price}
              inputMode="decimal"
              onChange={(e) => set('price', e.target.value)}
            />
          </Field>
          <Field label="Total Cost (₹)">
            <Input value={totalCost.toFixed(2)} readOnly className="bg-slate-50" />
          </Field>
          <Field label="Funding Source">
            <Select
              value={form.fundingSource}
              placeholder="Select funding source"
              onChange={(value) => set('fundingSource', value)}
            >
              {FUNDING.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Remarks">
            <Input
              value={form.remarks}
              placeholder="Enter any additional remarks (optional)"
              onChange={(e) => set('remarks', e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setForm(blankForm());
            setErrors({});
            setNotice('');
            setSavedLabels([]);
          }}
        >
          <X className="mr-1 h-4 w-4" />
          Cancel
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={save.isPending}
            onClick={() => void submit('save')}
          >
            <Save className="mr-1 h-4 w-4" />
            Save Entry
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={save.isPending}
            onClick={() => void submit('another')}
          >
            <Plus className="mr-1 h-4 w-4" />
            Save & Add Another
          </Button>
          <Button type="button" disabled={save.isPending} onClick={() => void submit('print')}>
            <Printer className="mr-1 h-4 w-4" />
            {save.isPending ? 'Saving…' : 'Save & Print Barcode'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon,
  tint,
  title,
  hint,
  children,
}: {
  icon: ReactNode;
  tint: string;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-start lg:p-5">
      <div className="flex w-full shrink-0 items-start gap-3 lg:w-56">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-lg text-white ${tint}`}
        >
          {icon}
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">{hint}</p>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium text-slate-700">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      {children}
      {error ? <span className="block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}

function Select({
  value,
  placeholder,
  onChange,
  children,
}: {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {children}
    </select>
  );
}
