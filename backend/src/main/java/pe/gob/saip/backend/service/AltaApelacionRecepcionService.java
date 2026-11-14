package pe.gob.saip.backend.service;

import java.io.*;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.validation.Validator;
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

/** Coordinates only citizen creation; subsequent TTAIP commands retain their own preconditions. */
@Service
public class AltaApelacionRecepcionService {
    private final AltaApelacionRecepcionRepository recepciones;
    private final ApelacionService apelaciones;
    private final SolicitudService solicitudes;
    private final ElevacionApelacionTtaipService elevaciones;
    private final ExpedienteTtaipService expedientes;
    private final AutorizacionRecursosService autorizacion;
    private final DocumentoService documentos;
    private final CiudadanoRepository ciudadanos;
    private final EntityManager em;
    private final Validator validator;
    private final long maxFileSize;

    public AltaApelacionRecepcionService(AltaApelacionRecepcionRepository recepciones,ApelacionService apelaciones,
            SolicitudService solicitudes,ElevacionApelacionTtaipService elevaciones,ExpedienteTtaipService expedientes,
            AutorizacionRecursosService autorizacion,DocumentoService documentos,CiudadanoRepository ciudadanos,
            EntityManager em,Validator validator,StorageProperties properties) {
        this.recepciones=recepciones;this.apelaciones=apelaciones;this.solicitudes=solicitudes;this.elevaciones=elevaciones;
        this.expedientes=expedientes;this.autorizacion=autorizacion;this.documentos=documentos;this.ciudadanos=ciudadanos;
        this.em=em;this.validator=validator;this.maxFileSize=properties.getMaxFileSize();
    }

    @Transactional
    public AltaApelacionRecepcionDTO registrar(RegistrarAltaApelacionRequest request,List<MultipartFile> files) {
        Usuario actor=actor();
        List<Archivo> manifest=preparar(request,files);
        String huella=huella(actor.getIdUsuario(),request,manifest);
        apelaciones.bloquearAlta();
        var anterior=recepciones.findByClaveOperacion(request.claveOperacion().toString());
        if(anterior.isPresent()) {
            verificarActor(anterior.get(),actor);
            if(!huella.equals(anterior.get().getHuellaSolicitud())) throw new ConflictoEstadoException("La clave de operación tiene otro contenido recibido");
            return dto(anterior.get());
        }
        Solicitud solicitud=null;
        if(!"EXTERNA".equals(request.modalidad())) {
            solicitud=solicitudes.bloquearSolicitud(request.solicitudId());
            autorizacion.verificarSolicitudAccesible(solicitud.getId());
            if(!solicitud.getCiudadano().getId().equals(actor.getIdUsuario())) throw new AccessDeniedException("La SAIP no pertenece al recurrente");
            if(solicitud.getApelacion()!=null) throw new ConflictoEstadoException("La solicitud ya tiene una apelación asociada");
            if(manifest.stream().noneMatch(d->"SOLICITUD_ORIGINAL".equals(d.tipo()))) throw new IllegalArgumentException("Adjunte la copia real de la SAIP original");
            if(solicitud.getRespuesta()!=null && solicitud.getRespuesta().getTipoRespuesta()!=Respuesta.TipoRespuesta.SILENCIO_ADMINISTRATIVO
                    && manifest.stream().noneMatch(d->"RESPUESTA_ENTIDAD".equals(d.tipo())))
                throw new IllegalArgumentException("Adjunte la respuesta de la entidad o seleccione su antecedente");
        }
        for(Archivo archivo:manifest) if(archivo.origenId()!=null) verificarOrigen(archivo,solicitud);
        Apelacion apelacion;
        if("EXTERNA".equals(request.modalidad())) {
            var externa=externa(request,actor.getIdUsuario()); validar(externa);
            apelacion=apelaciones.crearExterna(externa);
        } else if("ANTE_ENTIDAD".equals(request.modalidad())) {
            var ante=new CrearApelacionAnteEntidadRequest(request.solicitudId(),actor.getIdUsuario(),request.fundamentos(),
                request.fechaPresentacionAnteEntidad(),request.referenciaCargoPresentacion(),request.observacion());
            validar(ante);apelacion=elevaciones.registrarPresentacionAnteEntidad(ante);
        } else {
            apelacion=new Apelacion();apelacion.setSolicitud(solicitud);apelacion.setTipoOrigen(Apelacion.TipoOrigenApelacion.SAIP_INTERNA);
            apelacion.setCiudadano(ciudadanos.findById(actor.getIdUsuario()).orElseThrow(()->new AccessDeniedException("Ciudadano no disponible")));
            apelacion.setFundamentos(request.fundamentos().trim());apelacion.setEstado(Apelacion.EstadoApelacion.EN_CALIFICACION_1);
            apelacion=apelaciones.save(apelacion);solicitud.setApelacion(apelacion);
        }
        if(!"ANTE_ENTIDAD".equals(request.modalidad())) expedientes.obtenerOCrearParaApelacion(apelacion);
        AltaApelacionRecepcion receipt=new AltaApelacionRecepcion();receipt.setApelacion(apelacion);receipt.setCreadoPor(actor);
        receipt.setClaveOperacion(request.claveOperacion().toString());receipt.setHuellaSolicitud(huella);
        receipt.setModalidad(request.modalidad());receipt.setFechaRecepcion(apelacion.getFechaApelacion());
        for(Archivo archivo:manifest) {
            var relacion=new DocumentoUploadRequest(Documento.TipoDocumento.valueOf(archivo.tipo()),null,null,apelacion.getId(),null,null,null);
            DocumentoMetadataDTO doc=archivo.origenId()==null?documentos.subir(archivo.file(),relacion):documentos.clonar(archivo.origenId(),relacion);
            if(!archivo.hash().equals(doc.hashSha256()) || archivo.size()!=doc.sizeBytes())
                throw new ConflictoEstadoException("Los bytes almacenados no coinciden con la versión presentada");
            receipt.getDocumentos().add(new AltaApelacionRecepcion.Archivo(doc.id(),archivo.origenId(),archivo.hash()));
        }
        recepciones.saveAndFlush(receipt);
        // Reload DB precision and inverse collections (including the actual opening history).
        Long id=receipt.getId();em.clear();
        return dto(recepciones.findById(id).orElseThrow());
    }

