import bcrypt from "bcryptjs";
import postgres from "postgres";
import { chunkText, estimateTokens } from "../src/lib/ai/chunking";
import { embedText } from "../src/lib/ai/embeddings";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://enterprise_ai:enterprise_ai@localhost:5432/enterprise_ai_os";

const sql = postgres(databaseUrl, { max: 1 });

const organizationId = "11111111-1111-4111-8111-111111111111";
const adminId = "22222222-2222-4222-8222-222222222222";
const memberId = "33333333-3333-4333-8333-333333333333";
const viewerId = "44444444-4444-4444-8444-444444444444";

const docs = [
  {
    title: "Q2 Revenue and Risk Review",
    mimeType: "text/markdown",
    text: "Q2 revenue grew 18.4 percent quarter over quarter. Key risks include procurement delays, account concentration, and increasing cloud inference cost. Recommended actions include executive renewal owners, self-serve onboarding, and model-call cost caps.",
  },
  {
    title: "Security and AI Tooling Policy",
    mimeType: "text/markdown",
    text: "High-risk actions such as sending email, creating public issues, changing calendar invites, or exporting documents require human approval. Prompt injection warnings, tool logs, and retrieval citations must be visible to administrators.",
  },
];

function vectorLiteral(values: number[]) {
  return `[${values.join(",")}]`;
}

async function main() {
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;

  await sql`
    INSERT INTO organizations (id, name, slug)
    VALUES (${organizationId}, 'NovaWorks Enterprise', 'novaworks')
    ON CONFLICT (slug) DO NOTHING
  `;

  const adminHash = await bcrypt.hash("admin123", 10);
  const memberHash = await bcrypt.hash("member123", 10);
  const viewerHash = await bcrypt.hash("viewer123", 10);

  await sql`
    INSERT INTO users (id, email, name, password_hash, avatar)
    VALUES
      (${adminId}, 'admin@novaworks.ai', 'Ava Chen', ${adminHash}, 'AC'),
      (${memberId}, 'member@novaworks.ai', 'Marcus Lee', ${memberHash}, 'ML'),
      (${viewerId}, 'viewer@novaworks.ai', 'Priya Shah', ${viewerHash}, 'PS')
    ON CONFLICT (email) DO NOTHING
  `;

  await sql`
    INSERT INTO memberships (organization_id, user_id, role)
    VALUES
      (${organizationId}, ${adminId}, 'admin'),
      (${organizationId}, ${memberId}, 'member'),
      (${organizationId}, ${viewerId}, 'viewer')
    ON CONFLICT DO NOTHING
  `;

  for (const doc of docs) {
    const [inserted] = await sql<{ id: string }[]>`
      INSERT INTO documents (organization_id, uploaded_by_id, title, source_type, mime_type, summary)
      VALUES (${organizationId}, ${adminId}, ${doc.title}, 'seed', ${doc.mimeType}, ${doc.text.slice(0, 220)})
      RETURNING id
    `;

    const chunkTexts = chunkText(doc.text);
    for (let index = 0; index < chunkTexts.length; index += 1) {
      const content = chunkTexts[index];
      await sql`
        INSERT INTO document_chunks (
          organization_id,
          document_id,
          chunk_index,
          content,
          embedding,
          token_count
        )
        VALUES (
          ${organizationId},
          ${inserted.id},
          ${index},
          ${content},
          ${vectorLiteral(embedText(content))}::vector,
          ${estimateTokens(content)}
        )
      `;
    }
  }

  await sql`
    INSERT INTO audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
    VALUES (${organizationId}, ${adminId}, 'database.seeded', 'organization', ${organizationId}, '{"source":"scripts/seed.ts"}')
  `;

  await sql.end();
  console.log("Seeded Enterprise AI OS demo database.");
}

main().catch(async (error) => {
  await sql.end();
  console.error(error);
  process.exit(1);
});
