/**
 * Create (or promote) an admin account. Admins can never be created through public signup.
 *   npx ts-node scripts/create-admin.ts "Full Name" admin@example.com 'a-long-passphrase'
 */
import { supabaseAdmin } from "../src/config/supabase";
import { hashPassword } from "../src/utils/password";

async function main() {
  const [name, email, password] = process.argv.slice(2);
  if (!name || !email || !password || password.length < 12) {
    console.error('Usage: ts-node scripts/create-admin.ts "Full Name" email "password (12+ chars)"');
    process.exit(1);
  }
  const lower = email.toLowerCase();
  const password_hash = await hashPassword(password);

  const { data: existing } = await supabaseAdmin.from("users").select("id").eq("email", lower).maybeSingle();
  if (existing) {
    await supabaseAdmin.from("users").update({ role: "ADMIN", password_hash, is_suspended: false }).eq("id", existing.id);
    console.log(`Promoted existing user ${lower} to ADMIN and reset the password.`);
  } else {
    const { error } = await supabaseAdmin.from("users").insert({ full_name: name, email: lower, password_hash, role: "ADMIN", is_verified: true });
    if (error) throw error;
    console.log(`Created ADMIN ${lower}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
