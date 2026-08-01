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
  EyeOff,
  Grid3X3,
  Lock,
  Magnet,
  Maximize2,
  Printer,
  Redo2,
  RotateCcw,
  Save,
  Undo2,
  Unlock,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Cr80CardBack, Cr80CardFront } from '@/components/id-cards/cr80-card-renderer';
import {
  cardCanvasSizePx,
  CR80_GRID_MM,
  DEFAULT_EVOLIS_FEED,
  DEFAULT_PRINT_CALIBRATION,
  snapMm,
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
import {
  BACKGROUND_SELECTION_BACK,
  BACKGROUND_SELECTION_FRONT,
  backgroundForSide,
  defaultBackgroundLayer,
  isBackgroundSelection,
} from '@/components/id-cards/id-card-background-utils';
import {
  FIELD_DEFAULT_LABELS,
  parsePalettePayload,
} from '@/components/id-cards/id-card-element-catalog';
import {
  createElementFromCatalogItem,
  createElementFromPayload,
} from '@/components/id-cards/create-id-card-element';
import { DesignerElementsPanel } from '@/components/id-cards-module/designer-elements-panel';
import { DesignerLayersPanel } from '@/components/id-cards-module/designer-layers-panel';
import { DesignerPropertiesPanel } from '@/components/id-cards-module/designer-properties-panel';
import type {
  IdCardBackgroundLayer,
  IdCardElement,
  IdCardLayoutMeta,
  IdCardLayoutV1,
} from '@/types/id-card-template';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

/** @deprecated Prefer FIELD_DEFAULT_LABELS / getFieldDisplayName from element catalog */
export const FIELD_LABELS = FIELD_DEFAULT_LABELS;

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
      const next = normalizeIdCardLayout(selectedTemplate.layout, selectedTemplate.holderType);
      replaceLayout(next);
      setTemplateName(selectedTemplate.name);
      const locked = new Set<string>();
      for (const el of [...next.front, ...next.back]) {
        if (el.locked) locked.add(el.id);
      }
      setLockedIds(locked);
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
  const effectiveLockedIds = useMemo(() => {
    const next = new Set(lockedIds);
    for (const el of allElements) {
      if (el.locked) next.add(el.id);
    }
    return next;
  }, [lockedIds, allElements]);
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
        layout: {
          ...layout,
          meta: { ...layout.meta, customized: true },
        },
      }),
    onSuccess: () => {
      setLayout((prev) => ({
        ...prev,
        meta: { ...prev.meta, customized: true },
      }));
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
      if (typeof patch.locked === 'boolean') {
        setLockedIds((prev) => {
          const next = new Set(prev);
          if (patch.locked) next.add(selectedElementId);
          else next.delete(selectedElementId);
          return next;
        });
      }
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

  const addCatalogItem = (
    item: Parameters<typeof createElementFromCatalogItem>[0],
    at?: { x: number; y: number },
  ) => {
    const cardSide = viewMode === 'both' ? selectedSide : side;
    const el = createElementFromCatalogItem(item, cardSide, layout, at);
    if (at) {
      el.x = snapMm(el.x, CR80_GRID_MM, snapToGrid);
      el.y = snapMm(el.y, CR80_GRID_MM, snapToGrid);
    }
    updateElementsForSide(cardSide, [...(cardSide === 'front' ? layout.front : layout.back), el]);
    setSelectedElementId(el.id);
  };

  const addPayloadAtCursor = useCallback(
    (raw: string, xMm: number, yMm: number, dropSide: 'front' | 'back') => {
      const payload = parsePalettePayload(raw);
      if (!payload) return;
      const el = createElementFromPayload(payload, dropSide, layout, { x: xMm, y: yMm });
      el.x = snapMm(el.x, CR80_GRID_MM, snapToGrid);
      el.y = snapMm(el.y, CR80_GRID_MM, snapToGrid);
      updateElementsForSide(dropSide, [...(dropSide === 'front' ? layout.front : layout.back), el]);
      setSelectedElementId(el.id);
    },
    [layout, snapToGrid, updateElementsForSide],
  );

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
      const copy: IdCardElement = {
        ...structuredClone(selectedElement),
        id:
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? `${selectedElement.type}-${crypto.randomUUID()}`
            : `${selectedElement.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        x: selectedElement.x + 2,
        y: selectedElement.y + 2,
        zIndex: els.length + 1,
      };
      updateElementsForSide(cardSide, [...els, copy]);
      setSelectedElementId(copy.id);
    },
    toggleLock: () => {
      if (!selectedElement) return;
      const nextLocked = !(selectedElement.locked || lockedIds.has(selectedElement.id));
      updateSelected({ locked: nextLocked });
      setLockedIds((prev) => {
        const next = new Set(prev);
        if (nextLocked) next.add(selectedElement.id);
        else next.delete(selectedElement.id);
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

  const layersSide = viewMode === 'both' ? selectedSide : side;
  // Always list one face only — front/back templates often reuse the same element ids (e.g. "logo").
  const layerSource = layersSide === 'front' ? layout.front : layout.back;
  const sortedLayers = [...layerSource].sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));

  /** Phase B hook: selectedIds prepared; Phase A uses single selection. */
  const selectedIds = useMemo(
    () =>
      selectedElementId && !isBackgroundSelection(selectedElementId) ? [selectedElementId] : [],
    [selectedElementId],
  );
  void selectedIds;

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
    lockedElementIds: effectiveLockedIds,
    signatureUrl,
    backgroundSelected: selectedElementId === BACKGROUND_SELECTION_FRONT,
    onSelectBackground: () => setSelectedElementId(BACKGROUND_SELECTION_FRONT),
    onBackgroundChange: (
      patch: Partial<Pick<IdCardBackgroundLayer, 'x' | 'y' | 'width' | 'height'>>,
    ) => updateBackground('front', patch),
    onPaletteDrop: (payload: string, xMm: number, yMm: number) =>
      addPayloadAtCursor(payload, xMm, yMm, 'front'),
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
    onPaletteDrop: (payload: string, xMm: number, yMm: number) =>
      addPayloadAtCursor(payload, xMm, yMm, 'back'),
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
            onClick={() => {
              void openCr80PrintPreview({
                model: previewModel,
                layout,
                holderType: selectedTemplate?.holderType,
                calibration,
                purpose: 'preview',
                testMode: testPrintMode,
                signatureUrl,
              }).catch((e) => setMessage(apiErrorMessage(e, 'Print preview failed')));
            }}
          >
            <Printer className="mr-1 h-3.5 w-3.5" /> Print Preview
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              void openCr80PrintPreview({
                model: previewModel,
                layout,
                holderType: selectedTemplate?.holderType,
                calibration,
                evolisFeed,
                purpose: 'evolis',
                testMode: testPrintMode,
                signatureUrl,
              }).catch((e) => setMessage(apiErrorMessage(e, 'Evolis export failed')));
            }}
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
                {tab === 'components' ? 'Elements' : tab}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-auto p-2 text-xs">
            {leftTab === 'components' && (
              <DesignerElementsPanel
                holderType={selectedTemplate?.holderType}
                search={componentSearch}
                onSearchChange={setComponentSearch}
                layout={layout}
                activeCardSide={activeCardSide}
                templateId={selectedTemplateId || undefined}
                onBackgroundUploaded={(result) => applyBackgroundUpload(activeCardSide, result)}
                onAddItem={(item) => addCatalogItem(item)}
              />
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
              <DesignerLayersPanel
                layers={sortedLayers}
                layersSide={layersSide}
                layout={layout}
                selectedElementId={selectedElementId}
                lockedIds={effectiveLockedIds}
                layerDragIndex={layerDragIndex}
                onLayerDragIndex={setLayerDragIndex}
                onSelect={setSelectedElementId}
                onReorder={(from, to) => reorderLayers(layersSide, from, to)}
              />
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
          <DesignerPropertiesPanel
            selectedElement={selectedElement}
            selectedBackground={selectedBackground}
            backgroundSideSelected={backgroundSideSelected}
            templateId={selectedTemplateId || undefined}
            onUpdateElement={updateSelected}
            onUpdateBackground={updateBackground}
            onBackgroundUploaded={(side, result) => applyBackgroundUpload(side, result)}
            onRemoveBackground={removeBackground}
          />
          {(selectedElement || selectedBackground) && (
            <div className="mt-3 flex flex-wrap gap-1 border-t border-border pt-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2"
                onClick={layerActions.bringForward}
                disabled={!selectedElement}
              >
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2"
                onClick={layerActions.sendBackward}
                disabled={!selectedElement}
              >
                <ArrowDown className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2"
                onClick={layerActions.duplicate}
                disabled={!selectedElement}
              >
                <Copy className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2"
                onClick={layerActions.toggleLock}
                disabled={!selectedElement}
              >
                {selectedElement &&
                (lockedIds.has(selectedElement.id) || selectedElement.locked) ? (
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
                disabled={!selectedElement}
              >
                <EyeOff className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="h-7 flex-1"
                onClick={layerActions.remove}
              >
                Remove
              </Button>
              <p className="w-full text-[10px] text-muted-foreground">
                Arrow keys nudge · Shift = 1mm · Del removes
              </p>
            </div>
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
