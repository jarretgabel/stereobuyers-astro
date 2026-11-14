# AWS hosting for www.stereobuyers.com

One CDK stack (`lib/site-stack.ts`, deployed to **us-east-1** so the CloudFront cert can live in the same stack):

- Private S3 bucket (block public access, SSE-S3, versioned, TLS-only, retained on stack delete) behind CloudFront with Origin Access Control.
- CloudFront: aliases `www.` + apex, HTTP/2+3, Brotli/gzip, HTTP→HTTPS, `/index.html` default root.
- Cache policies: `/_astro/*` (hashed) 1 year; `/assets/media/*` 30 days; everything else (HTML, CSS, JS, sitemap.xml, robots.txt, llms.txt) 5 min.
- Response headers: HSTS (1y, includeSubdomains), `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`. **No CSP** on purpose: the site uses many third-party inline scripts and a CSP would break them.
- Viewer-request CloudFront Function + KeyValueStore (`functions/viewer-request.js`, data in `generated/redirect-kvs.json`).
- GitHub OIDC provider + least-privilege deploy role (S3 list/put/delete on the bucket, `cloudfront:CreateInvalidation` on the distribution), limited to `refs/heads/<branch>` of your repo.
- Custom 404: wired to `/404.html` (403/404 → 404 status) **only if `dist/404.html` exists at synth time**. **TODO:** the site currently has no 404 page; add `src/pages/404.astro`, rebuild, redeploy the stack.

## Context options (`cdk deploy -c key=value`)

| key | default | meaning |
|---|---|---|
| `domainName` | `stereobuyers.com` | apex; site served on `www.` + apex |
| `manageDns` | `true` | `false` = no zone lookup/cert/records (DNS elsewhere) |
| `certificateArn` | – | existing **us-east-1** ACM cert covering www + apex (with `manageDns=false`). If absent, no aliases are attached (only the `*.cloudfront.net` domain works) |
| `githubOwner`, `githubRepo` | – | both required to create the deploy role |
| `githubBranch` | `main` | branch allowed to assume the role |
| `githubOidcProviderArn` | – | reuse the account's existing GitHub OIDC provider (only one per account is allowed) |

## Runbook

```sh
cd infra && npm install
npm test                                  # function unit tests
npx cdk bootstrap aws://<account>/us-east-1   # once per account/region
npm run synth -- -c githubOwner=<owner> -c githubRepo=<repo>
npm run deploy -- -c githubOwner=<owner> -c githubRepo=<repo> [-c manageDns=false -c certificateArn=...]
```

`npm run generate` rebuilds `generated/redirect-kvs.json` from `migration/urls.txt` (or `node scripts/generate-redirect-data.mjs --dist ../dist`). Re-run and redeploy the stack whenever pages are added/removed (the KVS only affects extension-less and `/foo.html` URLs; normal pages work without it).

After deploy, set GitHub repository **variables**: `AWS_ROLE_ARN` (output `DeployRoleArn`), `S3_BUCKET` (`BucketName`), `CLOUDFRONT_DISTRIBUTION_ID` (`DistributionId`), optional `AWS_REGION`. Pushes to `main` then build, sync (`_astro` with `immutable`, media 30 days, the rest with 5‑min cache, deleting removed files) and invalidate `/*`. If DNS validation is manual (`manageDns=false`), request the cert first in us-east-1 and validate it at your DNS host.

### DNS cutover checklist

1. 24–48h ahead: lower TTLs on apex/www records at the current DNS host (e.g. 60s).
2. Deploy the stack, run the deploy workflow once (or `workflow_dispatch`).
3. Verify on `https://<id>.cloudfront.net` (`curl -I`): `/`, `/about/`, `/about` (→301 `/about/`), a product `.html` page, `/assets/css/main.css` (5 min), `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/feedback/`. Test with the real hostname before DNS moves: `curl -I --resolve www.stereobuyers.com:443:<cloudfront-ip> https://www.stereobuyers.com/` (requires aliases + cert attached). Note the apex→www redirect only triggers on the alias hostnames.
4. Switch DNS: with `manageDns=true` the stack creates A/AAAA alias records for www and apex (delete/replace conflicting existing records in the zone first; if the registrar's nameservers aren't Route 53, point them at the zone). Otherwise CNAME `www` → distribution domain and ALIAS/ANAME the apex.
5. Watch for 403/5xx, check Search Console for redirect/crawl errors; raise TTLs afterwards.

### Rollback

Point DNS back to Netlify (kept untouched until you're confident; low TTL makes this fast). For a bad content deploy: revert the commit on `main` (the workflow redeploys), or restore previous object versions (bucket is versioned) and invalidate `/*`. For a bad function change: redeploy the previous stack revision.

## Redirect decisions (`functions/viewer-request.js`)

| rule | decision |
|---|---|
| apex → www | 301 to `https://www.stereobuyers.com` keeping path + query (single hop together with other redirects). Old `.htaccess` did the reverse (www→apex); superseded: canonical is www. |
| `/feedback/` (Netlify `_redirects`) | ported, also matches `/feedback`; → `https://g.page/r/Cc3QI0XLBTnOEAg/review` (301; Netlify default was 301). |
| `/stereo-equipment-and-components-we-buy/davore-fidelity/*` (Netlify) | ported → `/devore-fidelity/:splat`, 301. |
| `/meet-the-stereo-buyers/` → `/about/` | ported (`sb-htaccess`; `/about/` exists). |
| `/m/how-to-sell-…/`, `/mobile/how-to-sell-…/` → `/how-to-sell-…/` | ported (target exists in urls.txt). |
| `get-a-quote.html`, `privacy-policy.html`, `stereo-equipment-and-components-we-buy.html` → directory | ported as the generic rule "`/foo.html` → `/foo/` when only the directory page exists" (the original Apache lines lacked a leading `/`). |
| root brand redirects (`/audio-research/`, `/krell/`, `/mcintosh/`, … → `/stereo-equipment-and-components-we-buy/`) | **not ported**: these are real pages on the current Jekyll site and in `urls.txt`; redirecting would remove them. |
| `.html` → extension-less (Apache rule) | **not ported**: opposite of the new site, whose canonical product URLs keep `.html`. |
| no-slash → slash (Apache rule) | replaced by data-driven rule: extension-less path → `/dir/` if a directory page exists (or both exist), else `.html` if only a file page exists, else passed through (origin 404). |
| `/dir/` → `/dir/index.html` | internal rewrite (no redirect). |
| Apache gzip/expires | replaced by CloudFront compression and cache policies. |

## Assumptions / caveats

- Hosted zone `stereobuyers.com` is in the deploying account if `manageDns=true`; the lookup needs AWS credentials at synth.
- `/assets/css` and `/assets/js` have stable names, so they use the 5‑minute cache; only `/_astro/*` (hashed) is immutable.
- Query strings are not forwarded to S3 or part of the cache key.
- Deploy role may only be assumed from the configured branch (`workflow_dispatch` on `main` included); the CDK stack itself is deployed manually, not by the workflow.
- Bucket has `RETAIN`; delete it manually if the stack is destroyed.
