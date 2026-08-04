const CUSTOMER_TABLE = "customer_profile";
const SOURCE_TABLES = ["contact_request", "quote_request"];

function normalizeName(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("vi-VN");
}

function normalizePhone(value) {
  return String(value ?? "").replace(/[^0-9+]+/g, "");
}

function normalizeEmail(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function sameIdentity(profile, source) {
  if (normalizeName(profile.full_name) !== normalizeName(source.full_name))
    return false;

  const phone = normalizePhone(source.phone);
  const email = normalizeEmail(source.email);
  return Boolean(
    (phone && normalizePhone(profile.phone) === phone) ||
    (email && normalizeEmail(profile.email) === email),
  );
}

/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  await knex.transaction(async (trx) => {
    const profiles = await trx(CUSTOMER_TABLE)
      .select(
        "id",
        "full_name",
        "phone",
        "email",
        "company_name",
        "deleted_at",
        "created_at",
      )
      .orderByRaw("CASE WHEN deleted_at IS NULL THEN 0 ELSE 1 END ASC")
      .orderBy("created_at", "asc");

    for (const tableName of SOURCE_TABLES) {
      const sources = await trx(tableName)
        .select(
          "id",
          "customer_id",
          "full_name",
          "phone",
          "email",
          "company_name",
        )
        .whereNull("deleted_at")
        .whereNotIn("status", ["spam", "invalid"])
        .whereNot("full_name", "ilike", "QA %")
        .where((builder) => {
          builder
            .whereNull("email")
            .orWhereNot("email", "ilike", "qa-%@example.com");
        })
        .orderBy("created_at", "asc");

      for (const source of sources) {
        let profile = profiles.find((candidate) =>
          sameIdentity(candidate, source),
        );

        if (!profile) {
          const [created] = await trx(CUSTOMER_TABLE)
            .insert({
              full_name: String(source.full_name).trim(),
              phone: String(source.phone ?? "").trim() || null,
              email: normalizeEmail(source.email) || null,
              company_name: String(source.company_name ?? "").trim() || null,
            })
            .returning([
              "id",
              "full_name",
              "phone",
              "email",
              "company_name",
              "deleted_at",
              "created_at",
            ]);
          profile = created;
          profiles.push(created);
        } else if (profile.deleted_at) {
          await trx(CUSTOMER_TABLE)
            .where({ id: profile.id })
            .update({ deleted_at: null });
          profile.deleted_at = null;
        }

        if (source.customer_id !== profile.id) {
          await trx(tableName)
            .where({ id: source.id })
            .update({ customer_id: profile.id });
        }
      }
    }
  });
};

/**
 * This migration repairs business links and intentionally has no automatic down migration.
 * Re-merging customer profiles would recreate the incorrect identity associations.
 */
exports.down = async function down() {};
