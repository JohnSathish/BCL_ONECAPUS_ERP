'use client';

import { Button } from '@/components/ui/button';

type FyugpStructureToolbarProps = {
  disabled?: boolean;
  selectedTemplateId: string;
  templates: Array<{ id: string; templateName: string }>;
  saving?: boolean;
  loadingDefaults?: boolean;
  applyingTemplate?: boolean;
  onTemplateChange: (templateId: string) => void;
  onApplyToCurrent: () => void;
  onApplyToProgrammes: () => void;
  onBulkUpdate: () => void;
  onCloneStructure: () => void;
  onCopySemesterPattern: () => void;
  onLoadNehuDefaults: () => void;
  onManageTemplates: () => void;
  onSave: () => void;
};

export function FyugpStructureToolbar({
  disabled,
  selectedTemplateId,
  templates,
  saving,
  loadingDefaults,
  applyingTemplate,
  onTemplateChange,
  onApplyToCurrent,
  onApplyToProgrammes,
  onBulkUpdate,
  onCloneStructure,
  onCopySemesterPattern,
  onLoadNehuDefaults,
  onManageTemplates,
  onSave,
}: FyugpStructureToolbarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <select
        className="h-8 min-w-[220px] rounded-md border border-border bg-card px-2 text-xs"
        value={selectedTemplateId}
        onChange={(e) => onTemplateChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">Select template…</option>
        {templates.map((template) => (
          <option key={template.id} value={template.id}>
            {template.templateName}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || !selectedTemplateId || applyingTemplate}
        onClick={onApplyToCurrent}
      >
        {applyingTemplate ? 'Applying…' : 'Apply to this version'}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || !selectedTemplateId}
        onClick={onApplyToProgrammes}
      >
        Apply to programmes
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || !selectedTemplateId}
        onClick={onBulkUpdate}
      >
        Bulk update
      </Button>
      <Button size="sm" variant="outline" disabled={disabled} onClick={onCloneStructure}>
        Clone structure
      </Button>
      <Button size="sm" variant="outline" disabled={disabled} onClick={onCopySemesterPattern}>
        Copy semester pattern
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || loadingDefaults}
        onClick={onLoadNehuDefaults}
      >
        {loadingDefaults ? 'Loading…' : 'Load NEHU FYUGP defaults'}
      </Button>
      <Button size="sm" variant="outline" disabled={disabled} onClick={onManageTemplates}>
        Manage templates
      </Button>
      <Button size="sm" disabled={disabled || saving} onClick={onSave}>
        {saving ? 'Saving…' : 'Save structure'}
      </Button>
    </div>
  );
}
