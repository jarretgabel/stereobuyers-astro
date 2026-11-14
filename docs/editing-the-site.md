# Editing the StereoBuyers site

Content is edited at **`/admin/`** on the site (for example `https://www.stereobuyers.com/admin/`). Nothing you do there can break the live site until it is published, and every change can be undone.

## One-time setup (done by the site owner)
1. Give the editor a free GitHub account and add them to the repository (**Settings → Collaborators → Add people**, role **Write**).
2. Optional but recommended: require approval before publishing (**Settings → Branches → Add rule for `main` → Require a pull request before merging**). Editors then submit changes for review and the owner approves them.

## Signing in
1. Open `/admin/` and choose **Sign in with GitHub**.
2. Approve the sign-in in the pop-up window.

## What can be edited
| Section | What it covers |
| --- | --- |
| Blog posts | Title, date, image, text |
| Service areas | Area pages (Denver, NYC, …) |
| Brand histories | The history text shown on brand pages |
| Pages | Home, About us, Get a quote, How to sell, Privacy policy, Terms |
| Brand landing pages | The headline and intro on pages such as /krell/ |
| Each brand (Krell, McIntosh, …) | Products: name, type, image, description, specifications, SEO title and description |
| FAQ & press | Questions and answers, press articles |

Page layout, and the text of the Contact, Business to Business, Why Use StereoBuyers and Buying Hi-Fi pages, are not editable here yet; ask a developer. In the Pages text boxes, `###` makes a heading, and a line with `---` starts a new section on the Privacy and Terms pages.

## Making a change
1. Pick a section on the left, then an entry (or **New …** to add one).
2. Edit the fields. Required fields are marked; hints are shown under the label.
3. Choose **Save**. This creates a draft in the **Workflow** tab. The live site is unchanged.
4. When it looks right, move it to **Ready** and then **Publish** (or ask the owner to approve it if approval is required).
5. The site updates by itself within a few minutes.

## Adding a product
1. Open the brand (for example **Krell**) and choose **New product**.
2. Fill in **Product name** (this becomes the page address), **Component type**, **Image**, **Description** and **Specifications**.
3. Fill in the **Search result title** and **description**: this is what Google shows. Keep the title under about 60 characters and the description under about 155.
4. Save, then publish.

## Images
- Upload JPEG images (PNG for logos). Use descriptive file names such as `krell-ksa-200s-power-amplifier.jpg`.
- Smaller, web-sized versions are created automatically when the site is published.

## If something goes wrong
- **Can't sign in:** make sure you accepted the GitHub invitation to the repository.
- **A change looks wrong after publishing:** tell the owner. Every change is a recorded commit on GitHub and can be reverted.
