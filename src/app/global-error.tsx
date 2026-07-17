"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        <div style={{ padding: 24, textAlign: "center", fontFamily: "sans-serif" }}>
          <h1>Algo deu errado</h1>
          <p>Ja fomos avisados sobre esse erro. Tente recarregar a pagina.</p>
        </div>
      </body>
    </html>
  );
}
