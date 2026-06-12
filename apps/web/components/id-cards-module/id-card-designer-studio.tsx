'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  Grid3X3,
  GripVertical,
  Image,
  Lock,
  Magnet,
  Maximize2,
  Printer,
  Redo2,
  RotateCcw,
  Save,
  Search,
  Undo2,
  Unlock,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Cr80CardBack, Cr80CardFront } from '@/components/id-cards/cr80-card-renderer';
import {
  cardCanvasSizePx,
  DEFAULT_EVOLIS_FEED,
  DEFAULT_PRINT_CALIBRATION,
  TEMPLATE_CATEGORIES,
  ZOOM_PRESETS,
  type DesignerViewMode,
  type EvolisFeedOptions,
  type PrintCalibration,
} from '@/components/id-cards/cr80-designer-constants';
import { CR80_HEIGHT_MM, CR80_WIDTH_MM } from '@/components/id-cards/cr80-constants';
import {
  DESIGNER_RULER_SIZE,
  DesignerRulerHorizontal,
  DesignerRulerVertical,
} from '@/components/id-cards/designer-rulers';
import { defaultLayoutForHolderType } from '@/components/id-cards/default-layouts';
import {
  alignElementToCard,
  nudgeElement,
  PREVIEW_DATA_OPTIONS,
  reorderLayerElements,
  STYLE_PRESET_OPTIONS,
  type CardAlignment,
  type PreviewDataId,
} from '@/components/id-cards/designer-utils';
import { paletteKeysForHolderType } from '@/components/id-cards/id-card-field-registry';
import { normalizeIdCardLayout } from '@/components/id-cards/layout-legacy-migrate';
import { openCr80PrintPreview } from '@/components/id-cards/print-cr80-id-card';
import { previewModelForDesigner } from '@/components/id-cards/sample-id-card-models';
import { useDesignerHistory } from '@/components/id-cards/use-designer-history';
import { useInstitutionBranding } from '@/hooks/use-institution-branding';
import {
  duplicateIdCardTemplate,
  fetchIdCardSettings,
  fetchIdCardTemplates,
  setDefaultIdCardTemplate,
  updateIdCardTemplate,
} from '@/services/id-cards';
import { resolveInstitutionSignatureUrl } from '@/components/id-cards/resolve-institution-signature-url';
import { IdCardBackgroundUploader } from '@/components/id-cards/id-card-background-uploader';
import {
  BACKGROUND_FIT_OPTIONS,
  BACKGROUND_SELECTION_BACK,
  BACKGROUND_SELECTION_FRONT,
  backgroundForSide,
  defaultBackgroundLayer,
  isBackgroundSelection,
} from '@/components/id-cards/id-card-background-utils';
import type {
  IdCardBackgroundLayer,
  IdCardElement,
  IdCardLayoutMeta,
  IdCardLayoutV1,
} from '@/types/id-card-template';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

function newElement(
  fieldKey: string,
  side: 'front' | 'back',
  layout: IdCardLayoutV1,
): IdCardElement {
  const existing = side === 'front' ? layout.front : layout.back;
  const y =
    existing.length > 0 ? Math.min(75, Math.max(...existing.map((e) => e.y + e.height)) + 2) : 10;
  return {
    id: `${fieldKey}-${Date.now()}`,
    type: 'field',
    fieldKey,
    x: 4,
    y,
    width: 46,
    height: 8,
    zIndex: existing.length + 1,
    style: { visible: true, align: 'center' },
  };
}

export const FIELD_LABELS: Record<string, string> = {
  headerBand: 'Header',
  watermark: 'Watermark',
  logo: 'Logo',
  collegeName: 'College Name',
  collegeAddress: 'College Address',
  affiliationLine: 'Affiliation',
  accreditationLine: 'Accreditation',
  photo: 'Photo',
  name: 'Name',
  roleLabel: 'Role',
  subtitle: 'Department Subtitle',
  registrationNumber: 'Reg No',
  rollNumber: 'Roll No',
  department: 'Department',
  programme: 'Programme',
  semester: 'Semester',
  gender: 'Gender',
  fatherName: 'Father Name',
  motherName: 'Mother Name',
  holderAddress: 'Address',
  bloodGroup: 'Blood Group',
  qr: 'QR Code',
  barcode: 'Barcode',
  validity: 'Validity',
  validityBlock: 'Validity Block',
  emergencyContact: 'Emergency Contact',
  rfidNumber: 'RFID Number',
  securityHologram: 'Security Hologram',
  memberId: 'Member ID',
  validityFooter: 'Footer',
  verificationInfo: 'Verification',
  address: 'College (Back)',
  terms: 'Terms',
  principalSignature: 'Principal Signature',
  footerBand: 'Footer Band',
  contact: 'Contact Block',
  email: 'Email',
  phone: 'Phone',
  joiningDate: 'Joining Date',
  employeeId: 'Employee ID',
  designation: 'Designation',
};

