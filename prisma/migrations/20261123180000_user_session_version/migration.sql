-- Version de session : incrémentée au changement de mot de passe pour révoquer les sessions existantes.
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
