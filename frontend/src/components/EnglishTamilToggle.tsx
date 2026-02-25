import React, { useCallback, useEffect, useMemo, useRef } from "react";
import useLanguageStore from "../store/language";

const MARKER_PREFIX = "§§";
const TRANSLATE_API_URL = "https://translate.googleapis.com/translate_a/single";
const MAX_ENCODED_CHUNK_LENGTH = 1500;
const TRANSLATABLE_ATTRIBUTES = ["placeholder", "title", "aria-label", "alt"] as const;

const originalTextByNode = new WeakMap<Text, string>();
const tamilTranslationCache = new Map<string, string>();

const isTranslatableNode = (node: Text) => {
  const parent = node.parentElement;
  if (!parent) return false;
  if (!node.nodeValue?.trim()) return false;

  const blockedTagNames = ["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"];
  if (blockedTagNames.includes(parent.tagName)) return false;

  if (parent.closest(".notranslate,[translate='no']")) return false;
  return true;
};

const isTranslatableElement = (element: Element) =>
  !element.closest(".notranslate,[translate='no']");

const collectTextNodes = () => {
  const root = document.body;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    const textNode = current as Text;
    if (isTranslatableNode(textNode)) {
      nodes.push(textNode);
    }
    current = walker.nextNode();
  }
  return nodes;
};

const markerForIndex = (index: number) => `${MARKER_PREFIX}${index}${MARKER_PREFIX}`;

const splitIntoChunks = (texts: string[]) => {
  const chunks: string[][] = [];
  let currentChunk: string[] = [];
  let currentChunkLength = 0;

  texts.forEach((text) => {
    const markerOverhead = markerForIndex(currentChunk.length).length + 4;
    const encodedLength = encodeURIComponent(text).length + markerOverhead;

    if (
      currentChunk.length > 0 &&
      currentChunkLength + encodedLength > MAX_ENCODED_CHUNK_LENGTH
    ) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentChunkLength = 0;
    }

    currentChunk.push(text);
    currentChunkLength += encodedLength;
  });

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
};

const parseChunkResponse = (raw: string, expectedCount: number) => {
  const output = Array.from({ length: expectedCount }, () => "");
  const regex = new RegExp(
    `${MARKER_PREFIX}(\\d+)${MARKER_PREFIX}\\s*([\\s\\S]*?)(?=\\n${MARKER_PREFIX}\\d+${MARKER_PREFIX}|$)`,
    "g",
  );

  let match: RegExpExecArray | null = regex.exec(raw);
  while (match) {
    const index = Number(match[1]);
    if (Number.isInteger(index) && index >= 0 && index < output.length) {
      output[index] = match[2].trim();
    }
    match = regex.exec(raw);
  }

  return output;
};

