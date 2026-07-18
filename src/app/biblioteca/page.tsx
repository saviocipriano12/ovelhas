"use client";

import NextLink from "next/link";
import { FormEvent, useMemo, useState } from "react";
import jsPDF from "jspdf";
import { Award, BookOpen, Download, FilePlus2, FileText, Link as LinkIcon, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { SectionHeader } from "@/components/section-header";
import { useToast } from "@/components/toast-provider";
import { getScopedPeople } from "@/lib/access-control";
import type { CertificateRecord, LibraryMaterial } from "@/lib/data";
import { roleLabels } from "@/lib/data";
import {
  useCertificates,
  useDiscipleship,
  useLibraryMaterials,
  useLocalPeople,
} from "@/lib/local-store";

function downloadCertificate(certificate: CertificateRecord, personName: string, churchName = "Ovelhas") {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();

  doc.setDrawColor(6, 78, 59);
  doc.setLineWidth(2);
  doc.rect(10, 10, width - 20, height - 20);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(4, 120, 87);
  doc.text(churchName.toUpperCase(), width / 2, 35, { align: "center" });

  doc.setFontSize(36);
  doc.setTextColor(15, 23, 42);
  doc.text("Certificado", width / 2, 55, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.setTextColor(100, 116, 139);
  doc.text("Certificamos que", width / 2, 75, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(6, 78, 59);
  doc.text(personName, width / 2, 92, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.setTextColor(51, 65, 85);
  doc.text(`concluiu a trilha "${certificate.title}" no ${churchName}.`, width / 2, 108, { align: "center" });

  const issuedDate = new Intl.DateTimeFormat("pt-BR").format(new Date(certificate.issuedAt));
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text(issuedDate, width / 2 - 40, height - 30, { align: "center" });
  doc.text("Data", width / 2 - 40, height - 24, { align: "center" });
  doc.text(certificate.issuedByName, width / 2 + 40, height - 30, { align: "center" });
  doc.text("Responsavel", width / 2 + 40, height - 24, { align: "center" });

  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text("Ovelhas by Savio Cipriano", width / 2, height - 14, { align: "center" });

  doc.save(`certificado-${personName.toLowerCase().replaceAll(" ", "-")}.pdf`);
}

function materialIcon(type: LibraryMaterial["materialType"]) {
  if (type === "pdf") return FileText;
  if (type === "link") return LinkIcon;
  if (type === "devotional") return BookOpen;
  return FileText;
}

export default function LibraryPage() {
  const { currentUser, isDemoMode } = useAuth();
  const { people } = useLocalPeople();
  const { tracks } = useDiscipleship();
  const { materials, addMaterial } = useLibraryMaterials(currentUser.churchId);
  const { certificates, issueCertificate } = useCertificates(currentUser.churchId);
  const toast = useToast();
  const visiblePeople = getScopedPeople(currentUser, people, isDemoMode);
  const canManage = currentUser.role === "admin" || currentUser.role === "pastor";
  const canIssue = currentUser.role !== "member";
  const [selectedPersonId, setSelectedPersonId] = useState(visiblePeople[0]?.id ?? "");
  const [selectedTrackId, setSelectedTrackId] = useState(tracks[0]?.id ?? "");
  const visibleMaterials = materials.filter((material) => {
    if (!material.active) return false;
    if (currentUser.role === "member") return material.audience === "member";
    if (currentUser.role === "leader") return material.audience === "member" || material.audience === "leader";
    return true;
  });
  const certificateRows = useMemo(
    () =>
      certificates.map((certificate) => ({
        certificate,
        person: people.find((person) => person.id === certificate.personId),
      })),
    [certificates, people],
  );

  async function handleMaterialSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const result = await addMaterial({
      churchId: currentUser.churchId,
      title: String(formData.get("title") || "").trim(),
      description: String(formData.get("description") || "").trim(),
      materialType: String(formData.get("materialType") || "link") as LibraryMaterial["materialType"],
      url: String(formData.get("url") || "").trim(),
      audience: String(formData.get("audience") || "member") as LibraryMaterial["audience"],
      trackId: String(formData.get("trackId") || "") || undefined,
      createdBy: currentUser.id,
      persistToSupabase: !isDemoMode,
    });

    if (!result.ok) {
      toast.error(`Nao consegui cadastrar material: ${result.error}`);
      return;
    }

    toast.success("Material cadastrado.");
    event.currentTarget.reset();
  }

  async function handleIssueCertificate() {
    const person = visiblePeople.find((item) => item.id === selectedPersonId);
    const track = tracks.find((item) => item.id === selectedTrackId);

    if (!person || !track) {
      toast.error("Escolha pessoa e trilha para emitir certificado.");
      return;
    }

    const result = await issueCertificate({
      churchId: person.churchId,
      personId: person.id,
      trackId: track.id,
      title: track.title,
      issuedBy: currentUser.id,
      issuedByName: currentUser.name,
      persistToSupabase: !isDemoMode,
    });

    if (!result.ok || !result.certificate) {
      toast.error(`Nao consegui emitir certificado: ${result.error}`);
      return;
    }

    toast.success(
      result.alreadyIssued
        ? `${person.name} ja tinha certificado desta trilha. Baixando novamente.`
        : `Certificado emitido para ${person.name}.`,
    );
    downloadCertificate(result.certificate, person.name);
  }

  return (
    <AppShell>
      <section className="animate-enter space-y-5">
        <SectionHeader eyebrow={roleLabels[currentUser.role]} title="Biblioteca e certificados" />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-950 p-4 text-white">
            <BookOpen size={20} className="text-emerald-200" />
            <p className="mt-3 text-2xl font-semibold">{visibleMaterials.length}</p>
            <p className="text-sm text-slate-300">Materiais</p>
          </div>
          <div className="rounded-lg bg-white/90 p-4 shadow-sm">
            <Award size={20} className="text-emerald-700" />
            <p className="mt-3 text-2xl font-semibold text-slate-950">{certificates.length}</p>
            <p className="text-sm text-slate-500">Certificados</p>
          </div>
          <div className="rounded-lg bg-white/90 p-4 shadow-sm">
            <ShieldCheck size={20} className="text-sky-700" />
            <p className="mt-3 text-2xl font-semibold text-slate-950">{tracks.length}</p>
            <p className="text-sm text-slate-500">Trilhas</p>
          </div>
        </div>

        <section className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
          <div className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
            <SectionHeader eyebrow="Materiais" title="Apoio para discipulado" />
            <div className="grid gap-3 md:grid-cols-2">
              {visibleMaterials.map((material) => {
                const Icon = materialIcon(material.materialType);
                return (
                  <a key={material.id} href={material.url} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-50 p-4 hover:bg-white">
                    <Icon size={22} className="text-emerald-700" />
                    <p className="mt-3 font-bold text-slate-950">{material.title}</p>
                    <p className="mt-1 text-sm leading-5 text-slate-500">{material.description}</p>
                    <span className="mt-3 inline-flex rounded-lg bg-white px-2 py-1 text-xs font-bold text-slate-500">{material.audience}</span>
                  </a>
                );
              })}
            </div>
          </div>

          {canIssue && (
            <div className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
              <SectionHeader eyebrow="Certificado" title="Emitir conclusao" />
              <div className="space-y-3">
                <select value={selectedPersonId} onChange={(event) => setSelectedPersonId(event.target.value)} className="min-h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                  {visiblePeople.map((person) => (
                    <option key={person.id} value={person.id}>{person.name}</option>
                  ))}
                </select>
                <select value={selectedTrackId} onChange={(event) => setSelectedTrackId(event.target.value)} className="min-h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                  {tracks.map((track) => (
                    <option key={track.id} value={track.id}>{track.title}</option>
                  ))}
                </select>
                <button onClick={handleIssueCertificate} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-900 px-4 text-sm font-bold text-white">
                  <Award size={18} />
                  Emitir e baixar
                </button>
              </div>
            </div>
          )}
        </section>

        {canManage && (
          <form onSubmit={handleMaterialSubmit} className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
            <SectionHeader eyebrow="Admin" title="Cadastrar material" />
            <div className="grid gap-3 md:grid-cols-2">
              <input name="title" required placeholder="Titulo" className="min-h-12 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500" />
              <input name="url" required placeholder="URL do material" className="min-h-12 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500" />
              <select name="materialType" className="min-h-12 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                <option value="link">Link</option>
                <option value="pdf">PDF</option>
                <option value="video">Video</option>
                <option value="image">Imagem</option>
                <option value="devotional">Devocional</option>
              </select>
              <select name="audience" className="min-h-12 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                <option value="member">Membro</option>
                <option value="leader">Lider</option>
                <option value="leadership">Lideranca</option>
              </select>
              <select name="trackId" className="min-h-12 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 md:col-span-2">
                <option value="">Sem trilha vinculada</option>
                {tracks.map((track) => (
                  <option key={track.id} value={track.id}>{track.title}</option>
                ))}
              </select>
              <textarea name="description" placeholder="Descricao" rows={3} className="resize-none rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-500 md:col-span-2" />
            </div>
            <button className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white">
              <FilePlus2 size={18} />
              Salvar material
            </button>
          </form>
        )}

        <section className="rounded-lg border border-white/80 bg-white/90 p-5 shadow-sm">
          <SectionHeader eyebrow="Historico" title="Certificados emitidos" />
          <div className="space-y-3">
            {certificateRows.map(({ certificate, person }) => (
              <article key={certificate.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-4">
                <span className="min-w-0">
                  {person ? (
                    <NextLink href={`/pessoas/${person.id}`} className="block truncate font-bold text-emerald-800 hover:underline">
                      {person.name}
                    </NextLink>
                  ) : (
                    <span className="block truncate font-bold text-slate-950">Pessoa</span>
                  )}
                  <span className="text-sm text-slate-500">{certificate.title}</span>
                </span>
                <button onClick={() => downloadCertificate(certificate, person?.name ?? "Pessoa")} className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-emerald-700" aria-label="Baixar certificado">
                  <Download size={18} />
                </button>
              </article>
            ))}
          </div>
        </section>
      </section>
    </AppShell>
  );
}
