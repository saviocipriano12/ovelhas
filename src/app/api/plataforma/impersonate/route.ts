import "server-only";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/supabase/platform-auth";

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => null);
  const churchId = typeof body?.churchId === "string" ? body.churchId : null;
  const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId : null;

  if (!churchId || !targetUserId) {
    return NextResponse.json({ error: "Informe a igreja e o administrador." }, { status: 400 });
  }

  const { data: targetProfile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, name, role, church_id")
    .eq("id", targetUserId)
    .maybeSingle();

  if (profileError || !targetProfile) {
    return NextResponse.json({ error: "Administrador nao encontrado." }, { status: 404 });
  }

  if (targetProfile.church_id !== churchId || !["admin", "pastor"].includes(targetProfile.role)) {
    return NextResponse.json({ error: "Este usuario nao e admin ou pastor desta igreja." }, { status: 403 });
  }

  const { data: targetUser, error: targetUserError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
  if (targetUserError || !targetUser.user?.email) {
    return NextResponse.json({ error: "Nao foi possivel localizar o login deste administrador." }, { status: 404 });
  }

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: targetUser.user.email,
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    return NextResponse.json({ error: linkError?.message ?? "Nao foi possivel gerar o acesso." }, { status: 500 });
  }

  const anonClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: sessionData, error: sessionError } = await anonClient.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  });

  if (sessionError || !sessionData.session) {
    return NextResponse.json({ error: sessionError?.message ?? "Nao foi possivel iniciar o acesso." }, { status: 500 });
  }

  await supabaseAdmin.from("platform_audit_log").insert({
    actor_id: auth.userId,
    action: "impersonate",
    target_church_id: churchId,
    details: { target_user_id: targetProfile.id, target_user_name: targetProfile.name },
  });

  return NextResponse.json({
    accessToken: sessionData.session.access_token,
    refreshToken: sessionData.session.refresh_token,
    adminName: targetProfile.name,
  });
}
