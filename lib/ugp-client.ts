/**
 * UGP Platform sync — pushes supplier-collected DPP fields to the real product
 * on app.universalgoods.xyz via the metadata API.
 *
 * Uses the session cookie configured in .env (UG_SESSION_COOKIE, UG_ORG_ID).
 */

const UG_API_URL = process.env.UG_API_URL ?? "https://app.universalgoods.xyz/api/server";

/** Map each engagement field key → UGP product section slug. */
export const FIELD_TO_SECTION: Record<string, string> = {
  // physicalAttributes
  weight: "physicalAttributes",
  dimensions: "physicalAttributes",

  // provenance — manufacturing-site certifications belong with the facility
  manufactureCertificates: "provenance",

  // composition — material-level certs, datasheets, sourcing, renewable %
  materialCertifications: "composition",
  materialDatasheets: "composition",
  sourcingInfo: "composition",
  renewableContentPercentage: "composition",

  // circularity — repair & recycling
  repairGuides: "circularity",
  recyclingInstructions: "circularity",
  recyclingFacilities: "circularity",
  materialRecoveryInfo: "circularity",

  // documentation — user-facing URLs & compliance paperwork
  userManualUrl: "documentation",
  complianceDocuments: "documentation",
  euDeclarationOfConformityUrl: "documentation",
  responsibleSourcingPolicyUrl: "documentation",
};

/** Display title for each section (used when creating a new section). */
export const SECTION_TITLES: Record<string, string> = {
  identification: "Identification",
  physicalAttributes: "Physical Attributes",
  provenance: "Provenance",
  composition: "Composition",
  circularity: "Circularity",
  documentation: "Documentation",
};

export interface SyncResult {
  synced: boolean;
  sectionsUpdated: string[];
  errors: Array<{ section: string; error: string }>;
}

interface SectionDetail {
  slug: string;
  title: string;
  visibility: string;
  data: Record<string, unknown>;
}

function ugHeaders(): Record<string, string> {
  const cookie = process.env.UG_SESSION_COOKIE;
  const orgId = process.env.UG_ORG_ID;
  if (!cookie) throw new Error("UG_SESSION_COOKIE not configured");
  if (!orgId) throw new Error("UG_ORG_ID not configured");
  return {
    "Content-Type": "application/json",
    Cookie: cookie,
    "x-organization-id": orgId,
  };
}

/** Fetch existing section data. Returns null if the section doesn't exist yet. */
async function getSection(productId: string, slug: string): Promise<SectionDetail | null> {
  const res = await fetch(
    `${UG_API_URL}/api/metadata/product/${productId}/detail/${slug}`,
    { headers: ugHeaders() }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${slug}: ${res.status} ${await res.text()}`);
  return (await res.json()) as SectionDetail;
}

/** PUT (create or update) a section. */
async function putSection(
  productId: string,
  slug: string,
  body: { title: string; data: Record<string, unknown>; visibility: string }
): Promise<void> {
  const res = await fetch(
    `${UG_API_URL}/api/metadata/product/${productId}/detail/${slug}`,
    {
      method: "PUT",
      headers: ugHeaders(),
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw new Error(`PUT ${slug}: ${res.status} ${await res.text()}`);
}

/**
 * Push a set of newly-extracted supplier fields to the UGP product.
 * Groups fields by section, reads existing section data, merges the new
 * values in, and PUTs each affected section back to UGP.
 */
export async function pushFieldsToUGP(
  productId: string,
  fieldUpdates: Record<string, string>
): Promise<SyncResult> {
  // Group updates by target section
  const bySection: Record<string, Record<string, string>> = {};
  for (const [key, value] of Object.entries(fieldUpdates)) {
    const slug = FIELD_TO_SECTION[key];
    if (!slug || !value) continue;
    (bySection[slug] ??= {})[key] = value;
  }

  const sectionsUpdated: string[] = [];
  const errors: SyncResult["errors"] = [];

  for (const [slug, updates] of Object.entries(bySection)) {
    try {
      const existing = await getSection(productId, slug);
      const mergedData = { ...(existing?.data ?? {}), ...updates };
      await putSection(productId, slug, {
        title: existing?.title ?? SECTION_TITLES[slug] ?? slug,
        data: mergedData,
        visibility: existing?.visibility ?? "public",
      });
      sectionsUpdated.push(slug);
    } catch (err) {
      errors.push({ section: slug, error: (err as Error).message });
    }
  }

  return {
    synced: sectionsUpdated.length > 0 && errors.length === 0,
    sectionsUpdated,
    errors,
  };
}
