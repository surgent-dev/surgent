import { describe, expect, test } from "bun:test";
import { Project } from "../../src/project/project";
import { Log } from "../../src/util/log";
import { Storage } from "../../src/storage/storage";
import path from "path";
import { tmpdir } from "../fixture/fixture";

Log.init({ print: false });

describe("Project.fromDirectory", () => {
  test("creates a local project with a stable id", async () => {
    await using tmp = await tmpdir();

    const project = await Project.fromDirectory(tmp.path);
    const again = await Project.fromDirectory(tmp.path);

    expect(project).toBeDefined();
    expect(project.id).toBe(again.id);
    expect(project.directory).toBe(tmp.path);
  });
});

describe("Project.discover", () => {
  test("should discover favicon.png in root", async () => {
    await using tmp = await tmpdir();
    const project = await Project.fromDirectory(tmp.path);

    const pngData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await Bun.write(path.join(tmp.path, "favicon.png"), pngData);

    await Project.discover(project);

    const updated = await Storage.read<Project.Info>(["project", project.id]);
    expect(updated.icon).toBeDefined();
    expect(updated.icon?.url).toStartWith("data:");
    expect(updated.icon?.url).toContain("base64");
    expect(updated.icon?.color).toBeUndefined();
  });

  test("should not discover non-image files", async () => {
    await using tmp = await tmpdir();
    const project = await Project.fromDirectory(tmp.path);

    await Bun.write(path.join(tmp.path, "favicon.txt"), "not an image");

    await Project.discover(project);

    const updated = await Storage.read<Project.Info>(["project", project.id]);
    expect(updated.icon).toBeUndefined();
  });
});
