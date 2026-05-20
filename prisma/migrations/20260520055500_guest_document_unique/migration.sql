CREATE UNIQUE INDEX "reservation_guests_reservationId_documentNumber_key"
  ON "reservation_guests"("reservationId", "documentNumber");
