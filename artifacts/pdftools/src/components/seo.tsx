import { useEffect } from "react";

type StructuredData = Record<string, unknown>;

interface SeoProps {
  title: string;
  description: string;
  path?: string;
  structuredData?: StructuredData;
}

function setMeta(attribute: "name" | "property", key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${key}"]`,
  );
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

export function Seo({ title, description, path, structuredData }: SeoProps) {
  useEffect(() => {
    const canonicalPath = path ?? window.location.pathname;
    const canonicalUrl = `${window.location.origin}${canonicalPath}`;

    document.title = title;
    setMeta("name", "description", description);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", canonicalUrl);
    setMeta("property", "og:type", "website");
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:card", "summary");

    let canonical = document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;

    const scriptId = "route-structured-data";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (structuredData) {
      if (!script) {
        script = document.createElement("script");
        script.id = scriptId;
        script.type = "application/ld+json";
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(structuredData);
    } else {
      script?.remove();
    }
  }, [title, description, path, structuredData]);

  return null;
}