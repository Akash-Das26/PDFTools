import { useListTools } from "@workspace/api-client-react";
import type { Tool } from "@workspace/api-client-react";

/**
 * Catalog access.
 *
 * `/api/tools` is the single source of truth for the 32 tools, their landing
 * category, accent token, workspace template and wire status. Nothing in the
 * web app re-declares a tool, so the landing badges, the section contents and
 * the workspace pages can never disagree with each other.
 */
export function useToolCatalog(): {
  tools: Tool[];
  isLoading: boolean;
  isError: boolean;
} {
  const { data, isPending, isError } = useListTools();
  return {
    tools: data ?? [],
    isLoading: isPending,
    isError,
  };
}

export function useTool(toolId: string | undefined): {
  tool: Tool | undefined;
  isLoading: boolean;
} {
  const { tools, isLoading } = useToolCatalog();
  return { tool: tools.find((entry) => entry.id === toolId), isLoading };
}

/**
 * Search matching, following the reference markup: each card carries
 * `data-title` and `data-keywords`, and the inline search matches on name,
 * description and those synonyms. That is why "shrink" finds Compress and
 * "bates" finds Add Page Numbers.
 */
function matchesQuery(tool: Tool, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  const haystack = [tool.name, tool.description, ...(tool.keywords ?? [])]
    .join(" ")
    .toLowerCase();

  return needle.split(/\s+/).every((token) => haystack.includes(token));
}

export function filterTools(tools: Tool[], query: string): Tool[] {
  return tools.filter((tool) => matchesQuery(tool, query));
}
