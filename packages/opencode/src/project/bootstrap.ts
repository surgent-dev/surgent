import { File } from "../file";
import { Project } from "./project";
import { Bus } from "../bus";
import { Command } from "../command";
import { Instance } from "./instance";
import { Log } from "../util/log";

export async function InstanceBootstrap() {
  Log.Default.info("bootstrapping", { directory: Instance.directory });

  Bus.subscribe(Command.Event.Executed, async (payload) => {
    if (payload.properties.name === Command.Default.INIT) {
      await Project.setInitialized(Instance.project.id);
    }
  });
}
