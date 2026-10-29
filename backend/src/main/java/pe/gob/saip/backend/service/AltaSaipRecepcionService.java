package pe.gob.saip.backend.service;

import java.io.*;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import jakarta.persistence.EntityManager;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import pe.gob.saip.backend.config.StorageProperties;
import pe.gob.saip.backend.exception.*;
import pe.gob.saip.backend.model.dto.*;
import pe.gob.saip.backend.model.entity.*;
import pe.gob.saip.backend.repository.*;
import pe.gob.saip.backend.storage.StorageException;

/** One DB transaction for creation, receipt and exact files, using existing storage compensation. */
@Service
public class AltaSaipRecepcionService {
    private final SolicitudService solicitudes;
    private final AltaSaipRecepcionRepository recepciones;
    private final CiudadanoRepository ciudadanos;
    private final EntidadRepository entidades;
    private final DocumentoService documentos;
    private final AutorizacionRecursosService autorizacion;
    private final EntityManager em;
    private final long maxFileSize;

    public AltaSaipRecepcionService(SolicitudService solicitudes, AltaSaipRecepcionRepository recepciones,
            CiudadanoRepository ciudadanos, EntidadRepository entidades, DocumentoService documentos,
            AutorizacionRecursosService autorizacion, EntityManager em, StorageProperties properties) {
        this.solicitudes=solicitudes;this.recepciones=recepciones;this.ciudadanos=ciudadanos;this.entidades=entidades;
        this.documentos=documentos;this.autorizacion=autorizacion;this.em=em;this.maxFileSize=properties.getMaxFileSize();
    }

    @Transactional
    public AltaSaipRecepcionDTO registrar(RegistrarAltaSaipRequest request) {
        Usuario actor=actorCiudadano();
        List<MultipartFile> files=request.archivos()==null ? List.of() : request.archivos();
        List<String> tipos=request.tiposDocumento()==null ? List.of() : request.tiposDocumento();
        if (tipos.size()!=files.size() || tipos.stream().anyMatch(t -> t==null || !Set.of("SOLICITUD_ORIGINAL","DOCUMENTO_ADJUNTO").contains(t)))
            throw new IllegalArgumentException("Identifique el tipo permitido de cada archivo seleccionado");
        List<Archivo> manifest=new ArrayList<>();
        String huella=huella(actor.getIdUsuario(),request,files,tipos,manifest);
        // No request row exists yet. Share the transaction-scoped creation/numbering lock with legacy creation.
        solicitudes.bloquearAlta();
        var anterior=recepciones.findByClaveOperacion(request.claveOperacion().toString());
        if(anterior.isPresent()) {
            verificarActor(anterior.get(),actor);
            if(!huella.equals(anterior.get().getHuellaSolicitud()))
                throw new ConflictoEstadoException("La clave de operación ya tiene otro contenido recibido");
            return dto(anterior.get());
        }
        if(!Boolean.TRUE.equals(request.consentimientoDatosPersonales()) || !Boolean.TRUE.equals(request.declaraVeracidad()))
            throw new IllegalArgumentException("Acepte el tratamiento de datos y la declaración de veracidad");
        if(!Boolean.TRUE.equals(request.formatoDigital()) && !Boolean.TRUE.equals(request.formatoFisico()))
            throw new IllegalArgumentException("Seleccione una modalidad de entrega");
        Ciudadano ciudadano=ciudadanos.findById(actor.getIdUsuario()).orElseThrow(() -> new AccessDeniedException("No existe un ciudadano para esta identidad"));
        Entidad entidad=entidades.findById(request.entidadId()).orElseThrow(() -> new RecursoNoEncontradoException("Entidad no encontrada"));
        if(!"Activa".equalsIgnoreCase(entidad.getEstado())) throw new ConflictoEstadoException("La entidad seleccionada no está activa");
        Solicitud s=new Solicitud();s.setCiudadano(ciudadano);s.setEntidad(entidad);
        s.setAsunto(request.asunto().trim());s.setDescripcion(request.descripcion().trim());s.setTipoInformacion(texto(request.tipoInformacion()));
        s.setFormatoDigital(request.formatoDigital());s.setFormatoFisico(request.formatoFisico());
        s.setCopiaSimple(request.copiaSimple());s.setCopiaCertificada(request.copiaCertificada());
        s.setConsentimientoDatosPersonales(true);s.setCanalNotificacion(Solicitud.CanalNotificacion.valueOf(request.canalNotificacion()));
        s.setEstado(Solicitud.EstadoSolicitud.RECEPCIONADA);s.setPrioridad(Solicitud.Prioridad.MEDIA);
        s=solicitudes.save(s);
        AltaSaipRecepcion r=new AltaSaipRecepcion();r.setSolicitud(s);r.setCreadoPor(actor);r.setClaveOperacion(request.claveOperacion().toString());
        r.setHuellaSolicitud(huella);r.setDeclaraVeracidad(true);r.setFechaRecepcion(s.getFechaPresentacion());
        for(int i=0;i<files.size();i++) {
            DocumentoMetadataDTO doc=documentos.subir(files.get(i),new DocumentoUploadRequest(
                Documento.TipoDocumento.valueOf(tipos.get(i)),s.getId(),null,null,null,null,null));
            Archivo esperado=manifest.get(i);
            if(!esperado.hash().equals(doc.hashSha256()) || esperado.size()!=doc.sizeBytes())
                throw new ConflictoEstadoException("Los bytes almacenados no coinciden con el archivo presentado");
            r.getDocumentoIds().add(doc.id());
        }
        recepciones.saveAndFlush(r);em.refresh(r);em.refresh(s);
        for(Long id:r.getDocumentoIds())em.refresh(em.getReference(Documento.class,id));
        return dto(r);
    }

