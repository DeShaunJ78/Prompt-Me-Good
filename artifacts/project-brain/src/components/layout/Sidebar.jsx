import { useState } from "react";
import { cn } from "@/lib/utils";
import { useProjectBrain } from "@/context/ProjectBrainContext";
import { useTier } from "@/context/TierContext";
import ArtifactViewer from "@/components/cockpit/ArtifactViewer";
import RepoManager from "@/components/repo/RepoManager";
import FlightRecorder from "@/components/cockpit/FlightRecorder";

const TABS = [
  { id: "spec", label: "Artifacts", icon: "📋", feature: null        },
  { id: "repo", label: "Repo",      icon: "📂", feature: null        },
  { id: "log",  label: "Log",       icon: "🗒️", feature: "flight_recorder" },
];

export default function Sidebar() {
  const { flightLog }  = useProjectBrain();
  const { gate, can }  = useTier();
  const [activeTab, setActiveTab] = useState("spec");

  const hasNewLog = flightLog.length > 0;

  const handleTabClick = (tab) => {
    if (tab.feature && !gate(tab.feature)) return; // opens upgrade modal
    setActiveTab(tab.id);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-panel">
        {TABS.map((tab) => {
          const isLocked = tab.feature && !can(tab.feature);
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab)}
              className={cn(
                "flex-1 relative flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-all",
                activeTab === tab.id
                  ? "text-primary border-b-2 border-primary -mb-px bg-primary/5"
                  : "text-subtle hover:text-body hover:bg-elevated border-b-2 border-transparent -mb-px",
                isLocked && "opacity-60"
              )}
            >
              <span className="text-sm">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              {isLocked && (
                <span className="text-[9px] leading-none text-subtle">🔒</span>
              )}
              {tab.id === "log" && hasNewLog && activeTab !== "log" && !isLocked && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === "spec" && <ArtifactViewer />}
        {activeTab === "repo" && <RepoManager />}
        {activeTab === "log"  && <FlightRecorder />}
      </div>
    </div>
  );
}
