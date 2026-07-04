# Yellow Rose BBQ - Sausage Prep Tool

A mobile-first, high-contrast, kitchen-line-optimized productivity tool and recipe calculator. Designed for elbow-tap interactions during production.

## Features

- **Dynamic Ratio Scaling**: Drag the slider or use the helper tap buttons to scale the recipe from 5 lbs to 150 lbs.
- **Link & Twists Predictor**: Predict total stuffed weight, total expected links, total twists, and twisting runs automatically.
- **Day-split Workflow Checklist**: Day 1 and Day 2 checklists with striking success states (green highlighting) and large tap targets.
- **Live Synchronized Sessions**: Syncs in real time with a public key-value store. Share the URL with others (e.g. owners) so they can monitor step progress in real time.
- **Pitmaster Speed Run**: Prominent shortcut button to complete Day 1 and prep steps instantly.

## How to Set Up Your Custom Subdomain

To tie this app to a custom subdomain (e.g. `sausage.allen.tools`):

1. **Create/Edit the `CNAME` file**:
   Create a file named `CNAME` in the root of this repository and write your custom domain inside it (with no `http://` or `/`). E.g.
   ```text
   sausage.allen.tools
   ```
2. **Configure DNS Records**:
   In your domain registrar (where you manage `allen.tools`):
   - Add a new **CNAME** record:
     - **Host/Name**: `sausage` (or whatever subdomain you want)
     - **Target/Value**: `your-github-username.github.io`

<!-- Triggering rebuild after DNS fix -->
3. **Enable GitHub Pages**:
   - Go to your GitHub Repository Settings.
   - Go to the **Pages** section in the sidebar.
   - Set the source branch to `main` (or your default branch) and folder to `/ (root)`.
   - Ensure the Custom Domain field displays your subdomain and save.
   - Enable **Enforce HTTPS**.
