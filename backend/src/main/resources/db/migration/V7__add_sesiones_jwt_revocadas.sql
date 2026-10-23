CREATE TABLE sesiones_jwt_revocadas (
    id_usuario BIGINT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    jti VARCHAR(36) NOT NULL,
    expira_en TIMESTAMP WITH TIME ZONE NOT NULL,
    revocada_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_usuario, jti)
);
-- Retain revocations at least until their signed expiration. No cleanup runs yet.
CREATE INDEX idx_sesiones_jwt_revocadas_expira ON sesiones_jwt_revocadas(expira_en);
