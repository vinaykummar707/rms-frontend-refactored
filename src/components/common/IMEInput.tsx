import React, { useState, useRef, useImperativeHandle, forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { fetchTransliteration } from "@/shared/utils/transliteration";
import { cn } from "cn";

interface IMEInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  langCode: string;
  value?: string;
  onChange?: (e: any) => void;
  className?: string;
}

export const IMEInput = forwardRef<HTMLInputElement, IMEInputProps>(
  ({ langCode, value = "", onChange, className, ...otherProps }, ref) => {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [cursorIndex, setCursorIndex] = useState<number>(0);
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number>(-1);
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      const selectionStart = e.target.selectionStart || 0;

      if (onChange) onChange(e);
      setCursorIndex(selectionStart);
      setSelectedSuggestionIndex(-1);

      const words = newValue.split(" ");
      let wordStart = 0;
      let wordIndex = -1;

      for (let i = 0; i < words.length; i++) {
        if (
          selectionStart >= wordStart &&
          selectionStart <= wordStart + words[i].length
        ) {
          wordIndex = i;
          break;
        }
        wordStart += words[i].length + 1;
      }

      if (wordIndex === -1 || langCode === "en" || !newValue.trim()) {
        setSuggestions([]);
        return;
      }

      const wordAtCursor = words[wordIndex];

      if (wordAtCursor && wordAtCursor.trim()) {
        const results = await fetchTransliteration(wordAtCursor, langCode);
        setSuggestions([...results, wordAtCursor]);
      } else {
        setSuggestions([]);
      }
    };

    const replaceWordAtCursor = (suggestion: string) => {
      const currentValue = String(value || "");
      const words = currentValue.split(" ");
      let wordStart = 0;
      let wordIndex = -1;

      for (let i = 0; i < words.length; i++) {
        if (
          cursorIndex >= wordStart &&
          cursorIndex <= wordStart + words[i].length
        ) {
          wordIndex = i;
          break;
        }
        wordStart += words[i].length + 1;
      }

      if (wordIndex !== -1) {
        words[wordIndex] = suggestion;
        const newText = words.join(" ");
        const newCursorPos = wordStart + suggestion.length + 1;

        if (onChange) {
          const syntheticEvent = {
            target: { value: newText },
          };
          onChange(syntheticEvent);
        }
        setCursorIndex(newCursorPos);
      }

      setSuggestions([]);
      setSelectedSuggestionIndex(-1);

      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 0);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (suggestions.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedSuggestionIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
          return;
        }

        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedSuggestionIndex((prev) =>
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
          return;
        }

        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          const targetSuggestion =
            selectedSuggestionIndex >= 0
              ? suggestions[selectedSuggestionIndex]
              : suggestions[0];
          replaceWordAtCursor(targetSuggestion);
          return;
        }

        if (e.key === " ") {
          e.preventDefault();
          const targetSuggestion =
            selectedSuggestionIndex >= 0
              ? suggestions[selectedSuggestionIndex]
              : suggestions[0];
          replaceWordAtCursor(targetSuggestion + " ");
          return;
        }

        if (e.key === "Escape") {
          e.preventDefault();
          setSuggestions([]);
          setSelectedSuggestionIndex(-1);
          return;
        }
      }

      if (otherProps.onKeyDown) {
        otherProps.onKeyDown(e);
      }
    };

    return (
      <div className="relative w-full">
        <Input
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className={cn("text-xs h-8 font-medium", className)}
          {...otherProps}
        />
        {suggestions.length > 0 && (
          <div className="absolute left-0 top-full mt-1 w-full z-50 rounded-md border border-border bg-popover p-1 shadow-md text-popover-foreground">
            <ul className="max-h-48 overflow-y-auto text-xs divide-y divide-border/40">
              {suggestions.map((suggestion, index) => (
                <li
                  key={`${suggestion}-${index}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    replaceWordAtCursor(suggestion);
                  }}
                  className={cn(
                    "cursor-pointer px-2.5 py-1.5 rounded-sm select-none transition-colors",
                    index === selectedSuggestionIndex
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }
);

IMEInput.displayName = "IMEInput";
export default IMEInput;

