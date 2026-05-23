-- Suspend access codes temporarily without revoking them.
ALTER TYPE "AccessCredentialStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';
