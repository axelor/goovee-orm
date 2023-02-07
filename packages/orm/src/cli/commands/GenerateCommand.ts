import fs from "node:fs";
import path from "node:path";

import { spawnSync } from "node:child_process";
import { CommandModule } from "yargs";
import pkg from "../../../package.json";
import { createFile, generateClient } from "../../client/client-generator";

const generateIndex = (outDir: string) => {
  createFile(
    outDir,
    "index.ts",
    `
export * from "./client";
export * from "./models";
`
  );
};

const generatePackageJson = (outDir: string) => {
  const name = "@goovee/cms-client";
  const { version, license, dependencies, devDependencies } = pkg;

  const config = {
    name,
    version,
    license,
    private: true,
    main: "./dist/index.js",
    module: "./dist/index.mjs",
    types: "./dist/index.d.ts",
    scripts: {
      build: "tsup",
      format: 'prettier --write "**/*.{ts,tsx,md}"',
    },
    dependencies: {
      dotenv: dependencies.dotenv,
      typeorm: dependencies.typeorm,
      pg: dependencies.pg,
    },
    peerDependencies: {
      graphql: dependencies.graphql,
    },
    peerDependenciesMeta: {
      graphql: {
        optional: true,
      },
    },
    devDependencies: {
      "@swc/core": devDependencies["@swc/core"],
      "@types/node": devDependencies["@types/node"],
      "@types/pg": devDependencies["@types/pg"],
      prettier: "latest",
      tsup: devDependencies["tsup"],
      typescript: devDependencies["typescript"],
    },
    optionalDependencies: {
      [pkg.name]: "*",
    },
  };

  createFile(outDir, "package.json", config);
};

const generateTsConfig = (outDir: string) => {
  const config = {
    compilerOptions: {
      target: "ESNext",
      module: "CommonJS",
      lib: ["ESNext", "DOM", "DOM.Iterable"],
      noEmit: true,
      composite: false,
      declaration: true,
      declarationMap: true,
      esModuleInterop: true,
      forceConsistentCasingInFileNames: true,
      inlineSources: false,
      isolatedModules: true,
      emitDecoratorMetadata: true,
      experimentalDecorators: true,
      moduleResolution: "node",
      resolveJsonModule: true,
      noUnusedLocals: false,
      noUnusedParameters: false,
      preserveWatchOutput: true,
      skipLibCheck: true,
      strict: true,
    },
    include: ["src"],
    exclude: ["node_modules"],
  };
  createFile(outDir, "tsconfig.json", config);
};

const generateTsUp = (outDir: string) => {
  const config = {
    clean: true,
    dts: true,
    entry: ["src/index.ts", "src/*/index.ts", "src/models/*.ts"],
    format: ["cjs", "esm"],
    sourcemap: true,
  };
  createFile(outDir, "tsup.config.json", config);
};

const npmInstall = (cwd: string) => {
  const proc = spawnSync("npm", ["install"], {
    cwd,
    stdio: "inherit",
    windowsHide: true,
  });
  if (proc.status !== 0) {
    console.error("Unable to install dependencies.");
    process.exit(1);
  }
};

const npmBuild = (cwd: string) => {
  const proc = spawnSync("npm", ["run", "build"], {
    cwd,
    stdio: "inherit",
    windowsHide: true,
  });
  if (proc.status !== 0) {
    console.error("Unable to build client.");
    process.exit(1);
  }
};

const npmFormat = (cwd: string) => {
  const proc = spawnSync("npm", ["run", "format"], {
    cwd,
    windowsHide: true,
  });
  if (proc.status !== 0) {
    console.error("Unable to build client.");
    process.exit(1);
  }
};

const updateDeps = (cwd: string) => {
  const pkgName = "@goovee/cms-client";
  const pkgDir = cwd;
  const pkgFile = path.join(pkgDir, "package.json");
  if (fs.existsSync(pkgFile)) {
    const config = require(pkgFile);
    let { dependencies = {}, optionalDependencies = {} } = config;
    if (dependencies[pkgName] || optionalDependencies[pkgName]) {
      return;
    }
    optionalDependencies[pkgName] = "*";
    createFile(pkgDir, "package.json", {
      ...config,
      optionalDependencies,
    });
  }
};

export const GenerateCommand: CommandModule = {
  command: "generate",
  describe: "Generate entity types and client from the schema",
  handler: (args) => {
    const searchPaths = [
      path.join(".", "src", "goovee", "schema"),
      path.join(".", "goovee", "schema"),
      path.join(".", "schema"),
    ];

    const schemaDir = searchPaths.find((x) => fs.existsSync(x));
    const clientDir = path.join("node_modules", ".goovee", "cms-client");
    const linkDir = path.join("node_modules", "@goovee", "cms-client");
    const srcDir = path.join(clientDir, "src");
    const modelsDir = path.join(srcDir, "models");

    if (!schemaDir || !fs.existsSync(schemaDir)) {
      console.error(`Schema directory doesn't exists`);
      process.exit(1);
    }

    // clean models
    fs.rmSync(modelsDir, { recursive: true, force: true });

    // generate client
    generateClient(schemaDir, srcDir);
    generateIndex(srcDir);
    generatePackageJson(clientDir);
    generateTsConfig(clientDir);
    generateTsUp(clientDir);

    // build
    npmFormat(clientDir);
    npmInstall(clientDir);
    npmBuild(clientDir);

    // add client as an optionalDependencies
    updateDeps(process.cwd());

    // symlink
    if (!fs.existsSync(linkDir)) {
      const linkParent = path.dirname(linkDir);
      fs.mkdirSync(linkParent, { recursive: true });
      fs.symlinkSync(path.relative(linkParent, clientDir), linkDir);
    }
  },
};
