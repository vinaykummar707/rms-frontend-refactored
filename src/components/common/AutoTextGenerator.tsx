import React, { useEffect, useState } from "react";
import { fetchTransliteration } from "@/shared/utils/transliteration";

interface AutoTextGeneratorProps {
  route: any;
  targetLang: string;
  isRouteNumber?: boolean;
  fieldKey?: string;
  text?: string;
  variant?: "select" | "list";
  onSelect: (value: string) => void;
}

interface RouteCombo {
  value: string;
  category: string;
}

const CATEGORY_ORDER = [
  "Route Number",
  "Combined Format",
  "Route + Destination",
  "Source ⇄ Destination",
  "Via",
  "Current Text",
];

function dedupeCombos(combos: RouteCombo[]): RouteCombo[] {
  const seen = new Set<string>();
  return combos.filter((combo) => {
    if (!combo.value || seen.has(combo.value)) return false;
    seen.add(combo.value);
    return true;
  });
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getRouteNumberTokens(route: any): string[] {
  if (!route) return [];

  const splitRoute = Boolean(
    route.splitRoute ?? route.split_route ?? route.is_split_route
  );
  const routeNumber = (route.routeNumber ?? route.route_number ?? "").toString().trim();
  const routeNumber1 = (route.routeNumber1 ?? route.route_number_1 ?? "").toString().trim();
  const routeNumber2 = (route.routeNumber2 ?? route.route_number_2 ?? "").toString().trim();

  const tokens: string[] = [];
  if (splitRoute) {
    if (routeNumber1 && routeNumber2) tokens.push(`${routeNumber1}/${routeNumber2}`);
    if (routeNumber1) tokens.push(routeNumber1);
    if (routeNumber2) tokens.push(routeNumber2);
  } else if (routeNumber) {
    tokens.push(routeNumber);
  }

  return tokens.filter((str, idx, arr) => !!str && arr.indexOf(str) === idx);
}

async function transliterateComboPreservingNumbers(
  combo: string,
  targetLang: string,
  routeNumberTokens: string[]
): Promise<string> {
  if (routeNumberTokens.length === 0) {
    const [result] = await fetchTransliteration(combo, targetLang);
    return result || combo;
  }

  const sortedTokens = [...routeNumberTokens].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(${sortedTokens.map(escapeRegExp).join("|")})`, "g");
  const parts = combo.split(pattern);

  const translatedParts = await Promise.all(
    parts.map(async (part) => {
      if (!part || routeNumberTokens.includes(part)) return part;
      const [result] = await fetchTransliteration(part, targetLang);
      return result || part;
    })
  );

  return translatedParts.join("");
}

function generateCombinations(
  route: any,
  isRouteNumber: boolean = false,
  fieldKey?: string,
  text?: string
): RouteCombo[] {
  if (!route) return [];

  const splitRoute = Boolean(
    route.splitRoute ?? route.split_route ?? route.is_split_route
  );
  const routeNumber = (route.routeNumber ?? route.route_number ?? "").toString().trim();
  const routeNumber1 = (route.routeNumber1 ?? route.route_number_1 ?? "").toString().trim();
  const routeNumber2 = (route.routeNumber2 ?? route.route_number_2 ?? "").toString().trim();
  const sep = route.separation || "-";
  const source = (route.source || "").toString().trim();
  const destination = (route.destination || "").toString().trim();
  const via = (route.via || "").toString().trim();

  if (isRouteNumber) {
    const routeNumberOptions: RouteCombo[] = [];
    if (splitRoute) {
      const combined = routeNumber1 && routeNumber2 ? `${routeNumber1}/${routeNumber2}` : "";

      if (fieldKey === "routeNumber1") {
        if (routeNumber1) routeNumberOptions.push({ value: routeNumber1, category: "Route Number" });
        if (combined) routeNumberOptions.push({ value: combined, category: "Combined Format" });
      } else if (fieldKey === "routeNumber2") {
        if (routeNumber2) routeNumberOptions.push({ value: routeNumber2, category: "Route Number" });
        if (combined) routeNumberOptions.push({ value: combined, category: "Combined Format" });
      } else {
        if (combined) routeNumberOptions.push({ value: combined, category: "Combined Format" });
        if (routeNumber1) routeNumberOptions.push({ value: routeNumber1, category: "Route Number" });
        if (routeNumber2) routeNumberOptions.push({ value: routeNumber2, category: "Route Number" });
      }
    } else {
      if (routeNumber) routeNumberOptions.push({ value: routeNumber, category: "Route Number" });
    }

    if (text && text.trim()) {
      routeNumberOptions.push({ value: text.trim(), category: "Current Text" });
    }

    return dedupeCombos(routeNumberOptions);
  }

  const combos: RouteCombo[] = [];
  const primaryNumber = splitRoute
    ? routeNumber1 && routeNumber2 ? `${routeNumber1}/${routeNumber2}` : routeNumber1 || routeNumber2
    : routeNumber;

  if (source && destination) {
    combos.push({ value: `${source} ${sep} ${destination}`, category: "Source ⇄ Destination" });
    combos.push({ value: `${destination} ${sep} ${source}`, category: "Source ⇄ Destination" });
  }

  if (primaryNumber && destination) {
    combos.push({ value: `${primaryNumber} ${sep} ${destination}`, category: "Route + Destination" });
    combos.push({ value: `${primaryNumber} ${destination}`, category: "Route + Destination" });
  }

  if (primaryNumber && source) {
    combos.push({ value: `${primaryNumber} ${sep} ${source}`, category: "Route + Destination" });
  }

  if (primaryNumber && source && destination) {
    combos.push({ value: `${primaryNumber} ${sep} ${source} ${sep} ${destination}`, category: "Combined Format" });
    combos.push({ value: `${primaryNumber} ${source} ${sep} ${destination}`, category: "Combined Format" });
  }

  if (destination) combos.push({ value: destination, category: "Route + Destination" });
  if (source) combos.push({ value: source, category: "Source ⇄ Destination" });

  if (via) {
    combos.push({ value: `VIA ${via}`, category: "Via" });
    combos.push({ value: via, category: "Via" });
    if (destination) {
      combos.push({ value: `${destination} VIA ${via}`, category: "Via" });
    }
  }

  if (text && text.trim()) {
    combos.push({ value: text.trim(), category: "Current Text" });
  }

  return dedupeCombos(combos);
}

export const AutoTextGenerator: React.FC<AutoTextGeneratorProps> = ({
  route,
  targetLang,
  isRouteNumber = false,
  fieldKey,
  text = "",
  variant: _variant = "list",
  onSelect,
}) => {
  const [suggestions, setSuggestions] = useState<RouteCombo[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const englishCombos = React.useMemo(
    () => generateCombinations(route, isRouteNumber, fieldKey, text),
    [route, isRouteNumber, fieldKey, text]
  );

  useEffect(() => {
    let isMounted = true;

    if (!englishCombos.length) {
      setSuggestions([]);
      return;
    }

    const normalizedLang = (targetLang || "en").toLowerCase().replace(/\d+$/, "");

    if (normalizedLang === "en" || normalizedLang === "english") {
      setSuggestions(englishCombos);
      return;
    }

    setLoading(true);
    const routeNumberTokens = getRouteNumberTokens(route);

    Promise.all(
      englishCombos.map(async (combo) => {
        if (combo.category === "Route Number" || combo.category === "Combined Format") {
          return combo;
        }
        try {
          const translatedValue = await transliterateComboPreservingNumbers(
            combo.value,
            normalizedLang,
            routeNumberTokens
          );
          return { ...combo, value: translatedValue };
        } catch (err) {
          console.error("Transliteration failed for:", combo.value, err);
          return combo;
        }
      })
    ).then((translatedCombos) => {
      if (isMounted) {
        setSuggestions(dedupeCombos(translatedCombos));
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [
    englishCombos,
    route,
    targetLang,
    isRouteNumber,
    fieldKey,
    text,
  ]);

  if (!englishCombos.length && !suggestions.length) return null;

  const groupedSuggestions = CATEGORY_ORDER.map((category) => ({
    category,
    items: suggestions.filter((combo) => combo.category === category),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex flex-col max-h-[360px] overflow-y-auto divide-y divide-border/40 pr-1">
      {loading && (
        <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          Transliterating suggestions...
        </div>
      )}
      {groupedSuggestions.map((group) => (
        <div key={group.category} className="py-1">
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {group.category}
          </div>
          <div className="flex flex-col gap-0.5 px-1">
            {group.items.map((combo, idx) => (
              <button
                key={`${group.category}-${combo.value}-${idx}`}
                type="button"
                onClick={() => onSelect(combo.value)}
                className="w-full text-left px-2.5 py-1.5 text-xs rounded-md text-foreground hover:bg-accent active:bg-accent/80 transition-colors flex items-center justify-between group cursor-pointer"
              >
                <span className="font-medium truncate">{combo.value}</span>
                <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 flex-none ml-2 font-mono">
                  Pick ↵
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
      {!loading && groupedSuggestions.length === 0 && (
        <div className="p-3 text-xs text-muted-foreground text-center">
          No suggestions available. Enter route number, source, or destination first.
        </div>
      )}
    </div>
  );
};

export default AutoTextGenerator;
