"use client";

import { FormEvent, useState } from "react";
import { Camera, Info, Save, UserRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { PersonAvatar } from "@/components/person-avatar";
import { SectionHeader } from "@/components/section-header";
import { useToast } from "@/components/toast-provider";
import { roleLabels } from "@/lib/data";
import type { Person } from "@/lib/data";
import { useLocalPeople } from "@/lib/local-store";
import { supabase } from "@/lib/supabase/client";

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Nao consegui ler a imagem."));
    reader.readAsDataURL(file);
  });
}

function fallbackPerson(userName: string, photoUrl?: string): Person {
  return {
    id: "perfil",
    name: userName,
    initials: userName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "O",
    stage: "Usuario",
    status: "Perfil",
    phone: "",
    email: "",
    cell: "",
    leader: "",
    discipleshipLeader: "",
    neighborhood: "",
    firstVisit: "",
    birthday: "--/--",
    progress: 0,
    cellAbsences: 0,
    servicePresent: false,
    tone: "bg-emerald-100 text-emerald-800",
    churchId: "",
    cellId: "",
    createdByUserId: "",
    leaderUserId: "",
    photoUrl,
  };
}

export default function ProfilePage() {
  const { currentUser, isDemoMode } = useAuth();
  const { people, updatePerson } = useLocalPeople();
  const toast = useToast();
  const person = people.find((item) => item.personUserId === currentUser.id || item.id === currentUser.personId);
  const [photoPreview, setPhotoPreview] = useState(person?.photoUrl || "");
  const displayPerson = person ? { ...person, photoUrl: photoPreview || person.photoUrl } : fallbackPerson(currentUser.name, photoPreview);

  async function handlePhotoChange(file?: File | null) {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Escolha uma imagem para a foto do perfil.");
      return;
    }

    if (isDemoMode) {
      if (file.size > 900 * 1024) {
        toast.error("Use uma foto menor que 900 KB para manter o app leve no celular.");
        return;
      }

      try {
        const dataUrl = await readFileAsDataUrl(file);
        setPhotoPreview(dataUrl);
        toast.success("Foto carregada. Toque em salvar para atualizar o perfil.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Nao consegui carregar a foto.");
      }
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Use uma foto menor que 5 MB.");
      return;
    }

    const extension = file.name.split(".").pop() || "jpg";
    const path = `${currentUser.id}/${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("profile-photos").upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error(`Nao consegui enviar a foto: ${uploadError.message}`);
      return;
    }

    const { data } = supabase.storage.from("profile-photos").getPublicUrl(path);
    setPhotoPreview(data.publicUrl);
    toast.success("Foto carregada. Toque em salvar para atualizar o perfil.");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || currentUser.name).trim();
    const phone = String(formData.get("phone") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const birthDate = String(formData.get("birthDate") || "").trim();
    const address = String(formData.get("address") || "").trim();
    const familyPhone = String(formData.get("familyPhone") || "").trim();
    const neighborhood = String(formData.get("neighborhood") || "").trim();

    if (!isDemoMode) {
      const rpcResult = await supabase.rpc("update_my_profile", { profile_name: name });

      if (rpcResult.error) {
        const fallbackResult = await supabase.from("profiles").update({ name }).eq("id", currentUser.id);

        if (fallbackResult.error) {
          toast.error(`Nao consegui salvar seu nome: ${fallbackResult.error.message}`);
          return;
        }
      }
    }

    if (person) {
      const result = await updatePerson(person.id, {
        name,
        phone,
        email,
        birthDate,
        address,
        familyPhone,
        neighborhood,
        photoUrl: photoPreview || person.photoUrl || "",
        persistToSupabase: !isDemoMode,
      });

      if (!result.ok) {
        toast.error(`Nao consegui atualizar seu perfil: ${result.error}`);
        return;
      }

      toast.success("Perfil atualizado.");
      return;
    }

    toast.success("Nome atualizado.");
  }

  return (
    <AppShell>
      <section className="mx-auto max-w-2xl animate-enter space-y-5 pb-6">
        <SectionHeader eyebrow={roleLabels[currentUser.role]} title="Perfil" />

        <section className="rounded-[30px] bg-slate-950 p-5 text-white shadow-xl shadow-slate-900/10">
          <div className="flex items-center gap-4">
            <div className="rounded-[24px] bg-white/10 p-2">
              <PersonAvatar person={displayPerson} size="lg" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase text-emerald-200">Minha conta</p>
              <h1 className="truncate text-2xl font-black">{person?.name || currentUser.name}</h1>
              <p className="mt-1 text-sm font-semibold text-slate-300">{person?.cell || roleLabels[currentUser.role]}</p>
            </div>
          </div>
        </section>

        <form onSubmit={saveProfile} className="native-form rounded-[28px] border border-white/80 bg-white/90 p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
              <UserRound size={20} />
            </span>
            <div>
              <p className="text-xs font-black uppercase text-emerald-700">Dados pessoais</p>
              <h2 className="text-lg font-black text-slate-950">Atualize suas informacoes</h2>
            </div>
          </div>

          {!person && (
            <div className="mb-4 flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">
              <Info size={16} className="mt-0.5 shrink-0" />
              Sua conta ainda nao esta vinculada a um cadastro de pessoa. Por enquanto so o nome pode ser atualizado aqui;
              fale com seu lider para vincular telefone, endereco e foto.
            </div>
          )}

          {person && (
            <label className="mb-4 flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 px-4 text-sm font-black text-emerald-900">
              <Camera size={18} />
              Enviar foto de perfil
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => handlePhotoChange(event.target.files?.[0])}
              />
            </label>
          )}

          <div className="grid gap-3">
            <input name="name" defaultValue={person?.name || currentUser.name} className="field-control" placeholder="Nome completo" />
            {person && (
              <>
                <input name="phone" defaultValue={person.phone} inputMode="tel" className="field-control" placeholder="WhatsApp" />
                <input name="email" defaultValue={person.email} type="email" className="field-control" placeholder="Email" />
                <input name="birthDate" defaultValue={person.birthDate} type="date" className="field-control" aria-label="Data de nascimento" />
                <input name="neighborhood" defaultValue={person.neighborhood} className="field-control" placeholder="Bairro" />
                <input name="address" defaultValue={person.address} className="field-control" placeholder="Endereco completo" />
                <input name="familyPhone" defaultValue={person.familyPhone} inputMode="tel" className="field-control" placeholder="Telefone de familiar" />
              </>
            )}
          </div>

          <button className="primary-action mt-4">
            <Save size={17} />
            Salvar perfil
          </button>
        </form>
      </section>
    </AppShell>
  );
}
