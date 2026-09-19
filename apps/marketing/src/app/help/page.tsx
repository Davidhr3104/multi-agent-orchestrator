import { HOW_TO_USE_MARKETING } from "@helix/help";
import { EngineShell } from "@/components/engine-shell";

export default function HelpPage() {
  const guide = HOW_TO_USE_MARKETING;
  return (
    <EngineShell active="help">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8 lg:px-8">
        <div>
          <h1 className="text-2xl font-medium text-white">{guide.title}</h1>
          <p className="mt-2 text-sm text-[#9CA3AF]">{guide.overview}</p>
        </div>
        <ol className="flex flex-col gap-3">
          {guide.steps.map((step) => (
            <li
              key={step.title}
              className="rounded-xl border border-white/[0.08] bg-[#10131a]/85 p-5 shadow-lg backdrop-blur-sm"
            >
              <h2 className="text-sm font-semibold text-white">{step.title}</h2>
              <p className="mt-2 text-sm text-[#9CA3AF]">{step.body}</p>
            </li>
          ))}
        </ol>
        <p className="text-sm text-[#FBBF24]">{guide.hitlTip}</p>
      </div>
    </EngineShell>
  );
}
