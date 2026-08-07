import {
  createAgentSessionServices,
  type AgentSessionRuntimeDiagnostic,
  type ModelRuntime,
} from "@earendil-works/pi-coding-agent";

let modelRuntimePromise: Promise<ModelRuntime> | undefined;

function logPiRuntimeDiagnostic(
  diagnostic: AgentSessionRuntimeDiagnostic,
): void {
  process.stderr.write(
    `pi bridge: ${diagnostic.type}: ${diagnostic.message}\n`,
  );
}

async function createPiModelRuntime(): Promise<ModelRuntime> {
  // ModelRuntime.create() restores Pi's built-in/model-store catalog, but it
  // does not discover extensions or apply their pending provider
  // registrations. Build the shared runtime through Pi's service factory so
  // globally installed provider extensions (for example CommandCode and model
  // routers) are registered before bb asks for model/list or opens a thread.
  // The service factory also keeps credential resolution inside Pi, using the
  // same auth.json, models.json, extension config, and environment as the CLI.
  const services = await createAgentSessionServices({ cwd: process.cwd() });
  for (const diagnostic of services.diagnostics) {
    logPiRuntimeDiagnostic(diagnostic);
  }
  return services.modelRuntime;
}

export function getPiModelRuntime(): Promise<ModelRuntime> {
  // Drop the memo if creation fails, otherwise one transient extension/auth
  // load failure is cached for the life of the bridge process and every later
  // model list and session start replays the same rejection until restart.
  modelRuntimePromise ??= createPiModelRuntime().catch((error: unknown) => {
    modelRuntimePromise = undefined;
    throw error;
  });
  return modelRuntimePromise;
}

/** @internal Test seam: reset the per-process shared runtime. */
export function resetPiModelRuntimeForTests(): void {
  modelRuntimePromise = undefined;
}
