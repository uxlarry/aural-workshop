# Aural Workshop Placeholder Site

This workspace now contains a single Angular application that acts as a
placeholder and launch announcement page for Aural Workshop.

## What Is Included

- One app: `aural-workshop-site`
- Angular Material UI components
- Brand primary color set to `#f6931e`
- Hero section configured to load an image from:
  `apps/aural-workshop-site/public/hero-image.jpg`

## Local Development

```bash
npm install
npx nx run aural-workshop-site:serve
```

The app runs at `http://localhost:4200` by default.

## Build and Test

```bash
npx nx run aural-workshop-site:build
npx nx run aural-workshop-site:vite:test
npx nx run aural-workshop-site:lint
```

## Hero Image

Add your hero image file at:

`apps/aural-workshop-site/public/hero-image.jpg`

If that file is missing, the page still loads with the gradient background,
but no image will be displayed.

[Install Nx Console &raquo;](https://nx.dev/docs/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## 🔗 Learn More

- [Nx Documentation](https://nx.dev/docs)
- [Angular Monorepo Tutorial](https://nx.dev/docs/getting-started/tutorials/angular-monorepo-tutorial)
- [Module Boundaries](https://nx.dev/docs/features/enforce-module-boundaries)
- [Docker Integration](https://nx.dev/docs/guides/nx-release/release-docker-images)
- [Playwright Testing](https://nx.dev/docs/technologies/test-tools/playwright)
- [Vite with Angular](https://nx.dev/docs/technologies/build-tools/vite)
- [Nx Cloud](https://nx.dev/nx-cloud)
- [Releasing Packages](https://nx.dev/docs/features/manage-releases)

## 💬 Community

Join the Nx community:

- [Discord](https://go.nx.dev/community)
- [X (Twitter)](https://twitter.com/nxdevtools)
- [LinkedIn](https://www.linkedin.com/company/nrwl)
- [YouTube](https://www.youtube.com/@nxdevtools)
- [Blog](https://nx.dev/blog)
