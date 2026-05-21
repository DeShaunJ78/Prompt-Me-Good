import BuildCompanion from "@/components/companion/BuildCompanion";

export default function CenterPanel() {
  return (
    <main className="flex-1 flex flex-col overflow-hidden min-w-0 bg-canvas">
      <BuildCompanion />
    </main>
  );
}
