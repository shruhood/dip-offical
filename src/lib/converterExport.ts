import type { ToolDefinition, ToolEngineId } from '../types/tool';

export interface ToolExportShortcut {
  ready: boolean;
  onExport: () => Promise<void> | void;
}

const CONVERTER_ENGINE_IDS = new Set<ToolEngineId>([
  'pdf-to-word',
  'word-to-pdf',
  'pdf-to-excel',
  'excel-to-pdf',
  'pdf-to-image',
  'image-to-pdf',
  'html-to-pdf',
  'image-convert',
  'data-converter',
  'ocr-text',
]);

export function isConverterTool(tool: ToolDefinition): boolean {
  if (tool.category === 'converters') return true;
  if (CONVERTER_ENGINE_IDS.has(tool.engineId)) return true;
  if (tool.slug.includes('converter') || tool.slug.includes('-to-')) return true;
  return false;
}
