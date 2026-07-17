import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function requirePlatformAdmin(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");

  if (!token) {
    return { ok: false as const, error: "Nao autenticado.", status: 401 };
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

  if (userError || !userData.user) {
    return { ok: false as const, error: "Sessao invalida.", status: 401 };
  }

  const { data: platformAdmin, error: platformAdminError } = await supabaseAdmin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (platformAdminError || !platformAdmin) {
    return { ok: false as const, error: "Acesso restrito ao admin geral da plataforma.", status: 403 };
  }

  return { ok: true as const, userId: userData.user.id };
}