    @Transactional(readOnly=true)
    public AltaApelacionRecepcionDTO obtener(UUID clave) {
        Usuario actor=actor();
        var receipt=recepciones.findByClaveOperacion(clave.toString()).orElseThrow(()->new RecursoNoEncontradoException("No hay recepción confirmada para esta operación"));
        verificarActor(receipt,actor);return dto(receipt);
    }
    private Usuario actor() {
        Usuario actor=autorizacion.obtenerUsuarioActual();
        if(actor.getTipoUsuario()!=Usuario.TipoUsuario.CIUDADANO) throw new AccessDeniedException("La operación requiere la identidad ciudadana autenticada");
        return actor;
    }
    private void verificarActor(AltaApelacionRecepcion r,Usuario actor) {
        if(!r.getCreadoPor().getIdUsuario().equals(actor.getIdUsuario())) throw new AccessDeniedException("La recepción corresponde a otra identidad");
    }
    private AltaApelacionRecepcionDTO dto(AltaApelacionRecepcion receipt) {
        Apelacion a=receipt.getApelacion();autorizacion.verificarApelacionAccesible(a);
        if(!a.getCiudadano().getId().equals(receipt.getCreadoPor().getIdUsuario())) throw new ConflictoEstadoException("La recepción no corresponde al recurrente");
        List<AltaApelacionDocumentoDTO> manifest=new ArrayList<>();
        for(var archivo:receipt.getDocumentos()) {
            DocumentoMetadataDTO d;
            try {d=documentos.obtenerMetadataDisponible(archivo.getDocumentoId());}
            catch(StorageException|RecursoNoEncontradoException e){throw new StorageException(StorageException.Reason.IO_ERROR,"La recepción existe pero un archivo no está disponible; no repita el alta",e);}
            if(!a.getId().equals(d.apelacionId()) || d.solicitudId()!=null || d.respuestaId()!=null || d.resolucionId()!=null
                    || d.expedienteTtaipId()!=null || d.cedulaNotificacionId()!=null || !archivo.getHash().equals(d.hashSha256()))
                throw new ConflictoEstadoException("Documento incompatible con el manifiesto de recepción");
            manifest.add(new AltaApelacionDocumentoDTO(d,archivo.getOrigenId(),archivo.getHash()));
        }
        return new AltaApelacionRecepcionDTO(receipt.getId(),receipt.getClaveOperacion(),receipt.getModalidad(),receipt.getFechaRecepcion(),ApelacionDTO.from(a),List.copyOf(manifest));
    }
    private void verificarOrigen(Archivo archivo,Solicitud solicitud) {
        if(solicitud==null) throw new IllegalArgumentException("La apelación externa no admite antecedentes de una SAIP local");
        Documento source=em.find(Documento.class,archivo.origenId(),LockModeType.PESSIMISTIC_READ);
        if(source==null) throw new RecursoNoEncontradoException("Antecedente no encontrado");
        em.refresh(source);
        var d=documentos.obtenerMetadataDisponible(archivo.origenId());
        boolean sinOtras=d.apelacionId()==null && d.expedienteTtaipId()==null && d.resolucionId()==null && d.cedulaNotificacionId()==null;
        boolean original=Set.of("SOLICITUD_ORIGINAL","DOCUMENTO_ADJUNTO").contains(archivo.tipo()) && archivo.tipo().equals(d.tipoDocumento())
            && solicitud.getId().equals(d.solicitudId()) && d.respuestaId()==null;
        boolean respuesta="RESPUESTA_ENTIDAD".equals(archivo.tipo()) && "RESPUESTA_ENTIDAD".equals(d.tipoDocumento())
            && d.solicitudId()==null && solicitud.getRespuesta()!=null && solicitud.getRespuesta().getId().equals(d.respuestaId());
        if(!sinOtras || !(original||respuesta)) throw new ConflictoEstadoException("El antecedente no corresponde a la SAIP o respuesta de origen");
        if(!archivo.hash().equals(d.hashSha256())) throw new ConflictoEstadoException("La versión seleccionada del antecedente cambió");
        archivo.size=d.sizeBytes();archivo.nombre=d.nombreOriginal();archivo.mime=d.contentType();
    }
    private static final class Archivo {
        final String tipo,hash;final Long origenId;final MultipartFile file;long size;String nombre,mime;
        Archivo(String tipo,String hash,Long origenId,MultipartFile file,long size,String nombre,String mime){this.tipo=tipo;this.hash=hash;this.origenId=origenId;this.file=file;this.size=size;this.nombre=nombre;this.mime=mime;}
        String tipo(){return tipo;}String hash(){return hash;}Long origenId(){return origenId;}MultipartFile file(){return file;}long size(){return size;}
    }
    private List<Archivo> preparar(RegistrarAltaApelacionRequest r,List<MultipartFile> files) {
        boolean externa="EXTERNA".equals(r.modalidad()),ante="ANTE_ENTIDAD".equals(r.modalidad());
        if(externa ? r.solicitudId()!=null : r.solicitudId()==null) throw new IllegalArgumentException("Identifique el origen de esta modalidad sin mezclar SAIP local y externa");
        if(!externa && (r.entidadId()!=null || r.entidadExternaNombre()!=null || r.entidadExternaRuc()!=null || r.entidadExternaEmail()!=null
                || r.numeroSolicitudExterna()!=null || r.fechaPresentacionSolicitudExterna()!=null || r.fechaRespuestaEntidad()!=null || r.tipoDenegatoria()!=null
                || r.resumenSolicitudOriginal()!=null || r.resumenRespuestaEntidad()!=null || r.referenciaDocumentoSolicitud()!=null || r.referenciaCargoRecepcion()!=null
                || r.referenciaRespuestaEntidad()!=null || r.evidenciaSilencioAdministrativo()!=null)) throw new IllegalArgumentException("Campos externos no permitidos para una SAIP vinculada");
        if(!ante && (r.fechaPresentacionAnteEntidad()!=null || r.referenciaCargoPresentacion()!=null || !externa && r.observacion()!=null))
            throw new IllegalArgumentException("El cargo ante entidad no corresponde a esta modalidad");
        if(externa && r.entidadId()!=null && (r.entidadExternaNombre()!=null || r.entidadExternaRuc()!=null || r.entidadExternaEmail()!=null))
            throw new IllegalArgumentException("No mezcle entidad del catálogo y entidad declarada");
        List<Archivo> manifest=new ArrayList<>();int index=0;
        for(var d:r.documentos()) {
            if(d==null) throw new IllegalArgumentException("Documento inválido");
            if(d.origenId()!=null) {
                if(d.hashOrigen()==null || externa) throw new IllegalArgumentException("El antecedente requiere versión y SAIP local");
                manifest.add(new Archivo(d.tipoDocumento(),d.hashOrigen(),d.origenId(),null,0,null,null));
            } else {
                if(d.hashOrigen()!=null || index>=files.size()) throw new IllegalArgumentException("Manifiesto y archivos incompatibles");
                MultipartFile file=files.get(index++);
                if(file==null || file.isEmpty() || file.getSize()>maxFileSize) throw new IllegalArgumentException("Adjunte archivos no vacíos dentro del tamaño permitido");
                manifest.add(new Archivo(d.tipoDocumento(),hash(file),null,file,file.getSize(),file.getOriginalFilename(),file.getContentType()));
            }
        }
        if(index!=files.size()) throw new IllegalArgumentException("Todos los archivos deben figurar en el manifiesto");
        if(manifest.stream().filter(d->d.origenId()!=null).map(Archivo::origenId).distinct().count()!=manifest.stream().filter(d->d.origenId()!=null).count())
            throw new IllegalArgumentException("No repita un antecedente en el manifiesto");
        return manifest;
    }
    private CrearApelacionExternaRequest externa(RegistrarAltaApelacionRequest r,Long actor){return new CrearApelacionExternaRequest(actor,r.entidadId(),r.entidadExternaNombre(),r.entidadExternaRuc(),r.entidadExternaEmail(),r.numeroSolicitudExterna(),r.fechaPresentacionSolicitudExterna(),r.fechaRespuestaEntidad(),r.tipoDenegatoria(),r.resumenSolicitudOriginal(),r.resumenRespuestaEntidad(),r.referenciaDocumentoSolicitud(),r.referenciaCargoRecepcion(),r.referenciaRespuestaEntidad(),r.evidenciaSilencioAdministrativo(),r.fundamentos(),r.observacion());}
    private void validar(Object request) {if(!validator.validate(request).isEmpty()) throw new IllegalArgumentException("Complete los datos y límites de la modalidad seleccionada");}
    private String huella(Long actor,RegistrarAltaApelacionRequest r,List<Archivo> manifest) {
        MessageDigest md=digest();campo(md,"ttaip:alta:v1");campo(md,actor);
        for(var component:RegistrarAltaApelacionRequest.class.getRecordComponents()) {
            if(Set.of("claveOperacion","documentos").contains(component.getName()))continue;
            try{Object value=component.getAccessor().invoke(r);campo(md,value instanceof String s?s.trim():value);}catch(ReflectiveOperationException e){throw new IllegalStateException(e);}
        }
        campo(md,manifest.size());
        for(Archivo d:manifest){campo(md,d.tipo);campo(md,d.origenId);campo(md,d.hash);
            if(d.origenId==null){campo(md,d.nombre);campo(md,d.mime);campo(md,d.size);}}
        return "ttaip:alta:v1:"+HexFormat.of().formatHex(md.digest());
    }
    private String hash(MultipartFile file) {
        MessageDigest md=digest();long total=0;
        try(InputStream in=file.getInputStream()){byte[] buffer=new byte[8192];int n;while((n=in.read(buffer))!=-1){total+=n;if(total>maxFileSize)throw new IllegalArgumentException("Archivo demasiado grande");md.update(buffer,0,n);}}
        catch(IOException e){throw new StorageException(StorageException.Reason.IO_ERROR,"No se pudieron leer los archivos",e);}
        if(total!=file.getSize())throw new IllegalArgumentException("Tamaño de archivo inconsistente");return HexFormat.of().formatHex(md.digest());
    }
    private MessageDigest digest(){try{return MessageDigest.getInstance("SHA-256");}catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}}
    private void campo(MessageDigest md,Object value){String text=value==null?null:value.toString();byte[] b=text==null?new byte[0]:text.getBytes(StandardCharsets.UTF_8);md.update(ByteBuffer.allocate(4).putInt(text==null?-1:b.length).array());md.update(b);}
}
