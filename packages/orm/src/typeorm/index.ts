import { DataSource, DataSourceOptions } from "typeorm";
import { PostgresDriver } from "./driver/PostgresDriver";
import { GooveeNamingStrategy } from "./naming/GooveeNamingStrategy";
import { VersionCheck } from "./subscribers/VersionCheck";

export const createDataSource = (options: DataSourceOptions) => {
  const ds = new DataSource({
    ...options,
    subscribers: [VersionCheck],
    namingStrategy: new GooveeNamingStrategy(),
  });

  ds.driver = new PostgresDriver(ds);

  return ds;
};
