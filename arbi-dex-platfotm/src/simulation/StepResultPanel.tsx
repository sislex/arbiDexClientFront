import type { EngineConditionEvaluation } from "./engineConditionTypes";
import { useSimulatorI18n } from "./useSimulatorI18n";
import { getConditionLabel } from "./conditionLabels";
import type { SimulationLogEvent } from "./simulationViewerTypes";

interface StepResultPanelProps {
  event: SimulationLogEvent | null;
  isDark: boolean;
  token1Label: string;
  token2Label: string;
}

export function StepResultPanel({
  event,
  isDark,
  token1Label,
  token2Label,
}: StepResultPanelProps) {
  const { t } = useSimulatorI18n();
  if (!event?.detail?.evaluations || event.detail.evaluations.length === 0) return null;

  const groups = (["toBuy", "toSell"] as const).map((group) => ({
    group,
    items: event.detail!.evaluations!.filter((item: EngineConditionEvaluation) => item.group === group),
  }));

  return (
    <div className="mx-2.5 mt-2 mb-2">
      {groups.map(({ group, items }) => {
        if (items.length === 0) return null;
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
              {items.map((item, idx) => (
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
                  {(item.current || item.required) && (
                    <div
                      className="mt-0.5 flex items-center gap-2"
                      style={{
                        fontSize: "10px",
                        color: isDark ? "#6B7A8D" : "#5A6A7A",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {item.current && <span>{item.current}</span>}
                      {item.required && <span>req: {item.required}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
