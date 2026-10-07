import { useRef } from "react";
import { ADMIN_TABS } from "./adminTabConfig";

export default function AdminTabs({ activeTab, onChange, pendingCount = 0 }) {
  const tabButtonsRef = useRef({});

  const focusTab = (index) => {
    const tab = ADMIN_TABS[(index + ADMIN_TABS.length) % ADMIN_TABS.length];
    onChange(tab.id);
    tabButtonsRef.current[tab.id]?.focus();
  };

  const handleKeyDown = (event, index) => {
    const moves = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: ADMIN_TABS.length - 1,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    focusTab(moves[event.key]);
  };

  return (
    <div
      role="tablist"
      aria-label="Admin sections"
      className="sticky top-0 z-10 -mx-1 flex gap-1 overflow-x-auto rounded-xl border border-primary/15 bg-surface-app/95 p-1 shadow-sm backdrop-blur"
    >
      {ADMIN_TABS.map((tab, index) => {
        const selected = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              tabButtonsRef.current[tab.id] = node;
            }}
            type="button"
            role="tab"
            id={`admin-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`admin-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`flex min-w-0 flex-1 flex-col items-center sm:items-start rounded-lg px-3 py-2 text-center sm:px-4 sm:text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              selected
                ? "bg-primary text-on-primary shadow"
                : "text-foreground hover:bg-primary/10 hover:text-heading"
            }`}
          >
            <span className="flex items-center gap-2 font-semibold">
              {tab.label}
              {tab.id === "users" && pendingCount > 0 ? (
                <span
                  className={`rounded-full px-2 text-xs font-bold ${
                    selected ? "bg-on-primary text-primary" : "bg-danger text-white"
                  }`}
                  aria-label={`${pendingCount} pending deletion request${pendingCount === 1 ? "" : "s"}`}
                >
                  {pendingCount}
                </span>
              ) : null}
            </span>
            <span
              className={`hidden text-xs sm:block ${selected ? "text-on-primary/85" : "text-neutral-600"}`}
            >
              {tab.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