    @Transactional(readOnly=true)
    public AltaSaipRecepcionDTO obtener(UUID clave) {
        Usuario actor=actorCiudadano();
        AltaSaipRecepcion r=recepciones.findByClaveOperacion(clave.toString())
            .orElseThrow(() -> new RecursoNoEncontradoException("No se ha confirmado recepción para esta operación"));
        verificarActor(r,actor);autorizacion.verificarSolicitudAccesible(r.getSolicitud().getId());return dto(r);
    }
    private Usuario actorCiudadano() {
        Usuario actor=autorizacion.obtenerUsuarioActual();
        if(actor.getTipoUsuario()!=Usuario.TipoUsuario.CIUDADANO)throw new AccessDeniedException("Esta operación requiere la identidad ciudadana autenticada");
        return actor;
    }
    private void verificarActor(AltaSaipRecepcion r,Usuario actor) {
        if(!r.getCreadoPor().getIdUsuario().equals(actor.getIdUsuario()))throw new AccessDeniedException("La recepción corresponde a otra identidad");
    }
    private AltaSaipRecepcionDTO dto(AltaSaipRecepcion r) {
        if(!r.getSolicitud().getCiudadano().getId().equals(r.getCreadoPor().getIdUsuario()))
            throw new ConflictoEstadoException("La solicitud no corresponde a la identidad de recepción");
        List<DocumentoMetadataDTO> manifest=new ArrayList<>();
        for(Long id:r.getDocumentoIds()) {
            DocumentoMetadataDTO d;
            try {d=documentos.obtenerMetadataDisponible(id);}
            catch(StorageException | RecursoNoEncontradoException e) {
                throw new StorageException(StorageException.Reason.IO_ERROR,"La recepción existe pero un archivo no está disponible. No repita el alta",e);
            }
            if(!r.getSolicitud().getId().equals(d.solicitudId()) || d.respuestaId()!=null || d.apelacionId()!=null
                    || d.resolucionId()!=null || d.expedienteTtaipId()!=null || d.cedulaNotificacionId()!=null
                    || d.tipoDocumento()==null || !Set.of("SOLICITUD_ORIGINAL","DOCUMENTO_ADJUNTO").contains(d.tipoDocumento()))
                throw new ConflictoEstadoException("Un documento no corresponde a la recepción de alta");
            manifest.add(d);
        }
        return new AltaSaipRecepcionDTO(r.getId(),r.getClaveOperacion(),r.getFechaRecepcion(),r.getDeclaraVeracidad(),
            SolicitudDTO.from(r.getSolicitud()),List.copyOf(manifest));
    }
    private record Archivo(long size,String hash) {}
    private String huella(Long actor,RegistrarAltaSaipRequest r,List<MultipartFile> files,List<String> tipos,List<Archivo> manifest) {
        try {
            MessageDigest digest=MessageDigest.getInstance("SHA-256");
            for(String value:new String[]{"saip:alta:v1",actor.toString(),r.entidadId().toString(),r.asunto().trim(),r.descripcion().trim(),texto(r.tipoInformacion()),
                    String.valueOf(r.formatoDigital()),String.valueOf(r.formatoFisico()),String.valueOf(r.copiaSimple()),String.valueOf(r.copiaCertificada()),
                    String.valueOf(r.consentimientoDatosPersonales()),String.valueOf(r.declaraVeracidad()),r.canalNotificacion(),String.valueOf(files.size())})campo(digest,value);
            for(int i=0;i<files.size();i++) {
                MultipartFile f=files.get(i);
                if(f==null || f.isEmpty() || f.getSize()>maxFileSize)throw new IllegalArgumentException("Adjunte archivos no vacíos dentro del tamaño permitido");
                MessageDigest bytes=MessageDigest.getInstance("SHA-256");long total=0;
                try(InputStream in=f.getInputStream()){byte[] buffer=new byte[8192];int n;while((n=in.read(buffer))!=-1){
                    total+=n;if(total>maxFileSize)throw new IllegalArgumentException("El archivo supera el tamaño permitido");bytes.update(buffer,0,n);}}
                if(total!=f.getSize())throw new IllegalArgumentException("Tamaño de archivo inconsistente");
                String hash=HexFormat.of().formatHex(bytes.digest());manifest.add(new Archivo(total,hash));
                for(String value:new String[]{tipos.get(i),f.getOriginalFilename(),f.getContentType(),Long.toString(total),hash})campo(digest,value);
            }
            return "saip:alta:v1:"+HexFormat.of().formatHex(digest.digest());
        }catch(IOException e){throw new StorageException(StorageException.Reason.IO_ERROR,"No se pudieron leer los archivos de la operación",e);}
        catch(NoSuchAlgorithmException e){throw new IllegalStateException("SHA-256 no disponible",e);}
    }
    private String texto(String s){return s==null || s.isBlank()?null:s.trim();}
    private void campo(MessageDigest digest,String value){byte[] bytes=value==null?new byte[0]:value.getBytes(StandardCharsets.UTF_8);
        digest.update(ByteBuffer.allocate(4).putInt(value==null?-1:bytes.length).array());digest.update(bytes);}
}
