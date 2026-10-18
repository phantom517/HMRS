"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { ChevronDown, Check, Search, X } from "lucide-react";

export interface CustomSelectOption {
  value: string;
  label: string;
  description?: string;
  badge?: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  searchable?: boolean;
  className?: string;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select an option…",
  label,
  disabled = false,
  searchable = true,
  className = "",
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectId = useId();

  const selectedOption = options.find((opt) => opt.value === value);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen && searchable && options.length > 5) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, searchable, options.length]);

  const filteredOptions =
    searchTerm.trim() === ""
      ? options
      : options.filter(
          (opt) =>
            opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (opt.description &&
              opt.description.toLowerCase().includes(searchTerm.toLowerCase()))
        );

  const shouldShowSearch = searchable && options.length > 5;

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      style={{ minWidth: 0 }}
    >
      {label && (
        <label
          htmlFor={selectId}
          style={{
            display: "block",
            fontSize: 14,
            fontWeight: 500,
            color: "var(--ink)",
            marginBottom: 8,
          }}
        >
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        id={selectId}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            setSearchTerm("");
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        style={{
          width: "100%",
          minHeight: 48,
          padding: "10px 16px",
          borderRadius: 12,
          background: "var(--linen)",
          border: isOpen
            ? "1.5px solid var(--ink)"
            : "1px solid var(--ink-border)",
          fontSize: 15,
          color: selectedOption ? "var(--ink)" : "var(--ink-tertiary)",
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          textAlign: "left",
          transition: "border-color 150ms ease, background-color 150ms ease",
        }}
        onMouseEnter={(e) => {
          if (!disabled && !isOpen) {
            e.currentTarget.style.borderColor = "var(--ink-border-strong)";
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && !isOpen) {
            e.currentTarget.style.borderColor = "var(--ink-border)";
          }
        }}
      >
        <span
          style={{
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontWeight: selectedOption ? 500 : 400,
          }}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          style={{
            width: 18,
            height: 18,
            strokeWidth: 2,
            color: "var(--ink-secondary)",
            flexShrink: 0,
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 180ms ease",
          }}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 100,
            background: "var(--paper)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid var(--ink-border-strong)",
            borderRadius: 14,
            overflow: "hidden",
            maxHeight: 280,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Search box if list is long */}
          {shouldShowSearch && (
            <div
              style={{
                padding: "8px 12px",
                borderBottom: "1px solid var(--ink-border)",
                background: "var(--linen)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Search
                style={{
                  width: 15,
                  height: 15,
                  color: "var(--ink-secondary)",
                  flexShrink: 0,
                }}
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  fontSize: 13.5,
                  color: "var(--ink)",
                  fontFamily: "inherit",
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    color: "var(--ink-secondary)",
                  }}
                >
                  <X style={{ width: 14, height: 14 }} />
                </button>
              )}
            </div>
          )}

          {/* Options list */}
          <div
            role="listbox"
            style={{
              overflowY: "auto",
              padding: 6,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {filteredOptions.length === 0 ? (
              <div
                style={{
                  padding: "16px 12px",
                  fontSize: 13.5,
                  color: "var(--ink-secondary)",
                  textAlign: "center",
                }}
              >
                No matching options found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: isSelected
                        ? "var(--linen)"
                        : "transparent",
                      color: "var(--ink)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      fontSize: 14,
                      transition: "background-color 120ms ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = "var(--linen)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: isSelected ? 500 : 400,
                          color: "var(--ink)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {opt.label}
                      </div>
                      {opt.description && (
                        <div
                          style={{
                            fontSize: 12.5,
                            color: "var(--ink-secondary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {opt.description}
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        flexShrink: 0,
                      }}
                    >
                      {opt.badge && (
                        <span
                          className="ztag ztag-neutral"
                          style={{ fontSize: 11, padding: "2px 8px" }}
                        >
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && (
                        <Check
                          style={{
                            width: 16,
                            height: 16,
                            color: "var(--ink)",
                            strokeWidth: 2,
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
