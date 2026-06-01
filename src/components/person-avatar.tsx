import type { Person } from "@/lib/data";

/* eslint-disable @next/next/no-img-element */

export function PersonAvatar({ person, size = "md" }: { person: Person; size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "h-10 w-10 text-sm",
    md: "h-12 w-12 text-base",
    lg: "h-20 w-20 text-2xl",
  };

  if (person.photoUrl) {
    return (
      <img
        src={person.photoUrl}
        alt={person.name}
        className={`shrink-0 rounded-lg object-cover ${sizes[size]}`}
      />
    );
  }

  return (
    <span className={`flex shrink-0 items-center justify-center rounded-lg font-bold ${sizes[size]} ${person.tone}`}>
      {person.initials}
    </span>
  );
}
