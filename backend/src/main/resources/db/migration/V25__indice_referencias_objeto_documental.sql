CREATE INDEX idx_documentos_objeto_almacenado
    ON documentos (storage_provider, ruta_archivo, id_documento);
