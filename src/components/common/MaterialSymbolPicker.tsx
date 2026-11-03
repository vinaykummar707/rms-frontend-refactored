import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Check, Grid } from "lucide-react";
import {
  ALL_MATERIAL_SYMBOLS,
  type MaterialSymbolItem,
} from "@/config/constants/materialSymbols";
import { cn } from "cn";

interface MaterialSymbolPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIcon?: string;
  onSelectIcon: (iconName: string) => void;
}

const CATEGORIES = [
  "All",
  "Transit",
  "Navigation",
  "Amenities",
  "Alerts",
  "Places",
];

const INITIAL_RENDER_COUNT = 96;
const LOAD_MORE_STEP = 64;

export const MaterialSymbolPicker: React.FC<MaterialSymbolPickerProps> = ({
  open,
  onOpenChange,
  selectedIcon = "",
  onSelectIcon,
}) => {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [visibleCount, setVisibleCount] = useState(INITIAL_RENDER_COUNT);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setVisibleCount(INITIAL_RENDER_COUNT);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearch("");
      setSelectedCategory("All");
    }
  }, [open]);

  const filteredSymbols = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ALL_MATERIAL_SYMBOLS.filter((item: MaterialSymbolItem) => {
      const matchesCategory =
        selectedCategory === "All" || item.category === selectedCategory;
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.label.toLowerCase().includes(q)
      );
    });
  }, [search, selectedCategory]);

  const displayedSymbols = useMemo(() => {
    return filteredSymbols.slice(0, visibleCount);
  }, [filteredSymbols, visibleCount]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 150) {
      if (visibleCount < filteredSymbols.length) {
        setVisibleCount((prev) =>
          Math.min(prev + LOAD_MORE_STEP, filteredSymbols.length)
        );
      }
    }
  };

  const handleSelect = (name: string) => {
    onSelectIcon(name);
    onOpenChange(false);
  };

  const handleClear = () => {
    onSelectIcon("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] p-0 gap-0 overflow-hidden bg-background border-border">
        {/* Header */}
        <DialogHeader className="p-4 pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Grid className="h-5 w-5 text-primary" />
              <DialogTitle className="text-base font-semibold">
                Select Signboard Symbol
              </DialogTitle>
            </div>
            {selectedIcon && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-xs text-destructive hover:bg-destructive/10 h-7 px-2"
              >
                Clear Symbol
              </Button>
            )}
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Search over 4,000 transit icons, arrows, facilities, and destination glyphs.
          </DialogDescription>
        </DialogHeader>

        {/* Search & Category Filter */}
        <div className="p-3 border-b border-border space-y-2.5 bg-muted/30">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search symbols by name (e.g. bus, arrow, train, airport)..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVisibleCount(INITIAL_RENDER_COUNT);
              }}
              className="pl-8 text-xs h-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {CATEGORIES.map((cat) => (
              <Button
                key={cat}
                type="button"
                variant={selectedCategory === cat ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedCategory(cat);
                  setVisibleCount(INITIAL_RENDER_COUNT);
                }}
                className={cn(
                  "h-6 text-[11px] px-2.5 rounded-full shrink-0",
                  selectedCategory === cat
                    ? "font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        {/* Symbols Grid */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="p-3 overflow-y-auto max-h-[380px] min-h-[260px]"
        >
          {displayedSymbols.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Grid className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-xs font-medium">No symbols found</p>
              <p className="text-[11px] opacity-70">
                Try searching with a different keyword or category.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
              {displayedSymbols.map((item) => {
                const isSelected = selectedIcon === item.name;
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => handleSelect(item.name)}
                    className={cn(
                      "group relative flex flex-col items-center justify-center p-2 rounded-lg border transition-all text-center cursor-pointer",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary ring-1 ring-primary shadow-xs"
                        : "border-border/60 hover:border-primary/50 hover:bg-muted/50 text-foreground"
                    )}
                    title={item.label}
                  >
                    <span className="material-symbols-outlined text-2xl leading-none transition-transform group-hover:scale-115">
                      {item.name}
                    </span>
                    <span className="text-[10px] mt-1.5 line-clamp-1 w-full text-muted-foreground font-medium group-hover:text-foreground">
                      {item.label}
                    </span>
                    {isSelected && (
                      <span className="absolute top-1 right-1 h-3.5 w-3.5 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {displayedSymbols.length} of {filteredSymbols.length} symbols
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-7 text-xs"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialSymbolPicker;
