import { MessageCircle } from "lucide-react";
import { whatsappLink } from "@/lib/whatsapp";

export function WhatsAppButton({
  phone,
  message,
  label = "WhatsApp",
  className = "",
}: {
  phone: string;
  message: string;
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={whatsappLink(phone, message)}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#25d366] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#1fb65a] ${className}`}
    >
      <MessageCircle size={17} />
      {label}
    </a>
  );
}
