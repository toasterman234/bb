import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAgentSessionServices, modelRuntime } = vi.hoisted(() => {
  const modelRuntime = { getModel: vi.fn() };
  return {
    createAgentSessionServices: vi.fn(),
    modelRuntime,
  };
});

vi.mock("@earendil-works/pi-coding-agent", () => ({
  createAgentSessionServices,
}));

import {
  getPiModelRuntime,
  resetPiModelRuntimeForTests,
} from "../model-runtime.js";

describe("Pi bridge model runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPiModelRuntimeForTests();
    createAgentSessionServices.mockResolvedValue({
      diagnostics: [],
      modelRuntime,
    });
  });

  it("loads extension-backed providers through Pi's service factory", async () => {
    await expect(getPiModelRuntime()).resolves.toBe(modelRuntime);

    expect(createAgentSessionServices).toHaveBeenCalledWith({
      cwd: process.cwd(),
    });
  });

  it("shares one extension-aware runtime across model lists and sessions", async () => {
    const first = await getPiModelRuntime();
    const second = await getPiModelRuntime();

    expect(first).toBe(modelRuntime);
    expect(second).toBe(modelRuntime);
    expect(createAgentSessionServices).toHaveBeenCalledOnce();
  });

  it("surfaces non-fatal extension diagnostics without hiding the runtime", async () => {
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    createAgentSessionServices.mockResolvedValueOnce({
      diagnostics: [
        {
          type: "warning",
          message: "CommandCode provider loaded with a warning",
        },
      ],
      modelRuntime,
    });

    await expect(getPiModelRuntime()).resolves.toBe(modelRuntime);

    expect(stderr).toHaveBeenCalledWith(
      "pi bridge: warning: CommandCode provider loaded with a warning\n",
    );
    stderr.mockRestore();
  });

  it("retries service creation after a transient extension load failure", async () => {
    createAgentSessionServices
      .mockRejectedValueOnce(new Error("extension load failed"))
      .mockResolvedValueOnce({ diagnostics: [], modelRuntime });

    await expect(getPiModelRuntime()).rejects.toThrow("extension load failed");
    await expect(getPiModelRuntime()).resolves.toBe(modelRuntime);

    expect(createAgentSessionServices).toHaveBeenCalledTimes(2);
  });
});
