import { DataSource, DataSourceOptions } from "typeorm";
import { PostgresDriver } from "./driver/PostgresDriver";
import { GooveeNamingStrategy } from "./naming/GooveeNamingStrategy";

export const createDataSource = (options: DataSourceOptions) => {
  const ds = new DataSource({
    ...options,
    subscribers: [],
    namingStrategy: new GooveeNamingStrategy(),
  });

  ds.driver = new PostgresDriver(ds);

  return ds;
};
