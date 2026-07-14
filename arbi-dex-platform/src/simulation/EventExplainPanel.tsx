import { useSimulatorI18n } from "./useSimulatorI18n";
import { getConditionLabel } from "./conditionLabels";
import type { SimulationLogEvent } from "./simulationViewerTypes";

interface EventExplainPanelProps {
  event: SimulationLogEvent;
  onClose: () => void;
  onJumpToPoint?: () => void;
  isDark: boolean;
  token1Label: string;
  token2Label: string;
}

export function EventExplainPanel({
  event,
  onClose,
  onJumpToPoint,
  isDark,
  token1Label,
  token2Label,
}: EventExplainPanelProps) {
  const { t } = useSimulatorI18n();
  const d = event.detail!;
  const isNoAction = d.decision === "NO ACTION";
  const isBuy = d.decision === "BUY";
  const accent = isNoAction ? "#6B7A8D" : isBuy ? "#10B981" : "#E5383B";

  return (
    <div
      className="rounded mt-1 p-3"
      style={{ backgroundColor: isDark ? "#0A1119" : "#F5F7FA", border: `1px solid ${accent}40` }}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            color: isDark ? "#6B7A8D" : "#5A6A7A",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            fontFamily: "var(--font-mono)",
          }}
        >
          {isNoAction ? t("simulator.explainNo") : t("simulator.explain")}
        </span>
        <button onClick={onClose} style={{ color: isDark ? "#6B7A8D" : "#5A6A7A", fontSize: "14px", lineHeight: 1 }}>
          ×
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        {d.evaluations && d.evaluations.length > 0 && (
          <div className="mb-1">
            {(["toBuy", "toSell"] as const).map((group) => {
              const groupItems = d.evaluations?.filter((item) => item.group === group) ?? [];
              if (groupItems.length === 0) return null;
              return (
                <div key={group} className="mb-2">
                  <div
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      color: isDark ? "#8EA0B5" : "#475569",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: "4px",
                    }}
                  >
                    {group === "toBuy" ? "Условия покупки" : "Условия продажи"}
                  </div>
                  <div className="flex flex-col gap-1">
                    {groupItems.map((item, idx) => (
                      <div
                        key={`${item.id}-${idx}`}
                        className="rounded px-2 py-1"
                        style={{
                          border: `1px solid ${isDark ? "#1E2D40" : "#D1D9E0"}`,
                          backgroundColor: isDark ? "#111722" : "#FFFFFF",
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span style={{ fontSize: "11px", color: isDark ? "#C4CDD8" : "#374151" }}>
                            {getConditionLabel(t, item.id, token1Label, token2Label)}
                          </span>
                          <span
                            style={{
                              fontSize: "11px",
                              fontFamily: "var(--font-mono)",
                              color: item.passed ? "#10B981" : "#E5383B",
                            }}
                          >
                            {item.passed ? "true" : "false"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {[
          [t("simulator.rule"), d.rule],
          [t("simulator.currentValue"), d.currentValue],
          [t("simulator.required"), d.required],
          ["Request price", d.requestPrice],
          ["Executed price", d.executedPrice],
          ["Execution ok", d.executionOk],
          ["Execution delay ms", d.executionDelayMs],
          ["Slippage", d.slippagePct],
          [t("simulator.riskLabel"), d.risk],
          [t("simulator.tradeSize"), d.amount],
          [t("simulator.status"), d.status],
        ]
          .filter(([, v]) => v)
          .map(([label, value]) => (
            <div key={label as string} className="flex items-baseline gap-2">
              <span
                style={{
                  fontSize: "10px",
                  color: isDark ? "#6B7A8D" : "#5A6A7A",
                  minWidth: "90px",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {label}
              </span>
              <span style={{ fontSize: "11px", color: isDark ? "#C4CDD8" : "#374151", fontFamily: "var(--font-mono)" }}>
                {value}
              </span>
            </div>
          ))}
        <div
          className="mt-1 pt-2 flex items-center gap-2"
          style={{ borderTop: `1px solid ${isDark ? "#1E2D40" : "#D1D9E0"}` }}
        >
          <span style={{ fontSize: "10px", color: isDark ? "#6B7A8D" : "#5A6A7A", fontFamily: "var(--font-mono)" }}>
            {t("simulator.decision")}
          </span>
          <span
            className="px-2 py-0.5 rounded text-xs"
            style={{ fontFamily: "var(--font-mono)", fontWeight: 600, backgroundColor: `${accent}20`, color: accent }}
          >
            {d.decision}
          </span>
          {onJumpToPoint && (event.type === "Buy" || event.type === "Sell" || event.type === "Error") && (
            <button
              onClick={onJumpToPoint}
              className="ml-auto px-2 py-0.5 rounded text-xs transition-colors"
              style={{
                fontFamily: "var(--font-mono)",
                border: `1px solid ${isDark ? "#1E2D40" : "#D1D9E0"}`,
                color: isDark ? "#C4CDD8" : "#374151",
              }}
            >
              Перейти к точке
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
