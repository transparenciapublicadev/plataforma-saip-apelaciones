-- Authentication generations survive reactivation. Existing JWTs without a
-- signed generation are rejected by the application and require a new login.
ALTER TABLE usuarios
    ADD COLUMN version_autenticacion BIGINT NOT NULL DEFAULT 0
    CONSTRAINT ck_usuario_version_autenticacion CHECK (version_autenticacion >= 0);
