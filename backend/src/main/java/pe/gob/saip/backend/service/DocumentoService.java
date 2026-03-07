package pe.gob.saip.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.gob.saip.backend.model.entity.Documento;
import pe.gob.saip.backend.repository.DocumentoRepository;

import java.util.List;
import java.util.Optional;

@Service
public class DocumentoService {

    private final DocumentoRepository documentoRepository;

    public DocumentoService(DocumentoRepository documentoRepository) {
        this.documentoRepository = documentoRepository;
    }

    @Transactional(readOnly = true)
    public List<Documento> obtenerTodosLosDocumentos() {
        return documentoRepository.findAll();
    }

    @Transactional(readOnly = true)
    public Optional<Documento> obtenerDocumentoPorId(Long id) {
        return documentoRepository.findById(id);
    }

    @Transactional
    public void guardarDocumento(Documento documento) {
        documentoRepository.save(documento);
    }

    @Transactional
    public Documento guardar(Documento documento) {
        return documentoRepository.save(documento);
    }

    @Transactional
    public void eliminarDocumento(Long id) {
        documentoRepository.deleteById(id);
    }
}
