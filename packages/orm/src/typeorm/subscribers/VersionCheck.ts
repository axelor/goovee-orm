import {
  EntitySubscriberInterface,
  EventSubscriber,
  RemoveEvent,
  UpdateEvent,
} from "typeorm";

@EventSubscriber()
export class VersionCheck implements EntitySubscriberInterface {
  beforeRemove(event: RemoveEvent<any>): void | Promise<any> {
    this.checkVersion(event);
  }

  async beforeUpdate(event: UpdateEvent<any>): Promise<any> {
    this.checkVersion(event);
  }

  async checkVersion(event: UpdateEvent<any> | RemoveEvent<any>) {
    if (event.metadata.versionColumn && event.entity) {
      const id = Reflect.get(event.entity, "id");
      const version = Reflect.get(event.entity, "version") ?? -1;
      const entityType = event.metadata.targetName;
      await event.manager.findOne(entityType, {
        select: ["id", "version"] as any,
        where: { id },
        lock: { mode: "optimistic", version },
      });
    }
  }
}
