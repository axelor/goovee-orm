# Goovee

Welcome to the **Goovee Portal Mono-Repo** — a centralized repository containing all core packages that power the Goovee platform. This mono-repo is designed for modular development, easy collaboration, and consistent dependency management across multiple Goovee components.

## Packages Overview

All packages can be found in the `packages/` folder. It currently contains the following package:

- [@goovee/orm](https://github.com/axelor/goovee-orm/blob/main/packages/orm) with its [changelog file](https://github.com/axelor/goovee-orm/blob/main/packages/orm/CHANGELOG.md)

## License

This package is made available under the Sustainable Use License.

You may use this software for non-commercial or internal business purposes only.
Commercial use requires a valid Axelor SAS Enterprise License.

See [LICENSE.md](https://github.com/axelor/goovee-orm/blob/main/LICENSE.md) for details.

## Development

Please check out our [CONTRIBUTING.md](https://github.com/axelor/goovee-orm/blob/main/CONTRIBUTING.md) for guidelines.

### Requirements

- `node >= 18.0.0`
- `pnpm >= 9.0.6`

You can use [corepack](https://nodejs.org/api/corepack.html) to install [pnpm](https://pnpm.io/installation).

```
corepack enable
corepack prepare pnpm@latest --activate
```

### Important commands

To build all the packages, run the following command: `pnpm build`
