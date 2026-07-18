import "server-only";
import { NextResponse } from "next/server";
import { resend } from "@/lib/resend/client";
import { supabaseAdmin } from "@/lib/supabase/admin";

function isBirthdayWithinDays(birthDate: string | null, days: number): boolean {
  if (!birthDate) return false;
  const parts = birthDate.split("-").map(Number);
  const month = parts[1];
  const day = parts[2];
  if (!month || !day) return false;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(now.getFullYear(), month - 1, day);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  return diffDays >= 0 && diffDays <= days;
}

function buildDigestHtml(input: {
  churchName: string;
  peopleCount: number;
  pendingCareCount: number;
  birthdays: string[];
  appUrl: string;
}) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #0f172a;">
      <h1 style="color:#064e3b; font-size: 20px;">Resumo semanal — ${input.churchName}</h1>
      <p>Aqui esta o que esta acontecendo na sua igreja essa semana:</p>
      <ul>
        <li><strong>${input.peopleCount}</strong> pessoa(s) cadastradas no total</li>
        <li><strong>${input.pendingCareCount}</strong> cuidado(s) pastoral(is) pendente(s)</li>
      </ul>
      ${input.birthdays.length > 0 ? `<p><strong>Aniversariantes dessa semana:</strong> ${input.birthdays.join(", ")}</p>` : ""}
      <p><a href="${input.appUrl}/dashboard" style="color:#064e3b;">Abrir o Ovelhas</a></p>
    </div>
  `;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ovelhas.vercel.app";

  const { data: churches, error: churchesError } = await supabaseAdmin.from("churches").select("id, name");
  if (churchesError || !churches) {
    return NextResponse.json({ error: "Erro ao buscar igrejas." }, { status: 500 });
  }

  let sent = 0;
  const skipped: string[] = [];

  for (const church of churches) {
    const { data: subscription } = await supabaseAdmin
      .from("church_subscriptions")
      .select("status")
      .eq("church_id", church.id)
      .maybeSingle();

    if (subscription && ["canceled", "unpaid", "incomplete_expired"].includes(subscription.status)) {
      continue;
    }

    const { data: leaders } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("church_id", church.id)
      .in("role", ["admin", "pastor"]);

    if (!leaders || leaders.length === 0) {
      continue;
    }

    const [{ data: people }, { data: pendingCare }] = await Promise.all([
      supabaseAdmin.from("people").select("name, birth_date").eq("church_id", church.id),
      supabaseAdmin.from("follow_ups").select("id").eq("church_id", church.id).eq("status", "open"),
    ]);

    const birthdays = (people ?? [])
      .filter((person) => isBirthdayWithinDays(person.birth_date as string | null, 7))
      .map((person) => person.name as string);

    const html = buildDigestHtml({
      churchName: church.name,
      peopleCount: people?.length ?? 0,
      pendingCareCount: pendingCare?.length ?? 0,
      birthdays,
      appUrl,
    });

    for (const leader of leaders) {
      const { data: leaderUser } = await supabaseAdmin.auth.admin.getUserById(leader.id);
      const email = leaderUser.user?.email;
      if (!email) {
        continue;
      }

      const result = await resend.emails.send({
        from: "Ovelhas <onboarding@resend.dev>",
        to: email,
        subject: `Resumo semanal - ${church.name}`,
        html,
      });

      if (!result.error) {
        sent++;
      } else {
        skipped.push(`${church.name}: ${result.error.message}`);
      }
    }
  }

  return NextResponse.json({ sent, skipped });
}
