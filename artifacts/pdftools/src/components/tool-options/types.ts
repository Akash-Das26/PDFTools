import { useEffect, useRef } from "react";

/**
 * What an option panel tells the generic tool page. Panels own their own state
 * and report the finished multipart payload, so `tool.tsx` never needs to know
 * which tool it is rendering.
 */
export interface ToolOptionsReport {
  /** Multipart text fields appended after the document itself. */
  fields: Array<[string, string]>;
  /** Extra multipart file parts, e.g. the watermark image. */
  files: Array<[string, File]>;
  /** False while required inputs are still missing. */
  ready: boolean;
  /** Suggested download name (the server's Content-Disposition wins if present). */
  resultName: string;
}

export interface ToolOptionsPanelProps {
  /** The document (or images) selected for processing. */
  file: File;
  /** The selected file name without its extension. */
  baseName: string;
  onChange: (report: ToolOptionsReport) => void;
}

/**
 * Publishes a memoized report up to the tool page. The report must be memoized
 * by the panel so this only fires when one of its inputs actually changes.
 */
export function useOptionsReport(onChange: (report: ToolOptionsReport) => void, report: ToolOptionsReport) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    onChangeRef.current(report);
  }, [report]);
}

/** Turns a page-number array into the comma separated wire format. */
export function formatPageNumbers(pages: number[]): string {
  return pages.join(",");
}

export function baseNameOf(name: string): string {
  return name.replace(/\.[a-z0-9]{1,5}$/i, "");
}
