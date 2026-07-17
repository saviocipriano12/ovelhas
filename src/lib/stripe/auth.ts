import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function requireChurchBillingAdmin(request: Request, churchId: string) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");

  if (!token) {
    return { ok: false as const, error: "Nao autenticado.", status: 401 };
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

  if (userError || !userData.user) {
    return { ok: false as const, error: "Sessao invalida.", status: 401 };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("church_id, role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { ok: false as const, error: "Perfil nao encontrado.", status: 403 };
  }

  if (profile.church_id !== churchId || !["admin", "pastor"].includes(profile.role)) {
    return { ok: false as const, error: "Sem permissao para gerenciar a assinatura desta igreja.", status: 403 };
  }

  return { ok: true as const, userId: userData.user.id };
}
