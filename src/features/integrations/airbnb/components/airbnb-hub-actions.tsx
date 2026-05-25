"use client";

import { Download } from "lucide-react";
import { AirbnbSyncStatus } from "@/components/airbnb/airbnb-sync-status";
import { Button } from "@/components/ui/button";

type AirbnbHubActionsProps = {
  canSync: boolean;
  onImportClick: () => void;
  importLabel?: string;
};

/** Acciones compartidas: sync global + abrir import (el drawer vive en el padre). */
export function AirbnbHubActions({
  canSync,
  onImportClick,
  importLabel = "Importar desde Airbnb",
}: AirbnbHubActionsProps) {
  if (!canSync) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <AirbnbSyncStatus canSync={canSync} />
      <Button
        type="button"
        variant="outline"
        onClick={onImportClick}
        className="h-9 rounded-full border-danger/30 px-4 text-danger hover:bg-danger/10 hover:text-danger"
      >
        <Download className="mr-2 h-4 w-4" />
        {importLabel}
      </Button>
    </div>
  );
}
