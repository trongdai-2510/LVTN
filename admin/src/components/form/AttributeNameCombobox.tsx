'use client';

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from '@/components/icons';

import { Input } from '@/components/ui/Input';
import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';

export type AttributeNameSuggestion = {
  name: string;
  usage_count: number;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

type SuggestionOption =
  | { type: 'suggestion'; suggestion: AttributeNameSuggestion }
  | { type: 'create'; name: string };

let suggestionCache: AttributeNameSuggestion[] | null = null;
let suggestionRequest: Promise<AttributeNameSuggestion[]> | null = null;

export function AttributeNameCombobox({
  value,
  onChange,
  disabled = false,
  placeholder = 'Tên thông số'
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [suggestions, setSuggestions] = useState<AttributeNameSuggestion[]>(
    () => suggestionCache ?? []
  );
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [fetchFailed, setFetchFailed] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setQuery(value);
    }
  }, [isOpen, value]);

  useEffect(() => {
    let active = true;

    fetchSuggestions()
      .then((items) => {
        if (!active) return;
        setSuggestions(items);
        setFetchFailed(false);
      })
      .catch((error) => {
        console.warn('Cannot load variant attribute name suggestions.', error);
        if (!active) return;
        setFetchFailed(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const normalizedQuery = normalizeName(query.trim());
  const filteredSuggestions = useMemo(() => {
    if (!normalizedQuery) {
      return suggestions;
    }
    return suggestions.filter((suggestion) =>
      normalizeName(suggestion.name).includes(normalizedQuery)
    );
  }, [normalizedQuery, suggestions]);

  const hasExactMatch = useMemo(() => {
    if (!normalizedQuery) return true;
    return suggestions.some((suggestion) => normalizeName(suggestion.name) === normalizedQuery);
  }, [normalizedQuery, suggestions]);

  const options = useMemo<SuggestionOption[]>(() => {
    const nextOptions: SuggestionOption[] = filteredSuggestions.map((suggestion) => ({
      type: 'suggestion',
      suggestion
    }));
    const trimmedQuery = query.trim();
    if (trimmedQuery && !hasExactMatch) {
      nextOptions.push({ type: 'create', name: trimmedQuery });
    }
    return nextOptions;
  }, [filteredSuggestions, hasExactMatch, query]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [normalizedQuery, isOpen]);

  useEffect(() => {
    if (highlightedIndex >= options.length) {
      setHighlightedIndex(Math.max(options.length - 1, 0));
    }
  }, [highlightedIndex, options.length]);

  function openDropdown() {
    if (!disabled && !fetchFailed) {
      setIsOpen(true);
    }
  }

  function commitQuery() {
    onChange(query);
    setIsOpen(false);
  }

  function selectOption(option: SuggestionOption) {
    const nextValue = option.type === 'suggestion' ? option.suggestion.name : option.name;
    setQuery(nextValue);
    onChange(nextValue);
    setIsOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (disabled || fetchFailed) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      openDropdown();
      setHighlightedIndex((current) =>
        options.length === 0 ? 0 : (current + 1) % options.length
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      openDropdown();
      setHighlightedIndex((current) =>
        options.length === 0 ? 0 : (current - 1 + options.length) % options.length
      );
      return;
    }

    if (event.key === 'Enter' && isOpen && options.length > 0) {
      event.preventDefault();
      selectOption(options[highlightedIndex] ?? options[0]);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setQuery(value);
      setIsOpen(false);
    }
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node | null)) {
          commitQuery();
        }
      }}
    >
      <Input
        type="text"
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        onFocus={openDropdown}
        onChange={(event) => {
          const nextQuery = event.target.value;
          setQuery(nextQuery);
          if (fetchFailed) {
            onChange(nextQuery);
          } else {
            setIsOpen(true);
          }
        }}
        onKeyDown={handleKeyDown}
      />

      {isOpen && !disabled && !fetchFailed ? (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-auto rounded-sm border border-border bg-panel py-1 shadow-lg"
        >
          {options.length > 0 ? (
            options.map((option, index) => {
              const active = index === highlightedIndex;
              return (
                <li
                  key={option.type === 'suggestion' ? option.suggestion.name : `create:${option.name}`}
                  role="option"
                  aria-selected={active}
                  className={cn(
                    'flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm text-text',
                    active ? 'bg-blue-50 text-blue-950' : 'hover:bg-muted'
                  )}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    selectOption(option);
                  }}
                >
                  {option.type === 'suggestion' ? (
                    <>
                      <span className="min-w-0 truncate">
                        <HighlightedName name={option.suggestion.name} query={query} />
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        · {option.suggestion.usage_count} SP
                      </span>
                    </>
                  ) : (
                    <span className="flex min-w-0 items-center gap-2 font-medium text-primary">
                      <Plus className="h-4 w-4 shrink-0" />
                      <span className="truncate">Thêm &quot;{option.name}&quot; làm tên mới</span>
                    </span>
                  )}
                </li>
              );
            })
          ) : (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              Không có gợi ý phù hợp.
            </li>
          )}
        </ul>
      ) : null}
    </div>
  );
}

async function fetchSuggestions(): Promise<AttributeNameSuggestion[]> {
  if (suggestionCache) {
    return suggestionCache;
  }

  if (!suggestionRequest) {
    suggestionRequest = apiClient
      .get<{ items: AttributeNameSuggestion[] }>(
        endpoints.songThanh.variantAttributeNameSuggestions
      )
      .then((payload) => {
        suggestionCache = payload.items;
        return payload.items;
      })
      .catch((error) => {
        suggestionRequest = null;
        throw error;
      });
  }

  return suggestionRequest;
}

function HighlightedName({ name, query }: { name: string; query: string }) {
  const range = findMatchRange(name, query);
  if (!range) {
    return <>{name}</>;
  }

  return (
    <>
      {name.slice(0, range.start)}
      <strong className="font-semibold text-text">{name.slice(range.start, range.end)}</strong>
      {name.slice(range.end)}
    </>
  );
}

function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();
}

function findMatchRange(name: string, query: string): { start: number; end: number } | null {
  const normalizedQuery = normalizeName(query.trim());
  if (!normalizedQuery) {
    return null;
  }

  let normalizedName = '';
  const indexMap: number[] = [];

  Array.from(name).forEach((character, index) => {
    const normalizedCharacter = normalizeName(character);
    for (const normalizedPart of Array.from(normalizedCharacter)) {
      normalizedName += normalizedPart;
      indexMap.push(index);
    }
  });

  const matchIndex = normalizedName.indexOf(normalizedQuery);
  if (matchIndex < 0) {
    return null;
  }

  const start = indexMap[matchIndex] ?? 0;
  const end = (indexMap[matchIndex + normalizedQuery.length - 1] ?? start) + 1;
  return { start, end };
}