export function IdCardDesignerStudio() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const initialTemplateId = searchParams.get('templateId');
  const { branding } = useInstitutionBranding();
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const templatesQ = useQuery({
    queryKey: ['id-cards', 'templates'],
    queryFn: fetchIdCardTemplates,
  });
  const settingsQ = useQuery({ queryKey: ['id-cards', 'settings'], queryFn: fetchIdCardSettings });

  const signatureUrl = useMemo(
    () => resolveInstitutionSignatureUrl(settingsQ.data?.institutionSignatureUrl),
    [settingsQ.data?.institutionSignatureUrl],
  );

  const [selectedTemplateId, setSelectedTemplateId] = useState(initialTemplateId ?? '');
  const [viewMode, setViewMode] = useState<DesignerViewMode>('front');
  const { layout, setLayout, replaceLayout, undo, redo, canUndo, canRedo } = useDesignerHistory(
    defaultLayoutForHolderType('STUDENT'),
  );
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [message, setMessage] = useState('');
  const [zoom, setZoom] = useState<number>(1);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showSafeMargin, setShowSafeMargin] = useState(true);
  const [showPrintArea, setShowPrintArea] = useState(true);
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [calibration, setCalibration] = useState<PrintCalibration>(DEFAULT_PRINT_CALIBRATION);
  const [evolisFeed, setEvolisFeed] = useState<EvolisFeedOptions>(DEFAULT_EVOLIS_FEED);
  const [testPrintMode, setTestPrintMode] = useState(false);
  const [leftTab, setLeftTab] = useState<'components' | 'templates' | 'layers'>('components');
  const [componentSearch, setComponentSearch] = useState('');
  const [previewDataId, setPreviewDataId] = useState<PreviewDataId>('student');
  const [layerDragIndex, setLayerDragIndex] = useState<number | null>(null);

  const templates = templatesQ.data ?? [];
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const filteredTemplates =
    categoryFilter === 'ALL' ? templates : templates.filter((t) => t.holderType === categoryFilter);

  useEffect(() => {
    if (initialTemplateId && templates.some((t) => t.id === initialTemplateId)) {
      setSelectedTemplateId(initialTemplateId);
      return;
    }
    if (!selectedTemplateId && templates.length > 0) {
      setSelectedTemplateId(
        templates.find((t) => t.isDefault && t.holderType === 'STUDENT')?.id ??
          templates.find((t) => t.code === 'dbc-pursuit-excellence')?.id ??
          templates.find((t) => t.code === 'dbc-classic')?.id ??
          templates.find((t) => t.code === 'STUDENT')?.id ??
          templates[0].id,
      );
    }
  }, [templates, selectedTemplateId, initialTemplateId]);

  useEffect(() => {
    if (selectedTemplate) {
      replaceLayout(normalizeIdCardLayout(selectedTemplate.layout, selectedTemplate.holderType));
      setTemplateName(selectedTemplate.name);
    }
  }, [selectedTemplate, replaceLayout]);

  const previewModel = useMemo(
    () =>
      previewModelForDesigner(previewDataId, selectedTemplate?.holderType ?? 'STUDENT', branding),
    [previewDataId, selectedTemplate?.holderType, branding],
  );

  const side = viewMode === 'back' ? 'back' : 'front';
  const allElements = [...layout.front, ...layout.back];
  const selectedElement = allElements.find((e) => e.id === selectedElementId) ?? null;
  const selectedSide: 'front' | 'back' =
    selectedElement && layout.back.some((e) => e.id === selectedElement.id) ? 'back' : 'front';
  const backgroundSideSelected: 'front' | 'back' | null = isBackgroundSelection(selectedElementId)
    ? selectedElementId === BACKGROUND_SELECTION_FRONT
      ? 'front'
      : 'back'
    : null;
  const selectedBackground =
    backgroundSideSelected != null
      ? (backgroundForSide(layout, backgroundSideSelected) ?? null)
      : null;
  const activeCardSide: 'front' | 'back' =
    backgroundSideSelected ?? (viewMode === 'both' ? selectedSide : side);
  const elements =
    viewMode === 'both'
      ? selectedSide === 'back'
        ? layout.back
        : layout.front
      : side === 'front'
        ? layout.front
        : layout.back;
  const canvasSize = cardCanvasSizePx(zoom);

  const updateElementsForSide = useCallback(
    (cardSide: 'front' | 'back', next: IdCardElement[]) => {
      setLayout((prev) =>
        cardSide === 'front' ? { ...prev, front: next } : { ...prev, back: next },
      );
    },
    [setLayout],
  );

  const onElementChangeForSide = useCallback(
    (cardSide: 'front' | 'back') =>
      (id: string, patch: Partial<Pick<IdCardElement, 'x' | 'y' | 'width' | 'height'>>) => {
        const els = cardSide === 'front' ? layout.front : layout.back;
        updateElementsForSide(
          cardSide,
          els.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        );
      },
    [layout.front, layout.back, updateElementsForSide],
  );

  const saveMut = useMutation({
    mutationFn: () =>
      updateIdCardTemplate(selectedTemplateId, {
        name: templateName.trim() || selectedTemplate?.name,
        layout,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['id-cards', 'templates'] });
      setMessage('Template saved.');
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Save failed')),
  });

  const defaultMut = useMutation({
    mutationFn: () => setDefaultIdCardTemplate(selectedTemplateId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['id-cards', 'templates'] });
      setMessage('Set as default.');
    },
  });

  const duplicateMut = useMutation({
    mutationFn: () => duplicateIdCardTemplate(selectedTemplateId),
    onSuccess: (tpl) => {
      void qc.invalidateQueries({ queryKey: ['id-cards', 'templates'] });
      setSelectedTemplateId(tpl.id);
      setMessage('Template duplicated.');
    },
  });

  const updateSelected = useCallback(
    (patch: Partial<IdCardElement>) => {
      if (!selectedElementId) return;
      const cardSide = layout.front.some((e) => e.id === selectedElementId) ? 'front' : 'back';
      const els = cardSide === 'front' ? layout.front : layout.back;
      updateElementsForSide(
        cardSide,
        els.map((e) => (e.id === selectedElementId ? { ...e, ...patch } : e)),
      );
    },
    [selectedElementId, layout.front, layout.back, updateElementsForSide],
  );

  const updateBackground = useCallback(
    (cardSide: 'front' | 'back', patch: Partial<IdCardBackgroundLayer>) => {
      setLayout((prev) => {
        const key = cardSide === 'front' ? 'frontBackground' : 'backBackground';
        const current = prev[key];
        if (!current) return prev;
        return { ...prev, [key]: { ...current, ...patch } };
      });
    },
    [setLayout],
  );

  const applyBackgroundUpload = useCallback(
    (
      cardSide: 'front' | 'back',
      result: { imageUrl: string; naturalWidth?: number | null; naturalHeight?: number | null },
    ) => {
      const layer = defaultBackgroundLayer(result);
      setLayout((prev) => ({
        ...prev,
        meta: { ...prev.meta, creationMethod: prev.meta?.creationMethod ?? 'background-upload' },
        ...(cardSide === 'front' ? { frontBackground: layer } : { backBackground: layer }),
      }));
      setSelectedElementId(
        cardSide === 'front' ? BACKGROUND_SELECTION_FRONT : BACKGROUND_SELECTION_BACK,
      );
      setMessage(`${cardSide === 'front' ? 'Front' : 'Back'} background uploaded.`);
    },
    [setLayout],
  );

  const removeBackground = useCallback(
    (cardSide: 'front' | 'back') => {
      setLayout((prev) => ({
        ...prev,
        ...(cardSide === 'front' ? { frontBackground: null } : { backBackground: null }),
      }));
      setSelectedElementId(null);
    },
    [setLayout],
  );

  const alignSelected = useCallback(
    (alignment: CardAlignment) => {
      if (selectedBackground && backgroundSideSelected) {
        updateBackground(backgroundSideSelected, alignElementToCard(selectedBackground, alignment));
        return;
      }
      if (!selectedElement) return;
      updateSelected(alignElementToCard(selectedElement, alignment));
    },
    [selectedBackground, backgroundSideSelected, selectedElement, updateSelected, updateBackground],
  );

  const addField = (fieldKey: string) => {
    const cardSide = viewMode === 'both' ? selectedSide : side;
    const el = newElement(fieldKey, cardSide, layout);
    updateElementsForSide(cardSide, [...(cardSide === 'front' ? layout.front : layout.back), el]);
    setSelectedElementId(el.id);
  };

  const removeSelected = useCallback(() => {
    if (backgroundSideSelected) {
      removeBackground(backgroundSideSelected);
      return;
    }
    if (!selectedElementId) return;
    const cardSide = layout.front.some((e) => e.id === selectedElementId) ? 'front' : 'back';
    const els = cardSide === 'front' ? layout.front : layout.back;
    updateElementsForSide(
      cardSide,
      els.filter((e) => e.id !== selectedElementId),
    );
    setSelectedElementId(null);
  }, [
    backgroundSideSelected,
    removeBackground,
    selectedElementId,
    layout.front,
    layout.back,
    updateElementsForSide,
  ]);

  const layerActions = {
    bringForward: () => {
      if (!selectedElement) return;
      const cardSide = layout.front.some((e) => e.id === selectedElement.id) ? 'front' : 'back';
      const els = cardSide === 'front' ? layout.front : layout.back;
      const maxZ = Math.max(...els.map((e) => e.zIndex ?? 0));
      updateSelected({ zIndex: maxZ + 1 });
    },
    sendBackward: () => {
      if (!selectedElement) return;
      const cardSide = layout.front.some((e) => e.id === selectedElement.id) ? 'front' : 'back';
      const els = cardSide === 'front' ? layout.front : layout.back;
      const minZ = Math.min(...els.map((e) => e.zIndex ?? 0));
      updateSelected({ zIndex: Math.max(0, minZ - 1) });
    },
    duplicate: () => {
      if (!selectedElement) return;
      const cardSide = layout.front.some((e) => e.id === selectedElement.id) ? 'front' : 'back';
      const els = cardSide === 'front' ? layout.front : layout.back;
      const copy = {
        ...selectedElement,
        id: `${selectedElement.fieldKey}-${Date.now()}`,
        x: selectedElement.x + 2,
        y: selectedElement.y + 2,
      };
      updateElementsForSide(cardSide, [...els, copy]);
      setSelectedElementId(copy.id);
    },
    toggleLock: () => {
      if (!selectedElementId) return;
      setLockedIds((prev) => {
        const next = new Set(prev);
        if (next.has(selectedElementId)) next.delete(selectedElementId);
        else next.add(selectedElementId);
        return next;
      });
    },
    toggleHide: () => {
      if (!selectedElement) return;
      updateSelected({
        style: { ...selectedElement.style, visible: selectedElement.style?.visible === false },
      });
    },
    remove: removeSelected,
  };

  const reorderLayers = (cardSide: 'front' | 'back', fromIndex: number, toIndex: number) => {
    const els = cardSide === 'front' ? layout.front : layout.back;
    updateElementsForSide(cardSide, reorderLayerElements(els, fromIndex, toIndex));
  };

  const updateStylePreset = (stylePreset: IdCardLayoutMeta['stylePreset']) => {
    setLayout((prev) => ({ ...prev, meta: { ...prev.meta, stylePreset } }));
  };

  const fitScreen = () => {
    const host = canvasHostRef.current;
    if (!host) return;
    const pad = 80;
    const zw = (host.clientWidth - pad) / (CR80_WIDTH_MM * (96 / 25.4));
    const zh = (host.clientHeight - pad) / (CR80_HEIGHT_MM * (96 / 25.4));
    setZoom(Math.min(2, Math.max(0.25, Math.min(zw, zh))));
  };

  const palette = selectedTemplate ? paletteKeysForHolderType(selectedTemplate.holderType) : [];
  const filteredPalette = palette.filter((key) => {
    const label = FIELD_LABELS[key] ?? key;
    const q = componentSearch.trim().toLowerCase();
    return !q || label.toLowerCase().includes(q) || key.toLowerCase().includes(q);
  });
  const sortedLayers = [...(viewMode === 'both' ? allElements : elements)].sort(
    (a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0),
  );
  const layersSide = viewMode === 'both' ? selectedSide : side;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      )
        return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElementId) {
        e.preventDefault();
        removeSelected();
        return;
      }
      if (
        selectedBackground &&
        backgroundSideSelected &&
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 0.5;
        const dir =
          e.key === 'ArrowUp'
            ? 'up'
            : e.key === 'ArrowDown'
              ? 'down'
              : e.key === 'ArrowLeft'
                ? 'left'
                : 'right';
        updateBackground(backgroundSideSelected, nudgeElement(selectedBackground, dir, step));
        return;
      }
      if (selectedElement && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 0.5;
        const dir =
          e.key === 'ArrowUp'
            ? 'up'
            : e.key === 'ArrowDown'
              ? 'down'
              : e.key === 'ArrowLeft'
                ? 'left'
                : 'right';
        updateSelected(nudgeElement(selectedElement, dir, step));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    undo,
    redo,
    selectedElementId,
    selectedElement,
    selectedBackground,
    backgroundSideSelected,
    updateSelected,
    updateBackground,
    removeSelected,
  ]);

  const frontCanvasProps = {
    model: previewModel,
    layout,
    holderType: selectedTemplate?.holderType,
    designMode: true as const,
    selectedElementId: isBackgroundSelection(selectedElementId) ? null : selectedElementId,
    onSelectElement: (id: string | null) => setSelectedElementId(id),
    onElementChange: onElementChangeForSide('front'),
    zoom,
    snapToGrid,
    showGrid,
    showSafeMargin,
    showPrintArea,
    lockedElementIds: lockedIds,
    signatureUrl,
    backgroundSelected: selectedElementId === BACKGROUND_SELECTION_FRONT,
    onSelectBackground: () => setSelectedElementId(BACKGROUND_SELECTION_FRONT),
    onBackgroundChange: (
      patch: Partial<Pick<IdCardBackgroundLayer, 'x' | 'y' | 'width' | 'height'>>,
    ) => updateBackground('front', patch),
  };

  const backCanvasProps = {
    ...frontCanvasProps,
    selectedElementId: isBackgroundSelection(selectedElementId) ? null : selectedElementId,
    onElementChange: onElementChangeForSide('back'),
    backgroundSelected: selectedElementId === BACKGROUND_SELECTION_BACK,
    onSelectBackground: () => setSelectedElementId(BACKGROUND_SELECTION_BACK),
    onBackgroundChange: (
      patch: Partial<Pick<IdCardBackgroundLayer, 'x' | 'y' | 'width' | 'height'>>,
    ) => updateBackground('back', patch),
  };

  return (
    <div className="flex h-[calc(100dvh-4rem)] min-h-[640px] flex-col overflow-hidden rounded-xl border border-border bg-background">
      {/* Top toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-4 py-2">
        <Link
          href="/admin/id-cards/templates"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Gallery
        </Link>
        <span className="text-muted-foreground">|</span>
        <Link
          href="/admin/id-cards"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ID Cards
        </Link>
        <span className="text-muted-foreground">|</span>
        <Input
          className="h-8 max-w-[200px] text-sm font-medium"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          placeholder="Template name"
        />
        <div className="flex gap-1">
          {(['front', 'back', 'both'] as DesignerViewMode[]).map((m) => (
            <Button
              key={m}
              type="button"
              size="sm"
              variant={viewMode === m ? 'default' : 'outline'}
              className="h-8 capitalize"
              onClick={() => setViewMode(m)}
            >
              {m === 'both' ? 'Side-by-Side' : m}
            </Button>
          ))}
        </div>
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            disabled={!canUndo}
            onClick={undo}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            disabled={!canRedo}
            onClick={redo}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="ml-auto flex flex-wrap gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
          >
            <Save className="mr-1 h-3.5 w-3.5" /> Save
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => defaultMut.mutate()}>
            Set default
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => duplicateMut.mutate()}>
            Duplicate
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              if (selectedTemplate) {
                replaceLayout(defaultLayoutForHolderType(selectedTemplate.holderType));
                setMessage('Reset to defaults (not saved).');
              }
            }}
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() =>
              openCr80PrintPreview({
                model: previewModel,
                layout,
                holderType: selectedTemplate?.holderType,
                calibration,
                purpose: 'preview',
                testMode: testPrintMode,
                signatureUrl,
              })
            }
          >
            <Printer className="mr-1 h-3.5 w-3.5" /> Print Preview
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              openCr80PrintPreview({
                model: previewModel,
                layout,
                holderType: selectedTemplate?.holderType,
                calibration,
                evolisFeed,
                purpose: 'evolis',
                testMode: testPrintMode,
                signatureUrl,
              })
            }
          >
            Evolis Export
          </Button>
        </div>
      </div>

      {/* Alignment + style bar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-muted/15 px-4 py-1.5 text-xs">
        <span className="font-medium text-muted-foreground">Style preset</span>
        <select
          className="h-7 rounded border border-border bg-background px-2 text-xs"
          value={layout.meta?.stylePreset ?? 'classic'}
          onChange={(e) => updateStylePreset(e.target.value as IdCardLayoutMeta['stylePreset'])}
        >
          {STYLE_PRESET_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="mx-1 text-muted-foreground">|</span>
        <span className="font-medium text-muted-foreground">Preview data</span>
        <select
          className="h-7 rounded border border-border bg-background px-2 text-xs"
          value={previewDataId}
          onChange={(e) => setPreviewDataId(e.target.value as PreviewDataId)}
        >
          {PREVIEW_DATA_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        {selectedElement || selectedBackground ? (
          <>
            <span className="mx-1 text-muted-foreground">|</span>
            <span className="font-medium text-muted-foreground">Align</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2"
              onClick={() => alignSelected('left')}
              title="Align left"
            >
              <AlignStartHorizontal className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2"
              onClick={() => alignSelected('center-h')}
              title="Center horizontally"
            >
              <AlignCenterHorizontal className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2"
              onClick={() => alignSelected('right')}
              title="Align right"
            >
              <AlignEndHorizontal className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2"
              onClick={() => alignSelected('top')}
              title="Align top"
            >
              <AlignStartVertical className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2"
              onClick={() => alignSelected('center-v')}
              title="Center vertically"
            >
              <AlignCenterVertical className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2"
              onClick={() => alignSelected('bottom')}
              title="Align bottom"
            >
              <AlignEndVertical className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2"
              onClick={() => alignSelected('center')}
              title="Center on card"
            >
              <AlignCenter className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <span className="text-muted-foreground">Select an element to align</span>
        )}
      </div>

      {message ? (
        <p className="shrink-0 px-4 py-1 text-xs text-muted-foreground">{message}</p>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {/* Left panel */}
        <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-muted/10">
          <div className="flex border-b border-border text-[10px] font-semibold uppercase">
            {(['components', 'templates', 'layers'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                className={cn(
                  'flex-1 px-2 py-2 capitalize',
                  leftTab === tab
                    ? 'border-b-2 border-primary bg-background'
                    : 'text-muted-foreground',
                )}
                onClick={() => setLeftTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-auto p-2 text-xs">
            {leftTab === 'components' && (
              <div className="space-y-2">
                <div className="rounded-md border border-primary/30 bg-primary/5 p-2">
                  <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-primary">
                    <Image className="h-3.5 w-3.5" /> + Background Image
                  </p>
                  <IdCardBackgroundUploader
                    side={activeCardSide}
                    templateId={selectedTemplateId || undefined}
                    existingUrl={backgroundForSide(layout, activeCardSide)?.imageUrl}
                    onUploaded={(result) => applyBackgroundUpload(activeCardSide, result)}
                    compact
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {activeCardSide === 'front' ? 'Front' : 'Back'} side · layer 0 (bottom)
                  </p>
                </div>
                <div className="relative">
                  <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder="Search components…"
                    value={componentSearch}
                    onChange={(e) => setComponentSearch(e.target.value)}
                    className="h-8 pl-7 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  {filteredPalette.map((key) => (
                    <button
                      key={key}
                      type="button"
                      className="flex w-full items-center rounded-md border border-border px-2 py-1.5 text-left hover:bg-muted"
                      onClick={() => addField(key)}
                    >
                      + {FIELD_LABELS[key] ?? key}
                    </button>
                  ))}
                  {filteredPalette.length === 0 ? (
                    <p className="py-4 text-center text-muted-foreground">
                      No matching components.
                    </p>
                  ) : null}
                </div>
              </div>
            )}
            {leftTab === 'templates' && (
              <div className="space-y-2">
                <select
                  className="w-full rounded border border-border bg-background px-2 py-1"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="ALL">All categories</option>
                  {TEMPLATE_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {filteredTemplates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={cn(
                      'w-full rounded border px-2 py-1.5 text-left',
                      t.id === selectedTemplateId
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted',
                    )}
                    onClick={() => setSelectedTemplateId(t.id)}
                  >
                    <div className="font-medium">{t.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {t.holderType}
                      {t.isDefault ? ' · default' : ''}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {leftTab === 'layers' && (
              <ul className="space-y-1">
                {sortedLayers.map((el, index) => {
                  const hidden = el.style?.visible === false;
                  const locked = lockedIds.has(el.id);
                  return (
                    <li
                      key={el.id}
                      draggable
                      onDragStart={() => setLayerDragIndex(index)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (layerDragIndex != null && layerDragIndex !== index) {
                          reorderLayers(layersSide, layerDragIndex, index);
                        }
                        setLayerDragIndex(null);
                      }}
                    >
                      <button
                        type="button"
                        className={cn(
                          'flex w-full items-center gap-1 rounded px-1 py-1',
                          selectedElementId === el.id
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-muted',
                          hidden && 'opacity-50',
                        )}
                        onClick={() => setSelectedElementId(el.id)}
                      >
                        <GripVertical className="h-3 w-3 shrink-0 cursor-grab text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate text-left">
                          {FIELD_LABELS[el.fieldKey ?? ''] ?? el.fieldKey}
                        </span>
                        {locked ? <Lock className="h-2.5 w-2.5 shrink-0" /> : null}
                        {hidden ? (
                          <EyeOff className="h-2.5 w-2.5 shrink-0" />
                        ) : (
                          <Eye className="h-2.5 w-2.5 shrink-0 opacity-30" />
                        )}
                        <span className="text-[10px] text-muted-foreground">z{el.zIndex ?? 0}</span>
                      </button>
                    </li>
                  );
                })}
                {backgroundForSide(layout, layersSide) ? (
                  <li className="mt-2 border-t border-border pt-2">
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-1 rounded px-1 py-1',
                        isBackgroundSelection(selectedElementId) &&
                          ((layersSide === 'front' &&
                            selectedElementId === BACKGROUND_SELECTION_FRONT) ||
                            (layersSide === 'back' &&
                              selectedElementId === BACKGROUND_SELECTION_BACK))
                          ? 'bg-violet-500/10 text-violet-700'
                          : 'hover:bg-muted',
                      )}
                      onClick={() =>
                        setSelectedElementId(
                          layersSide === 'front'
                            ? BACKGROUND_SELECTION_FRONT
                            : BACKGROUND_SELECTION_BACK,
                        )
                      }
                    >
                      <Image className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-left">Background Image</span>
                      {backgroundForSide(layout, layersSide)?.locked ? (
                        <Lock className="h-2.5 w-2.5 shrink-0" />
                      ) : null}
                      <span className="text-[10px] text-muted-foreground">z0</span>
                    </button>
                  </li>
                ) : null}
              </ul>
            )}
          </div>
        </aside>

        {/* Center canvas */}
        <main
          ref={canvasHostRef}
          className="relative flex min-w-0 flex-1 flex-col overflow-auto bg-slate-200/40 dark:bg-slate-900/40"
        >
          <div className="sticky top-0 z-10 flex">
            <div style={{ width: DESIGNER_RULER_SIZE }} />
            <DesignerRulerHorizontal zoom={zoom} widthPx={canvasSize.width} />
          </div>
          <div className="flex flex-1 items-start justify-center p-8">
            <div className="flex">
              <DesignerRulerVertical zoom={zoom} heightPx={canvasSize.height} />
              <div className="flex flex-wrap items-start justify-center gap-8">
                {(viewMode === 'front' || viewMode === 'both') && (
                  <div className="shadow-2xl ring-1 ring-black/10">
                    <Cr80CardFront {...frontCanvasProps} />
                  </div>
                )}
                {(viewMode === 'back' || viewMode === 'both') && (
                  <div className="shadow-2xl ring-1 ring-black/10">
                    <Cr80CardBack {...backCanvasProps} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* Right properties */}
        <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-border bg-muted/10 p-3 text-xs">
          <p className="font-semibold">Properties</p>
          {selectedBackground && backgroundSideSelected ? (
            <div className="mt-2 space-y-2">
              <p className="text-muted-foreground">
                Background Image ({backgroundSideSelected === 'front' ? 'Front' : 'Back'})
              </p>
              <IdCardBackgroundUploader
                side={backgroundSideSelected}
                templateId={selectedTemplateId || undefined}
                existingUrl={selectedBackground.imageUrl}
                onUploaded={(result) => applyBackgroundUpload(backgroundSideSelected, result)}
                compact
              />
              <div className="grid grid-cols-2 gap-2">
                {(['x', 'y', 'width', 'height'] as const).map((prop) => (
                  <div key={prop}>
                    <Label className="text-[10px] uppercase">{prop} (mm)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      className="h-8"
                      value={selectedBackground[prop]}
                      disabled={selectedBackground.locked}
                      onChange={(e) =>
                        updateBackground(backgroundSideSelected, {
                          [prop]: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                ))}
              </div>
              <div>
                <Label className="text-[10px] uppercase">Fit</Label>
                <select
                  className="h-8 w-full rounded-md border border-border bg-background px-2"
                  value={selectedBackground.fit ?? 'cover'}
                  onChange={(e) =>
                    updateBackground(backgroundSideSelected, {
                      fit: e.target.value as IdCardBackgroundLayer['fit'],
                    })
                  }
                >
                  {BACKGROUND_FIT_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-[10px] uppercase">Opacity</Label>
                <Input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  className="h-8"
                  value={selectedBackground.opacity ?? 1}
                  onChange={(e) =>
                    updateBackground(backgroundSideSelected, { opacity: Number(e.target.value) })
                  }
                />
              </div>
              {selectedBackground.naturalWidth && selectedBackground.naturalHeight ? (
                <p className="text-[10px] text-muted-foreground">
                  Original: {selectedBackground.naturalWidth}×{selectedBackground.naturalHeight}px ·
                  stored lossless
                </p>
              ) : null}
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={selectedBackground.locked ?? false}
                  onChange={(e) =>
                    updateBackground(backgroundSideSelected, { locked: e.target.checked })
                  }
                />
                Lock background (prevent move/resize)
              </label>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="w-full"
                onClick={() => removeBackground(backgroundSideSelected)}
              >
                Remove Background
              </Button>
            </div>
          ) : selectedElement ? (
            <div className="mt-2 space-y-2">
              <p className="text-muted-foreground">
                {FIELD_LABELS[selectedElement.fieldKey ?? ''] ?? selectedElement.fieldKey}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(['x', 'y', 'width', 'height'] as const).map((prop) => (
                  <div key={prop}>
                    <Label className="text-[10px] uppercase">{prop} (mm)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      className="h-8"
                      value={selectedElement[prop]}
                      onChange={(e) => updateSelected({ [prop]: Number(e.target.value) || 0 })}
                    />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] uppercase">Font size (px)</Label>
                  <Input
                    type="number"
                    className="h-8"
                    value={selectedElement.style?.fontSize ?? 6}
                    onChange={(e) =>
                      updateSelected({
                        style: { ...selectedElement.style, fontSize: Number(e.target.value) || 6 },
                      })
                    }
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase">Font weight</Label>
                  <select
                    className="h-8 w-full rounded-md border border-border bg-background px-2"
                    value={selectedElement.style?.fontWeight ?? 'bold'}
                    onChange={(e) =>
                      updateSelected({
                        style: {
                          ...selectedElement.style,
                          fontWeight: e.target.value as NonNullable<
                            typeof selectedElement.style
                          >['fontWeight'],
                        },
                      })
                    }
                  >
                    <option value="normal">Normal</option>
                    <option value="medium">Medium</option>
                    <option value="semibold">Semibold</option>
                    <option value="bold">Bold</option>
                    <option value="extrabold">Extra bold</option>
                  </select>
                </div>
              </div>
              <div>
                <Label className="text-[10px] uppercase">Text align</Label>
                <select
                  className="h-8 w-full rounded-md border border-border bg-background px-2"
                  value={selectedElement.style?.align ?? 'center'}
                  onChange={(e) =>
                    updateSelected({
                      style: {
                        ...selectedElement.style,
                        align: e.target.value as 'left' | 'center' | 'right',
                      },
                    })
                  }
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
              {selectedElement.fieldKey === 'photo' ? (
                <div>
                  <Label className="text-[10px] uppercase">Photo shape</Label>
                  <select
                    className="h-8 w-full rounded-md border border-border bg-background px-2"
                    value={selectedElement.style?.photoShape ?? 'square'}
                    onChange={(e) =>
                      updateSelected({
                        style: {
                          ...selectedElement.style,
                          photoShape: e.target.value as 'square' | 'circle',
                        },
                      })
                    }
                  >
                    <option value="square">Square</option>
                    <option value="circle">Circle</option>
                  </select>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] uppercase">Text color</Label>
                  <Input
                    type="color"
                    className="h-8 p-1"
                    value={selectedElement.style?.color ?? '#0f172a'}
                    onChange={(e) =>
                      updateSelected({ style: { ...selectedElement.style, color: e.target.value } })
                    }
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase">Background</Label>
                  <Input
                    type="color"
                    className="h-8 p-1"
                    value={selectedElement.style?.backgroundColor ?? '#ffffff'}
                    onChange={(e) =>
                      updateSelected({
                        style: { ...selectedElement.style, backgroundColor: e.target.value },
                      })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] uppercase">Opacity</Label>
                  <Input
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    className="h-8"
                    value={selectedElement.style?.opacity ?? 1}
                    onChange={(e) =>
                      updateSelected({
                        style: { ...selectedElement.style, opacity: Number(e.target.value) },
                      })
                    }
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase">Border (mm)</Label>
                  <Input
                    type="number"
                    step={0.1}
                    min={0}
                    className="h-8"
                    value={selectedElement.style?.borderWidthMm ?? 0}
                    onChange={(e) =>
                      updateSelected({
                        style: {
                          ...selectedElement.style,
                          borderWidthMm: Number(e.target.value) || 0,
                        },
                      })
                    }
                  />
                </div>
              </div>
              <div>
                <Label className="text-[10px] uppercase">Border color</Label>
                <Input
                  type="color"
                  className="h-8 p-1"
                  value={selectedElement.style?.borderColor ?? '#cbd5e1'}
                  onChange={(e) =>
                    updateSelected({
                      style: { ...selectedElement.style, borderColor: e.target.value },
                    })
                  }
                />
              </div>
              <div className="flex flex-wrap gap-1 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2"
                  onClick={layerActions.bringForward}
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2"
                  onClick={layerActions.sendBackward}
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2"
                  onClick={layerActions.duplicate}
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2"
                  onClick={layerActions.toggleLock}
                >
                  {lockedIds.has(selectedElement.id) ? (
                    <Lock className="h-3 w-3" />
                  ) : (
                    <Unlock className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2"
                  onClick={layerActions.toggleHide}
                >
                  <EyeOff className="h-3 w-3" />
                </Button>
              </div>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="w-full"
                onClick={layerActions.remove}
              >
                Remove
              </Button>
              <p className="text-[10px] text-muted-foreground">
                Arrow keys nudge · Shift = 1mm · Del removes
              </p>
            </div>
          ) : (
            <p className="mt-2 text-muted-foreground">Select an element on the canvas.</p>
          )}

          <div className="mt-6 border-t border-border pt-3">
            <p className="font-semibold">Print calibration (mm)</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Offsets translate content only — never rotate the card.
            </p>
            {(['topOffsetMm', 'leftOffsetMm', 'rightOffsetMm', 'bottomOffsetMm'] as const).map(
              (k) => (
                <div key={k} className="mt-1">
                  <Label className="text-[10px]">{k.replace('OffsetMm', '')}</Label>
                  <Input
                    type="number"
                    step="0.5"
                    className="h-7"
                    value={calibration[k]}
                    onChange={(e) =>
                      setCalibration({ ...calibration, [k]: Number(e.target.value) || 0 })
                    }
                  />
                </div>
              ),
            )}
            <label className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={testPrintMode}
                onChange={(e) => setTestPrintMode(e.target.checked)}
              />
              Test print (alignment grid)
            </label>
          </div>

          <div className="mt-4 border-t border-border pt-3">
            <p className="font-semibold">Evolis Primacy feed</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Only applied to Evolis Export — not print preview. Preview always matches the designer
              1:1.
            </p>
            <label className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={evolisFeed.rotateFront180 ?? false}
                onChange={(e) => setEvolisFeed({ ...evolisFeed, rotateFront180: e.target.checked })}
              />
              Rotate front 180° (Primacy feed)
            </label>
            <label className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={evolisFeed.rotateBack180 ?? false}
                onChange={(e) => setEvolisFeed({ ...evolisFeed, rotateBack180: e.target.checked })}
              />
              Rotate back 180° (Primacy feed)
            </label>
          </div>
        </aside>
      </div>

      {/* Bottom bar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border bg-muted/30 px-4 py-2 text-xs">
        <span className="font-medium text-muted-foreground">Zoom:</span>
        {ZOOM_PRESETS.map((z) => (
          <Button
            key={z}
            type="button"
            size="sm"
            variant={zoom === z ? 'default' : 'outline'}
            className="h-7 px-2"
            onClick={() => setZoom(z)}
          >
            {z * 100}%
          </Button>
        ))}
        <Button type="button" size="sm" variant="outline" className="h-7" onClick={fitScreen}>
          <Maximize2 className="mr-1 h-3 w-3" /> Fit
        </Button>
        <span className="mx-2 text-muted-foreground">|</span>
        <Button
          type="button"
          size="sm"
          variant={showGrid ? 'default' : 'outline'}
          className="h-7"
          onClick={() => setShowGrid((v) => !v)}
        >
          <Grid3X3 className="mr-1 h-3 w-3" /> Grid
        </Button>
        <Button
          type="button"
          size="sm"
          variant={snapToGrid ? 'default' : 'outline'}
          className="h-7"
          onClick={() => setSnapToGrid((v) => !v)}
        >
          <Magnet className="mr-1 h-3 w-3" /> Snap
        </Button>
        <Button
          type="button"
          size="sm"
          variant={showSafeMargin ? 'default' : 'outline'}
          className="h-7"
          onClick={() => setShowSafeMargin((v) => !v)}
        >
          Safe margin
        </Button>
        <Button
          type="button"
          size="sm"
          variant={showPrintArea ? 'default' : 'outline'}
          className="h-7"
          onClick={() => setShowPrintArea((v) => !v)}
        >
          Print area
        </Button>
        <span className="ml-auto text-muted-foreground">
          CR80 {CR80_WIDTH_MM} × {CR80_HEIGHT_MM} mm · Preview:{' '}
          {previewModel.cardType === 'student'
            ? (previewModel.holder.displayFullName ?? previewModel.holder.fullName)
            : previewModel.holder.fullName}
        </span>
      </div>
    </div>
  );
}