const requestTamilTranslations = async (texts: string[], signal?: AbortSignal) => {
  if (texts.length === 0) return new Map<string, string>();

  const uniqueTexts = Array.from(new Set(texts.map((text) => text.trim()).filter(Boolean)));
  const uncachedTexts = uniqueTexts.filter((text) => !tamilTranslationCache.has(text));

  const chunks = splitIntoChunks(uncachedTexts);
  for (const chunk of chunks) {
    const markedPayload = chunk
      .map((text, index) => `${markerForIndex(index)} ${text}`)
      .join("\n");

    const params = new URLSearchParams();
    params.set("client", "gtx");
    params.set("sl", "en");
    params.set("tl", "ta");
    params.set("dt", "t");
    params.set("q", markedPayload);

    const response = await fetch(`${TRANSLATE_API_URL}?${params.toString()}`, { signal });
    if (!response.ok) {
      throw new Error(`Tamil translation failed: HTTP ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    const segments = Array.isArray(payload) && Array.isArray(payload[0]) ? payload[0] : [];
    const merged = segments
      .map((segment) =>
        Array.isArray(segment) && typeof segment[0] === "string" ? segment[0] : "",
      )
      .join("");

    const translatedTexts = parseChunkResponse(merged, chunk.length);
    chunk.forEach((sourceText, index) => {
      tamilTranslationCache.set(sourceText, translatedTexts[index] || sourceText);
    });
  }

  const out = new Map<string, string>();
  uniqueTexts.forEach((text) => out.set(text, tamilTranslationCache.get(text) || text));
  return out;
};

const restoreEnglishText = () => {
  const textNodes = collectTextNodes();
  textNodes.forEach((textNode) => {
    const original = originalTextByNode.get(textNode);
    if (original !== undefined && textNode.nodeValue !== original) {
      textNode.nodeValue = original;
    }
  });

  const attrSelector = TRANSLATABLE_ATTRIBUTES.map((attr) => `[data-et-orig-${attr}]`).join(",");
  const elements = Array.from(document.querySelectorAll<HTMLElement>(attrSelector));
  elements.forEach((element) => {
    TRANSLATABLE_ATTRIBUTES.forEach((attr) => {
      const key = `etOrig${attr.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())}`;
      const original = (element.dataset as Record<string, string | undefined>)[key];
      if (original !== undefined) {
        element.setAttribute(attr, original);
      }
    });
  });
};

type EnglishTamilToggleProps = {
  className?: string;
};

const EnglishTamilToggle: React.FC<EnglishTamilToggleProps> = ({ className = "mb-4" }) => {
  const { language, setLanguage } = useLanguageStore();
  const mutationDebounceRef = useRef<number | null>(null);
  const translatingRef = useRef(false);
  const observerEnabled = language === "ta";

  const translatePageToTamil = useCallback(async (signal?: AbortSignal) => {
    if (translatingRef.current) return;
    translatingRef.current = true;

    try {
      const textNodes = collectTextNodes();
      const sourceTextByNode = new Map<Text, string>();

      textNodes.forEach((textNode) => {
        const existingOriginal = originalTextByNode.get(textNode);
        if (existingOriginal !== undefined) {
          sourceTextByNode.set(textNode, existingOriginal);
          return;
        }
        const original = textNode.nodeValue ?? "";
        originalTextByNode.set(textNode, original);
        sourceTextByNode.set(textNode, original);
      });

      const attributesToTranslate: Array<{
        element: Element;
        attr: (typeof TRANSLATABLE_ATTRIBUTES)[number];
        original: string;
      }> = [];

      const allElements = Array.from(document.querySelectorAll<HTMLElement>("*")).filter(
        isTranslatableElement,
      );

      allElements.forEach((element) => {
        TRANSLATABLE_ATTRIBUTES.forEach((attr) => {
          const value = element.getAttribute(attr);
          if (!value?.trim()) return;

          const key = `etOrig${attr.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())}`;
          const data = element.dataset as Record<string, string | undefined>;
          if (data[key] === undefined) {
            data[key] = value;
          }

          attributesToTranslate.push({
            element,
            attr,
            original: data[key] || value,
          });
        });
      });

      const allSourceTexts = [
        ...Array.from(sourceTextByNode.values()),
        ...attributesToTranslate.map((entry) => entry.original),
      ];

      const translationMap = await requestTamilTranslations(allSourceTexts, signal);
      if (signal?.aborted) return;

      sourceTextByNode.forEach((source, node) => {
        const translated = translationMap.get(source) || source;
        if (node.nodeValue !== translated) {
          node.nodeValue = translated;
        }
      });

      attributesToTranslate.forEach(({ element, attr, original }) => {
        const translated = translationMap.get(original) || original;
        if (element.getAttribute(attr) !== translated) {
          element.setAttribute(attr, translated);
        }
      });
    } finally {
      translatingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    if (language === "en") {
      restoreEnglishText();
      return () => controller.abort();
    }

    translatePageToTamil(controller.signal).catch(() => {
      // Keep English text if translation service is unavailable.
    });

    return () => controller.abort();
  }, [language, translatePageToTamil]);

  useEffect(() => {
    if (!observerEnabled) return;

    const observer = new MutationObserver(() => {
      if (mutationDebounceRef.current) {
        window.clearTimeout(mutationDebounceRef.current);
      }
      mutationDebounceRef.current = window.setTimeout(() => {
        translatePageToTamil().catch(() => {
          // Keep current state if a dynamic translation attempt fails.
        });
      }, 180);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (mutationDebounceRef.current) {
        window.clearTimeout(mutationDebounceRef.current);
        mutationDebounceRef.current = null;
      }
    };
  }, [observerEnabled, translatePageToTamil]);

  const labels = useMemo(
    () => ({
      en: "English",
      ta: "தமிழ்",
    }),
    [],
  );

  return (
    <div className={`notranslate flex justify-center ${className}`} translate="no">
      <div className="inline-flex items-center gap-1 rounded-full border border-[#90CAF9] bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setLanguage("en")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            language === "en"
              ? "bg-[#F5C518] text-black"
              : "text-[#1565C0] hover:bg-[#E3F2FD]"
          }`}
        >
          {labels.en}
        </button>
        <button
          type="button"
          onClick={() => setLanguage("ta")}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            language === "ta"
              ? "bg-[#F5C518] text-black"
              : "text-[#1565C0] hover:bg-[#E3F2FD]"
          }`}
        >
          {labels.ta}
        </button>
      </div>
    </div>
  );
};

export default EnglishTamilToggle;
